import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { prisma } from "@/lib/prisma/client";

export type LegalSlug = "privacidade" | "cookies" | "termos";

type LegalOverrides = Partial<Record<LegalSlug, string>>;

const STORE_NAME_PLACEHOLDER = "[nome da loja]";

function legalFilePath(slug: LegalSlug): string {
  return join(process.cwd(), "src/content/legal", `${slug}.md`);
}

const FALLBACK_LEGAL_MARKDOWN =
  "## Conteúdo indisponível\n\nEstamos atualizando esta página. Tente novamente em breve.";

function readLegalFile(slug: LegalSlug): string {
  try {
    return readFileSync(legalFilePath(slug), "utf-8");
  } catch {
    console.warn(`[legal] Falha ao ler arquivo ${slug}; usando fallback mínimo.`);
    return FALLBACK_LEGAL_MARKDOWN;
  }
}

function substituteStoreName(markdown: string, storeName: string): string {
  return markdown.replaceAll(STORE_NAME_PLACEHOLDER, storeName);
}

function parseLegalOverrides(value: unknown): LegalOverrides | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as LegalOverrides;
}

async function loadLegalOverrides(): Promise<LegalOverrides | null> {
  try {
    const rows = await prisma.storeSetting.findMany();
    const legalRow = rows.find((row) => row.key === "legal");
    if (!legalRow) return null;
    return parseLegalOverrides(legalRow.value);
  } catch {
    console.warn("[legal] Falha ao ler store_settings; usando arquivos locais.");
    return null;
  }
}

export async function resolveLegalPage(slug: LegalSlug): Promise<string> {
  const branding = await resolveBranding();
  const overrides = await loadLegalOverrides();
  const overrideText = overrides?.[slug]?.trim();

  const content =
    overrideText && overrideText.length > 0
      ? overrideText
      : readLegalFile(slug);

  return substituteStoreName(content, branding.store.name);
}
