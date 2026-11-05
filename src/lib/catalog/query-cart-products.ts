import { decimalToNumber } from "@/domain/product";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { publicProductWhere } from "@/lib/catalog/catalog-where";
import { prisma } from "@/lib/prisma/client";

export type CartProductDto = {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  promoPrice: number | null;
  thumbUrl: string | null;
};

/** Só o que a vitrine já mostra: publicado, fora da lixeira, categoria ativa. Id ausente = indisponível. */
export async function queryCartProducts(ids: string[]): Promise<CartProductDto[]> {
  const branding = await resolveBranding();
  const showPrices = branding.behavior.show_prices;

  const rows = await prisma.product.findMany({
    where: { ...publicProductWhere(), id: { in: ids } },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      promoPrice: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { thumbUrl: true } },
    },
  });

  // Rota pública: com preços desligados, o valor nem sai do servidor.
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: showPrices ? decimalToNumber(row.price) : null,
    promoPrice: showPrices ? decimalToNumber(row.promoPrice) : null,
    thumbUrl: row.images[0]?.thumbUrl ?? null,
  }));
}
