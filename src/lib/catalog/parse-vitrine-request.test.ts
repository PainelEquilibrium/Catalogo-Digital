import { describe, expect, it } from "vitest";
import {
  parseVitrineProductsRequest,
  parseVitrineSearchRequest,
} from "@/lib/catalog/parse-vitrine-request";

const FIELDS_SCHEMA = [
  {
    key: "cor",
    label: "Cor",
    type: "multiselect" as const,
    filterable: true,
    options: ["Preto", "Bege"],
  },
];

describe("parseVitrineSearchRequest", () => {
  it("aceita busca sem slug e ignora filtros de categoria", () => {
    const result = parseVitrineSearchRequest(
      new URLSearchParams("q=gola&ordenar=preco_asc&cor=Preto"),
    );
    expect(result).toMatchObject({
      ok: true,
      query: { q: "gola", ordenar: "preco_asc", filters: {}, cursor: null },
    });
  });

  it("rejeita cursor inválido", () => {
    expect(
      parseVitrineSearchRequest(new URLSearchParams("cursor=%%%")),
    ).toEqual({ ok: false, status: 400, message: "cursor inválido" });
  });
});

describe("parseVitrineProductsRequest", () => {
  it("rejeita slug ausente", () => {
    const result = parseVitrineProductsRequest(
      new URLSearchParams(),
      FIELDS_SCHEMA,
    );
    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "slug é obrigatório",
    });
  });

  it("rejeita cursor inválido", () => {
    const result = parseVitrineProductsRequest(
      new URLSearchParams("slug=trico&cursor=%%%"),
      FIELDS_SCHEMA,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("aceita filtros válidos", () => {
    const result = parseVitrineProductsRequest(
      new URLSearchParams("slug=trico&cor=Preto"),
      FIELDS_SCHEMA,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slug).toBe("trico");
      expect(result.query.filters.cor).toEqual(["Preto"]);
    }
  });
});
