import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { brandingToCssVars } from "@/domain/branding";
import { ThemeScript } from "@/components/layout/theme-script";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { AnalyticsRoot } from "@/components/analytics/analytics-root";
import { ConsentDefaultScript } from "@/components/analytics/consent-default-script";
import { Toaster } from "@/components/ui/sonner";
import { copyPtBr } from "@/lib/copy/pt-br";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

function withLoadedFonts(vars: Record<string, string>): Record<string, string> {
  return {
    ...vars,
    "--font-body": "var(--font-inter), sans-serif",
    "--font-heading": "var(--font-fraunces), serif",
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
    title: {
      default: branding.store.name,
      template: `%s | ${branding.store.name}`,
    },
    description: branding.store.tagline,
    icons: {
      icon: branding.store.favicon_url,
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
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
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
