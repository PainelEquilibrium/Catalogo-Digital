import type { Metadata } from "next";
import {
  parseCatalogSearchParams,
  serializeCatalogSearchParams,
} from "@/domain/catalog-query";
import { FilterBar } from "@/app/(vitrine)/colecao/[slug]/_components/filter-bar";
import { ProductGridWithLoadMore } from "@/app/(vitrine)/colecao/[slug]/_components/load-more";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { copyPtBr } from "@/lib/copy/pt-br";
import { queryProducts } from "@/lib/catalog/query-products";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: copyPtBr.catalog.allProducts,
  robots: { index: false },
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, ordenar } = await searchParams;
  const urlParams = new URLSearchParams();
  if (typeof q === "string") {
    urlParams.set("q", q);
  }
  if (typeof ordenar === "string") {
    urlParams.set("ordenar", ordenar);
  }

  // Campos filtráveis variam por categoria; aqui só há busca e ordenação.
  const catalogQuery = parseCatalogSearchParams(urlParams, []);
  const branding = await resolveBranding();
  const { items, nextCursor } = await queryProducts({
    query: { ...catalogQuery, cursor: null },
  });
  const apiQueryString = serializeCatalogSearchParams(catalogQuery);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-heading text-3xl font-medium tracking-tight text-[var(--color-text)] sm:text-4xl">
        {catalogQuery.q
          ? copyPtBr.catalog.searchResults(catalogQuery.q)
          : copyPtBr.catalog.allProducts}
      </h1>

      <FilterBar
        basePath="/busca"
        query={catalogQuery}
        filterableFields={[]}
        sortOptions={branding.behavior.sort_options}
      />

      {items.length === 0 ? (
        <p className="text-center text-base text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
          {branding.empty_states.no_results}
        </p>
      ) : (
        <ProductGridWithLoadMore
          key={apiQueryString}
          initialItems={items}
          initialNextCursor={nextCursor}
          queryString={apiQueryString}
          branding={branding}
        />
      )}
    </div>
  );
}
