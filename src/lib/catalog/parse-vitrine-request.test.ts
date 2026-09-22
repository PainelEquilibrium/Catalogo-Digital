import { describe, expect, it } from "vitest";
import { parseVitrineProductsRequest } from "@/lib/catalog/parse-vitrine-request";

const FIELDS_SCHEMA = [
  {
    key: "cor",
    label: "Cor",
    type: "multiselect" as const,
    filterable: true,
    options: ["Preto", "Bege"],
  },
];

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
