import { redirect } from "next/navigation";
import { ContactSection } from "@/components/admin/settings/contact-section";
import {
  BehaviorSection,
  HomeSection,
  LegalSection,
  StoreSection,
  ThemeSection,
} from "@/components/admin/settings/settings-sections";
import { requireAction, StaffAuthError } from "@/lib/auth/server";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { prisma } from "@/lib/prisma/client";

export default async function AdminSettingsPage() {
  try {
    await requireAction("settings");
  } catch (error) {
    if (error instanceof StaffAuthError) redirect("/admin/sem-acesso");
    throw error;
  }

  const branding = await resolveBranding();
  const legalRow = await prisma.storeSetting.findUnique({ where: { key: "legal" } });
  const legal = (legalRow?.value ?? {}) as Record<string, string>;
  // key remonta o formulário quando o valor salvo muda (salvar ou restaurar).
  // Arquivos enviados ficam fora da chave: trocar logo não remonta o formulário nem apaga texto digitado.
  const textOnly = {
    ...branding,
    store: { name: branding.store.name, tagline: branding.store.tagline },
    hero: { ...branding.hero, image_url: "" },
  };
  const version = JSON.stringify([textOnly, legal]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{copyAdminPtBr.settings.title}</h1>
      <StoreSection key={`s${version}`} branding={branding} />
      <ThemeSection key={`t${version}`} branding={branding} />
      <HomeSection key={`h${version}`} branding={branding} />
      <ContactSection key={`c${version}`} branding={branding} />
      <BehaviorSection key={`b${version}`} branding={branding} />
      <LegalSection key={`l${version}`} saved={legal} />
    </div>
  );
}
