import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";
import { copyPtBr } from "@/lib/copy/pt-br";
import { resolveLegalPage } from "@/lib/legal/resolve-legal";
import { resolveBranding } from "@/lib/branding/resolve-branding";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await resolveBranding();
  const title = copyPtBr.legal.termos;
  return {
    title,
    description: `${title} — ${branding.store.name}`,
  };
}

export default async function TermosPage() {
  const markdown = await resolveLegalPage("termos");

  return <LegalArticle title={copyPtBr.legal.termos} markdown={markdown} />;
}
