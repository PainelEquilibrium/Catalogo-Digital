import { Prisma } from "@/generated/prisma/client";
import {
  encodeCursor,
  PAGE_SIZE,
  type CatalogQuery,
  type Cursor,
} from "@/domain/catalog-query";
import { mapProductToCard, type ProductCard } from "@/domain/product";
import { parseFieldsSchema } from "@/domain/category-fields";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { prisma } from "@/lib/prisma/client";
import {
  buildAttributeFilterClauses,
  buildKeysetWhere,
  buildOrderBy,
  cursorValueFromProduct,
  productCoverSelect,
  publicCategoryWhere,
  publicProductWhere,
} from "@/lib/catalog/catalog-where";

const productListSelect = {
  id: true,
  slug: true,
  name: true,
  price: true,
  promoPrice: true,
  createdAt: true,
  isFeatured: true,
  images: productCoverSelect,
} as const;

async function resolvePricing() {
  const branding = await resolveBranding();
  return {
    showPrices: branding.behavior.show_prices,
    currency: branding.behavior.currency,
  };
}

async function searchProductIdsInCategory(
  categoryId: string,
  queryText: string,
): Promise<string[]> {
  const pattern = `%${queryText}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT p.id
    FROM public.products p
    INNER JOIN public.categories c ON c.id = p.category_id
    WHERE p.category_id = ${categoryId}::uuid
      AND p.status = 'published'
      AND p.deleted_at IS NULL
      AND c.is_active = true
      AND c.deleted_at IS NULL
      AND (
        extensions.unaccent(p.name) ILIKE extensions.unaccent(${pattern})
        OR extensions.unaccent(p.slug) ILIKE extensions.unaccent(${pattern})
        OR extensions.unaccent(p.attributes::text) ILIKE extensions.unaccent(${pattern})
      )
  `);
  return rows.map((row) => row.id);
}

function activeCursor(query: CatalogQuery): Cursor | null {
  if (!query.cursor || query.cursor.o !== query.ordenar) {
    return null;
  }
  return query.cursor;
}

export async function queryProducts(input: {
  categorySlug: string;
  query: CatalogQuery;
}): Promise<{ items: ProductCard[]; nextCursor: string | null }> {
  const category = await prisma.category.findFirst({
    where: publicCategoryWhere(input.categorySlug),
    select: {
      id: true,
      fieldsSchema: true,
    },
  });

  if (!category) {
    return { items: [], nextCursor: null };
  }

  const fieldsSchema = parseFieldsSchema(category.fieldsSchema);
  const pricing = await resolvePricing();
  const sort = input.query.ordenar;
  const cursor = activeCursor(input.query);

  const andWhere: Prisma.ProductWhereInput[] = [
    publicProductWhere(category.id),
    ...buildAttributeFilterClauses(input.query.filters, fieldsSchema),
  ];

  if (input.query.q) {
    const matchedIds = await searchProductIdsInCategory(
      category.id,
      input.query.q,
    );
    if (matchedIds.length === 0) {
      return { items: [], nextCursor: null };
    }
    andWhere.push({ id: { in: matchedIds } });
  }

  if (cursor) {
    andWhere.push(buildKeysetWhere(sort, cursor));
  }

  const rows = await prisma.product.findMany({
    where: { AND: andWhere },
    orderBy: buildOrderBy(sort),
    take: PAGE_SIZE + 1,
    select: productListSelect,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = pageRows.at(-1);

  return {
    items: pageRows.map((row) => mapProductToCard(row, pricing)),
    nextCursor:
      hasMore && last
        ? encodeCursor({
            o: sort,
            v: cursorValueFromProduct(last, sort),
            i: last.id,
          })
        : null,
  };
}

export async function queryHomeRails(limits: {
  newArrivals: number;
  featured: number;
  onSale: number;
}): Promise<{
  newArrivals: ProductCard[];
  featured: ProductCard[];
  onSale: ProductCard[];
}> {
  const pricing = await resolvePricing();
  const baseWhere = publicProductWhere();

  const [newArrivals, featured, onSale] = await Promise.all([
    prisma.product.findMany({
      where: baseWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limits.newArrivals,
      select: productListSelect,
    }),
    prisma.product.findMany({
      where: { ...baseWhere, isFeatured: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limits.featured,
      select: productListSelect,
    }),
    prisma.product.findMany({
      where: { ...baseWhere, promoPrice: { not: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limits.onSale,
      select: productListSelect,
    }),
  ]);

  return {
    newArrivals: newArrivals.map((row) => mapProductToCard(row, pricing)),
    featured: featured.map((row) => mapProductToCard(row, pricing)),
    onSale: onSale.map((row) => mapProductToCard(row, pricing)),
  };
}

export async function queryRelated(
  categoryId: string,
  excludeId: string,
  limit = 4,
): Promise<ProductCard[]> {
  const pricing = await resolvePricing();
  const rows = await prisma.product.findMany({
    where: {
      ...publicProductWhere(categoryId),
      id: { not: excludeId },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: productListSelect,
  });

  return rows.map((row) => mapProductToCard(row, pricing));
}
