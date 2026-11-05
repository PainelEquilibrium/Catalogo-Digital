import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { readValidatedDimensions } from "./process-image-buffer";
import { isValidStorageRef, publicObjectUrl, UUID, VARIANT_BUCKET, type StorageObjectRef } from "./upload";
import { IMAGE_VARIANTS } from "./variants";

// "Pasta" fixa dos arquivos da loja (logo, ícone, hero) no bucket público de variantes.
export const STORE_ASSET_ENTITY_ID = "00000000-0000-4000-8000-000000000001";

const MAX_SIDE = IMAGE_VARIANTS.detail.maxSide;
const OG = { width: 1200, height: 630 };

export async function processBrandAsset(
  input: Buffer,
  options: { minSide: number; background?: string },
): Promise<{ webp: Buffer; ogJpeg?: Buffer; width: number; height: number }> {
  const { width, height } = await readValidatedDimensions(input, options.minSide);
  const webp = await sharp(input).rotate().resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true }).webp().toBuffer();
  if (!options.background) return { webp, width, height };

  // Logo centralizado numa tela do tamanho do OG; a transparência vira o fundo da loja.
  const logo = await sharp(webp)
    .resize(Math.round(OG.width * 0.8), Math.round(OG.height * 0.7), { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const ogJpeg = await sharp({ create: { ...OG, channels: 3, background: options.background } })
    .composite([{ input: logo, gravity: "centre" }])
    .jpeg({ quality: IMAGE_VARIANTS.og.jpegQuality, mozjpeg: true })
    .toBuffer();
  return { webp, ogJpeg, width, height };
}

// Caminhos "-detail.webp" e "-og.jpg" são os únicos que o padrão de variantes aceita para estes arquivos.
export async function uploadBrandAsset(processed: { webp: Buffer; ogJpeg?: Buffer }): Promise<{ webpUrl: string; ogUrl?: string }> {
  const id = randomUUID();
  const prefix = `variants/${STORE_ASSET_ENTITY_ID}/${id}`;
  const files = [
    { path: `${prefix}-detail.webp`, body: processed.webp, contentType: "image/webp" },
    ...(processed.ogJpeg ? [{ path: `${prefix}-og.jpg`, body: processed.ogJpeg, contentType: "image/jpeg" }] : []),
  ];
  const bucket = createAdminSupabase().storage.from(VARIANT_BUCKET);
  const done: string[] = [];
  try {
    for (const file of files) {
      const { error } = await bucket.upload(file.path, file.body, { contentType: file.contentType, upsert: false });
      if (error) throw new Error(error.message);
      done.push(file.path);
    }
  } catch (error) {
    if (done.length) await bucket.remove(done).catch(() => console.error("Brand asset cleanup pending", done));
    throw error;
  }
  return { webpUrl: publicObjectUrl(files[0].path), ogUrl: files[1] && publicObjectUrl(files[1].path) };
}

const STORE_ASSET_URL = new RegExp(`/storage/v1/object/public/${VARIANT_BUCKET}/(variants/${STORE_ASSET_ENTITY_ID}/${UUID}-(?:detail\.webp|og\.jpg))$`, "i");

// Objetos de loja citados em qualquer string do valor. Caminhos locais, URLs externas e fotos de produto não entram.
export function storeAssetRefsIn(value: unknown): StorageObjectRef[] {
  if (typeof value === "string") {
    const path = STORE_ASSET_URL.exec(value)?.[1];
    const ref = { bucket: VARIANT_BUCKET, path: path ?? "" } as StorageObjectRef;
    return path && isValidStorageRef(ref) ? [ref] : [];
  }
  if (Array.isArray(value)) return value.flatMap(storeAssetRefsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(storeAssetRefsIn);
  return [];
}
