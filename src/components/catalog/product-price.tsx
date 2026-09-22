import { formatProductPrice } from "@/domain/price";
import { copyPtBr } from "@/lib/copy/pt-br";

type ProductPriceProps = {
  price: number | null;
  promoPrice: number | null;
  showPrices: boolean;
  currency: string;
};

export function ProductPrice({
  price,
  promoPrice,
  showPrices,
  currency,
}: ProductPriceProps) {
  const formatted = formatProductPrice({
    price,
    promoPrice,
    showPrices,
    currency,
  });

  if (formatted.kind === "consulta") {
    return (
      <p className="text-sm text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
        {copyPtBr.price.onRequest}
      </p>
    );
  }

  if (formatted.kind === "promo") {
    return (
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span className="text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] line-through">
          {formatted.from}
        </span>
        <span className="font-medium text-[var(--color-primary)]">
          {formatted.to}
        </span>
      </p>
    );
  }

  return (
    <p className="text-sm font-medium text-[var(--color-text)]">
      {formatted.label}
    </p>
  );
}
