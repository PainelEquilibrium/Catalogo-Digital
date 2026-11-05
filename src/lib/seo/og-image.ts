import type { Metadata } from "next";
import type { Branding } from "@/domain/branding";
import { getSiteUrl } from "@/config/site";

type OgImages = NonNullable<NonNullable<Metadata["openGraph"]>["images"]>;

// Sem width/height: o JPG não tem recorte fixo e cada app de prévia ajusta do seu jeito.
const DEFAULT_LOGO = "/images/og-padrao.jpg";

function isJpg(url: string): boolean {
  try {
    return /\.jpe?g$/i.test(new URL(url, "http://x").pathname);
  } catch {
    return false;
  }
}

export function absoluteAssetUrl(pathOrUrl: string, siteUrl: string): string {
  return new URL(pathOrUrl, `${siteUrl}/`).toString();
}

export function storeOgImages(branding: Branding, alt: string): OgImages {
  const logo = isJpg(branding.share.og_image) ? branding.share.og_image : DEFAULT_LOGO;
  return [{ url: absoluteAssetUrl(logo, getSiteUrl()), alt }];
}

// Linhas antigas ainda podem guardar .webp (ver og-jpg-transition): só JPG vira miniatura.
function jpgOrLogo(ogUrl: string | null | undefined, alt: string, branding: Branding): OgImages {
  return ogUrl && isJpg(ogUrl)
    ? [{ url: absoluteAssetUrl(ogUrl, getSiteUrl()), alt }]
    : storeOgImages(branding, alt);
}

export const categoryOgImages = (
  category: { name: string; coverOgUrl: string | null },
  branding: Branding,
): OgImages => jpgOrLogo(category.coverOgUrl, category.name, branding);

export const productOgImages = (
  product: { name: string; gallery: { ogUrl: string | null }[] },
  branding: Branding,
): OgImages => jpgOrLogo(product.gallery[0]?.ogUrl, product.name, branding);
