import { formatProductPrice } from "@/domain/price";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

const copy = copyAdminPtBr.products;

type AdminProductPriceProps = {
  price: number | null;
  promoPrice: number | null;
  showPrices: boolean;
  currency: string;
};

export function AdminProductPrice({
  price,
  promoPrice,
  showPrices,
  currency,
}: AdminProductPriceProps) {
  const formatted = formatProductPrice({
    price,
    promoPrice,
    showPrices,
    currency,
  });

  if (formatted.kind === "consulta") {
    return <span className="text-muted-foreground">{copy.priceOnRequest}</span>;
  }

  if (formatted.kind === "promo") {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-muted-foreground line-through">{formatted.from}</span>
        <span className="font-medium">{formatted.to}</span>
      </span>
    );
  }

  return <span>{formatted.label}</span>;
}
