import type { CategoryField } from "@/domain/category-fields";

type DecimalLike = { toNumber(): number };

export type ProductCardBadges = {
  promo?: true;
};

export type ProductCardCoverImage = {
  cardUrl: string;
  width: number | null;
  height: number | null;
};

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  price: number | null;
  promoPrice: number | null;
  showPrices: boolean;
  currency: string;
  coverImage: ProductCardCoverImage | null;
  badges: ProductCardBadges;
};

export type ProductGalleryImage = {
  id: string;
  thumbUrl: string;
  cardUrl: string;
  detailUrl: string;
  ogUrl: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
};

export type ProductDetailAttribute = {
  key: string;
  label: string;
  type: CategoryField["type"];
  value: unknown;
};

export type ProductDetail = ProductCard & {
  description: string | null;
  attributes: ProductDetailAttribute[];
  gallery: ProductGalleryImage[];
  categoryId: string;
  categorySlug: string;
};

export type CategoryCard = {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  sortOrder: number;
};

export function decimalToNumber(
  value: DecimalLike | null | undefined,
): number | null {
  if (value == null) {
    return null;
  }
  return value.toNumber();
}

type ProductRowForCard = {
  id: string;
  slug: string;
  name: string;
  price: DecimalLike | null;
  promoPrice: DecimalLike | null;
  images: Array<{
    cardUrl: string;
    width: number | null;
    height: number | null;
  }>;
};

export function mapProductToCard(
  product: ProductRowForCard,
  pricing: { showPrices: boolean; currency: string },
): ProductCard {
  const cover = product.images[0] ?? null;
  const price = decimalToNumber(product.price);
  const promoPrice = decimalToNumber(product.promoPrice);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price,
    promoPrice,
    showPrices: pricing.showPrices,
    currency: pricing.currency,
    coverImage: cover
      ? {
          cardUrl: cover.cardUrl,
          width: cover.width,
          height: cover.height,
        }
      : null,
    badges: promoPrice != null ? { promo: true } : {},
  };
}

export function buildDetailAttributes(
  fieldsSchema: CategoryField[],
  attributes: Record<string, unknown>,
): ProductDetailAttribute[] {
  return fieldsSchema.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    value: attributes[field.key] ?? null,
  }));
}
