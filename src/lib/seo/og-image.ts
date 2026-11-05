import type { Metadata } from "next";
import type { Branding } from "@/domain/branding";
import { getSiteUrl } from "@/config/site";

type OgImages = NonNullable<NonNullable<Metadata["openGraph"]>["images"]>;

// Sem width/height: o JPG não tem recorte fixo e cada app de prévia ajusta do seu jeito.
const JPG = /\.jpe?g(?:[?#]|$)/i;

export function absoluteAssetUrl(pathOrUrl: string, siteUrl: string): string {
  return new URL(pathOrUrl, `${siteUrl}/`).toString();
}

export function storeOgImages(branding: Branding, alt: string): OgImages {
  return [{ url: absoluteAssetUrl(branding.share.og_image, getSiteUrl()), alt }];
}

// Linhas antigas ainda podem guardar .webp (ver og-jpg-transition): só JPG vira miniatura.
function jpgOrLogo(ogUrl: string | null | undefined, alt: string, branding: Branding): OgImages {
  return ogUrl && JPG.test(ogUrl)
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
