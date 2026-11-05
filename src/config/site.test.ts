import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "./site";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getSiteUrl", () => {
  it("valor válido perde a barra final", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://loja.example/");
    expect(getSiteUrl()).toBe("https://loja.example");
  });

  it("sem variável em desenvolvimento: localhost, sem aviso", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getSiteUrl()).toBe("http://localhost:3000");
    expect(warn).not.toHaveBeenCalled();
  });

  it("sem variável em produção: localhost com aviso", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getSiteUrl()).toBe("http://localhost:3000");
    expect(warn).toHaveBeenCalled();
  });

  it("valor sem esquema ou com esquema inválido cai em localhost com aviso, sem lançar", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const bad of ["loja.example", "htp//loja", "ftp://loja.example"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", bad);
      expect(getSiteUrl()).toBe("http://localhost:3000");
    }
    expect(warn).toHaveBeenCalled();
  });
});
