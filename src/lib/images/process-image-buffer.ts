import sharp, { type Metadata } from "sharp";
import { IMAGE_VARIANTS } from "./variants";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1"]);

function looksLikeHeicBuffer(input: Buffer): boolean {
  if (input.length >= 12 && input.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = input.subarray(8, 12).toString("ascii");
    return HEIC_BRANDS.has(brand);
  }
  const ascii = input.toString("ascii", 0, Math.min(input.length, 32));
  return /ftyp(?:heic|heix|hevc|hevx|mif1)/.test(ascii);
}

export type ProcessedImageBuffers = {
  thumb: Buffer;
  card: Buffer;
  detail: Buffer;
  og: Buffer;
  width: number;
  height: number;
};

function isHeic(meta: Metadata): boolean {
  if (meta.format === "heif" || meta.compression === "hevc") {
    return true;
  }
  const media = meta.mediaType?.toLowerCase() ?? "";
  return media.includes("heic") || media === "image/heif";
}

function assertAcceptedFormat(meta: Metadata): void {
  if (isHeic(meta)) {
    throw new Error("HEIC images are not supported");
  }

  const format = meta.format;
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new Error(
      `Unsupported image format: ${format ?? "unknown"}. Only JPEG, PNG and WebP are accepted.`,
    );
  }
}

function basePipeline(input: Buffer): ReturnType<typeof sharp> {
  return sharp(input).rotate().normalize();
}

async function orientedDimensions(input: Buffer): Promise<{
  width: number;
  height: number;
}> {
  const meta = await sharp(input).metadata();
  const oriented = meta.autoOrient;
  const width = oriented?.width ?? meta.width;
  const height = oriented?.height ?? meta.height;

  if (width === undefined || height === undefined) {
    throw new Error("Unable to read image dimensions");
  }

  return { width, height };
}

async function resizeMaxSide(
  input: Buffer,
  maxSide: number,
): Promise<Buffer> {
  return basePipeline(input)
    .resize(maxSide, maxSide, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp()
    .toBuffer();
}

async function resizeOg(input: Buffer): Promise<Buffer> {
  const { width, height } = IMAGE_VARIANTS.og;
  return basePipeline(input)
    .resize(width, height, {
      fit: "cover",
      position: "centre",
    })
    .webp()
    .toBuffer();
}

export async function processImageBuffer(
  input: Buffer,
): Promise<ProcessedImageBuffers> {
  if (looksLikeHeicBuffer(input)) {
    throw new Error("HEIC images are not supported");
  }

  const meta = await sharp(input).metadata();
  assertAcceptedFormat(meta);

  const { width, height } = await orientedDimensions(input);
  if (Math.min(width, height) < 800) {
    throw new Error("Image smallest side must be at least 800px");
  }

  const [thumb, card, detail, og] = await Promise.all([
    resizeMaxSide(input, IMAGE_VARIANTS.thumb.maxSide),
    resizeMaxSide(input, IMAGE_VARIANTS.card.maxSide),
    resizeMaxSide(input, IMAGE_VARIANTS.detail.maxSide),
    resizeOg(input),
  ]);

  return { thumb, card, detail, og, width, height };
}
