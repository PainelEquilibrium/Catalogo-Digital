import { prisma } from "@/lib/prisma/client";
import {
  publicCategoryWhere,
  publicProductWhere,
} from "@/lib/catalog/catalog-where";

const LEGAL_PATHS = ["/privacidade", "/cookies", "/termos"] as const;

export type SitemapPathEntry = {
  path: string;
  lastModified?: Date;
};

export async function querySitemapPaths(): Promise<SitemapPathEntry[]> {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: publicCategoryWhere(),
      select: { slug: true, updatedAt: true },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    }),
    prisma.product.findMany({
      where: publicProductWhere(),
      select: { slug: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { slug: "asc" }],
    }),
  ]);

  return [
    { path: "/" },
    ...categories.map((category) => ({
      path: `/colecao/${category.slug}`,
      lastModified: category.updatedAt,
    })),
    ...products.map((product) => ({
      path: `/produto/${product.slug}`,
      lastModified: product.updatedAt,
    })),
    ...LEGAL_PATHS.map((path) => ({ path })),
  ];
}
