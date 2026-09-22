import Image from "next/image";
import Link from "next/link";
import type { Branding } from "@/domain/branding";
import type { CategoryCard } from "@/domain/product";
import { copyPtBr } from "@/lib/copy/pt-br";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type SiteHeaderProps = {
  branding: Branding;
  categories: CategoryCard[];
  showThemeToggle: boolean;
};

export function SiteHeader({
  branding,
  categories,
  showThemeToggle,
}: SiteHeaderProps) {
  const firstSlug = categories[0]?.slug;
  const hasCategories = categories.length > 0;

  return (
    <header
      className="sticky top-0 z-40 border-b border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[var(--color-background)]/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-[var(--color-text)]"
        >
          <Image
            src={branding.store.logo_url}
            alt={branding.store.name}
            width={120}
            height={40}
            className="h-8 w-auto object-contain"
            priority
          />
          <span className="sr-only">{branding.store.name}</span>
        </Link>

        {hasCategories ? (
          <nav
            className="order-3 flex w-full flex-wrap gap-x-4 gap-y-1 text-sm sm:order-2 sm:w-auto sm:flex-1"
            aria-label="Categorias"
          >
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/colecao/${category.slug}`}
                className="text-[color-mix(in_srgb,var(--color-text)_75%,transparent)] transition-colors hover:text-[var(--color-primary)]"
              >
                {category.name}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-3 sm:order-3">
          {hasCategories && firstSlug ? (
            <form
              action={`/colecao/${firstSlug}`}
              method="get"
              className="flex min-h-11 min-w-0 flex-1 sm:max-w-xs"
              role="search"
            >
              <label htmlFor="header-search" className="sr-only">
                {copyPtBr.catalog.searchPlaceholder}
              </label>
              <input
                id="header-search"
                type="search"
                name="q"
                placeholder={copyPtBr.catalog.searchPlaceholder}
                className="min-h-11 w-full rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--color-text)_15%,transparent)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-text)] placeholder:text-[color-mix(in_srgb,var(--color-text)_45%,transparent)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:text-sm"
              />
            </form>
          ) : null}

          <ThemeToggle enabled={showThemeToggle} />
        </div>
      </div>
    </header>
  );
}
