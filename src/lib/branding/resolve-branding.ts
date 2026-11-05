import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { resolveBrandingLayers, type Branding } from "@/domain/branding";
import { prisma } from "@/lib/prisma/client";

const BRANDING_CONFIG_PATH = join(process.cwd(), "branding.config.json");

function loadBrandingConfigFile(): unknown {
  try {
    const raw = readFileSync(BRANDING_CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as unknown;
  } catch {
    console.warn(
      "[branding] Não foi possível ler branding.config.json; usando fallback.",
    );
    return undefined;
  }
}

function rowsToBrandingDb(rows: { key: string; value: unknown }[]): Record<string, unknown> {
  const fromDb: Record<string, unknown> = {};
  for (const row of rows) {
    if (row.key === "legal") continue;
    fromDb[row.key] = row.value;
  }
  return fromDb;
}

// cache: layout, metadata e página leem a marca na mesma requisição; uma leitura só.
export const resolveBranding = cache(async (): Promise<Branding> => {
  const fromFile = loadBrandingConfigFile();

  try {
    const rows = await prisma.storeSetting.findMany();
    const fromDb = rowsToBrandingDb(rows);
    return resolveBrandingLayers({ fromDb, fromFile });
  } catch {
    console.warn(
      "[branding] Falha ao ler store_settings; usando branding.config.json.",
    );
    return resolveBrandingLayers({ fromDb: {}, fromFile });
  }
});
