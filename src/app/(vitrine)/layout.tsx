import type { CategoryCard } from "@/domain/product";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { queryActiveCategories } from "@/lib/catalog/query-categories";

export default async function VitrineLayout({
  children,
}: LayoutProps<"/">) {
  const branding = await resolveBranding();

  let categories: CategoryCard[] = [];
  try {
    categories = await queryActiveCategories();
  } catch {
    categories = [];
  }

  const showThemeToggle =
    branding.theme.dark_mode.enabled && branding.theme.dark_mode.show_toggle;

  return (
    <>
      <SiteHeader
        branding={branding}
        categories={categories}
        showThemeToggle={showThemeToggle}
      />
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
