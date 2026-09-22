export type FormattedPrice =
  | { kind: "consulta" }
  | { kind: "regular"; label: string }
  | { kind: "promo"; from: string; to: string };

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  })
    .format(amount)
    .replace(/\u00A0/g, " ");
}

export function formatProductPrice(input: {
  price: number | null;
  promoPrice: number | null;
  showPrices: boolean;
  currency?: string;
}): FormattedPrice {
  const currency = input.currency ?? "BRL";

  if (!input.showPrices || input.price == null) {
    return { kind: "consulta" };
  }

  if (input.promoPrice != null) {
    return {
      kind: "promo",
      from: formatCurrency(input.price, currency),
      to: formatCurrency(input.promoPrice, currency),
    };
  }

  return {
    kind: "regular",
    label: formatCurrency(input.price, currency),
  };
}
