// Mantido igual ao que buildOrderMessage substitui; whatsapp-templates.test.ts falha se divergir.
export const ITEM_MARKERS = ["product_name", "selection", "qty", "unit_price", "item_total", "product_url"] as const;
export const ORDER_MARKERS = ["items_list", "total_items", "total"] as const;

type Validation = { ok: true } | { ok: false; message: string };

const short = (text: string) => {
  const flat = text.replace(/\s+/g, " ");
  return flat.length > 20 ? `${flat.slice(0, 20)}…` : flat;
};

// Tira os marcadores aceitos; qualquer chave que sobre chegaria literal à cliente (inclusive {preço}, {{qty}}, "{" solto).
function badBrace(template: string, allowed: readonly string[]): string | null {
  const rest = template.replace(/\{(\w+)\}/g, (m, name: string) => (allowed.includes(name) ? "" : m));
  const m = rest.match(/\{[^{}\n]*\}|\{[^{}]{0,20}|[{}]/);
  if (!m) return null;
  return /^\{[^{}\n]*\}$/.test(m[0]) ? `Marcador desconhecido: ${short(m[0])}` : `Chave sem par: ${short(m[0])}`;
}

export function validateTemplates(item: string, order: string): Validation {
  const bad = badBrace(item, ITEM_MARKERS) ?? badBrace(order, ORDER_MARKERS);
  if (bad) return { ok: false, message: `${bad}. Confira a lista de marcadores.` };
  if (!item.includes("{product_name}")) return { ok: false, message: "O modelo do item precisa de {product_name}." };
  if (!order.includes("{items_list}")) return { ok: false, message: "O modelo da mensagem precisa de {items_list}." };
  return { ok: true };
}
