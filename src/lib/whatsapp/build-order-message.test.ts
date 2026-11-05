import { describe, expect, it } from "vitest";
import { FALLBACK_BRANDING } from "@/domain/branding";
import {
  buildOrderMessage,
  buildOrderWhatsappUrl,
  type OrderLine,
} from "./build-order-message";

const { whatsapp_item_template, whatsapp_order_template } = FALLBACK_BRANDING.contact;

const blusa: OrderLine = {
  name: "Blusa Tricô",
  selections: [
    { key: "size", label: "Tamanho", value: "M" },
    { key: "color", label: "Cor", value: "Preto" },
  ],
  qty: 2,
  price: 189.9,
  promoPrice: 149.9,
  url: "https://loja.test/produto/blusa",
};

const base = {
  lines: [blusa],
  itemTemplate: whatsapp_item_template,
  orderTemplate: whatsapp_order_template,
  showPrices: true,
  currency: "BRL",
};

describe("buildOrderMessage", () => {
  it("traz produto, escolhas, quantidade e link", () => {
    const msg = buildOrderMessage(base);
    expect(msg).toContain("Blusa Tricô");
    expect(msg).toContain("Tamanho: M");
    expect(msg).toContain("Cor: Preto");
    expect(msg).toContain("x2");
    expect(msg).toContain("https://loja.test/produto/blusa");
  });

  it("usa promoção como preço unitário e soma total", () => {
    const msg = buildOrderMessage({
      ...base,
      itemTemplate: "{unit_price} x{qty} {item_total}",
    });
    expect(msg).toContain("R$ 149,90 x2 R$ 299,80");
    expect(msg).toContain("R$ 299,80");
    expect(msg).toContain("Total: R$ 299,80");
    expect(msg).not.toContain("189,90");
  });

  it("Sob consulta sai sem valor e o total avisa", () => {
    const msg = buildOrderMessage({
      ...base,
      lines: [
        { ...blusa, price: 100, promoPrice: null, qty: 1 },
        { ...blusa, name: "Vestido", price: null, promoPrice: null, qty: 1 },
      ],
    });
    expect(msg).toContain("Vestido");
    expect(msg).toContain("Total: R$ 100,00 + itens a confirmar");
  });

  it("só Sob consulta: não mostra R$", () => {
    const msg = buildOrderMessage({
      ...base,
      lines: [{ ...blusa, price: null, promoPrice: null }],
    });
    expect(msg).not.toContain("R$");
    expect(msg).toContain("Total: a confirmar");
  });

  it("show_prices false: nenhuma linha tem valor, total some", () => {
    const msg = buildOrderMessage({ ...base, showPrices: false });
    expect(msg).not.toContain("R$");
    expect(msg).not.toContain("Total:");
    expect(msg).toContain("Total de peças: 2");
  });

  it("não deixa linha vazia nem espaço sobrando", () => {
    const msg = buildOrderMessage({ ...base, showPrices: false });
    expect(msg).not.toMatch(/[ \t]{2,}|[ \t]\n|\n[ \t]|\n{3,}/);
    expect(msg).toBe(msg.trim());
  });

  it("nenhum {marcador} sobra, nem desconhecido", () => {
    const msg = buildOrderMessage({
      ...base,
      orderTemplate: "{items_list}\n{desconhecido}\n{total}",
    });
    expect(msg).not.toMatch(/\{\w+\}/);
  });

  it("nome com { } do usuário não é reprocessado", () => {
    const msg = buildOrderMessage({
      ...base,
      lines: [{ ...blusa, name: "Caixa {qty} {total} $& fim" }],
    });
    expect(msg).toContain("Caixa {qty} {total} $& fim");
  });
});

describe("buildOrderWhatsappUrl", () => {
  it("20 linhas com nomes de 120 caracteres acentuados passam de 8000 e dão too_long", () => {
    const longLines = Array.from({ length: 20 }, () => ({
      ...blusa,
      name: "ç".repeat(120),
      price: 10,
      promoPrice: null,
      qty: 1,
    }));
    const msg = buildOrderMessage({ ...base, lines: longLines });
    expect(buildOrderWhatsappUrl("5511999887766", msg)).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("20 linhas normais cabem", () => {
    const lines = Array.from({ length: 20 }, () => blusa);
    const msg = buildOrderMessage({ ...base, lines });
    expect(buildOrderWhatsappUrl("5511999887766", msg).ok).toBe(true);
  });

  it("acentos e quebras vão codificados na URL", () => {
    const result = buildOrderWhatsappUrl("+55 (11) 99988-7766", "Olá\nTudo");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toMatch(/^https:\/\/wa\.me\/5511999887766\?text=/);
    expect(result.url).toContain("Ol%C3%A1%0ATudo");
    expect(decodeURIComponent(result.url.split("text=")[1]!)).toBe("Olá\nTudo");
  });
});
