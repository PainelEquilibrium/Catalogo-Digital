import { randomUUID } from "node:crypto";
import { createServerSupabase } from "@/lib/auth/server";
import { getSupabasePublicConfig } from "@/lib/auth/supabase-env";
import { processImageBuffer } from "./process-image-buffer";

const BUCKET = "product-images";

type ImageScope =
  | { kind: "product"; productId: string }
  | { kind: "category"; categoryId: string };

function scopeId(scope: ImageScope): string {
  return scope.kind === "product" ? scope.productId : scope.categoryId;
}

function originalObjectPath(scope: ImageScope, uuid: string): string {
  return `originals/${scopeId(scope)}/${uuid}`;
}

function variantObjectPath(
  scope: ImageScope,
  uuid: string,
  variant: "thumb" | "card" | "detail" | "og",
): string {
  return `variants/${scopeId(scope)}/${uuid}-${variant}.webp`;
}

export function publicObjectUrl(objectPath: string): string {
  const { url } = getSupabasePublicConfig();
  return `${url}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

export function storagePathsForOriginal(storagePath: string): string[] {
  const match = /^originals\/([^/]+)\/([^/]+)$/.exec(storagePath);
  if (!match) {
    return [storagePath];
  }
  const [, entityId, uuid] = match;
  return [
    storagePath,
    `variants/${entityId}/${uuid}-thumb.webp`,
    `variants/${entityId}/${uuid}-card.webp`,
    `variants/${entityId}/${uuid}-detail.webp`,
    `variants/${entityId}/${uuid}-og.webp`,
  ];
}

async function uploadObject(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function removeStorageObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    throw new Error(error.message);
  }
}

export async function storeProcessedImage(input: {
  bytes: Buffer;
  scope: ImageScope;
}): Promise<{
  storagePath: string;
  thumbUrl: string;
  cardUrl: string;
  detailUrl: string;
  ogUrl: string;
  width: number;
  height: number;
  sizeKb: number;
}> {
  const processed = await processImageBuffer(input.bytes);
  const uuid = randomUUID();
  const storagePath = originalObjectPath(input.scope, uuid);

  const variantPaths = {
    thumb: variantObjectPath(input.scope, uuid, "thumb"),
    card: variantObjectPath(input.scope, uuid, "card"),
    detail: variantObjectPath(input.scope, uuid, "detail"),
    og: variantObjectPath(input.scope, uuid, "og"),
  };

  await uploadObject(storagePath, input.bytes, "application/octet-stream");
  await Promise.all([
    uploadObject(variantPaths.thumb, processed.thumb, "image/webp"),
    uploadObject(variantPaths.card, processed.card, "image/webp"),
    uploadObject(variantPaths.detail, processed.detail, "image/webp"),
    uploadObject(variantPaths.og, processed.og, "image/webp"),
  ]);

  const sizeKb = Math.max(1, Math.ceil(input.bytes.length / 1024));

  return {
    storagePath,
    thumbUrl: publicObjectUrl(variantPaths.thumb),
    cardUrl: publicObjectUrl(variantPaths.card),
    detailUrl: publicObjectUrl(variantPaths.detail),
    ogUrl: publicObjectUrl(variantPaths.og),
    width: processed.width,
    height: processed.height,
    sizeKb,
  };
}
