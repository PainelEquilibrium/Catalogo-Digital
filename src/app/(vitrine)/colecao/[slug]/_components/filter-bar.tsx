"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SortKey } from "@/domain/catalog-query";
import {
  serializeCatalogSearchParams,
  type CatalogQuery,
} from "@/domain/catalog-query";
import type { CategoryField } from "@/domain/category-fields";
import { copyPtBr } from "@/lib/copy/pt-br";

type FilterBarProps = {
  slug: string;
  query: CatalogQuery;
  filterableFields: CategoryField[];
  sortOptions: SortKey[];
};

function toggleFilterValue(
  query: CatalogQuery,
  key: string,
  value: string,
): Omit<CatalogQuery, "cursor"> {
  const current = query.filters[key] ?? [];
  const nextValues = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];

  const filters = { ...query.filters };
  if (nextValues.length === 0) {
    delete filters[key];
  } else {
    filters[key] = nextValues;
  }

  return {
    q: query.q,
    ordenar: query.ordenar,
    filters,
  };
}

function buildCollectionHref(
  slug: string,
  query: Omit<CatalogQuery, "cursor">,
): string {
  const serialized = serializeCatalogSearchParams(query);
  return serialized.length > 0
    ? `/colecao/${slug}?${serialized}`
    : `/colecao/${slug}`;
}

function isFilterActive(
  query: CatalogQuery,
  key: string,
  value: string,
): boolean {
  return (query.filters[key] ?? []).includes(value);
}

export function FilterBar({
  slug,
  query,
  filterableFields,
  sortOptions,
}: FilterBarProps) {
  const router = useRouter();

  const hasActiveFilters = Object.keys(query.filters).length > 0;

  function handleSortChange(nextSort: string) {
    const nextQuery: Omit<CatalogQuery, "cursor"> = {
      q: query.q,
      ordenar: nextSort as SortKey,
      filters: query.filters,
    };
    router.push(buildCollectionHref(slug, nextQuery));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor="collection-sort"
            className="text-sm font-medium text-[var(--color-text)]"
          >
            {copyPtBr.catalog.sortLabel}
          </label>
          <select
            id="collection-sort"
            value={query.ordenar}
            onChange={(event) => handleSortChange(event.target.value)}
            className="min-h-11 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--color-text)_15%,transparent)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            {sortOptions.map((option) => (
              <option key={option} value={option}>
                {copyPtBr.sort[option]}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters ? (
          <Link
            href={buildCollectionHref(slug, {
              q: query.q,
              ordenar: query.ordenar,
              filters: {},
            })}
            className="text-sm text-[var(--color-primary)] underline-offset-2 hover:underline"
          >
            {copyPtBr.catalog.clearFilters}
          </Link>
        ) : null}
      </div>

      {filterableFields.length > 0 ? (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-3 text-sm font-medium text-[var(--color-text)]">
            {copyPtBr.catalog.filtersLabel}
          </legend>
          <div className="flex flex-col gap-4">
            {filterableFields.map((field) => {
              const options =
                field.type === "boolean"
                  ? ["true", "false"]
                  : (field.options ?? []);

              return (
                <div key={field.key}>
                  <p className="mb-2 text-xs uppercase tracking-wide text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                    {field.label}
                  </p>
                  <ul className="flex flex-wrap gap-2 p-0">
                    {options.map((option) => {
                      const active = isFilterActive(query, field.key, option);
                      const label =
                        field.type === "boolean"
                          ? option === "true"
                            ? "Sim"
                            : "Não"
                          : option;
                      const href = buildCollectionHref(
                        slug,
                        toggleFilterValue(query, field.key, option),
                      );

                      return (
                        <li key={option} className="list-none">
                          <Link
                            href={href}
                            aria-pressed={active}
                            className={`inline-flex min-h-9 items-center rounded-[var(--radius)] border px-3 py-1.5 text-sm transition-colors ${
                              active
                                ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]"
                                : "border-[color-mix(in_srgb,var(--color-text)_15%,transparent)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
                            }`}
                          >
                            {label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
