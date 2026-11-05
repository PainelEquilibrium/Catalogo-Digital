import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma/client";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync),
  };
});

vi.mock("@/lib/branding/resolve-branding", () => ({
  resolveBranding: vi.fn(async () => ({
    store: { name: "Loja Teste" },
  })),
}));

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    storeSetting: {
      findMany: vi.fn(async () => []),
    },
  },
}));

describe("resolveLegalPage", () => {
  beforeEach(() => {
    vi.mocked(readFileSync).mockReset();
  });

  it("não rejeita quando o arquivo legal está ausente", async () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const { resolveLegalPage } = await import("@/lib/legal/resolve-legal");
    const markdown = await resolveLegalPage("privacidade");

    expect(markdown).toContain("Conteúdo indisponível");
    expect(markdown.length).toBeGreaterThan(0);
  });

  it("legais vazios caem no padrão", async () => {
    vi.mocked(readFileSync).mockReturnValue("Padrão de [nome da loja]");
    vi.mocked(prisma.storeSetting.findMany).mockResolvedValueOnce([
      { key: "legal", value: { termos: "   " } },
    ] as never);

    const { resolveLegalPage } = await import("@/lib/legal/resolve-legal");
    expect(await resolveLegalPage("termos")).toBe("Padrão de Loja Teste");
  });

  it("texto salvo substitui o padrão", async () => {
    vi.mocked(prisma.storeSetting.findMany).mockResolvedValueOnce([
      { key: "legal", value: { termos: "Meus termos" } },
    ] as never);

    const { resolveLegalPage } = await import("@/lib/legal/resolve-legal");
    expect(await resolveLegalPage("termos")).toBe("Meus termos");
  });

  it("termos padrão citam o acesso de suporte técnico", async () => {
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
    vi.mocked(readFileSync).mockImplementation(actual.readFileSync);

    const { resolveLegalPage } = await import("@/lib/legal/resolve-legal");
    expect(await resolveLegalPage("termos")).toMatch(/suporte técnico/i);
  });
});
