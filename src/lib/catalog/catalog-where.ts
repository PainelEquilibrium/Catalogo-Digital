import type { Prisma } from "@/generated/prisma/client";
import {
  getPublicFilterableKeys,
  parseFieldsSchema,
  type CategoryField,
} from "@/domain/category-fields";
import type { SortKey, Cursor } from "@/domain/catalog-query";

export const PRICE_NULL_CURSOR = "null";

/** Alinha cursor keyset com precisão de ms (Prisma/ISO vs timestamptz(6)). */
export function truncateToUtcMillis(date: Date): Date {
  return new Date(date.getTime());
}

export function parseCursorDate(iso: string): Date {
  return truncateToUtcMillis(new Date(iso));
}

/**
 * Bound superior exclusivo para comparar com uma coluna timestamptz(6) que
 * guarda microssegundos. O cursor (Prisma/ISO) só tem precisão de ms, então
 * uma linha com o mesmo ms do cursor mas µs residuais maiores não bate em
 * `equals` nem em `lt`. Usar `[cursorMs, cursorMs+1ms)` cobre esse intervalo.
 */
export function nextUtcMillisecond(date: Date): Date {
  return new Date(date.getTime() + 1);
}

export const productCoverSelect = {
  orderBy: { sortOrder: "asc" as const },
  take: 1,
  select: {
    cardUrl: true,
    width: true,
    height: true,
  },
};

export function publicCategoryWhere(
  slug?: string,
): Prisma.CategoryWhereInput {
  return {
    isActive: true,
    deletedAt: null,
    ...(slug ? { slug } : {}),
  };
}

export function publicProductWhere(
  categoryId?: string,
): Prisma.ProductWhereInput {
  return {
    status: "published",
    deletedAt: null,
    ...(categoryId ? { categoryId } : {}),
    category: publicCategoryWhere(),
  };
}

export function buildAttributeFilterClauses(
  filters: Record<string, string[]>,
  fieldsSchema: CategoryField[],
): Prisma.ProductWhereInput[] {
  const filterableKeys = new Set(getPublicFilterableKeys(fieldsSchema));
  const fieldByKey = new Map(fieldsSchema.map((field) => [field.key, field]));
  const clauses: Prisma.ProductWhereInput[] = [];

  for (const [key, values] of Object.entries(filters)) {
    if (!filterableKeys.has(key) || values.length === 0) {
      continue;
    }

    const field = fieldByKey.get(key);
    if (!field) {
      continue;
    }

    if (field.type === "multiselect") {
      clauses.push({
        OR: values.map((value) => ({
          attributes: {
            path: [key],
            array_contains: value,
          },
        })),
      });
      continue;
    }

    if (field.type === "select") {
      clauses.push({
        OR: values.map((value) => ({
          attributes: {
            path: [key],
            equals: value,
          },
        })),
      });
      continue;
    }

    if (field.type === "boolean") {
      clauses.push({
        OR: values.map((value) => ({
          attributes: {
            path: [key],
            equals:
              value === "true" ? true : value === "false" ? false : value,
          },
        })),
      });
    }
  }

  return clauses;
}

export function buildKeysetWhere(
  sort: SortKey,
  cursor: Cursor,
): Prisma.ProductWhereInput {
  switch (sort) {
    case "novidades": {
      const cursorDate = parseCursorDate(cursor.v);
      return {
        OR: [
          { createdAt: { lt: cursorDate } },
          {
            AND: [
              { createdAt: { gte: cursorDate } },
              { createdAt: { lt: nextUtcMillisecond(cursorDate) } },
              { id: { lt: cursor.i } },
            ],
          },
        ],
      };
    }
    case "preco_asc": {
      if (cursor.v === PRICE_NULL_CURSOR) {
        return { price: null, id: { gt: cursor.i } };
      }
      const price = cursor.v;
      return {
        OR: [
          { price: { gt: price } },
          { price, id: { gt: cursor.i } },
          { price: null },
        ],
      };
    }
    case "preco_desc": {
      if (cursor.v === PRICE_NULL_CURSOR) {
        return { price: null, id: { lt: cursor.i } };
      }
      const price = cursor.v;
      return {
        OR: [
          { price: { lt: price } },
          { price, id: { lt: cursor.i } },
          { price: null },
        ],
      };
    }
    case "destaque": {
      const [featuredToken, createdAtRaw] = cursor.v.split("|");
      const isFeatured = featuredToken === "1";
      const cursorDate = parseCursorDate(createdAtRaw);

      if (isFeatured) {
        return {
          OR: [
            { isFeatured: true, createdAt: { lt: cursorDate } },
            {
              isFeatured: true,
              AND: [
                { createdAt: { gte: cursorDate } },
                { createdAt: { lt: nextUtcMillisecond(cursorDate) } },
                { id: { lt: cursor.i } },
              ],
            },
            { isFeatured: false },
          ],
        };
      }

      return {
        isFeatured: false,
        OR: [
          { createdAt: { lt: cursorDate } },
          {
            AND: [
              { createdAt: { gte: cursorDate } },
              { createdAt: { lt: nextUtcMillisecond(cursorDate) } },
              { id: { lt: cursor.i } },
            ],
          },
        ],
      };
    }
  }
}

export function buildOrderBy(sort: SortKey): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "novidades":
      return [{ createdAt: "desc" }, { id: "desc" }];
    case "preco_asc":
      return [
        { price: { sort: "asc", nulls: "last" } },
        { id: "asc" },
      ];
    case "preco_desc":
      return [
        { price: { sort: "desc", nulls: "last" } },
        { id: "desc" },
      ];
    case "destaque":
      return [
        { isFeatured: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ];
  }
}

export function cursorValueFromProduct(
  product: {
    id: string;
    createdAt: Date;
    price: { toString(): string } | null;
    isFeatured: boolean;
  },
  sort: SortKey,
): string {
  switch (sort) {
    case "novidades":
      return truncateToUtcMillis(product.createdAt).toISOString();
    case "preco_asc":
    case "preco_desc":
      return product.price === null
        ? PRICE_NULL_CURSOR
        : product.price.toString();
    case "destaque":
      return `${product.isFeatured ? "1" : "0"}|${truncateToUtcMillis(product.createdAt).toISOString()}`;
  }
}
