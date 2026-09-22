import Image from "next/image";
import Link from "next/link";
import type { ProductCard as ProductCardModel } from "@/domain/product";
import { copyPtBr } from "@/lib/copy/pt-br";
import { ProductPrice } from "@/components/catalog/product-price";

const FALLBACK_CARD_SRC =
  "https://placehold.co/800x800/png?text=Produto";

type ProductCardProps = {
  product: ProductCardModel;
};

export function ProductCard({ product }: ProductCardProps) {
  const cover = product.coverImage;
  const src = cover?.cardUrl ?? FALLBACK_CARD_SRC;

  return (
    <article className="group flex flex-col gap-3">
      <Link
        href={`/produto/${product.slug}`}
        className="relative block aspect-[3/4] overflow-hidden rounded-[var(--radius)] bg-[var(--color-surface)]"
      >
        <Image
          src={src}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {product.badges.promo ? (
          <span className="absolute left-2 top-2 rounded-[var(--radius)] bg-[var(--color-accent)] px-2 py-0.5 text-xs font-medium text-[var(--color-background)]">
            {copyPtBr.price.promoBadge}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-col gap-1">
        <Link
          href={`/produto/${product.slug}`}
          className="font-heading text-base leading-snug text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)]"
        >
          {product.name}
        </Link>
        <ProductPrice
          price={product.price}
          promoPrice={product.promoPrice}
          showPrices={product.showPrices}
          currency={product.currency}
        />
      </div>
    </article>
  );
}
