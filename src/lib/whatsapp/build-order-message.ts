import { copyPtBr } from "@/lib/copy/pt-br";
import type { Selection } from "@/domain/customer-choices";
import { formatProductPrice } from "@/domain/price";
import type { ITEM_MARKERS, ORDER_MARKERS } from "@/domain/whatsapp-templates";

export type OrderLine = {
  name: string;
  selections: Selection[];
  qty: number;
  price: number | null;
  promoPrice: number | null;
  url: string;
};

export const MAX_WHATSAPP_URL_LENGTH = 8000;

function money(amount: number, currency: string): string {
  const formatted = formatProductPrice({ price: amount, promoPrice: null, showPrices: true, currency });
  return formatted.kind === "regular" ? formatted.label : "";
}

/** Uma passada por marcador; valores nunca são reprocessados. Linha que só tinha marcador vazio some. */
function renderTemplate(template: string, values: Record<string, string>): string {
  return template
    .split("\n")
    .flatMap((line) => {
      const rendered = line
        .replace(/\{(\w+)\}/g, (_, name: string) => (Object.hasOwn(values, name) ? values[name] : ""))
        .replace(/[ \t]{2,}/g, " ")
        .trim();
      return /\{\w+\}/.test(line) && rendered === "" ? [] : [rendered];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildOrderMessage(input: {
  lines: OrderLine[];
  itemTemplate: string;
  orderTemplate: string;
  showPrices: boolean;
  currency: string;
}): string {
  const { lines, itemTemplate, orderTemplate, showPrices, currency } = input;
  let totalCents = 0;
  let totalQty = 0;
  let pending = false;
  const itemTexts: string[] = [];

  for (const line of lines) {
    totalQty += line.qty;
    const unit = line.promoPrice ?? line.price;
    const unitCents = unit === null ? null : Math.round(unit * 100);
    const priced = showPrices && unitCents !== null;
    if (showPrices && unitCents === null) pending = true;
    if (priced) totalCents += unitCents * line.qty;

    const selection = line.selections.map((s) => `${s.label}: ${s.value}`).join(", ");
    const itemValues: Record<(typeof ITEM_MARKERS)[number], string> = {
      product_name: line.name,
      selection: selection ? ` (${selection})` : "",
      qty: String(line.qty),
      unit_price: priced ? money(unitCents / 100, currency) : "",
      item_total: priced ? money((unitCents * line.qty) / 100, currency) : "",
      product_url: line.url,
    };
    itemTexts.push(renderTemplate(itemTemplate, itemValues));
  }

  let total = "";
  if (showPrices) {
    const copy = copyPtBr.whatsapp;
    if (totalCents === 0 && pending) {
      total = `${copy.orderTotal}: ${copy.orderAllPending}`;
    } else {
      const sum = money(totalCents / 100, currency);
      total = pending
        ? `${copy.orderTotal}: ${sum} ${copy.orderPendingItems}`
        : `${copy.orderTotal}: ${sum}`;
    }
  }

  const orderValues: Record<(typeof ORDER_MARKERS)[number], string> = {
    items_list: itemTexts.join("\n\n"),
    total_items: String(totalQty),
    total,
  };
  return renderTemplate(orderTemplate, orderValues);
}

export function buildOrderWhatsappUrl(
  number: string,
  message: string,
): { ok: true; url: string } | { ok: false; reason: "too_long" } {
  const url = `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  return url.length > MAX_WHATSAPP_URL_LENGTH
    ? { ok: false, reason: "too_long" }
    : { ok: true, url };
}
