import { describe, expect, it } from "vitest";
import { formatProductPrice } from "./price";

describe("formatProductPrice", () => {
  it("retorna consulta quando showPrices é false", () => {
    expect(
      formatProductPrice({
        price: 199.9,
        promoPrice: null,
        showPrices: false,
      }),
    ).toEqual({ kind: "consulta" });
  });

  it("retorna consulta quando price é null (mesmo com promoPrice)", () => {
    expect(
      formatProductPrice({
        price: null,
        promoPrice: 99.9,
        showPrices: true,
      }),
    ).toEqual({ kind: "consulta" });
  });

  it("retorna promo com from e to formatados em pt-BR quando há preço e promoPrice", () => {
    expect(
      formatProductPrice({
        price: 199.9,
        promoPrice: 149.9,
        showPrices: true,
      }),
    ).toEqual({
      kind: "promo",
      from: "R$ 199,90",
      to: "R$ 149,90",
    });
  });

  it("retorna regular com label formatado quando há preço sem promo", () => {
    expect(
      formatProductPrice({
        price: 199.9,
        promoPrice: null,
        showPrices: true,
      }),
    ).toEqual({
      kind: "regular",
      label: "R$ 199,90",
    });
  });
});
