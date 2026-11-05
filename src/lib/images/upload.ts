import { randomUUID } from "node:crypto";
import { createServerSupabase } from "@/lib/auth/server";
import { getSupabasePublicConfig } from "@/lib/auth/supabase-env";
import { processImageBuffer } from "./process-image-buffer";

const ORIGINAL_BUCKET = "product-images";
const VARIANT_BUCKET = "product-image-variants";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const ORIGINAL_PATH = new RegExp(`^originals/(${UUID})/(${UUID})$`, "i");
const VARIANT_PATH = new RegExp(`^variants/${UUID}/${UUID}-(?:(?:thumb|card|detail|og)\\.webp|og\\.jpg)$`, "i");
const VARIANTS = ["thumb", "card", "detail", "og"] as const;
export type StorageObjectRef = { bucket: typeof ORIGINAL_BUCKET | typeof VARIANT_BUCKET; path: string };
type StorageClient = Awaited<ReturnType<typeof createServerSupabase>>;

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
  return `variants/${scopeId(scope)}/${uuid}-${variant}.${variant === "og" ? "jpg" : "webp"}`;
}

export function publicObjectUrl(objectPath: string): string {
  if (!VARIANT_PATH.test(objectPath)) throw new Error("Invalid image variant path");
  const { url } = getSupabasePublicConfig();
  return `${url}/storage/v1/object/public/${VARIANT_BUCKET}/${objectPath}`;
}

export function storageObjectsForOriginal(storagePath: string): StorageObjectRef[] {
  const match = ORIGINAL_PATH.exec(storagePath);
  if (!match) return [];
  const [, entityId, uuid] = match;
  return [
    { bucket: ORIGINAL_BUCKET, path: storagePath },
    // og.webp é legado (antes da variante JPG); apagar as duas.
    ...([ORIGINAL_BUCKET, VARIANT_BUCKET] as const).flatMap((bucket) => [...VARIANTS.map((variant) => `${variant}.webp`), "og.jpg"].map((file) => ({ bucket, path: `variants/${entityId}/${uuid}-${file}` }))),
  ];
}

async function uploadObject(
  supabase: StorageClient,
  object: StorageObjectRef,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage.from(object.bucket).upload(object.path, body, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export function isValidStorageRef(object: { bucket: string; path: string }): boolean {
  return (object.bucket === ORIGINAL_BUCKET && ORIGINAL_PATH.test(object.path)) ||
    ([ORIGINAL_BUCKET, VARIANT_BUCKET].includes(object.bucket) && VARIANT_PATH.test(object.path));
}

async function removeObjects(supabase: StorageClient, objects: StorageObjectRef[]): Promise<void> {
  for (const object of objects) {
    if (!isValidStorageRef(object)) throw new Error("Invalid image storage reference");
  }
  const results = await Promise.allSettled([ORIGINAL_BUCKET, VARIANT_BUCKET].map(async (bucket) => {
    const paths = objects.filter((object) => object.bucket === bucket).map((object) => object.path);
    if (!paths.length) return;
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error && !("code" in error && error.code === "NoSuchKey")) throw new Error(`Image cleanup failed in ${bucket}`);
  }));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}

export async function removeStorageObjects(objects: StorageObjectRef[]): Promise<void> {
  if (!objects.length) return;
  await removeObjects(await createServerSupabase(), objects);
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
  if (!ORIGINAL_PATH.test(storagePath)) throw new Error("Invalid image entity ID");

  const variantPaths = {
    thumb: variantObjectPath(input.scope, uuid, "thumb"),
    card: variantObjectPath(input.scope, uuid, "card"),
    detail: variantObjectPath(input.scope, uuid, "detail"),
    og: variantObjectPath(input.scope, uuid, "og"),
  };

  const supabase = await createServerSupabase();
  const confirmed: StorageObjectRef[] = [];
  const upload = async (object: StorageObjectRef, body: Buffer, contentType: string) => {
    await uploadObject(supabase, object, body, contentType);
    confirmed.push(object);
  };
  try {
    await upload({ bucket: ORIGINAL_BUCKET, path: storagePath }, input.bytes, "application/octet-stream");
    const results = await Promise.allSettled(VARIANTS.map((variant) => upload(
      { bucket: VARIANT_BUCKET, path: variantPaths[variant] }, processed[variant], variant === "og" ? "image/jpeg" : "image/webp",
    )));
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  } catch (error) {
    try { await removeObjects(supabase, confirmed); }
    catch { console.error("Image upload cleanup pending", confirmed); }
    throw error;
  }

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
export function storageObjectsForPersistedImage(
  storagePath: string | null,
  urls: Partial<Record<"thumb" | "card" | "detail" | "og", string | null>>,
): StorageObjectRef[] {
  const objects = storageObjectsForOriginal(storagePath ?? "");
  if (!objects.length || !Object.keys(urls).length) return [];
  const { url } = getSupabasePublicConfig();
  for (const [variant, persistedUrl] of Object.entries(urls)) {
    if (!persistedUrl || !objects.some((object) => (object.path.endsWith(`-${variant}.webp`) || object.path.endsWith(`-${variant}.jpg`)) &&
      persistedUrl === `${url}/storage/v1/object/public/${object.bucket}/${object.path}`)) return [];
  }
  return objects;
}
