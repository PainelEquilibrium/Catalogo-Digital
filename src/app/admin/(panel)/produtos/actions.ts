"use server";

import type { CategoryField } from "@/domain/category-fields";
import { parseFieldsSchema } from "@/domain/category-fields";
import type { PublishBlocker } from "@/domain/product-write";
import {
  keepOrphanAttributes,
  publishBlockers,
  slugFromName,
} from "@/domain/product-write";
import { requireStaff } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import {
  mapUploadError,
  messageForUploadError,
} from "@/lib/images/upload-errors";
import {
  removeStorageObjects,
  storageObjectsForOriginal,
  storageObjectsForPersistedImage,
  storeProcessedImage,
} from "@/lib/images/upload";
import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/generated/prisma/client";

const copy = copyAdminPtBr.products;
const uploadCopy = copyAdminPtBr.upload;

async function readImageUpload(
  formData: FormData,
): Promise<{ ok: true; bytes: Buffer } | { ok: false; message: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: uploadCopy.errorNoFile };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (mapUploadError(null, bytes.length) === "too_large") {
    return {
      ok: false,
      message: messageForUploadError("too_large"),
    };
  }

  return { ok: true, bytes };
}

function parseFields(raw: unknown): CategoryField[] {
  try {
    return parseFieldsSchema(raw);
  } catch {
    return [];
  }
}

function hasOrphanAttributeKeys(
  attributes: Record<string, unknown>,
  nextFieldKeys: readonly string[],
): boolean {
  const allowed = new Set(nextFieldKeys);
  return Object.keys(attributes).some((key) => !allowed.has(key));
}

function blockerMessage(
  blocker: PublishBlocker,
  fields: CategoryField[],
): string {
  switch (blocker.code) {
    case "min_photos":
      return copy.errorMinPhotos;
    case "required_field": {
      const label =
        fields.find((field) => field.key === blocker.key)?.label ?? blocker.key;
      return copy.errorRequiredField.replace("{label}", label);
    }
    case "slug_invalid":
      return copy.errorSlugInvalid;
    case "slug_taken":
      return copy.errorSlugTaken;
    case "promo_without_price":
      return copy.errorPromoWithoutPrice;
    case "promo_not_lower":
      return copy.errorPromoNotLower;
    default:
      return copy.errorGeneric;
  }
}

async function isProductSlugTaken(
  slug: string,
  excludeId: string | null,
): Promise<boolean> {
  const existing = await prisma.product.findFirst({
    where: {
      slug,
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return existing != null;
}

function mergeAttributes(
  previous: Record<string, unknown>,
  nextFieldKeys: readonly string[],
  fromForm: Record<string, unknown>,
): Record<string, unknown> {
  const base = keepOrphanAttributes(previous, nextFieldKeys);
  return { ...base, ...fromForm };
}

export async function saveProduct(input: {
  id: string | null;
  categoryId: string;
  name: string;
  slug: string;
  price: number | null;
  promoPrice: number | null;
  isFeatured: boolean;
  attributes: Record<string, unknown>;
  intent: "draft" | "publish";
  confirmCategoryChange: boolean;
}): Promise<
  | { ok: true; id: string }
  | { ok: false; message: string; needsCategoryConfirm?: boolean }
> {
  await requireStaff();

  const name = input.name.trim();
  const slug = input.slug.trim();
  const categoryId = input.categoryId.trim();

  if (!name) {
    return { ok: false, message: copy.errorNameRequired };
  }

  if (!categoryId) {
    return { ok: false, message: copy.errorCategoryRequired };
  }

  const category = await prisma.category.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { id: true, fieldsSchema: true },
  });

  if (!category) {
    return { ok: false, message: copy.errorCategoryNotFound };
  }

  const fields = parseFields(category.fieldsSchema);
  const fieldKeys = fields.map((field) => field.key);

  let previousAttributes: Record<string, unknown> = {};
  let previousCategoryId: string | null = null;
  let imageCount = 0;

  if (input.id) {
    const existing = await prisma.product.findFirst({
      where: { id: input.id, deletedAt: null },
      select: {
        categoryId: true,
        attributes: true,
        _count: { select: { images: true } },
      },
    });

    if (!existing) {
      return { ok: false, message: copy.errorNotFound };
    }

    previousCategoryId = existing.categoryId;
    previousAttributes =
      existing.attributes != null &&
      typeof existing.attributes === "object" &&
      !Array.isArray(existing.attributes)
        ? (existing.attributes as Record<string, unknown>)
        : {};
    imageCount = existing._count.images;
  }

  const categoryChanged =
    input.id != null &&
    previousCategoryId != null &&
    previousCategoryId !== categoryId;

  const attributes = mergeAttributes(
    previousAttributes,
    fieldKeys,
    input.attributes,
  );

  if (categoryChanged && !input.confirmCategoryChange) {
    if (hasOrphanAttributeKeys(previousAttributes, fieldKeys)) {
      return {
        ok: false,
        message: copy.confirmCategoryChangeDescription,
        needsCategoryConfirm: true,
      };
    }
  }

  const blockers = publishBlockers({
    imageCount,
    fields,
    attributes,
    slug,
    slugTaken: await isProductSlugTaken(slug, input.id),
    price: input.price,
    promoPrice: input.promoPrice,
  });

  const applicableBlockers =
    input.intent === "draft"
      ? blockers.filter(
          (blocker) =>
            blocker.code !== "min_photos" && blocker.code !== "required_field",
        )
      : blockers;

  if (applicableBlockers.length > 0) {
    return {
      ok: false,
      message: blockerMessage(applicableBlockers[0], fields),
    };
  }

  const status = input.intent === "publish" ? "published" : "draft";

  const data = {
    categoryId,
    name,
    slug,
    price: input.price,
    promoPrice: input.promoPrice,
    isFeatured: input.isFeatured,
    status,
    attributes: attributes as Prisma.InputJsonValue,
  };

  try {
    if (input.id) {
      await prisma.product.update({
        where: { id: input.id },
        data,
      });
      return { ok: true, id: input.id };
    }

    const created = await prisma.product.create({
      data,
      select: { id: true },
    });

    return { ok: true, id: created.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, message: copy.errorSlugTaken };
    }
    throw error;
  }
}

