import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";
import { copyPtBr } from "@/lib/copy/pt-br";
import { resolveLegalPage } from "@/lib/legal/resolve-legal";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { storeOgImages } from "@/lib/seo/og-image";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await resolveBranding();
  const title = copyPtBr.legal.privacidade;
  return {
    title,
    description: `${title} — ${branding.store.name}`,
    openGraph: { title, images: storeOgImages(branding, title) },
  };
}

export default async function PrivacidadePage() {
  const markdown = await resolveLegalPage("privacidade");

  return (
    <LegalArticle title={copyPtBr.legal.privacidade} markdown={markdown} />
  );
}
