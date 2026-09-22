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
  it("ok-800 produz quatro buffers WebP e dimensões após orientação", async () => {
    const input = await createPngBuffer(800, 800);
    const result = await processImageBuffer(input);

    expect(result.width).toBe(800);
    expect(result.height).toBe(800);

    await assertWebp(result.thumb, 400);
    await assertWebp(result.card, 800);
    await assertWebp(result.detail, 1600);
    await assertWebp(result.og);
    const ogMeta = await sharp(result.og).metadata();
    expect(ogMeta.width).toBe(1200);
    expect(ogMeta.height).toBe(630);
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
