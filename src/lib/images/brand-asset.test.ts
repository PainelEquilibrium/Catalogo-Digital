import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processBrandAsset, STORE_ASSET_ENTITY_ID, storeAssetRefsIn } from "./brand-asset";

const U = "11111111-1111-4111-8111-111111111111";
const base = "https://x.supabase.co/storage/v1/object/public/product-image-variants";

async function transparentLogo(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: 40, height: 40, channels: 3, background: "#ff0000" } }, gravity: "centre" }])
    .png()
    .toBuffer();
}

describe("processBrandAsset", () => {
  it("logo transparente gera JPG 1200x630 com fundo da loja", async () => {
    const result = await processBrandAsset(await transparentLogo(200, 100), { minSide: 64, background: "#102030" });
    const meta = await sharp(result.ogJpeg).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1200, 630]);
    const { data } = await sharp(result.ogJpeg).raw().toBuffer({ resolveWithObject: true });
    expect(Math.abs(data[0] - 0x10)).toBeLessThan(8);
    expect(Math.abs(data[1] - 0x20)).toBeLessThan(8);
    expect(Math.abs(data[2] - 0x30)).toBeLessThan(8);
    expect((await sharp(result.webp).metadata()).format).toBe("webp");
  });

  it("logo menor que 64 px é recusado", async () => {
    await expect(processBrandAsset(await transparentLogo(63, 200), { minSide: 64, background: "#fff" })).rejects.toThrow(/at least 64px/);
  });

  it("arquivo que não é imagem é recusado", async () => {
    await expect(processBrandAsset(Buffer.from("isto não é uma imagem"), { minSide: 64 })).rejects.toThrow();
  });

  it("ícone não gera OG", async () => {
    const result = await processBrandAsset(await transparentLogo(128, 128), { minSide: 64 });
    expect(result.ogJpeg).toBeUndefined();
  });
});

describe("storeAssetRefsIn", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  });

  it("o mesmo caminho em outro host, ou com ponto trocado por outro caractere, é rejeitado", () => {
    const tail = `storage/v1/object/public/product-image-variants/variants/${STORE_ASSET_ENTITY_ID}/${U}`;
    expect(storeAssetRefsIn(`https://evil.example.com/${tail}-detail.webp`)).toEqual([]);
    expect(storeAssetRefsIn(`https://x.supabase.co/${tail}-detailXwebp`)).toEqual([]);
    expect(storeAssetRefsIn(`https://x.supabase.co/${tail}-detail.webp?x=1`)).toEqual([]);
    expect(storeAssetRefsIn(`https://x.supabase.co/${tail}-detail.webp`)).toHaveLength(1);
  });

  it("só reconhece arquivos de loja no bucket público; locais e fotos de produto ficam de fora", () => {
    const own = `${base}/variants/${STORE_ASSET_ENTITY_ID}/${U}-detail.webp`;
    const og = `${base}/variants/${STORE_ASSET_ENTITY_ID}/${U}-og.jpg`;
    const product = `${base}/variants/22222222-2222-4222-8222-222222222222/${U}-card.webp`;
    expect(storeAssetRefsIn({ store: { logo: { light: own, dark: "/images/logo.webp" } }, share: { og_image: og }, x: product })).toEqual([
      { bucket: "product-image-variants", path: `variants/${STORE_ASSET_ENTITY_ID}/${U}-detail.webp` },
      { bucket: "product-image-variants", path: `variants/${STORE_ASSET_ENTITY_ID}/${U}-og.jpg` },
    ]);
  });
});
