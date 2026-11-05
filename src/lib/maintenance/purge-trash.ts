import type { AuditActor } from "@/lib/audit/record";
import { recordAudit } from "@/lib/audit/record";
import { storageObjectsForPersistedImage, type StorageObjectRef } from "@/lib/images/upload";
import { prisma } from "@/lib/prisma/client";
import { drainStorageDeletions, enqueueStorageDeletions } from "./storage-queue";

export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;
// Um upsert por objeto na fila; com latência remota o padrão de 5 s estoura.
const TX_OPTIONS = { timeout: 30_000 };

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
    }, TX_OPTIONS);
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
    }, TX_OPTIONS);
    if (outcome === "has_products") return outcome;
  } catch (error) {
    if (error instanceof NotInTrash) return "not_in_trash";
    throw error;
  }
  await drainQuietly(objects);
  return "purged";
}
