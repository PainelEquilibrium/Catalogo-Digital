import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AdminProductFilters } from "@/components/admin/admin-product-filters";
import { AdminProductPrice } from "@/components/admin/admin-product-price";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import {
  queryAdminProducts,
  type AdminProductRow,
} from "@/lib/catalog/query-admin-products";
import { queryAdminCategories } from "@/lib/catalog/query-admin-categories";

const copy = copyAdminPtBr.products;

type PageProps = {
  searchParams: Promise<{
    q?: string;
    categoria?: string;
    status?: string;
    page?: string;
  }>;
};

function parseStatus(
  raw: string | undefined,
): "draft" | "published" | null {
  if (raw === "draft" || raw === "published") {
    return raw;
  }
  return null;
}

async function loadAccumulatedProducts(input: {
  q: string | null;
  categoryId: string | null;
  status: "draft" | "published" | null;
  page: number;
}): Promise<{ items: AdminProductRow[]; hasMore: boolean }> {
  const allItems: AdminProductRow[] = [];
  let hasMore = false;

  for (let currentPage = 1; currentPage <= input.page; currentPage += 1) {
    const result = await queryAdminProducts({
      q: input.q,
      categoryId: input.categoryId,
      status: input.status,
      page: currentPage,
    });
    allItems.push(...result.items);
    hasMore = result.hasMore;
    if (result.items.length === 0) {
      break;
    }
  }

  return { items: allItems, hasMore };
}

function buildLoadMoreHref(
  base: {
    q: string;
    categoria: string;
    status: string;
    page: number;
  },
): string {
  const params = new URLSearchParams();
  if (base.q) {
    params.set("q", base.q);
  }
  if (base.categoria) {
    params.set("categoria", base.categoria);
  }
  if (base.status) {
    params.set("status", base.status);
  }
  params.set("page", String(base.page + 1));
  return `/admin/produtos?${params.toString()}`;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const categoria = params.categoria?.trim() ?? "";
  const status = parseStatus(params.status);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const [categories, branding, productResult] = await Promise.all([
    queryAdminCategories(),
    resolveBranding(),
    loadAccumulatedProducts({
      q: q || null,
      categoryId: categoria || null,
      status,
      page,
    }),
  ]);

  const { items, hasMore } = productResult;
  const hasFilters = Boolean(q || categoria || status);
  const showPrices = branding.behavior.show_prices;
  const currency = branding.behavior.currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <Button asChild className="min-h-11">
          <Link href="/admin/produtos/novo">{copy.new}</Link>
        </Button>
      </div>

      <Suspense fallback={null}>
        <AdminProductFilters
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
          }))}
          initialQ={q}
          initialCategoryId={categoria}
          initialStatus={params.status ?? ""}
        />
      </Suspense>

      {items.length === 0 ? (
        <p className="text-muted-foreground">
          {hasFilters ? copy.emptyFiltered : copy.empty}
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.colCover}</TableHead>
                <TableHead>{copy.colName}</TableHead>
                <TableHead>{copy.colCategory}</TableHead>
                <TableHead>{copy.colPrice}</TableHead>
                <TableHead>{copy.colStatus}</TableHead>
                <TableHead>{copy.colFeatured}</TableHead>
                <TableHead>{copy.colUpdated}</TableHead>
                <TableHead className="text-right">{copy.edit}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.coverImageUrl ? (
                      <Image
                        src={product.coverImageUrl}
                        alt=""
                        width={48}
                        height={48}
                        className="size-12 rounded object-cover"
                      />
                    ) : (
                      <span
                        className="inline-block size-12 rounded bg-muted"
                        aria-hidden
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category.name}</TableCell>
                  <TableCell>
                    <AdminProductPrice
                      price={product.price}
                      promoPrice={product.promoPrice}
                      showPrices={showPrices}
                      currency={currency}
                    />
                  </TableCell>
                  <TableCell>
                    {product.status === "published"
                      ? copy.statusPublished
                      : copy.statusDraft}
                  </TableCell>
                  <TableCell>
                    {product.isFeatured ? copy.featuredYes : copy.featuredNo}
                  </TableCell>
                  <TableCell>
                    {product.updatedAt.toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <ProductRowActions productId={product.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {hasMore ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link
                href={buildLoadMoreHref({
                  q,
                  categoria,
                  status: params.status ?? "",
                  page,
                })}
              >
                {copy.loadMore}
              </Link>
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
