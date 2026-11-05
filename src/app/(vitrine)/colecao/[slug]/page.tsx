import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  parseCatalogSearchParams,
  serializeCatalogSearchParams,
} from "@/domain/catalog-query";
import {
  getPublicFilterableKeys,
  parseFieldsSchema,
  type CategoryField,
} from "@/domain/category-fields";
import { FilterBar } from "./_components/filter-bar";
import { ProductGridWithLoadMore } from "./_components/load-more";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { copyPtBr } from "@/lib/copy/pt-br";
import { isValidCollectionSlug } from "@/lib/catalog/collection-slug";
import { queryCategoryBySlug } from "@/lib/catalog/query-categories";
import { queryProducts } from "@/lib/catalog/query-products";
import { categoryOgImages, storeOgImages } from "@/lib/seo/og-image";
import { getSiteUrl } from "@/config/site";
import { CurrentUrlShareButton } from "@/components/catalog/share-button";

type CollectionPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toUrlSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else {
      params.set(key, value);
    }
  }
  return params;
}

function filterableFieldsFromSchema(
  fields: CategoryField[],
  filterableKeys: string[],
): CategoryField[] {
  const keys = new Set(filterableKeys);
  return fields.filter((field) => keys.has(field.key));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const branding = await resolveBranding();

  if (!isValidCollectionSlug(slug)) {
    return { title: copyPtBr.catalog.collectionTitle };
  }

  let category: Awaited<ReturnType<typeof queryCategoryBySlug>>;
  try {
    category = await queryCategoryBySlug(slug);
  } catch (error) {
    console.error("[colecao] Falha ao ler categoria para metadados.", error);
    return {
      title: copyPtBr.catalog.collectionTitle,
      openGraph: { siteName: branding.store.name, images: storeOgImages(branding, branding.store.name) },
    };
  }
  if (!category) {
    return { title: copyPtBr.catalog.collectionTitle };
  }

  // Não lê searchParams: com ou sem filtros a miniatura é a mesma.
  return {
    title: category.name,
    openGraph: {
      siteName: branding.store.name,
      title: category.name,
      description: branding.store.tagline,
      images: categoryOgImages(category, branding),
    },
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const { slug } = await params;

  if (!isValidCollectionSlug(slug)) {
    notFound();
  }

  const category = await queryCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  const branding = await resolveBranding();
  const resolvedSearchParams = await searchParams;
  const urlParams = toUrlSearchParams(resolvedSearchParams);
  const fieldsSchema = parseFieldsSchema(category.fieldsSchema);
  const filterableKeys = getPublicFilterableKeys(fieldsSchema);
  const catalogQuery = parseCatalogSearchParams(urlParams, filterableKeys);
  const rscQuery = { ...catalogQuery, cursor: null };

  const { items, nextCursor } = await queryProducts({
    categorySlug: slug,
    query: rscQuery,
  });

  const apiQueryString = serializeCatalogSearchParams({
    q: catalogQuery.q,
    ordenar: catalogQuery.ordenar,
    filters: catalogQuery.filters,
  });

  const filterableFields = filterableFieldsFromSchema(
    fieldsSchema,
    filterableKeys,
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-heading text-3xl font-medium tracking-tight text-[var(--color-text)] sm:text-4xl">
            {category.name}
          </h1>
          <CurrentUrlShareButton siteUrl={getSiteUrl()} title={category.name} />
        </div>
        {category.description ? (
          <p className="max-w-2xl text-base text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
            {category.description}
          </p>
        ) : null}
      </header>

      <FilterBar
        basePath={`/colecao/${slug}`}
        query={catalogQuery}
        filterableFields={filterableFields}
        sortOptions={branding.behavior.sort_options}
      />

      {items.length === 0 ? (
        <p className="text-center text-base text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
          {branding.empty_states.no_results}
        </p>
      ) : (
        <ProductGridWithLoadMore
          key={apiQueryString}
          slug={slug}
          initialItems={items}
          initialNextCursor={nextCursor}
          queryString={apiQueryString}
          branding={branding}
        />
      )}
    </div>
  );
}
