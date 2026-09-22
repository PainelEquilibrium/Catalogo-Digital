export function buildWhatsappUrl(input: {
  number: string | null;
  template: string;
  productName: string;
  productUrl: string;
  priceLabel: string | null;
}): string | null {
  const digits = (input.number ?? "").replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  let message = input.template
    .replaceAll("{product_name}", input.productName)
    .replaceAll("{product_url}", input.productUrl);

  if (input.priceLabel === null) {
    message = message.replaceAll("{price}", "");
    message = message.replace(/\s{2,}/g, " ").trim();
  } else {
    message = message.replaceAll("{price}", input.priceLabel);
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
