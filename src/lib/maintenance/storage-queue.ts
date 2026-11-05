import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isValidStorageRef, type StorageObjectRef } from "@/lib/images/upload";

const MAX_ATTEMPTS = 5;

export async function enqueueStorageDeletions(tx: Prisma.TransactionClient, objects: StorageObjectRef[]): Promise<void> {
  if (!objects.length) return;
  await tx.storageDeletion.createMany({ data: objects.map(({ bucket, path }) => ({ bucket, path })), skipDuplicates: true });
}

// Só o sinal explícito de objeto inexistente (storage-js: error.code "NoSuchKey") conta como removido.
// 404 genérico, como "Bucket not found", é ambíguo: a linha fica na fila.
function isMissing(error: { code?: string; message?: string }): boolean {
  return error.code === "NoSuchKey" || /NoSuchKey/i.test(error.message ?? "");
}

export async function drainStorageDeletions(input: { paths?: StorageObjectRef[]; limit?: number } = {}): Promise<{ removed: number; failed: number }> {
  const rows = await prisma.storageDeletion.findMany({
    where: input.paths ? { OR: input.paths.map(({ bucket, path }) => ({ bucket, path })) } : undefined,
    orderBy: { createdAt: "asc" },
    take: input.limit ?? 500,
  });
  if (!rows.length) return { removed: 0, failed: 0 };
  const supabase = createAdminSupabase();
  let removed = 0;
  let failed = 0;
  const fail = async (batch: typeof rows, bucket: string, message: string) => {
    failed += batch.length;
    try {
      await prisma.storageDeletion.updateMany({ where: { id: { in: batch.map((row) => row.id) } }, data: { attempts: { increment: 1 }, lastError: message } });
    } catch {
      console.error("Storage deletion bookkeeping failed", { bucket, count: batch.length });
    }
    const stuck = batch.filter((row) => row.attempts + 1 >= MAX_ATTEMPTS).length;
    if (stuck) console.error("Storage deletion stuck", { bucket, count: stuck });
  };
  // Linha fora do padrão de imagem nunca vai ao Storage (a chave de serviço ignora RLS).
  const invalid = rows.filter((row) => !isValidStorageRef(row));
  if (invalid.length) {
    console.error("Storage deletion rejected: invalid reference", { count: invalid.length });
    await fail(invalid, "invalid", "Invalid storage reference");
  }
  const valid = rows.filter((row) => !invalid.includes(row));
  for (const bucket of [...new Set(valid.map((row) => row.bucket))]) {
    const batch = valid.filter((row) => row.bucket === bucket);
    let message: string | null = null;
    try {
      const { error } = await supabase.storage.from(bucket).remove(batch.map((row) => row.path));
      if (error && !isMissing(error)) message = error.message || "Storage error";
      if (message === null) {
        await prisma.storageDeletion.deleteMany({ where: { id: { in: batch.map((row) => row.id) } } });
        removed += batch.length;
        continue;
      }
    } catch (error) {
      message = error instanceof Error ? error.message : "Storage error";
    }
    await fail(batch, bucket, message);
  }
  return { removed, failed };
}
