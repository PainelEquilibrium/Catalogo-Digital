import { describe, expect, it } from "vitest";
import {
  keepOrphanAttributes,
  publishBlockers,
  slugFromName,
} from "./product-write";

const cor = {
  key: "cor",
  label: "Cor",
  type: "select" as const,
  required: true,
  options: ["Preto"],
};

describe("publishBlockers", () => {
  const base = {
    imageCount: 2,
    fields: [cor],
    attributes: { cor: "Preto" },
    slug: "blusa-preta",
    slugTaken: false,
    price: 100,
    promoPrice: null as number | null,
  };

  it("aceita o mínimo publicável", () => {
    expect(publishBlockers(base)).toEqual([]);
  });

  it("recusa menos de 2 fotos", () => {
    expect(publishBlockers({ ...base, imageCount: 1 })).toEqual([
      { code: "min_photos", have: 1 },
    ]);
  });

  it("recusa required vazio", () => {
    expect(publishBlockers({ ...base, attributes: {} })).toEqual([
      { code: "required_field", key: "cor" },
    ]);
  });

  it("recusa slug inválido ou tomado", () => {
    expect(publishBlockers({ ...base, slug: "Blusa" })[0]?.code).toBe(
      "slug_invalid",
    );
    expect(publishBlockers({ ...base, slugTaken: true })).toContainEqual({
      code: "slug_taken",
    });
  });

  it("recusa promo sem preço e promo >= preço", () => {
    expect(
      publishBlockers({ ...base, price: null, promoPrice: 10 }),
    ).toContainEqual({ code: "promo_without_price" });
    expect(publishBlockers({ ...base, promoPrice: 100 })).toContainEqual({
      code: "promo_not_lower",
    });
  });
});

describe("slugFromName", () => {
  it("kebab sem acento", () => {
    expect(slugFromName("  Blusa Tricô  ")).toBe("blusa-trico");
  });
});

describe("keepOrphanAttributes", () => {
  it("mantém chaves que o schema novo não tem", () => {
    expect(
      keepOrphanAttributes({ cor: "Preto", busto_cm: 90 }, ["cor"]),
    ).toEqual({ cor: "Preto", busto_cm: 90 });
  });
});
