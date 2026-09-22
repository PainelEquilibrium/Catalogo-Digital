import type { Prisma } from "@/generated/prisma/client";
import { decimalToNumber } from "@/domain/product";
import { productCoverSelect } from "@/lib/catalog/catalog-where";
import { prisma } from "@/lib/prisma/client";

export const ADMIN_PAGE_SIZE = 30;

export type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  isFeatured: boolean;
  price: number | null;
  promoPrice: number | null;
  updatedAt: Date;
  category: { id: string; name: string };
  coverImageUrl: string | null;
};

export function buildAdminProductWhere(input: {
  q: string | null;
  categoryId: string | null;
  status: "draft" | "published" | null;
}): Prisma.ProductWhereInput {
  const q = input.q?.trim();

  return {
    deletedAt: null,
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };
}

export function adminProductListPagination(page: number): {
  skip: number;
  take: number;
} {
  const safePage = Math.max(1, page);
  return {
    skip: (safePage - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE + 1,
  };
}

export async function queryAdminProducts(input: {
  q: string | null;
  categoryId: string | null;
  status: "draft" | "published" | null;
  page: number;
}): Promise<{ items: AdminProductRow[]; hasMore: boolean }> {
  const { skip, take } = adminProductListPagination(input.page);

  const rows = await prisma.product.findMany({
    where: buildAdminProductWhere(input),
    orderBy: { updatedAt: "desc" },
    skip,
    take,
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      isFeatured: true,
      price: true,
      promoPrice: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      images: productCoverSelect,
    },
  });

  const hasMore = rows.length > ADMIN_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, ADMIN_PAGE_SIZE) : rows;

  return {
    items: pageRows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      isFeatured: row.isFeatured,
      price: decimalToNumber(row.price),
      promoPrice: decimalToNumber(row.promoPrice),
      updatedAt: row.updatedAt,
      category: row.category,
      coverImageUrl: row.images[0]?.cardUrl ?? null,
    })),
    hasMore,
  };
}
