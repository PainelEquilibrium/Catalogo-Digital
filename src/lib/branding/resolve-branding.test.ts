import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseBranding } from "@/domain/branding";

const findManyMock = vi.fn();

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    storeSetting: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

describe("resolveBranding", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("quando Prisma falha, devolve branding Equilibrium do arquivo", async () => {
    findManyMock.mockRejectedValue(new Error("connection failed"));

    const { resolveBranding } = await import("./resolve-branding");
    const result = await resolveBranding();

    const fileRaw = JSON.parse(
      readFileSync(join(process.cwd(), "branding.config.json"), "utf-8"),
    );
    const expected = parseBranding(fileRaw);

    expect(result.store.name).toBe("Equilibrium Tecnologia");
    expect(result.theme.primary_color).toBe("#2D3A4A");
    expect(result.theme.secondary_color).toBe("#C9A66B");
    expect(result).toEqual(expected);
  });
});
