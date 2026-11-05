import { recordAudit, SYSTEM_ACTOR } from "@/lib/audit/record";
import { isValidStorageRef, ORIGINAL_BUCKET, ORIGINAL_PATH, UUID, VARIANT_BUCKET, VARIANT_PATH, type StorageObjectRef } from "@/lib/images/upload";
import { prisma } from "@/lib/prisma/client";
import { drainStorageDeletions, enqueueStorageDeletions } from "./storage-queue";

const MIN_AGE_MS = 24 * 3_600_000;
// Aborta quando mais de 20% dos objetos parecem órfãos (orphans / total > 1/5).
const MAX_ORPHAN_RATIO = 5;
// Acha caminhos de imagem dentro de URLs públicas ou caminhos crus, em qualquer string.
const PATH_IN_TEXT = new RegExp(`(?:originals|variants)/(${UUID})/(${UUID})(?:-(?:thumb|card|detail|og)\.webp|-og\.jpg)?`, "gi");

export function imageStem(path: string): string | null {
  const match = ORIGINAL_PATH.exec(path) ?? VARIANT_PATH.exec(path);
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : null;
}

type SweepObject = StorageObjectRef & { createdAt: Date };
export type SweepPlan =
  | { kind: "ok"; orphans: StorageObjectRef[] }
  | { kind: "aborted"; reason: "too_many_orphans"; orphanCount: number };

export function planOrphanSweep(input: {
  objects: { bucket: string; path: string; createdAt: Date }[];
  referencedStems: Set<string>;
  referencedPaths: Set<string>;
  now: Date;
}): SweepPlan {
  const cutoff = input.now.getTime() - MIN_AGE_MS;
  const orphans: StorageObjectRef[] = [];
  for (const { bucket, path, createdAt } of input.objects) {
    if (!isValidStorageRef({ bucket, path })) continue;
    const stem = imageStem(path);
    if (!stem || input.referencedStems.has(stem) || input.referencedPaths.has(path)) continue;
    // Data inválida (NaN) falha a comparação: conta como recente.
    if (!(createdAt.getTime() < cutoff)) continue;
    orphans.push({ bucket, path } as StorageObjectRef);
  }
  if (orphans.length * MAX_ORPHAN_RATIO > input.objects.length) {
    return { kind: "aborted", reason: "too_many_orphans", orphanCount: orphans.length };
  }
  return { kind: "ok", orphans };
}

export async function collectReferences(): Promise<{ referencedStems: Set<string>; referencedPaths: Set<string> }> {
  const referencedStems = new Set<string>();
  const referencedPaths = new Set<string>();
  const scan = (value: unknown): void => {
    if (typeof value === "string") {
      for (const match of value.matchAll(PATH_IN_TEXT)) {
        referencedPaths.add(match[0]);
        referencedStems.add(`${match[1]}/${match[2]}`.toLowerCase());
      }
    } else if (Array.isArray(value)) value.forEach(scan);
    else if (value && typeof value === "object") Object.values(value).forEach(scan);
  };
  // Sem filtro de deletedAt: item na lixeira ainda referencia seus arquivos.
  const [images, categories, products, settings, queue] = await Promise.all([
    prisma.productImage.findMany({ select: { storagePath: true, thumbUrl: true, cardUrl: true, detailUrl: true, ogUrl: true } }),
    prisma.category.findMany({ select: { coverImageUrl: true, coverStoragePath: true, coverOgUrl: true, description: true, fieldsSchema: true } }),
    prisma.product.findMany({ select: { description: true, attributes: true } }),
    prisma.storeSetting.findMany({ select: { value: true } }),
    prisma.storageDeletion.findMany({ select: { bucket: true, path: true } }),
  ]);
  for (const rows of [images, categories, products, settings]) rows.forEach(scan);
  for (const { path } of queue) {
    referencedPaths.add(path);
    const stem = imageStem(path);
    if (stem) referencedStems.add(stem);
  }
  return { referencedStems, referencedPaths };
}

export async function runOrphanSweep(now: Date): Promise<{ removed: number; aborted: boolean }> {
  const { referencedStems, referencedPaths } = await collectReferences();
  const rows = await prisma.$queryRaw<{ bucket_id: string; name: string | null; created_at: Date | null }[]>`
    SELECT bucket_id, name, created_at FROM storage.objects WHERE bucket_id IN (${ORIGINAL_BUCKET}, ${VARIANT_BUCKET})`;
  // Data nula = não sabemos a idade: tratada como agora (recente).
  const objects: SweepObject[] = rows.map((row) => ({ bucket: row.bucket_id as SweepObject["bucket"], path: row.name ?? "", createdAt: row.created_at ?? now }));
  const plan = planOrphanSweep({ objects, referencedStems, referencedPaths, now });
  if (plan.kind === "aborted") {
    console.error("Orphan sweep aborted", { reason: plan.reason, orphanCount: plan.orphanCount });
    return { removed: 0, aborted: true };
  }
  if (!plan.orphans.length) return { removed: 0, aborted: false };
  await prisma.$transaction(async (tx) => {
    await enqueueStorageDeletions(tx, plan.orphans);
    await recordAudit(tx, SYSTEM_ACTOR, {
      entityType: "system", entityId: "orphan-sweep", entityLabel: "Varredura de imagens órfãs", action: "orphan_sweep",
      after: { count: plan.orphans.length, objects: plan.orphans },
    });
  });
  const { removed } = await drainStorageDeletions({ paths: plan.orphans, limit: plan.orphans.length });
  return { removed, aborted: false };
}
