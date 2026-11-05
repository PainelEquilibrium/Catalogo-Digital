import { describe, expect, it } from "vitest";
import { resolveEffectiveWhatsappNumber } from "./resolve-effective-whatsapp-number";

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

  it("retorna null sem número efetivo — o envio fica indisponível", () => {
    expect(resolveEffectiveWhatsappNumber("", undefined)).toBeNull();
    expect(resolveEffectiveWhatsappNumber("abc", "  ")).toBeNull();
  });
});
