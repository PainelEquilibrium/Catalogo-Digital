import { describe, expect, it } from "vitest";
import { buildWhatsappUrl } from "./build-whatsapp-url";

const base = {
  number: "5511999887766",
  template:
    "Olá! Quero saber sobre {product_name} — {product_url} — Preço: {price}",
  productName: "Vestido Midi",
  productUrl: "https://loja.example/p/vestido-midi",
};

describe("buildWhatsappUrl", () => {
  it("retorna null quando número é null, vazio ou sem dígitos", () => {
    expect(
      buildWhatsappUrl({ ...base, number: null, priceLabel: "R$ 199,90" }),
    ).toBeNull();
    expect(
      buildWhatsappUrl({ ...base, number: "", priceLabel: "R$ 199,90" }),
    ).toBeNull();
    expect(
      buildWhatsappUrl({ ...base, number: "abc", priceLabel: "R$ 199,90" }),
    ).toBeNull();
  });

  it("monta wa.me com preço substituído", () => {
    const url = buildWhatsappUrl({
      ...base,
      priceLabel: "R$ 199,90",
    });
    expect(url).toMatch(/^https:\/\/wa\.me\/5511999887766\?text=/);
    const text = decodeURIComponent(url!.split("text=")[1]!);
    expect(text).toContain("Vestido Midi");
    expect(text).toContain("https://loja.example/p/vestido-midi");
    expect(text).toContain("R$ 199,90");
    expect(text).not.toMatch(/\{price\}/);
  });

  it("sem priceLabel remove {price} e colapsa espaços duplos", () => {
    const url = buildWhatsappUrl({
      ...base,
      priceLabel: null,
    });
    expect(url).not.toBeNull();
    const text = decodeURIComponent(url!.split("text=")[1]!);
    expect(text).not.toContain("{price}");
    expect(text).not.toMatch(/  /);
    expect(text).toContain("Vestido Midi");
  });

  it("extrai só dígitos do número", () => {
    const url = buildWhatsappUrl({
      ...base,
      number: "+55 (11) 99988-7766",
      priceLabel: "R$ 10,00",
    });
    expect(url).toMatch(/^https:\/\/wa\.me\/5511999887766\?text=/);
  });
});
