import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  FALLBACK_BRANDING,
  brandingToCssVars,
  deepMergeBranding,
  deriveDarkTheme,
  parseBranding,
  resolveBrandingLayers,
  type Branding,
} from "./branding";

const validFileBranding: Branding = {
  store: {
    name: "Arquivo Loja",
    tagline: "Catálogo de roupas do arquivo",
    logo: {
      light: "https://example.com/logo-black.png",
      dark: "https://example.com/logo-white.png",
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
    dark_mode: { enabled: true, default: "auto", show_toggle: true },
  },
  hero: {
    enabled: true,
    image_url: "https://example.com/hero.jpg",
    title: "Hero",
    subtitle: "Sub",
    cta_label: "Ver",
    cta_link: "/",
  },
  sections: {
    new_arrivals: { title: "Novidades", enabled: true, limit: 8 },
    featured: { title: "Destaques", enabled: true, limit: 8 },
    on_sale: { title: "Promoções", enabled: true, limit: 8 },
    campaigns: { title: "Campanhas", enabled: false },
    categories: { title: "Categorias", enabled: true },
  },
  empty_states: {
    no_products: "Sem produtos",
    no_results: "Sem resultados",
  },
  share: {
    og_image: "https://example.com/og.png",
    share_message: "Confira:",
  },
  contact: {
    whatsapp_number: "",
    whatsapp_item_template: "{product_name}",
    whatsapp_order_template: "{items_list}",
  },
  behavior: {
    default_sort: "novidades",
    sort_options: ["novidades", "preco_asc", "preco_desc", "destaque"],
    show_prices: true,
    currency: "BRL",
  },
};

describe("resolveBrandingLayers", () => {
  it("merge parcial do banco sobrescreve só chaves definidas", () => {
    const result = resolveBrandingLayers({
      fromDb: { store: { name: "Mariah's Boutique" } },
      fromFile: validFileBranding,
    });

    expect(result.store.name).toBe("Mariah's Boutique");
    expect(result.store.tagline).toBe(validFileBranding.store.tagline);
    expect(result.theme.primary_color).toBe(validFileBranding.theme.primary_color);
  });

  it("arquivo inválido usa FALLBACK_BRANDING", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = resolveBrandingLayers({
      fromDb: {},
      fromFile: { not: "branding" },
    });

    expect(result).toEqual(FALLBACK_BRANDING);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("DB vazio retorna branding do arquivo validado", () => {
    const result = resolveBrandingLayers({
      fromDb: {},
      fromFile: validFileBranding,
    });

    expect(result).toEqual(validFileBranding);
  });

  it("ignora chave de topo inválida no banco e mantém o arquivo", () => {
    const result = resolveBrandingLayers({
      fromDb: {
        store: { name: 12345 },
        behavior: { default_sort: "invalido" },
      },
      fromFile: validFileBranding,
    });

    expect(result.store.name).toBe(validFileBranding.store.name);
    expect(result.behavior.default_sort).toBe(validFileBranding.behavior.default_sort);
  });
});

describe("deepMergeBranding", () => {
  it("mescla objetos aninhados e substitui arrays", () => {
    const base = parseBranding(validFileBranding);
    const merged = deepMergeBranding(base, {
      behavior: {
        sort_options: ["destaque"],
        show_prices: false,
      },
    });

    expect(merged.behavior.sort_options).toEqual(["destaque"]);
    expect(merged.behavior.show_prices).toBe(false);
    expect(merged.behavior.default_sort).toBe(base.behavior.default_sort);
  });

  it("retorna base inalterado quando override quebra o schema", () => {
    const base = parseBranding(validFileBranding);

    expect(() =>
      deepMergeBranding(base, { store: { name: 1 } }),
    ).not.toThrow();

    const merged = deepMergeBranding(base, { store: { name: 1 } });
    expect(merged).toEqual(base);
  });
});

describe("deriveDarkTheme", () => {
  it("preenche tema escuro com fundo/texto invertidos e contraste legível", () => {
    const light = {
      ...validFileBranding.theme,
      dark: undefined,
    };

    const dark = deriveDarkTheme(light);

    expect(dark.background_color).toBe(light.text_color);
    expect(dark.text_color).toBe(light.background_color);
    expect(dark.accent_color).toBe(light.accent_color);
    expect(dark.secondary_color).toBe(light.secondary_color);
    expect(dark.primary_color.length).toBeGreaterThan(0);
    expect(dark.surface_color.length).toBeGreaterThan(0);
    expect(contrastRatio(dark.text_color, dark.background_color)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dark.accent_color, dark.background_color)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dark.secondary_color, dark.background_color)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("padrões de imagem e modelos", () => {
  const json = parseBranding(
    JSON.parse(readFileSync(join(process.cwd(), "branding.config.json"), "utf-8")),
  );

  it("fallback e JSON usam o hero local de nome fixo", () => {
    expect(FALLBACK_BRANDING.hero.image_url).toBe("/images/hero-padrao.webp");
    expect(json.hero.image_url).toBe("/images/hero-padrao.webp");
    expect(existsSync(join(process.cwd(), "public/images/hero-padrao.webp"))).toBe(true);
    expect(json.share.og_image).toBe("/images/og-padrao.jpg");
    expect(existsSync(join(process.cwd(), "public/images/og-padrao.jpg"))).toBe(true);
  });

  it("nenhum padrão aponta para placehold.co", () => {
    expect(JSON.stringify(FALLBACK_BRANDING)).not.toContain("placehold.co");
    expect(JSON.stringify(json)).not.toContain("placehold.co");
  });

  it("override antigo com whatsapp_message_default não quebra o parse", () => {
    const result = resolveBrandingLayers({
      fromDb: { contact: { whatsapp_message_default: "Olá {price}" } },
      fromFile: validFileBranding,
    });
    expect(result.contact.whatsapp_item_template).toBe("{product_name}");
  });

  it("modelos têm padrão com os marcadores da spec", () => {
    for (const b of [FALLBACK_BRANDING, json]) {
      expect(b.contact.whatsapp_item_template).toBe(
        "• {product_name}{selection} x{qty} {item_total}\n{product_url}",
      );
      expect(b.contact.whatsapp_order_template).toBe(
        "Olá! Quero fazer este pedido:\n\n{items_list}\n\nTotal de peças: {total_items}\n{total}",
      );
    }
  });
});

describe("assetPath e overrides legados", () => {
  const withHero = (image_url: string) => ({ ...validFileBranding.hero, image_url });

  it("hero.image_url rejeita valores perigosos e aceita local ou https", () => {
    for (const bad of ["javascript:alert(1)", "//host/x.jpg", "/\\host/x.jpg", "/a/../b.jpg", "/..", ""]) {
      expect(() => parseBranding({ ...validFileBranding, hero: withHero(bad) }), bad).toThrow();
    }
    for (const ok of ["/images/hero-padrao.webp", "https://example.com/h.jpg"]) {
      expect(parseBranding({ ...validFileBranding, hero: withHero(ok) }).hero.image_url).toBe(ok);
    }
  });

  it("share antigo com og_home_image e og_category_fallback ainda faz parse", () => {
    const result = resolveBrandingLayers({
      fromDb: { share: { og_home_image: "https://x.com/a.png", og_category_fallback: "https://x.com/b.png" } },
      fromFile: validFileBranding,
    });
    expect(result.share.og_image).toBe(validFileBranding.share.og_image);
  });

  it("og_image inválido no banco cai para a camada do JSON", () => {
    const result = resolveBrandingLayers({
      fromDb: { share: { og_image: "//evil.com/x.jpg" } },
      fromFile: validFileBranding,
    });
    expect(result.share.og_image).toBe(validFileBranding.share.og_image);
  });

  it("preserva whatsapp_message_default legado do banco", () => {
    const result = resolveBrandingLayers({
      fromDb: { contact: { whatsapp_message_default: "Olá {price}" } },
      fromFile: validFileBranding,
    });
    expect(result.contact.whatsapp_message_default).toBe("Olá {price}");
  });
});

describe("branding.config.json no disco", () => {
  const configPath = join(process.cwd(), "branding.config.json");
  const readConfig = () =>
    parseBranding(JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>);

  it("tem Equilibrium, campanhas off, WhatsApp vazio, paleta e tagline de roupas", () => {
    const branding = readConfig();

    expect(branding.store.name).toBe("Equilibrium Tecnologia");
    expect(branding.sections.campaigns.enabled).toBe(false);
    expect(branding.contact.whatsapp_number).toBe("");
    expect(branding.theme.primary_color).toBe("#5415FF");
    expect(branding.theme.secondary_color).toBe("#290880");
    expect(branding.theme.background_color).toBe("#F8F8F8");
    expect(branding.theme.surface_color).toBe("#E5E5E5");
    expect(branding.theme.text_color).toBe("#000823");

    const tagline = branding.store.tagline.toLowerCase();
    expect(tagline).toMatch(/roupa|moda|catálogo|catalogo/);
    expect(tagline).not.toMatch(/plus size|tricô|trico/);
  });

  it("tema escuro usa a paleta Equilibrium (fundo #000823, superfície #1E202C, texto #F8F8F8)", () => {
    const { dark } = readConfig().theme;

    expect(dark).toMatchObject({
      background_color: "#000823",
      surface_color: "#1E202C",
      text_color: "#F8F8F8",
      primary_color: "#5415FF",
    });
  });

  it("logos e ícones apontam para arquivos reais em /public, com versão por tema", () => {
    const { store } = readConfig();
    const assets = [store.logo.light, store.logo.dark, store.icon.light, store.icon.dark];

    expect(store.logo.light).toBe("/images/logo-black-3.webp");
    expect(store.logo.dark).toBe("/images/logo-white-3.webp");
    expect(store.icon.light).toBe("/images/icone-preto-fundo-transparente.webp");
    expect(store.icon.dark).toBe("/images/icone-branco-fundo-transparente.webp");
    for (const asset of assets) {
      expect(existsSync(join(process.cwd(), "public", asset))).toBe(true);
    }
  });

  it("texto sobre botão primário tem contraste AA nos dois temas", () => {
    const branding = readConfig();
    const light = brandingToCssVars(branding, "light");
    const dark = brandingToCssVars(branding, "dark");

    expect(
      contrastRatio(light["--color-on-primary"]!, light["--color-primary"]!),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(dark["--color-on-primary"]!, dark["--color-primary"]!),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("brandingToCssVars", () => {
  it("emite as variáveis CSS do modo light, com superfície e texto sobre primária", () => {
    const branding = parseBranding(validFileBranding);
    const vars = brandingToCssVars(branding, "light");

    expect(vars).toEqual({
      "--color-primary": branding.theme.primary_color,
      "--color-secondary": branding.theme.secondary_color,
      "--color-background": branding.theme.background_color,
      "--color-text": branding.theme.text_color,
      "--color-accent": branding.theme.accent_color,
      "--color-surface": branding.theme.background_color,
      "--color-on-primary": branding.theme.background_color,
      // accent claro (#C9A66B): o texto escuro tem mais contraste que o fundo.
      "--color-on-accent": branding.theme.text_color,
      "--radius": branding.theme.border_radius,
      "--font-heading": branding.theme.font_heading,
      "--font-body": branding.theme.font_body,
    });
  });

  it("emite as variáveis CSS no modo dark via deriveDarkTheme", () => {
    const branding = parseBranding(validFileBranding);
    const dark = deriveDarkTheme(branding.theme);
    const vars = brandingToCssVars(branding, "dark");
    const { "--color-on-primary": onPrimary, "--color-on-accent": onAccent, ...rest } = vars;

    expect(rest).toEqual({
      "--color-primary": dark.primary_color,
      "--color-secondary": dark.secondary_color,
      "--color-background": dark.background_color,
      "--color-text": dark.text_color,
      "--color-accent": dark.accent_color,
      "--color-surface": dark.surface_color,
      "--radius": branding.theme.border_radius,
      "--font-heading": branding.theme.font_heading,
      "--font-body": branding.theme.font_body,
    });
    expect([dark.background_color, dark.text_color]).toContain(onPrimary);
    expect([dark.background_color, dark.text_color]).toContain(onAccent);
  });
});

function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const transform = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}
