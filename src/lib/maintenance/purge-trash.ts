import type { AuditActor } from "@/lib/audit/record";
import { recordAudit, SYSTEM_ACTOR } from "@/lib/audit/record";
import { storageObjectsForPersistedImage, type StorageObjectRef } from "@/lib/images/upload";
import { prisma } from "@/lib/prisma/client";
import { drainStorageDeletions, enqueueStorageDeletions } from "./storage-queue";

export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

export function daysUntilPurge(deletedAt: Date, now: Date): number {
  const elapsed = Math.floor((now.getTime() - deletedAt.getTime()) / DAY_MS);
  return Math.max(0, TRASH_RETENTION_DAYS - elapsed);
}

// Lançado dentro da transação para desfazer tudo quando outra execução já apagou o item.
class NotInTrash extends Error {}

// Falha ao drenar não desfaz o purge: as linhas ficam na fila para a tarefa diária.
async function drainQuietly(objects: StorageObjectRef[]): Promise<void> {
  if (!objects.length) return;
  try {
    await drainStorageDeletions({ paths: objects });
  } catch {
    console.error("Purge storage cleanup pending", { count: objects.length });
  }
}

export async function purgeProduct(id: string, actor: AuditActor): Promise<"purged" | "not_in_trash"> {
  let objects: StorageObjectRef[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id, deletedAt: { not: null } },
        select: {
          id: true, name: true, slug: true, deletedAt: true,
          images: { select: { storagePath: true, thumbUrl: true, cardUrl: true, detailUrl: true, ogUrl: true } },
        },
      });
      if (!product) throw new NotInTrash();
      objects = product.images.flatMap((image) => storageObjectsForPersistedImage(image.storagePath, {
        thumb: image.thumbUrl, card: image.cardUrl, detail: image.detailUrl, og: image.ogUrl,
      }));
      // ProductImage tem onDelete: Restrict, então as imagens saem antes do produto.
      await tx.productImage.deleteMany({ where: { productId: id } });
      const { count } = await tx.product.deleteMany({ where: { id, deletedAt: { not: null } } });
      if (!count) throw new NotInTrash();
      await enqueueStorageDeletions(tx, objects);
      await recordAudit(tx, actor, {
        entityType: "product", entityId: id, entityLabel: product.name, action: "purge",
        before: { name: product.name, slug: product.slug, deletedAt: product.deletedAt },
      });
    });
  } catch (error) {
    if (error instanceof NotInTrash) return "not_in_trash";
    throw error;
  }
  await drainQuietly(objects);
  return "purged";
}

export async function purgeCategory(id: string, actor: AuditActor): Promise<"purged" | "not_in_trash" | "has_products"> {
  let objects: StorageObjectRef[] = [];
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { id: true, name: true, slug: true, coverStoragePath: true, coverImageUrl: true, deletedAt: true },
      });
      if (!category) throw new NotInTrash();
      // Sem filtro de deletedAt: produto na lixeira também bloqueia.
      if (await tx.product.count({ where: { categoryId: id } })) return "has_products" as const;
      objects = storageObjectsForPersistedImage(category.coverStoragePath, { card: category.coverImageUrl });
      const { count } = await tx.category.deleteMany({ where: { id, deletedAt: { not: null } } });
      if (!count) throw new NotInTrash();
      await enqueueStorageDeletions(tx, objects);
      await recordAudit(tx, actor, {
        entityType: "category", entityId: id, entityLabel: category.name, action: "purge",
        before: { name: category.name, slug: category.slug, deletedAt: category.deletedAt },
      });
      return "purged" as const;
    });
    if (outcome === "has_products") return outcome;
  } catch (error) {
    if (error instanceof NotInTrash) return "not_in_trash";
    throw error;
  }
  await drainQuietly(objects);
  return "purged";
}

type Row = { id: string; deletedAt: Date | null };

// Pagina por cursor (deletedAt, id) pulando o que falhou, até `batchSize` itens saírem ou acabarem os expirados.
// Assim itens que nunca saem (falha persistente) não monopolizam o lote.
async function sweepExpired(
  cutoff: Date,
  batchSize: number,
  find: (where: { AND: object[] }, take: number) => Promise<Row[]>,
  purge: (id: string) => Promise<boolean>,
  onError: (id: string) => void,
): Promise<number> {
  let purged = 0;
  let after: Row | null = null;
  while (purged < batchSize) {
    const and: object[] = [{ deletedAt: { lte: cutoff } }];
    if (after) and.push({ OR: [{ deletedAt: { gt: after.deletedAt } }, { deletedAt: after.deletedAt, id: { gt: after.id } }] });
    const page = await find({ AND: and }, batchSize);
    for (const row of page) {
      after = row;
      try {
        if (await purge(row.id)) purged++;
      } catch {
        onError(row.id);
      }
      if (purged >= batchSize) break;
    }
    if (page.length < batchSize) break;
  }
  return purged;
}

// Produtos antes de categorias: a categoria só sai depois que o último produto dela sai.
// Uma falha isola o item (só o id vai para o log) e conta em `failed`.
export async function purgeExpiredTrash(now: Date, batchSize = 100) {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS);
  const select = { id: true, deletedAt: true };
  const orderBy = [{ deletedAt: "asc" as const }, { id: "asc" as const }];
  const result = { products: 0, categories: 0, blocked: 0, failed: 0 };

  result.products = await sweepExpired(
    cutoff, batchSize,
    (where, take) => prisma.product.findMany({ where, select, orderBy, take }),
    async (id) => (await purgeProduct(id, SYSTEM_ACTOR)) === "purged",
    (id) => { result.failed++; console.error("Purge product failed", { id }); },
  );

  // Sem filtro de deletedAt na relação: produto na lixeira também bloqueia.
  result.categories = await sweepExpired(
    cutoff, batchSize,
    (where, take) => prisma.category.findMany({ where: { ...where, products: { none: {} } }, select, orderBy, take }),
    async (id) => {
      const outcome = await purgeCategory(id, SYSTEM_ACTOR);
      if (outcome === "has_products") result.blocked++; // corrida: ganhou produto após a consulta
      return outcome === "purged";
    },
    (id) => { result.failed++; console.error("Purge category failed", { id }); },
  );
  result.blocked += await prisma.category.count({ where: { deletedAt: { lte: cutoff }, products: { some: {} } } });
  return result;
}

export async function pruneOldAudit(now: Date): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
  const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
