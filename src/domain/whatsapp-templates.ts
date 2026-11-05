// Mantido igual ao que buildOrderMessage substitui; whatsapp-templates.test.ts falha se divergir.
export const ITEM_MARKERS = ["product_name", "selection", "qty", "unit_price", "item_total", "product_url"] as const;
export const ORDER_MARKERS = ["items_list", "total_items", "total"] as const;

type Validation = { ok: true } | { ok: false; message: string };

function unknownMarker(template: string, allowed: readonly string[]): string | null {
  // Qualquer {…} fora da lista é recusado, inclusive {preço}, que buildOrderMessage deixaria literal.
  for (const [marker, name] of template.matchAll(/\{([^{}\n]*)\}/g)) if (!allowed.includes(name)) return marker;
  return null;
}

export function validateTemplates(item: string, order: string): Validation {
  const bad = unknownMarker(item, ITEM_MARKERS) ?? unknownMarker(order, ORDER_MARKERS);
  if (bad) return { ok: false, message: `Marcador desconhecido: ${bad}. Confira a lista de marcadores.` };
  if (!item.includes("{product_name}")) return { ok: false, message: "O modelo do item precisa de {product_name}." };
  if (!order.includes("{items_list}")) return { ok: false, message: "O modelo da mensagem precisa de {items_list}." };
  return { ok: true };
}
