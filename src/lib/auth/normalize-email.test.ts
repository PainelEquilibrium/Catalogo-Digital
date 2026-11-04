import { describe, expect, it } from "vitest";
import { normalizeLoginEmail } from "@/lib/auth/normalize-email";

describe("normalizeLoginEmail", () => {
  it("normaliza '  Maria@Loja.COM ' para 'maria@loja.com'", () => {
    expect(normalizeLoginEmail("  Maria@Loja.COM ")).toBe("maria@loja.com");
  });
  it("recusa e-mail inválido", () => {
    expect(normalizeLoginEmail("maria")).toBeNull();
    expect(normalizeLoginEmail("")).toBeNull();
  });
});
