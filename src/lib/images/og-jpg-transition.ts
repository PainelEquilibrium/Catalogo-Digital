import type { PrismaClient } from "@/generated/prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueStorageDeletions } from "@/lib/maintenance/storage-queue";
import { processImageBuffer } from "./process-image-buffer";
import { isValidStorageRef, ORIGINAL_BUCKET, ORIGINAL_PATH, VARIANT_BUCKET } from "./upload";

export type OgJpgReport = { eligible: number; converted: number; skipped: number; failed: number };
type Deps = { prisma: PrismaClient; storage: SupabaseClient; apply: boolean };
type Target = { kind: "product" | "category"; id: string; storagePath: string | null; ogUrl: string | null };

const PAGE = 100;
const PUBLIC_OBJECT = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

// Ordem: upload do JPG, update + fila do WebP antigo na mesma transação. Sem rollback de arquivos antigos:
// o WebP só sai pela fila depois do update.
async function convert(deps: Deps, row: Target, match: RegExpExecArray): Promise<void> {
  const { prisma, storage } = deps;
  const original = await storage.storage.from(ORIGINAL_BUCKET).download(row.storagePath!);
  if (original.error || !original.data) throw new Error("Original unavailable");
  const { og } = await processImageBuffer(Buffer.from(await original.data.arrayBuffer()));
  const path = `variants/${match[1]}/${match[2]}-og.jpg`;
  const bucket = storage.storage.from(VARIANT_BUCKET);
  const up = await bucket.upload(path, og, { contentType: "image/jpeg", upsert: false });
  // Objeto já existente (execução anterior interrompida) é determinístico: reaproveita e não remove em falha.
  const created = !up.error;
  if (up.error && !/exists|duplicate/i.test(up.error.message)) throw new Error("Upload failed");
  const url = bucket.getPublicUrl(path).data.publicUrl;
  try {
    const old = PUBLIC_OBJECT.exec(row.ogUrl ?? "");
    const oldRef = old && { bucket: old[1] as typeof VARIANT_BUCKET, path: old[2] };
    await prisma.$transaction(async (tx) => {
      const where = { id: row.id, [row.kind === "product" ? "ogUrl" : "coverOgUrl"]: row.ogUrl };
      const { count } = row.kind === "product"
        ? await tx.productImage.updateMany({ where, data: { ogUrl: url } })
        : await tx.category.updateMany({ where, data: { coverOgUrl: url } });
      if (count !== 1) throw new Error("Record changed");
      if (oldRef && isValidStorageRef(oldRef)) await enqueueStorageDeletions(tx, [oldRef]);
    });
  } catch (error) {
    if (created) await bucket.remove([path]).catch(() => {});
    throw error;
  }
}

export async function runOgJpgTransition(deps: Deps): Promise<OgJpgReport> {
  const report: OgJpgReport = { eligible: 0, converted: 0, skipped: 0, failed: 0 };
  const handle = async (row: Target) => {
    const match = ORIGINAL_PATH.exec(row.storagePath ?? "");
    if (!match || row.ogUrl?.endsWith(".jpg")) { report.skipped++; return; }
    report.eligible++;
    if (!deps.apply) return;
    try { await convert(deps, row, match); report.converted++; }
    catch { report.failed++; }
  };
  for (let cursor: string | undefined; ;) {
    const rows = await deps.prisma.productImage.findMany({ take: PAGE, orderBy: { id: "asc" }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, storagePath: true, ogUrl: true } });
    for (const r of rows) await handle({ kind: "product", ...r });
    if (rows.length < PAGE) break;
    cursor = rows[rows.length - 1].id;
  }
  for (let cursor: string | undefined; ;) {
    const rows = await deps.prisma.category.findMany({ where: { coverStoragePath: { not: null } }, take: PAGE, orderBy: { id: "asc" }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, coverStoragePath: true, coverOgUrl: true } });
    for (const r of rows) await handle({ kind: "category", id: r.id, storagePath: r.coverStoragePath, ogUrl: r.coverOgUrl });
    if (rows.length < PAGE) break;
    cursor = rows[rows.length - 1].id;
  }
  return report;
}
