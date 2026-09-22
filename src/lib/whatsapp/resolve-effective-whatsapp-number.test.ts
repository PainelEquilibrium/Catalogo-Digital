import { describe, expect, it } from "vitest";
import { buildWhatsappUrl } from "./build-whatsapp-url";
import { resolveEffectiveWhatsappNumber } from "./resolve-effective-whatsapp-number";

const template = "Olá! {product_name} {product_url} {price}";

describe("resolveEffectiveWhatsappNumber", () => {
  it("prioriza branding com dígitos sobre env", () => {
    expect(
      resolveEffectiveWhatsappNumber("+55 11 98888-7777", "5511999998888"),
    ).toBe("+55 11 98888-7777");
  });

  it("usa WHATSAPP_NUMBER quando branding está vazio", () => {
    expect(resolveEffectiveWhatsappNumber("", "5511999998888")).toBe(
      "5511999998888",
    );
  });

  it("retorna null sem número efetivo — CTA não monta wa.me", () => {
    const number = resolveEffectiveWhatsappNumber("", undefined);
    expect(number).toBeNull();
    expect(
      buildWhatsappUrl({
        number,
        template,
        productName: "Produto",
        productUrl: "https://loja.example/produto/x",
        priceLabel: "R$ 10,00",
      }),
    ).toBeNull();
  });
});
