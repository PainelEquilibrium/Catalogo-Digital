import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FALLBACK_BRANDING } from "@/domain/branding";
import { parseSectionInput } from "@/domain/settings-sections";
import { buildOrderMessage } from "@/lib/whatsapp/build-order-message";
import { ITEM_MARKERS, ORDER_MARKERS, validateTemplates } from "./whatsapp-templates";

const { whatsapp_item_template: item, whatsapp_order_template: order } = FALLBACK_BRANDING.contact;
const FAKE_NUMBER = "5500000000000";

function blockKeys(source: string, call: string): string[] {
  const start = source.indexOf(call);
  const block = source.slice(start).split(/\n\s*\}\)/)[0];
  return [...block.matchAll(/^\s*(\w+)\s*[:,]/gm)].map((m) => m[1]);
}

describe("validateTemplates", () => {
  it("aceita os padrões", () => {
    expect(validateTemplates(item, order)).toEqual({ ok: true });
  });

  it("recusa marcador desconhecido e nomeia qual", () => {
    for (const bad of ["{preço}", "{foo}", "{ qty }", "{Qty}", "{}"]) {
      const result = validateTemplates(`{product_name} ${bad}`, order);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.message).toContain(bad);
    }
    const inOrder = validateTemplates(item, `{items_list} {preço}`);
    expect(!inOrder.ok && inOrder.message).toContain("{preço}");
  });

  it("recusa marcador de um modelo usado no outro", () => {
    expect(validateTemplates("{product_name} {total}", order).ok).toBe(false);
    expect(validateTemplates(item, "{items_list} {qty}").ok).toBe(false);
  });

  it("recusa mensagem sem {items_list}", () => {
    const result = validateTemplates(item, "Olá! {total}");
    expect(!result.ok && result.message).toContain("{items_list}");
  });

  it("recusa item sem {product_name}", () => {
    const result = validateTemplates("x{qty}", order);
    expect(!result.ok && result.message).toContain("{product_name}");
  });

  it("os marcadores aceitos são exatamente os que buildOrderMessage substitui", () => {
    const source = readFileSync("src/lib/whatsapp/build-order-message.ts", "utf8");
    expect(blockKeys(source, "renderTemplate(itemTemplate, {").sort()).toEqual([...ITEM_MARKERS].sort());
    expect(blockKeys(source, "return renderTemplate(orderTemplate, {").sort()).toEqual([...ORDER_MARKERS].sort());
    const line = { name: "N", selections: [{ key: "k", label: "L", value: "V" }], qty: 1, price: 10, promoPrice: null, url: "u" };
    const base = { lines: [line], showPrices: true, currency: "BRL" };
    for (const m of ITEM_MARKERS) {
      expect(buildOrderMessage({ ...base, itemTemplate: `{${m}}`, orderTemplate: "{items_list}" })).not.toBe("");
    }
    for (const m of ORDER_MARKERS) {
      expect(buildOrderMessage({ ...base, itemTemplate: "{product_name}", orderTemplate: `{${m}}` })).not.toBe("");
    }
  });
});

describe("contato em parseSectionInput", () => {
  const parse = (contact: Record<string, unknown>) => parseSectionInput("contact", { contact });

  it("número salvo guarda só dígitos e recusa menos de 10", () => {
    expect(parse({ whatsapp_number: "+55 (00) 00000-0000" })).toEqual({
      ok: true,
      rows: [{ key: "contact", value: { whatsapp_number: FAKE_NUMBER } }],
    });
    expect(parse({ whatsapp_number: "123456789" }).ok).toBe(false);
    expect(parse({ whatsapp_number: "" }).ok).toBe(true);
  });

  it("recusa modelo inválido no servidor e diz qual marcador", () => {
    const result = parse({ whatsapp_item_template: "{product_name} {preço}" });
    expect(!result.ok && result.message).toContain("{preço}");
  });

  it("não grava o campo legado", () => {
    const result = parse({ whatsapp_number: FAKE_NUMBER, whatsapp_message_default: "x" });
    expect(result.ok && result.rows[0].value).toEqual({ whatsapp_number: FAKE_NUMBER });
  });
});
