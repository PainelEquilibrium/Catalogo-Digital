import type { Metadata } from "next";
import localFont from "next/font/local";
import { brandingToCssVars } from "@/domain/branding";
import { ThemeScript } from "@/components/layout/theme-script";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { AnalyticsRoot } from "@/components/analytics/analytics-root";
import { ConsentDefaultScript } from "@/components/analytics/consent-default-script";
import { Toaster } from "@/components/ui/sonner";
import { getSiteUrl } from "@/config/site";
import { copyPtBr } from "@/lib/copy/pt-br";
import { storeOgImages } from "@/lib/seo/og-image";
import "./globals.css";

// Fontes da marca Equilibrium (public/fonts). Helvetica = títulos (h1);
// Gilroy = corpo. Telegraf e TT Lakes Neue são só de referência, não entram.
const helvetica = localFont({
  src: [
    { path: "../../public/fonts/helvetica/Helvetica-Light.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/helvetica/Helvetica.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/helvetica/Helvetica-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-helvetica",
  display: "swap",
});

const gilroy = localFont({
  src: [
    { path: "../../public/fonts/gilroy/Gilroy-Light.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/gilroy/Gilroy-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/gilroy/Gilroy-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/gilroy/Gilroy-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/gilroy/Gilroy-Heavy.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-gilroy",
  display: "swap",
});

function withLoadedFonts(vars: Record<string, string>): Record<string, string> {
  return {
    ...vars,
    "--font-body": "var(--font-gilroy), sans-serif",
    "--font-heading": "var(--font-helvetica), sans-serif",
  };
}

function brandingVarsToCss(
  selector: string,
  vars: Record<string, string>,
): string {
  const declarations = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return `${selector}{${declarations}}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await resolveBranding();
  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: branding.store.name,
      template: `%s | ${branding.store.name}`,
    },
    description: branding.store.tagline,
    openGraph: {
      siteName: branding.store.name,
      images: storeOgImages(branding, branding.store.name),
    },
    icons: {
      // Favicon acompanha o tema do sistema operacional (prefers-color-scheme).
      icon: [
        {
          url: branding.store.icon.light,
          media: "(prefers-color-scheme: light)",
          type: "image/webp",
        },
        {
          url: branding.store.icon.dark,
          media: "(prefers-color-scheme: dark)",
          type: "image/webp",
        },
      ],
    },
  };
}

export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
  const branding = await resolveBranding();

  const lightVars = withLoadedFonts(brandingToCssVars(branding, "light"));
  const darkVars = withLoadedFonts(brandingToCssVars(branding, "dark"));
  const themeCss = `${brandingVarsToCss(":root", lightVars)}html.dark{${Object.entries(darkVars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";")}}`;

  return (
    <html
      lang="pt-BR"
      className={`${helvetica.variable} ${gilroy.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript
          enabled={branding.theme.dark_mode.enabled}
          defaultMode={branding.theme.dark_mode.default}
        />
        <ConsentDefaultScript />
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main-content" className="skip-link">
          {copyPtBr.a11y.skipToContent}
        </a>
        {children}
        <AnalyticsRoot />
        <Toaster />
      </body>
    </html>
  );
}
