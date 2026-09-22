import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
