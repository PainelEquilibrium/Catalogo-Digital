import type { CategoryCard } from "@/domain/product";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartProvider } from "@/components/cart/cart-provider";
import { getSiteUrl } from "@/config/site";
import { resolveEffectiveWhatsappNumber } from "@/lib/whatsapp/resolve-effective-whatsapp-number";
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

  const cartConfig = {
    whatsappNumber: resolveEffectiveWhatsappNumber(
      branding.contact.whatsapp_number,
      process.env.WHATSAPP_NUMBER,
    ),
    itemTemplate: branding.contact.whatsapp_item_template,
    orderTemplate: branding.contact.whatsapp_order_template,
    showPrices: branding.behavior.show_prices,
    currency: branding.behavior.currency,
    siteUrl: getSiteUrl(),
  };

  return (
    <CartProvider config={cartConfig}>
      <SiteHeader
        branding={branding}
        categories={categories}
        showThemeToggle={showThemeToggle}
      />
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      <CartDrawer />
    </CartProvider>
  );
}
