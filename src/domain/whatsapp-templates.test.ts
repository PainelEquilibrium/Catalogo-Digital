import { describe, expect, it } from "vitest";
import { FALLBACK_BRANDING } from "@/domain/branding";
import { parseSectionInput } from "@/domain/settings-sections";
import { buildOrderMessage } from "@/lib/whatsapp/build-order-message";
import { ITEM_MARKERS, ORDER_MARKERS, validateTemplates } from "./whatsapp-templates";

const { whatsapp_item_template: item, whatsapp_order_template: order } = FALLBACK_BRANDING.contact;
const FAKE_NUMBER = "5500000000000";

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

  it("recusa chaves soltas, quebradas ou duplas e nomeia o trecho", () => {
    for (const bad of ["{", "}", "{qty", "{a\nb}", "{{qty}}"]) {
      for (const result of [validateTemplates(`{product_name} ${bad}`, order), validateTemplates(item, `{items_list} ${bad}`)]) {
        expect(result.ok).toBe(false);
        expect(!result.ok && result.message).toMatch(/[{}]/);
      }
    }
    const long = validateTemplates(`{product_name} {${"x".repeat(200)}}`, order);
    expect(!long.ok && long.message.length).toBeLessThan(120);
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

  it("cada marcador aceito é substituído por buildOrderMessage", () => {
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

  it("recusa número ou modelo que não seja texto, sem lançar", () => {
    expect(parse({ whatsapp_number: 5500000000000 }).ok).toBe(false);
    expect(parse({ whatsapp_item_template: 5 }).ok).toBe(false);
    expect(parse({ whatsapp_order_template: { a: 1 } }).ok).toBe(false);
  });

  it("não grava o campo legado", () => {
    const result = parse({ whatsapp_number: FAKE_NUMBER, whatsapp_message_default: "x" });
    expect(result.ok && result.rows[0].value).toEqual({ whatsapp_number: FAKE_NUMBER });
  });
});
