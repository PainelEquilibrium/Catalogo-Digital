import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { StorageObjectRef } from "@/lib/images/upload";

const MAX_ATTEMPTS = 5;

export async function enqueueStorageDeletions(tx: Prisma.TransactionClient, objects: StorageObjectRef[]): Promise<void> {
  for (const { bucket, path } of objects) {
    await tx.storageDeletion.upsert({ where: { bucket_path: { bucket, path } }, create: { bucket, path }, update: {} });
  }
}

// Storage remove em lote só devolve os objetos que existiam e não dá erro para os ausentes;
// 404/NoSuchKey explícito também conta como removido.
function isMissing(error: { statusCode?: string | number; message?: string }): boolean {
  return String(error.statusCode) === "404" || /NoSuchKey/i.test(error.message ?? "");
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
  for (const bucket of [...new Set(rows.map((row) => row.bucket))]) {
    const batch = rows.filter((row) => row.bucket === bucket);
    const ids = batch.map((row) => row.id);
    let message: string | null = null;
    try {
      const { error } = await supabase.storage.from(bucket).remove(batch.map((row) => row.path));
      if (error && !isMissing(error)) message = error.message || "Storage error";
    } catch (error) {
      message = error instanceof Error ? error.message : "Storage error";
    }
    if (message === null) {
      await prisma.storageDeletion.deleteMany({ where: { id: { in: ids } } });
      removed += batch.length;
      continue;
    }
    await prisma.storageDeletion.updateMany({ where: { id: { in: ids } }, data: { attempts: { increment: 1 }, lastError: message } });
    failed += batch.length;
    if (batch.some((row) => row.attempts + 1 >= MAX_ATTEMPTS)) {
      console.error("Storage deletion stuck", { bucket, count: batch.filter((row) => row.attempts + 1 >= MAX_ATTEMPTS).length });
    }
  }
  return { removed, failed };
}
