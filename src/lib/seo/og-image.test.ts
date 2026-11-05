import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Branding } from "@/domain/branding";
import { absoluteAssetUrl, categoryOgImages, productOgImages, storeOgImages } from "./og-image";

const SITE = "https://loja.example";
const branding = { share: { og_image: "/images/og-padrao.jpg" } } as Branding;
const logo = [{ url: `${SITE}/images/og-padrao.jpg`, alt: "Peça" }];

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE));
afterEach(() => vi.unstubAllEnvs());

describe("og-image", () => {
  it("caminho local vira URL absoluta", () => {
    expect(absoluteAssetUrl("/images/a.jpg", SITE)).toBe(`${SITE}/images/a.jpg`);
  });

  it("URL absoluta fica igual", () => {
    const url = "https://cdn.example/x/y.jpg?v=1";
    expect(absoluteAssetUrl(url, SITE)).toBe(url);
  });

  it("logo da loja vira imagem absoluta com alt", () => {
    expect(storeOgImages(branding, "Peça")).toEqual(logo);
  });

  it("produto usa o JPG da capa", () => {
    const gallery = [{ ogUrl: "https://cdn.example/p-og.jpg" }, { ogUrl: "https://cdn.example/q-og.jpg" }];
    expect(productOgImages({ name: "Peça", gallery }, branding)).toEqual([
      { url: "https://cdn.example/p-og.jpg", alt: "Peça" },
    ]);
  });

  it("produto sem JPG cai no logo, sem usar .webp", () => {
    expect(productOgImages({ name: "Peça", gallery: [{ ogUrl: "https://cdn.example/p-og.webp" }] }, branding)).toEqual(logo);
    expect(productOgImages({ name: "Peça", gallery: [{ ogUrl: "https://cdn.example/p-og.WEBP?v=2" }] }, branding)).toEqual(logo);
    expect(productOgImages({ name: "Peça", gallery: [] }, branding)).toEqual(logo);
  });

  it("categoria usa o JPG da capa", () => {
    expect(categoryOgImages({ name: "Peça", coverOgUrl: "https://cdn.example/c-og.jpg" }, branding)).toEqual([
      { url: "https://cdn.example/c-og.jpg", alt: "Peça" },
    ]);
  });

  it("categoria sem capa cai no logo", () => {
    expect(categoryOgImages({ name: "Peça", coverOgUrl: null }, branding)).toEqual(logo);
    expect(categoryOgImages({ name: "Peça", coverOgUrl: "https://cdn.example/c-og.webp" }, branding)).toEqual(logo);
  });
});
