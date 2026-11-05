import { brandingSchema, FALLBACK_BRANDING } from "@/domain/branding";
import { validateTemplates } from "@/domain/whatsapp-templates";

export type SettingsSection = "store" | "theme" | "home" | "contact" | "behavior" | "legal";

export const sectionKeys: Record<SettingsSection, string[]> = {
  store: ["store"],
  theme: ["theme"],
  home: ["hero", "sections"],
  contact: ["contact"],
  behavior: ["behavior"],
  legal: ["legal"],
};

export const LEGAL_SLUGS = ["privacidade", "cookies", "termos"] as const;

type Row = { key: string; value: unknown };
// `detail` marca mensagem que o usuário pode ver; sem ele, a ação usa o texto genérico.
type ParseResult = { ok: true; rows: Row[] } | { ok: false; message: string; detail?: true };

const INVALID = "Dados inválidos.";

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function mergeSettingValue(base: unknown, over: unknown): unknown {
  if (!isPlain(base) || !isPlain(over)) return over;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = mergeSettingValue(base[k], v);
  return out;
}

// Mantém só os caminhos enviados (com o valor já validado), para não congelar o padrão no banco.
function pickLike(parsed: unknown, sent: unknown): unknown {
  if (!isPlain(parsed) || !isPlain(sent)) return parsed;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(sent)) if (k in parsed) out[k] = pickLike(parsed[k], sent[k]);
  return out;
}

// Editores de upload (Task 16) cuidam de logo, ícone e imagem do hero; aqui só texto e opções.
function extraCheck(key: string, value: Record<string, unknown>): boolean {
  const text = (v: unknown) => (v === undefined ? undefined : String(v));
  if (key === "store" && "name" in value) return (text(value.name) ?? "").trim() !== "";
  if (key === "contact" && "whatsapp_number" in value) return /^(\d{10,15})?$/.test(text(value.whatsapp_number) ?? "");
  if (key === "hero" && "cta_link" in value) return /^(\/(?![/\\])|https:\/\/)\S*$/.test(text(value.cta_link) ?? "");
  return true;
}

const EDITABLE: Record<string, readonly string[]> = {
  store: ["name", "tagline"],
  hero: ["enabled", "title", "subtitle", "cta_label", "cta_link"],
  behavior: ["show_prices"],
  contact: ["whatsapp_number", "whatsapp_item_template", "whatsapp_order_template"],
};

function parseBrandingKey(key: string, sent: unknown): Row | null {
  if (!isPlain(sent)) return null;
  let candidate = sent;
  const only = EDITABLE[key];
  if (only) candidate = Object.fromEntries(Object.entries(sent).filter(([k]) => only.includes(k)));
  if (key === "contact" && typeof candidate.whatsapp_number === "string") {
    candidate = { ...candidate, whatsapp_number: candidate.whatsapp_number.replace(/\D/g, "") };
  }
  if (key === "theme") {
    // Imagens e fontes não vêm deste formulário.
    const { primary_color, secondary_color, background_color, surface_color, text_color, accent_color, dark_mode } =
      sent as Record<string, unknown>;
    candidate = Object.fromEntries(
      Object.entries({ primary_color, secondary_color, background_color, surface_color, text_color, accent_color, dark_mode })
        .filter(([, v]) => v !== undefined),
    );
  }
  if (!extraCheck(key, candidate)) return null;
  const shape = brandingSchema.shape[key as keyof typeof brandingSchema.shape];
  const base = FALLBACK_BRANDING[key as keyof typeof FALLBACK_BRANDING];
  const parsed = shape.safeParse(mergeSettingValue(base, candidate));
  if (!parsed.success) return null;
  return { key, value: pickLike(parsed.data, candidate) };
}

export function parseSectionInput(section: SettingsSection, input: unknown): ParseResult {
  if (!isPlain(input)) return { ok: false, message: INVALID };
  const rows: Row[] = [];
  for (const key of sectionKeys[section]) {
    if (key === "legal") {
      const sent = input.legal;
      if (!isPlain(sent)) return { ok: false, message: INVALID };
      const value: Record<string, string> = {};
      for (const slug of LEGAL_SLUGS) {
        const text = sent[slug];
        if (text !== undefined && typeof text !== "string") return { ok: false, message: INVALID };
        if (text?.trim()) value[slug] = text.trim();
      }
      rows.push({ key, value });
      continue;
    }
    const row = parseBrandingKey(key, input[key]);
    if (!row) return { ok: false, message: INVALID };
    if (key === "contact") {
      const c = row.value as Record<string, string>;
      const base = FALLBACK_BRANDING.contact;
      const check = validateTemplates(
        c.whatsapp_item_template ?? base.whatsapp_item_template,
        c.whatsapp_order_template ?? base.whatsapp_order_template,
      );
      if (!check.ok) return { ok: false, message: check.message, detail: true };
    }
    rows.push(row);
  }
  return { ok: true, rows };
}
