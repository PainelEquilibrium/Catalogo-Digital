"use server";

import { renamedFieldKeys, suggestCopySlug, trashCategoryBlocker } from "@/domain/category-write";
import {
  parseFieldsSchema,
  type FieldType,
} from "@/domain/category-fields";
import { slugFromName } from "@/domain/product-write";
import { auditActorFor, recordAudit } from "@/lib/audit/record";
import { requireAction } from "@/lib/auth/server";
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
import { drainStorageDeletions, enqueueStorageDeletions } from "@/lib/maintenance/storage-queue";
import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/generated/prisma/client";

const copy = copyAdminPtBr.categories;
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

const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type SaveFieldInput = {
  key: string;
  previousKey?: string;
  label: string;
  type: FieldType;
  required: boolean;
  filterable: boolean;
  options: string[];
  placeholder?: string;
};

function persistFilterable(type: FieldType, filterable: boolean): boolean {
  if (type === "select" || type === "multiselect" || type === "boolean") {
    return filterable;
  }
  return false;
}

function buildFieldsSchema(fields: SaveFieldInput[]) {
  const mapped = fields.map(({ previousKey: _previousKey, ...field }) => {
    const filterable = persistFilterable(field.type, field.filterable);
    const base: Record<string, unknown> = {
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      filterable,
    };
    if (field.type === "select" || field.type === "multiselect") {
      base.options = field.options;
    }
    if (field.placeholder?.trim()) {
      base.placeholder = field.placeholder.trim();
    }
    return base;
  });

  try {
    return parseFieldsSchema(mapped);
  } catch {
    return null;
  }
}

async function isSlugTaken(slug: string, excludeId: string | null): Promise<boolean> {
  const existing = await prisma.category.findFirst({
    where: {
      slug,
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return existing != null;
}

function categorySnapshot(c: {
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  fieldsSchema: unknown;
}) {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    fieldsSchema: c.fieldsSchema,
  };
}

export async function saveCategory(input: {
  id: string | null;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  fields: SaveFieldInput[];
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const actor = auditActorFor(await requireAction("catalog"));

  const name = input.name.trim();
  const slug = input.slug.trim();
  const description = input.description?.trim() || null;

  if (!name) {
    return { ok: false, message: copy.errorGeneric };
  }

  if (!VALID_SLUG.test(slug)) {
    return { ok: false, message: copy.errorSlugInvalid };
  }

  if (await isSlugTaken(slug, input.id)) {
    return { ok: false, message: copy.errorSlugTaken };
  }

  const fieldsSchema = buildFieldsSchema(input.fields);
  if (!fieldsSchema) {
    return { ok: false, message: copy.errorFieldsInvalid };
  }

  if (input.id) {
    const current = await prisma.category.findFirst({
      where: { id: input.id, deletedAt: null },
    });
    if (!current) {
      return { ok: false, message: copy.errorNotFound };
    }

    let previousKeys: string[] = [];
    try {
      previousKeys = parseFieldsSchema(current.fieldsSchema).map((field) => field.key);
    } catch {
      previousKeys = [];
    }

    const renamed = renamedFieldKeys({
      previousKeys,
      next: input.fields,
    });
    if (renamed.length > 0) {
      return { ok: false, message: copy.errorFieldKeyRenamed };
    }

    const categoryId = input.id;
    await prisma.$transaction(async (tx) => {
      const row = await tx.category.update({
        where: { id: categoryId },
        data: {
          name,
          slug,
          description,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
          fieldsSchema: fieldsSchema as Prisma.InputJsonValue,
        },
      });
      await recordAudit(tx, actor, {
        entityType: "category",
        entityId: row.id,
        entityLabel: name,
        action: "update",
        before: categorySnapshot(current),
        after: categorySnapshot(row),
      });
    });

    return { ok: true, id: categoryId };
  }

  const id = await prisma.$transaction(async (tx) => {
    const row = await tx.category.create({
      data: {
        name,
        slug,
        description,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        fieldsSchema: fieldsSchema as Prisma.InputJsonValue,
      },
    });
    await recordAudit(tx, actor, {
      entityType: "category",
      entityId: row.id,
      entityLabel: name,
      action: "create",
      after: categorySnapshot(row),
    });
    return row.id;
  });

  return { ok: true, id };
}

export async function duplicateCategory(
  id: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const actor = auditActorFor(await requireAction("catalog"));

  const source = await prisma.category.findFirst({
    where: { id, deletedAt: null },
  });

  if (!source) {
    return { ok: false, message: copy.errorNotFound };
  }

  const slugRows = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { slug: true },
  });
  const taken = new Set(slugRows.map((row) => row.slug));
  const slug = suggestCopySlug(source.slug, taken);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.category.create({
      data: {
        name: `${source.name}${copy.copySuffix}`,
        slug,
        description: source.description,
        isActive: source.isActive,
        sortOrder: source.sortOrder,
        fieldsSchema: source.fieldsSchema as Prisma.InputJsonValue,
        coverImageUrl: null,
        coverStoragePath: null,
      },
    });
    await recordAudit(tx, actor, {
      entityType: "category",
      entityId: row.id,
      entityLabel: row.name,
      action: "create",
      before: { duplicatedFrom: source.id },
      after: categorySnapshot(row),
    });
    return row;
  });

  return { ok: true, id: created.id };
}

