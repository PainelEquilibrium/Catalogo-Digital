import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";

export type AdminCategoryRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  fieldsSchema: Prisma.JsonValue;
  _count: {
    products: number;
  };
};

export async function queryAdminCategories(): Promise<AdminCategoryRow[]> {
  return prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      sortOrder: true,
      fieldsSchema: true,
      _count: {
        select: {
          products: {
            where: { deletedAt: null },
          },
        },
      },
    },
  });
}
