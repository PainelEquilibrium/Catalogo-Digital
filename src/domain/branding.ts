import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const sectionWithLimitSchema = z.object({
  title: z.string(),
  enabled: z.boolean(),
  limit: z.number().int().positive().optional(),
});

const sectionSchema = z.object({
  title: z.string(),
  enabled: z.boolean(),
});

const themeDarkSchema = z.object({
  primary_color: hexColor,
  secondary_color: hexColor,
  background_color: hexColor,
  surface_color: hexColor,
  text_color: hexColor,
  accent_color: hexColor,
});

const themeSchema = z.object({
  primary_color: hexColor,
  secondary_color: hexColor,
  background_color: hexColor,
  text_color: hexColor,
  accent_color: hexColor,
  font_heading: z.string(),
  font_body: z.string(),
  border_radius: z.string(),
  products_per_row: z.object({
    mobile: z.number().int().positive(),
    desktop: z.number().int().positive(),
  }),
  dark: themeDarkSchema.optional(),
  dark_mode: z.object({
    enabled: z.boolean(),
    default: z.enum(["light", "dark", "auto"]),
    show_toggle: z.boolean(),
  }),
});

export const brandingSchema = z.object({
  store: z.object({
    name: z.string(),
    tagline: z.string(),
    logo_url: z.string().url(),
    favicon_url: z.string().url(),
  }),
  theme: themeSchema,
  hero: z.object({
    enabled: z.boolean(),
    image_url: z.string().url(),
    title: z.string(),
    subtitle: z.string(),
    cta_label: z.string(),
    cta_link: z.string(),
  }),
  sections: z.object({
    new_arrivals: sectionWithLimitSchema,
    featured: sectionWithLimitSchema,
    on_sale: sectionWithLimitSchema,
    campaigns: sectionSchema,
    categories: sectionSchema,
  }),
  empty_states: z.object({
    no_products: z.string(),
    no_results: z.string(),
  }),
  share: z.object({
    og_home_image: z.string().url(),
    og_category_fallback: z.string().url(),
    share_message: z.string(),
  }),
  contact: z.object({
    whatsapp_number: z.string(),
    whatsapp_message_default: z.string(),
  }),
  behavior: z.object({
    default_sort: z.enum(["novidades", "preco_asc", "preco_desc", "destaque"]),
    sort_options: z.array(
      z.enum(["novidades", "preco_asc", "preco_desc", "destaque"]),
    ),
    show_prices: z.boolean(),
    currency: z.string(),
  }),
});

export type Branding = z.infer<typeof brandingSchema>;

const RAW_FALLBACK: Branding = {
  store: {
    name: "Equilibrium Tecnologia",
    tagline: "Catálogo digital de roupas — descubra peças para o seu estilo",
    logo_url: "https://placehold.co/240x80/2d3a4a/f4f6f8?text=Equilibrium",
    favicon_url: "https://placehold.co/64x64/2d3a4a/f4f6f8?text=EQ",
  },
  theme: {
    primary_color: "#2D3A4A",
    secondary_color: "#C9A66B",
    background_color: "#F7F5F2",
    text_color: "#2B2B2B",
    accent_color: "#C9A66B",
    font_heading: "Fraunces, serif",
    font_body: "Inter, sans-serif",
    border_radius: "12px",
    products_per_row: { mobile: 2, desktop: 4 },
    dark: {
      primary_color: "#C9A66B",
      secondary_color: "#2D3A4A",
      background_color: "#1A2027",
      surface_color: "#232B34",
      text_color: "#EDEAE4",
      accent_color: "#C9A66B",
    },
    dark_mode: { enabled: true, default: "auto", show_toggle: true },
  },
  hero: {
    enabled: true,
    image_url: "https://placehold.co/1600x900/3a4a5e/f4f6f8?text=Cat%C3%A1logo+Digital",
    title: "Nosso Catálogo",
    subtitle: "Roupas selecionadas para você explorar com calma",
    cta_label: "Ver novidades",
    cta_link: "/?ordenar=novidades",
  },
  sections: {
    new_arrivals: { title: "Novidades", enabled: true, limit: 8 },
    featured: { title: "Destaques", enabled: true, limit: 8 },
    on_sale: { title: "Promoções", enabled: true, limit: 8 },
    campaigns: { title: "Campanhas", enabled: false },
    categories: { title: "Categorias", enabled: true },
  },
  empty_states: {
    no_products: "Estamos preparando novidades. Volte em breve!",
    no_results: "Nenhum produto com esses filtros. Ajuste a busca.",
  },
  share: {
    og_home_image: "https://placehold.co/1200x630/2D3A4A/ffffff?text=Cat%C3%A1logo+Digital",
    og_category_fallback: "https://placehold.co/1200x630/C9A66B/2B2B2B?text=Cole%C3%A7%C3%A3o",
    share_message: "Olá! Amei esse catálogo e acho que você vai gostar:",
  },
  contact: {
    whatsapp_number: "",
    whatsapp_message_default:
      "Olá! Vi o catálogo e quero saber mais sobre: {product_name} {product_url} {price}",
  },
  behavior: {
    default_sort: "novidades",
    sort_options: ["novidades", "preco_asc", "preco_desc", "destaque"],
    show_prices: true,
    currency: "BRL",
  },
};

