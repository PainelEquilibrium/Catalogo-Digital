import { describe, expect, it } from "vitest";
import { markdownToHtml } from "@/lib/legal/markdown-to-html";
import { mergeSettingValue, parseSectionInput, sectionKeys } from "@/domain/settings-sections";

describe("parseSectionInput", () => {
  it("cor inválida é recusada", () => {
    const result = parseSectionInput("theme", { theme: { primary_color: "azul" } });
    expect(result.ok).toBe(false);
  });

  it("cor válida vira linha só com o que foi enviado", () => {
    const result = parseSectionInput("theme", { theme: { primary_color: "#112233" } });
    expect(result).toEqual({ ok: true, rows: [{ key: "theme", value: { primary_color: "#112233" } }] });
  });

  it("nome da loja vazio é recusado e campos desconhecidos são descartados", () => {
    expect(parseSectionInput("store", { store: { name: "  " } }).ok).toBe(false);
    expect(parseSectionInput("store", { store: { name: "Loja", logo: { light: "/x" }, lixo: 1 } })).toEqual({
      ok: true,
      rows: [{ key: "store", value: { name: "Loja" } }],
    });
  });

  it("home grava hero e sections", () => {
    const result = parseSectionInput("home", {
      hero: { title: "Oi" },
      sections: { featured: { title: "Top", enabled: false, limit: 4 } },
    });
    expect(result.ok && result.rows.map((r) => r.key)).toEqual(sectionKeys.home);
  });

  it("contato exige número só com dígitos", () => {
    expect(parseSectionInput("contact", { contact: { whatsapp_number: "+55 (11) 9" } }).ok).toBe(false);
    expect(parseSectionInput("contact", { contact: { whatsapp_number: "5511999990000" } }).ok).toBe(true);
  });

  it("show_prices precisa ser booleano", () => {
    expect(parseSectionInput("behavior", { behavior: { show_prices: "nao" } }).ok).toBe(false);
    expect(parseSectionInput("behavior", { behavior: { show_prices: false } })).toEqual({
      ok: true,
      rows: [{ key: "behavior", value: { show_prices: false } }],
    });
  });

  it("legais vazios são omitidos", () => {
    const result = parseSectionInput("legal", { legal: { termos: "  Meu texto ", cookies: "   ", privacidade: "" } });
    expect(result).toEqual({ ok: true, rows: [{ key: "legal", value: { termos: "Meu texto" } }] });
  });

  it("entrada que não é objeto é recusada", () => {
    expect(parseSectionInput("theme", null).ok).toBe(false);
    expect(parseSectionInput("legal", { legal: "x" }).ok).toBe(false);
  });
});

describe("markdown legal", () => {
  it("<script> sai escapado", () => {
    const html = markdownToHtml("Oi <script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("mergeSettingValue", () => {
  it("salvar o nome preserva o logo já gravado", () => {
    const logo = { light: "/a.webp", dark: "/b.webp" };
    expect(mergeSettingValue({ name: "Velho", logo }, { name: "Novo" })).toEqual({ name: "Novo", logo });
  });
});
