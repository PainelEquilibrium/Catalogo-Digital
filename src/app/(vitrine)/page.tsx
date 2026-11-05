import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { Branding } from "@/domain/branding";
import type { CategoryCard, ProductCard } from "@/domain/product";
import { HomeHero } from "@/components/catalog/home-hero";
import { ProductCard as CatalogProductCard } from "@/components/catalog/product-card";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { queryActiveCategories } from "@/lib/catalog/query-categories";
import { queryHomeRails } from "@/lib/catalog/query-products";
import { storeOgImages } from "@/lib/seo/og-image";

// Catálogo não pode ficar estático no deploy.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await resolveBranding();
  return {
    title: branding.store.name,
    description: branding.store.tagline,
    openGraph: {
      title: branding.store.name,
      description: branding.store.tagline,
      images: storeOgImages(branding, branding.store.name),
    },
  };
}

type HomeRails = {
  newArrivals: ProductCard[];
  featured: ProductCard[];
  onSale: ProductCard[];
};

async function loadHomeCatalog(): Promise<{
  branding: Branding;
  categories: CategoryCard[];
  rails: HomeRails;
}> {
  const branding = await resolveBranding();
  let categories: CategoryCard[] = [];
  let rails: HomeRails = {
    newArrivals: [],
    featured: [],
    onSale: [],
  };

  try {
    categories = await queryActiveCategories();
  } catch (error) {
    console.error("[home] Falha ao listar categorias.", error);
  }

  try {
    rails = await queryHomeRails({
      newArrivals: branding.sections.new_arrivals.limit ?? 8,
      featured: branding.sections.featured.limit ?? 8,
      onSale: branding.sections.on_sale.limit ?? 8,
    });
  } catch (error) {
    console.error("[home] Falha ao listar rails.", error);
  }

  return { branding, categories, rails };
}

function hasRailProducts(rails: HomeRails): boolean {
  return (
    rails.newArrivals.length > 0 ||
    rails.featured.length > 0 ||
    rails.onSale.length > 0
  );
}

function ProductGrid({
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
      {products.map((product) => (
        <li key={product.id}>
          <CatalogProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

function HomeSection({
  title,
  products,
  branding,
}: {
  title: string;
  products: ProductCard[];
  branding: Branding;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 sm:px-6" aria-labelledby={`section-${title}`}>
      <h2
        id={`section-${title}`}
        className="mb-6 font-heading text-2xl font-medium tracking-tight text-[var(--color-text)] sm:text-3xl"
      >
        {title}
      </h2>
      <ProductGrid products={products} branding={branding} />
    </section>
  );
}

function CategoryGrid({
  categories,
  fallbackCoverUrl,
  sectionTitle,
}: {
  categories: CategoryCard[];
  fallbackCoverUrl: string;
  sectionTitle: string;
}) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <section
      className="mx-auto w-full max-w-6xl px-4 sm:px-6"
      aria-labelledby="home-categories"
    >
      <h2
        id="home-categories"
        className="mb-6 font-heading text-2xl font-medium tracking-tight text-[var(--color-text)] sm:text-3xl"
      >
        {sectionTitle}
      </h2>
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const src = category.coverImageUrl ?? fallbackCoverUrl;
          return (
            <li key={category.id}>
              <Link
                href={`/colecao/${category.slug}`}
                className="group flex flex-col overflow-hidden rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] bg-[var(--color-surface)] transition-shadow hover:shadow-sm"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-background)]">
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <span className="px-4 py-3 font-heading text-lg text-[var(--color-text)] group-hover:text-[var(--color-primary)]">
                  {category.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function HomePage() {
  const { branding, categories, rails } = await loadHomeCatalog();
  const catalogEmpty =
    categories.length === 0 && !hasRailProducts(rails);

  return (
    <div className="flex flex-1 flex-col gap-12 py-8 sm:gap-16 sm:py-12">
      <HomeHero hero={branding.hero} />

      {catalogEmpty ? (
        <p className="mx-auto max-w-lg px-4 text-center text-base text-[color-mix(in_srgb,var(--color-text)_75%,transparent)] sm:px-6">
          {branding.empty_states.no_products}
        </p>
      ) : (
        <>
          {branding.sections.categories.enabled ? (
            <CategoryGrid
              categories={categories}
              fallbackCoverUrl={branding.share.og_image}
              sectionTitle={branding.sections.categories.title}
            />
          ) : null}

          {branding.sections.new_arrivals.enabled ? (
            <HomeSection
              title={branding.sections.new_arrivals.title}
              products={rails.newArrivals}
              branding={branding}
            />
          ) : null}

          {branding.sections.featured.enabled ? (
            <HomeSection
              title={branding.sections.featured.title}
              products={rails.featured}
              branding={branding}
            />
          ) : null}

          {branding.sections.on_sale.enabled ? (
            <HomeSection
              title={branding.sections.on_sale.title}
              products={rails.onSale}
              branding={branding}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
