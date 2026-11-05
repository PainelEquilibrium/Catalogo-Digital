import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, branding } = vi.hoisted(() => ({
  findMany: vi.fn(),
  branding: { behavior: { show_prices: true } },
}));
vi.mock("@/lib/prisma/client", () => ({ prisma: { product: { findMany } } }));
vi.mock("@/lib/branding/resolve-branding", () => ({ resolveBranding: async () => branding }));

import { queryCartProducts } from "./query-cart-products";

const ID = "11111111-1111-4111-8111-111111111111";
const row = (price: string | null, promo: string | null) => ({
  id: ID,
  name: "Blusa",
  slug: "blusa",
  price: price === null ? null : { toNumber: () => Number(price) },
  promoPrice: promo === null ? null : { toNumber: () => Number(promo) },
  images: [{ thumbUrl: "https://cdn.test/t.webp" }],
});

describe("queryCartProducts", () => {
  beforeEach(() => {
    findMany.mockReset();
    branding.behavior.show_prices = true;
  });

  it("só devolve publicado, fora da lixeira, em categoria ativa", async () => {
    findMany.mockResolvedValue([]);
    await queryCartProducts([ID]);
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      id: { in: [ID] },
      status: "published",
      deletedAt: null,
      category: { isActive: true, deletedAt: null },
    });
  });

  it("devolve preço e promoção atuais com a miniatura", async () => {
    findMany.mockResolvedValue([row("189.90", "149.90")]);
    expect(await queryCartProducts([ID])).toEqual([
      { id: ID, name: "Blusa", slug: "blusa", price: 189.9, promoPrice: 149.9, thumbUrl: "https://cdn.test/t.webp" },
    ]);
  });

  it("com show_prices desligado a rota pública não expõe preço nem promoção", async () => {
    branding.behavior.show_prices = false;
    findMany.mockResolvedValue([row("189.90", "149.90")]);
    const [item] = await queryCartProducts([ID]);
    expect(item).toMatchObject({ price: null, promoPrice: null });
    expect(JSON.stringify(item)).not.toMatch(/189|149/);
  });
});
