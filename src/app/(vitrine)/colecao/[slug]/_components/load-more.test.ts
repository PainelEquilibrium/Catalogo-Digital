import { describe, expect, it, vi } from "vitest";
import type { ProductCard } from "@/domain/product";
import {
  appendProductCards,
  fetchMoreProductCards,
} from "./load-more";

function card(id: string): ProductCard {
  return {
    id,
    slug: `produto-${id}`,
    name: `Produto ${id}`,
    price: 100,
    promoPrice: null,
    showPrices: true,
    currency: "BRL",
    coverImage: null,
    badges: {},
  };
}

describe("appendProductCards", () => {
  it("concatena páginas sem duplicar ids", () => {
    const merged = appendProductCards([card("1")], [card("2"), card("1")]);
    expect(merged.map((item) => item.id)).toEqual(["1", "2"]);
  });
});

describe("fetchMoreProductCards", () => {
  it("chama a API com slug, cursor e query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [card("2")],
        nextCursor: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchMoreProductCards(
      "trico",
      "cursor-token",
      "cor=Preto&ordenar=novidades",
    );

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vitrine/produtos?cor=Preto&ordenar=novidades&slug=trico&cursor=cursor-token",
    );

    vi.unstubAllGlobals();
  });
});
