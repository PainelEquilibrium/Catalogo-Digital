import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

// Caminho local em /public (ex.: /images/logo.webp) ou URL absoluta; sem //host, /\host nem "..".
const assetPath = z.string().regex(
  /^(?!.*(?:^|[/\\])\.\.(?:[/\\?#]|$))(?:\/(?![/\\])|https?:\/\/)\S+$/,
);

const themeAssetSchema = z.object({
  light: assetPath,
  dark: assetPath,
});

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
  surface_color: hexColor.optional(),
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
    logo: themeAssetSchema,
    icon: themeAssetSchema,
  }),
  theme: themeSchema,
  hero: z.object({
    enabled: z.boolean(),
    image_url: assetPath,
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
    og_image: assetPath,
    share_message: z.string(),
  }),
  contact: z.object({
    whatsapp_number: z.string(),
    whatsapp_item_template: z.string(),
    whatsapp_order_template: z.string(),
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
    logo: {
      light: "/images/logo-black-3.webp",
      dark: "/images/logo-white-3.webp",
    },
    icon: {
      light: "/images/icone-preto-fundo-transparente.webp",
      dark: "/images/icone-branco-fundo-transparente.webp",
    },
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
    image_url: "/images/hero-padrao.webp",
    title: "Nosso Catálogo",
    subtitle: "Roupas selecionadas para você explorar com calma",
    cta_label: "Ver novidades",
    cta_link: "/busca",
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
    og_image: "/images/og-padrao.jpg",
    share_message: "Olá! Amei esse catálogo e acho que você vai gostar:",
  },
  contact: {
    whatsapp_number: "",
    whatsapp_item_template: "• {product_name}{selection} x{qty} {item_total}\n{product_url}",
    whatsapp_order_template: "Olá! Quero fazer este pedido:\n\n{items_list}\n\nTotal de peças: {total_items}\n{total}",
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

/**
 * Escolhe, entre duas cores de texto, a que tem maior contraste sobre a
 * superfície. Usado para texto sobre botões/badges coloridos, que não pode
 * depender do fundo da página (no tema escuro ele seria escuro demais).
 */
function pickOnColor(surface: string, a: string, b: string): string {
  return contrastRatio(a, surface) >= contrastRatio(b, surface) ? a : b;
}

export function brandingToCssVars(
  b: Branding,
  mode: "light" | "dark",
): Record<string, string> {
  const palette =
    mode === "light"
      ? {
          primary: b.theme.primary_color,
          secondary: b.theme.secondary_color,
          background: b.theme.background_color,
          surface: b.theme.surface_color ?? b.theme.background_color,
          text: b.theme.text_color,
          accent: b.theme.accent_color,
        }
      : (() => {
          const dark = b.theme.dark ?? deriveDarkTheme(b.theme);
          return {
            primary: dark.primary_color,
            secondary: dark.secondary_color,
            background: dark.background_color,
            surface: dark.surface_color,
            text: dark.text_color,
            accent: dark.accent_color,
          };
        })();

  return {
    "--color-primary": palette.primary,
    "--color-secondary": palette.secondary,
    "--color-background": palette.background,
    "--color-text": palette.text,
    "--color-accent": palette.accent,
    "--color-surface": palette.surface,
    "--color-on-primary": pickOnColor(palette.primary, palette.background, palette.text),
    "--color-on-accent": pickOnColor(palette.accent, palette.background, palette.text),
    "--radius": b.theme.border_radius,
    "--font-heading": b.theme.font_heading,
    "--font-body": b.theme.font_body,
  };
}