export const FALLBACK_BRANDING: Branding = parseBranding(RAW_FALLBACK);

function stripMetaKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripMetaKeys);
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "_comment" || key === "$schema") continue;
      out[key] = stripMetaKeys(child);
    }
    return out;
  }
  return value;
}

export function parseBranding(raw: unknown): Branding {
  const cleaned = stripMetaKeys(raw);
  return brandingSchema.parse(cleaned);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function deepMergePlain(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, overrideValue] of Object.entries(override)) {
    if (overrideValue === undefined) continue;
    const baseValue = result[key];
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMergePlain(baseValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  }
  return result;
}

export function deepMergeBranding(
  base: Branding,
  override: Partial<Record<string, unknown>>,
): Branding {
  const merged = deepMergePlain(
    base as unknown as Record<string, unknown>,
    override,
  );
  const parsed = safeParseBranding(merged);
  return parsed ?? base;
}

function safeParseBranding(raw: unknown): Branding | null {
  const cleaned = stripMetaKeys(raw);
  const result = brandingSchema.safeParse(cleaned);
  return result.success ? result.data : null;
}

export function resolveBrandingLayers(args: {
  fromDb: Record<string, unknown>;
  fromFile: unknown;
  fallback?: Branding;
}): Branding {
  const fallback = args.fallback ?? FALLBACK_BRANDING;

  const parsedFile = safeParseBranding(args.fromFile);
  let fromFileLayer: Branding;
  if (parsedFile) {
    fromFileLayer = parsedFile;
  } else if (args.fromFile !== undefined && args.fromFile !== null) {
    console.warn(
      "[branding] branding.config.json inválido; usando FALLBACK_BRANDING.",
    );
    fromFileLayer = fallback;
  } else {
    fromFileLayer = fallback;
  }

  let layer = fromFileLayer;
  for (const [key, value] of Object.entries(args.fromDb)) {
    if (value === undefined) continue;
    const candidate = deepMergePlain(
      layer as unknown as Record<string, unknown>,
      { [key]: value },
    );
    const parsed = safeParseBranding(candidate);
    if (parsed) {
      layer = parsed;
    }
  }

  return layer;
}

const MIN_CONTRAST = 4.5;

function relativeLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const transform = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickColorWithContrast(
  candidate: string,
  background: string,
  fallback: string,
): string {
  return contrastRatio(candidate, background) >= MIN_CONTRAST
    ? candidate
    : fallback;
}

function darkenHex(hex: string, amount = 0.12): string {
  const normalized = hex.replace("#", "");
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(parseInt(normalized.slice(0, 2), 16) * (1 - amount));
  const g = clamp(parseInt(normalized.slice(2, 4), 16) * (1 - amount));
  const b = clamp(parseInt(normalized.slice(4, 6), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function deriveDarkTheme(
  light: Branding["theme"],
): NonNullable<Branding["theme"]["dark"]> {
  const fallbackDark = FALLBACK_BRANDING.theme.dark!;
  const background_color = light.text_color;
  const text_color = light.background_color;
  const surface_color = darkenHex(background_color, 0.08);

  const secondary_color = pickColorWithContrast(
    light.secondary_color,
    background_color,
    fallbackDark.secondary_color,
  );
  const accent_color = pickColorWithContrast(
    light.accent_color,
    background_color,
    fallbackDark.accent_color,
  );
  const primary_color = pickColorWithContrast(
    light.primary_color,
    background_color,
    fallbackDark.primary_color,
  );

  const dark = {
    primary_color,
    secondary_color,
    background_color,
    surface_color,
    text_color,
    accent_color,
  };

  if (contrastRatio(dark.text_color, dark.background_color) < MIN_CONTRAST) {
    return { ...fallbackDark };
  }

  return dark;
}

export function brandingToCssVars(
  b: Branding,
  mode: "light" | "dark",
): Record<string, string> {
  if (mode === "light") {
    return {
      "--color-primary": b.theme.primary_color,
      "--color-secondary": b.theme.secondary_color,
      "--color-background": b.theme.background_color,
      "--color-text": b.theme.text_color,
      "--color-accent": b.theme.accent_color,
      "--color-surface": b.theme.background_color,
      "--radius": b.theme.border_radius,
      "--font-heading": b.theme.font_heading,
      "--font-body": b.theme.font_body,
    };
  }

  const dark = b.theme.dark ?? deriveDarkTheme(b.theme);
  return {
    "--color-primary": dark.primary_color,
    "--color-secondary": dark.secondary_color,
    "--color-background": dark.background_color,
    "--color-text": dark.text_color,
    "--color-accent": dark.accent_color,
    "--color-surface": dark.surface_color,
    "--radius": b.theme.border_radius,
    "--font-heading": b.theme.font_heading,
    "--font-body": b.theme.font_body,
  };
}
