import type { Category } from "@/generated/prisma/client";
import { type CategoryCard } from "@/domain/product";
import { prisma } from "@/lib/prisma/client";
import { publicCategoryWhere } from "@/lib/catalog/catalog-where";

export async function queryActiveCategories(): Promise<CategoryCard[]> {
  const rows = await prisma.category.findMany({
    where: publicCategoryWhere(),
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      coverImageUrl: true,
      sortOrder: true,
    },
  });

  return rows;
}

export async function queryCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  return prisma.category.findFirst({
    where: publicCategoryWhere(slug),
  });
}
