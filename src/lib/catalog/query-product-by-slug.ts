import {
  buildDetailAttributes,
  mapProductToCard,
  type ProductDetail,
} from "@/domain/product";
import { parseFieldsSchema } from "@/domain/category-fields";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { prisma } from "@/lib/prisma/client";
import { publicCategoryWhere } from "@/lib/catalog/catalog-where";

export async function queryProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const branding = await resolveBranding();
  const pricing = {
    showPrices: branding.behavior.show_prices,
    currency: branding.behavior.currency,
  };

  const product = await prisma.product.findFirst({
    where: {
      slug,
      status: "published",
      deletedAt: null,
      category: publicCategoryWhere(),
    },
    include: {
      category: {
        select: {
          id: true,
          slug: true,
          fieldsSchema: true,
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          thumbUrl: true,
          cardUrl: true,
          detailUrl: true,
          ogUrl: true,
          width: true,
          height: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!product) {
    return null;
  }

  const fieldsSchema = parseFieldsSchema(product.category.fieldsSchema);
  const attributes =
    typeof product.attributes === "object" && product.attributes !== null
      ? (product.attributes as Record<string, unknown>)
      : {};

  const card = mapProductToCard(
    {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      promoPrice: product.promoPrice,
      images: product.images.length > 0 ? [product.images[0]!] : [],
    },
    pricing,
  );

  return {
    ...card,
    description: product.description,
    attributes: buildDetailAttributes(fieldsSchema, attributes),
    gallery: product.images,
    categoryId: product.category.id,
    categorySlug: product.category.slug,
  };
}

export { queryRelated } from "@/lib/catalog/query-products";