export async function trashProduct(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireStaff();

  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });

  if (!product) {
    return { ok: false, message: copy.errorNotFound };
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { deletedAt: new Date() },
  });

  return { ok: true };
}

export async function addProductImage(
  productId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireStaff();

  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true },
  });

  if (!product) {
    return { ok: false, message: uploadCopy.errorProductNotFound };
  }

  const fileResult = await readImageUpload(formData);
  if (!fileResult.ok) {
    return fileResult;
  }

  let stored;
  try {
    stored = await storeProcessedImage({
      bytes: fileResult.bytes,
      scope: { kind: "product", productId: product.id },
    });
  } catch (error) {
    const code = mapUploadError(error, fileResult.bytes.length);
    return { ok: false, message: messageForUploadError(code) };
  }

  try {
    const maxSort = await prisma.productImage.aggregate({
      where: { productId: product.id },
      _max: { sortOrder: true },
  });
    const nextSort = (maxSort._max.sortOrder ?? -1) + 1;

  await prisma.productImage.create({
    data: {
      productId: product.id,
      storagePath: stored.storagePath,
      thumbUrl: stored.thumbUrl,
      cardUrl: stored.cardUrl,
      detailUrl: stored.detailUrl,
      ogUrl: stored.ogUrl,
      width: stored.width,
      height: stored.height,
      sizeKb: stored.sizeKb,
      sortOrder: nextSort,
    },
  });

  } catch {
    console.error("Product image persistence failed", { productId: product.id, failure: "persistence" });
    try { await removeStorageObjects(storageObjectsForOriginal(stored.storagePath)); }
    catch { console.error("Product image compensation pending", { productId: product.id, storagePath: stored.storagePath }); }
    return { ok: false, message: uploadCopy.errorGeneric };
  }

  return { ok: true };
}

export async function reorderProductImages(
  productId: string,
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireStaff();

  const images = await prisma.productImage.findMany({
    where: { productId },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });

  if (images.length !== orderedIds.length) {
    return { ok: false, message: uploadCopy.errorReorderInvalid };
  }

  const known = new Set(images.map((row) => row.id));
  if (orderedIds.some((id) => !known.has(id))) {
    return { ok: false, message: uploadCopy.errorReorderInvalid };
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.productImage.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  return { ok: true };
}

export async function removeProductImage(
  imageId: string,
): Promise<{ ok: true; cleanupPending?: boolean } | { ok: false; message: string }> {
  await requireStaff();
  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { id: true, storagePath: true, thumbUrl: true, cardUrl: true, detailUrl: true, ogUrl: true },
  });
  if (!image) return { ok: false, message: uploadCopy.errorImageNotFound };
  try {
    await prisma.productImage.delete({ where: { id: image.id } });
  } catch {
    console.error("Product image unlink failed", { imageId: image.id, failure: "persistence" });
    return { ok: false, message: uploadCopy.errorGeneric };
  }
  try {
    const objects = storageObjectsForPersistedImage(image.storagePath, {
      thumb: image.thumbUrl, card: image.cardUrl, detail: image.detailUrl, og: image.ogUrl,
    });
    if (objects.length) await removeStorageObjects(objects);
  } catch {
    console.error("Product image cleanup pending", { imageId: image.id, storagePath: image.storagePath });
    return { ok: true, cleanupPending: true };
  }
  return { ok: true };
}
