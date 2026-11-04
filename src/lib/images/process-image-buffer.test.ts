import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImageBuffer } from "./process-image-buffer";

async function createPngBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#cccccc",
    },
  })
    .png()
    .toBuffer();
}

async function assertWebp(buffer: Buffer, maxSide?: number) {
  const meta = await sharp(buffer).metadata();
  expect(meta.format).toBe("webp");
  if (maxSide !== undefined) {
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(
      maxSide,
    );
  }
}

describe("processImageBuffer", () => {
  it("ok-800 produz três buffers WebP e dimensões após orientação", async () => {
    const input = await createPngBuffer(800, 800);
    const result = await processImageBuffer(input);

    expect(result.width).toBe(800);
    expect(result.height).toBe(800);

    await assertWebp(result.thumb, 400);
    await assertWebp(result.card, 800);
    await assertWebp(result.detail, 1600);
  });

  it("og sai como jpeg, sem recorte e com maior lado de 1200", async () => {
    const { og } = await processImageBuffer(await createPngBuffer(2000, 1000));
    const meta = await sharp(og).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1200, 600]);
  });

  it("PNG transparente vira JPG com fundo branco", async () => {
    const png = await sharp({ create: { width: 900, height: 900, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const { og } = await processImageBuffer(png);
    const { data } = await sharp(og).raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)].every((v) => v >= 250)).toBe(true);
  });

  it("rejeita imagem com lado menor < 800 (small-100)", async () => {
    const input = await createPngBuffer(100, 100);
    await expect(processImageBuffer(input)).rejects.toThrow(/800/);
  });

  it("rejeita buffer inválido", async () => {
    await expect(processImageBuffer(Buffer.from("not-an-image"))).rejects.toThrow();
  });

  it("rejeita HEIC com erro explícito", async () => {
    const heicLike = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ]);
    await expect(processImageBuffer(heicLike)).rejects.toThrow(/HEIC/i);
  });
});
