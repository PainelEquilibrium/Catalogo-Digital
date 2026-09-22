"use client";

import { useState, type CSSProperties } from "react";
import type { Branding } from "@/domain/branding";
import type { ProductCard } from "@/domain/product";
import { ProductCard as CatalogProductCard } from "@/components/catalog/product-card";
import { copyPtBr } from "@/lib/copy/pt-br";

type ProductGridWithLoadMoreProps = {
  slug: string;
  initialItems: ProductCard[];
  initialNextCursor: string | null;
  queryString: string;
  branding: Branding;
};

export function appendProductCards(
  existing: ProductCard[],
  incoming: ProductCard[],
): ProductCard[] {
  const seen = new Set(existing.map((product) => product.id));
  const uniqueIncoming = incoming.filter((product) => !seen.has(product.id));
  return [...existing, ...uniqueIncoming];
}

export async function fetchMoreProductCards(
  slug: string,
  cursor: string,
  queryString: string,
): Promise<{ items: ProductCard[]; nextCursor: string | null }> {
  const params = new URLSearchParams(queryString);
  params.set("slug", slug);
  params.set("cursor", cursor);

  const response = await fetch(`/api/vitrine/produtos?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Falha ao carregar produtos (${response.status})`);
  }

  return response.json() as Promise<{
    items: ProductCard[];
    nextCursor: string | null;
  }>;
}

export function ProductGridWithLoadMore({
  slug,
  initialItems,
  initialNextCursor,
  queryString,
  branding,
}: ProductGridWithLoadMoreProps) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mobile, desktop } = branding.theme.products_per_row;

  async function handleLoadMore() {
    if (!nextCursor || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const page = await fetchMoreProductCards(slug, nextCursor, queryString);
      setItems((current) => appendProductCards(current, page.items));
      setNextCursor(page.nextCursor);
    } catch {
      setError(copyPtBr.error.description);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ul
        className="grid list-none gap-x-4 gap-y-8 p-0 [grid-template-columns:repeat(var(--grid-cols-mobile),minmax(0,1fr))] md:[grid-template-columns:repeat(var(--grid-cols-desktop),minmax(0,1fr))]"
        style={
          {
            "--grid-cols-mobile": mobile,
            "--grid-cols-desktop": desktop,
          } as CSSProperties
        }
      >
        {items.map((product) => (
          <li key={product.id}>
            <CatalogProductCard product={product} />
          </li>
        ))}
      </ul>

      {error ? (
        <p className="text-center text-sm text-[var(--color-accent)]">{error}</p>
      ) : null}

      {nextCursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading}
            className="min-h-11 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] bg-[var(--color-surface)] px-6 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-60"
          >
            {loading ? copyPtBr.catalog.loadingMore : copyPtBr.catalog.loadMore}
          </button>
        </div>
      ) : null}
    </div>
  );
}
