import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  parseCatalogSearchParams,
  serializeCatalogSearchParams,
} from "./catalog-query";

describe("PAGE_SIZE", () => {
  it("é 12", () => {
    expect(PAGE_SIZE).toBe(12);
  });
});

describe("parseCatalogSearchParams", () => {
  it("parse cor=Preto,Bege em filters.cor", () => {
    const params = new URLSearchParams("cor=Preto,Bege");
    const query = parseCatalogSearchParams(params, ["cor", "tamanho"]);

    expect(query.filters.cor).toEqual(["Preto", "Bege"]);
    expect(query.q).toBeNull();
    expect(query.ordenar).toBe("novidades");
    expect(query.cursor).toBeNull();
  });

  it("ignora params que não estão em filterableKeys", () => {
    const params = new URLSearchParams("cor=Preto&composicao=algodao");
    const query = parseCatalogSearchParams(params, ["cor"]);

    expect(query.filters).toEqual({ cor: ["Preto"] });
    expect(query.filters.composicao).toBeUndefined();
  });

  it("ordenar inválido ou ausente vira novidades", () => {
    expect(
      parseCatalogSearchParams(new URLSearchParams(), []).ordenar,
    ).toBe("novidades");
    expect(
      parseCatalogSearchParams(new URLSearchParams("ordenar=invalido"), [])
        .ordenar,
    ).toBe("novidades");
  });

  it("q vazio ou ausente vira null", () => {
    expect(parseCatalogSearchParams(new URLSearchParams(), []).q).toBeNull();
    expect(parseCatalogSearchParams(new URLSearchParams("q="), []).q).toBeNull();
    expect(parseCatalogSearchParams(new URLSearchParams("q=  "), []).q).toBeNull();
  });

  it("cursor inválido vira null", () => {
    const params = new URLSearchParams("cursor=%%%invalido");
    expect(parseCatalogSearchParams(params, []).cursor).toBeNull();
  });
});

describe("encodeCursor / decodeCursor", () => {
  it("round-trip preserva o, v e i", () => {
    const payload = {
      o: "preco_asc" as const,
      v: "199.90",
      i: "prod-uuid-1",
    };
    const encoded = encodeCursor(payload);

    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeCursor(encoded)).toEqual(payload);
  });
});

describe("serializeCatalogSearchParams / parseCatalogSearchParams", () => {
  it("round-trip de filtros e ordenar sem cursor", () => {
    const filterableKeys = ["cor", "tamanho"];
    const original = {
      q: null as string | null,
      ordenar: "preco_asc" as const,
      filters: { cor: ["Preto", "Bege"] },
    };

    const serialized = serializeCatalogSearchParams(original);
    expect(serialized).toBe("cor=Preto,Bege&ordenar=preco_asc");

    const parsed = parseCatalogSearchParams(
      new URLSearchParams(serialized),
      filterableKeys,
    );

    expect(parsed.q).toBe(original.q);
    expect(parsed.ordenar).toBe(original.ordenar);
    expect(parsed.filters).toEqual(original.filters);
    expect(parsed.cursor).toBeNull();
  });
});
