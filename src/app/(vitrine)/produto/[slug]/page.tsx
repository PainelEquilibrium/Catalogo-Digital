import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Branding } from "@/domain/branding";
import { parseFieldsSchema } from "@/domain/category-fields";
import { customerChoices } from "@/domain/customer-choices";
import type { ProductCard } from "@/domain/product";
import { ProductCard as CatalogProductCard } from "@/components/catalog/product-card";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { ProductPrice } from "@/components/catalog/product-price";
import { ShareButton } from "@/components/catalog/share-button";
import { ProductPurchase } from "@/components/catalog/product-purchase";
import { getSiteUrl } from "@/config/site";
import {
  formatProductAttributeValue,
  isPresentAttributeValue,
} from "@/lib/catalog/format-product-attribute";
import { isValidCollectionSlug } from "@/lib/catalog/collection-slug";
import { queryCategoryBySlug } from "@/lib/catalog/query-categories";
import {
  queryProductBySlug,
  queryRelated,
} from "@/lib/catalog/query-product-by-slug";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { copyPtBr } from "@/lib/copy/pt-br";

// Catálogo não pode ficar estático no deploy.
export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

function RelatedGrid({
  products,
  branding,
}: {
  products: ProductCard[];
  branding: Branding;
}) {
  const { mobile, desktop } = branding.theme.products_per_row;

  return (
    <ul
      className="grid list-none gap-x-4 gap-y-8 p-0 [grid-template-columns:repeat(var(--grid-cols-mobile),minmax(0,1fr))] md:[grid-template-columns:repeat(var(--grid-cols-desktop),minmax(0,1fr))]"
      style={
        {
          "--grid-cols-mobile": mobile,
          "--grid-cols-desktop": desktop,
        } as CSSProperties
      }
    >
      {products.map((item) => (
        <li key={item.id}>
          <CatalogProductCard product={item} />
        </li>
      ))}
    </ul>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (!isValidCollectionSlug(slug)) {
    return { title: copyPtBr.catalog.collectionTitle };
  }

  const product = await queryProductBySlug(slug);
  if (!product) {
    return { title: copyPtBr.catalog.collectionTitle };
  }

  const cover = product.gallery[0];
  const ogImage = cover?.ogUrl ?? cover?.detailUrl;

  const openGraph: Metadata["openGraph"] = {
    title: product.name,
    images: ogImage
      ? [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: product.name,
          },
        ]
      : undefined,
  };

  return {
    title: product.name,
    openGraph,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  if (!isValidCollectionSlug(slug)) {
    notFound();
  }

  const product = await queryProductBySlug(slug);
  if (!product) {
    notFound();
  }

  const branding = await resolveBranding();
  const category = await queryCategoryBySlug(product.categorySlug);
  const related = await queryRelated(product.categoryId, product.id);
  const choices = customerChoices(
    parseFieldsSchema(category?.fieldsSchema ?? []),
    Object.fromEntries(product.attributes.map((attribute) => [attribute.key, attribute.value])),
  );
  const choiceKeys = new Set(choices.map((choice) => choice.key));
  const shareUrl = `${getSiteUrl()}/produto/${product.slug}`;
  // Campos "cliente escolhe" viram seletores abaixo; não repetem na lista de atributos.
  const visibleAttributes = product.attributes.filter(
    (attribute) => !choiceKeys.has(attribute.key) && isPresentAttributeValue(attribute.value),
  );

  return (
    <div className="flex w-full flex-col gap-12 pb-8 sm:pb-12">
      <article className="flex min-w-0 flex-col gap-8 sm:gap-12">
        <ProductGallery images={product.gallery} productName={product.name} />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6">
          <header className="flex flex-col gap-3">
            <Link
              href={`/colecao/${product.categorySlug}`}
              className="text-sm text-[color-mix(in_srgb,var(--color-text)_65%,transparent)] transition-colors hover:text-[var(--color-primary)]"
            >
              {category?.name ?? product.categorySlug}
            </Link>
            <h1 className="font-heading text-3xl font-medium tracking-tight text-[var(--color-text)] sm:text-4xl">
              {product.name}
            </h1>
            <ProductPrice
              price={product.price}
              promoPrice={product.promoPrice}
              showPrices={product.showPrices}
              currency={product.currency}
            />
          </header>

          {product.description ? (
            <p className="whitespace-pre-line text-base leading-relaxed text-[var(--color-text)]">
              {product.description}
            </p>
          ) : null}

          {visibleAttributes.length > 0 ? (
            <dl className="grid gap-3 border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pt-6">
              {visibleAttributes.map((attribute) => (
                <div
                  key={attribute.key}
                  className="grid gap-1 sm:grid-cols-[minmax(0,8rem)_1fr] sm:gap-4"
                >
                  <dt className="text-sm font-medium text-[color-mix(in_srgb,var(--color-text)_65%,transparent)]">
                    {attribute.label}
                  </dt>
                  <dd className="text-sm text-[var(--color-text)]">
                    {attribute.type === "url" &&
                    typeof attribute.value === "string" ? (
                      <a
                        href={attribute.value}
                        className="break-all text-[var(--color-primary)] underline-offset-2 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {attribute.value}
                      </a>
                    ) : (
                      formatProductAttributeValue(attribute)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="flex flex-col gap-4 border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pt-6">
            <ProductPurchase product={{ id: product.id, slug: product.slug }} choices={choices} />
            <div>
              <ShareButton url={shareUrl} title={product.name} />
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6" aria-labelledby="related-products-heading">
          <h2
            id="related-products-heading"
            className="mb-6 font-heading text-2xl font-medium tracking-tight text-[var(--color-text)] sm:text-3xl"
          >
            {copyPtBr.catalog.relatedProducts}
          </h2>
          <RelatedGrid products={related} branding={branding} />
        </section>
      ) : null}
    </div>
  );
}