export async function trashCategory(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = auditActorFor(await requireAction("catalog"));

  const category = await prisma.category.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          products: {
            where: { deletedAt: null },
          },
        },
      },
    },
  });

  if (!category) {
    return { ok: false, message: copy.errorNotFound };
  }

  const blocker = trashCategoryBlocker(category._count.products);
  if (blocker === "has_active_products") {
    return { ok: false, message: copy.errorHasActiveProducts };
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id: category.id },
      data: { deletedAt: new Date() },
    });
    await recordAudit(tx, actor, {
      entityType: "category",
      entityId: category.id,
      entityLabel: category.name,
      action: "trash",
      before: { name: category.name, slug: category.slug },
    });
  });

  return { ok: true };
}

export async function setCategoryCover(
  categoryId: string,
  formData: FormData,
): Promise<{ ok: true; coverImageUrl: string; cleanupPending?: boolean } | { ok: false; message: string }> {
  const actor = auditActorFor(await requireAction("catalog"));

  const category = await prisma.category.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { id: true, name: true, coverStoragePath: true, coverImageUrl: true, coverOgUrl: true },
  });

  if (!category) {
    return { ok: false, message: copy.errorNotFound };
  }

  const fileResult = await readImageUpload(formData);
  if (!fileResult.ok) {
    return fileResult;
  }

  let stored;
  try {
    stored = await storeProcessedImage({
      bytes: fileResult.bytes,
      scope: { kind: "category", categoryId: category.id },
    });
  } catch (error) {
    const code = mapUploadError(error, fileResult.bytes.length);
    return { ok: false, message: messageForUploadError(code) };
  }

  const previousObjects = storageObjectsForPersistedImage(category.coverStoragePath, { card: category.coverImageUrl });
  let saved;
  try {
    saved = await prisma.$transaction(async (tx) => {
      const result = await tx.category.updateMany({
        where: { id: category.id, deletedAt: null, coverStoragePath: category.coverStoragePath, coverImageUrl: category.coverImageUrl },
        data: { coverImageUrl: stored.cardUrl, coverOgUrl: stored.ogUrl, coverStoragePath: stored.storagePath },
      });
      if (result.count === 1) {
        await enqueueStorageDeletions(tx, previousObjects);
        await recordAudit(tx, actor, {
          entityType: "category",
          entityId: category.id,
          entityLabel: category.name,
          action: "cover_set",
          before: { coverImageUrl: category.coverImageUrl, coverOgUrl: category.coverOgUrl },
          after: { coverImageUrl: stored.cardUrl, coverOgUrl: stored.ogUrl },
        });
      }
      return result;
    });
  } catch {
    console.error("Category cover persistence failed", { categoryId: category.id, failure: "persistence" });
    try { await removeStorageObjects(storageObjectsForOriginal(stored.storagePath)); }
    catch { console.error("Category cover compensation pending", { categoryId: category.id, storagePath: stored.storagePath }); }
    return { ok: false, message: uploadCopy.errorGeneric };
  }
  if (saved.count !== 1) {
    try { await removeStorageObjects(storageObjectsForOriginal(stored.storagePath)); }
    catch { console.error("Category cover compensation pending", { categoryId: category.id, storagePath: stored.storagePath }); }
    return { ok: false, message: uploadCopy.errorGeneric };
  }
  if (previousObjects.length) {
    try {
      if ((await drainStorageDeletions({ paths: previousObjects })).failed) return { ok: true, coverImageUrl: stored.cardUrl, cleanupPending: true };
    } catch {
      console.error("Category cover cleanup pending", { categoryId: category.id });
      return { ok: true, coverImageUrl: stored.cardUrl, cleanupPending: true };
    }
  }
  return { ok: true, coverImageUrl: stored.cardUrl };
}
