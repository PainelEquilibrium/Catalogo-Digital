"use server";

import { auditActorFor, recordAudit } from "@/lib/audit/record";
import { requireAction, requireStaff } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { purgeCategory, purgeProduct } from "@/lib/maintenance/purge-trash";
import { prisma } from "@/lib/prisma/client";

const copy = copyAdminPtBr.trash;
const productCopy = copyAdminPtBr.products;
const categoryCopy = copyAdminPtBr.categories;

export async function queryTrash(): Promise<{
  products: { id: string; name: string; slug: string; deletedAt: Date }[];
  categories: { id: string; name: string; slug: string; deletedAt: Date }[];
}> {
  await requireStaff();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, name: true, slug: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.category.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, name: true, slug: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  return {
    products: products.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      deletedAt: row.deletedAt as Date,
    })),
    categories: categories.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      deletedAt: row.deletedAt as Date,
    })),
  };
}

export async function restoreProduct(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = auditActorFor(await requireAction("catalog"));

  const product = await prisma.product.findFirst({
    where: { id, deletedAt: { not: null } },
    select: { id: true, name: true, slug: true },
  });

  if (!product) {
    return { ok: false, message: productCopy.errorNotFound };
  }

  const slugConflict = await prisma.product.findFirst({
    where: {
      slug: product.slug,
      deletedAt: null,
      NOT: { id: product.id },
    },
    select: { id: true },
  });

  if (slugConflict) {
    return { ok: false, message: copy.errorRestoreSlugConflict };
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { deletedAt: null } });
    await recordAudit(tx, actor, {
      entityType: "product",
      entityId: product.id,
      entityLabel: product.name,
      action: "restore",
      after: { name: product.name, slug: product.slug },
    });
  });

  return { ok: true };
}

export async function restoreCategory(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = auditActorFor(await requireAction("catalog"));

  const category = await prisma.category.findFirst({
    where: { id, deletedAt: { not: null } },
    select: { id: true, name: true, slug: true },
  });

  if (!category) {
    return { ok: false, message: categoryCopy.errorNotFound };
  }

  const slugConflict = await prisma.category.findFirst({
    where: {
      slug: category.slug,
      deletedAt: null,
      NOT: { id: category.id },
    },
    select: { id: true },
  });

  if (slugConflict) {
    return { ok: false, message: copy.errorRestoreSlugConflict };
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.update({ where: { id: category.id }, data: { deletedAt: null } });
    await recordAudit(tx, actor, {
      entityType: "category",
      entityId: category.id,
      entityLabel: category.name,
      action: "restore",
      after: { name: category.name, slug: category.slug },
    });
  });

  return { ok: true };
}

export async function purgeTrashedProduct(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = auditActorFor(await requireAction("purge"));
  const result = await purgeProduct(id, actor);
  return result === "purged" ? { ok: true } : { ok: false, message: productCopy.errorNotFound };
}

export async function purgeTrashedCategory(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = auditActorFor(await requireAction("purge"));
  const result = await purgeCategory(id, actor);
  if (result === "purged") return { ok: true };
  return {
    ok: false,
    message: result === "has_products" ? copy.errorPurgeHasProducts : categoryCopy.errorNotFound,
  };
}
