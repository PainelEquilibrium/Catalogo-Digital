import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ transaction: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
  requireAction: vi.fn(),
  StaffAuthError: class StaffAuthError extends Error {},
}));
vi.mock("@/lib/prisma/client", () => ({ prisma: { $transaction: m.transaction } }));

import { requireAction, StaffAuthError } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { restoreSettingsSection, saveSettingsSection } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ações de configurações", () => {
  it("quem não pode alterar configurações é negado sem tocar no banco", async () => {
    vi.mocked(requireAction).mockRejectedValue(new StaffAuthError("forbidden"));
    const denied = { ok: false, message: copyAdminPtBr.settings.errorDenied };
    expect(await saveSettingsSection("store", { store: { name: "X" } })).toEqual(denied);
    expect(await restoreSettingsSection("store")).toEqual(denied);
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("dados inválidos são recusados antes da transação", async () => {
    vi.mocked(requireAction).mockResolvedValue({ userId: "o", email: "o@x.y", name: "Dona", role: "owner" });
    const result = await saveSettingsSection("theme", { theme: { primary_color: "azul" } });
    expect(result).toEqual({ ok: false, message: copyAdminPtBr.settings.errorInvalid });
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("salvar o nome preserva o logo que já está na chave", async () => {
    vi.mocked(requireAction).mockResolvedValue({ userId: "o", email: "o@x.y", name: "Dona", role: "owner" });
    const logo = { light: "/a.webp", dark: "/b.webp" };
    const tx = {
      storeSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ key: "store", value: { name: "Velho", logo } }),
        upsert: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };
    m.transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    const result = await saveSettingsSection("store", { store: { name: "Novo" } });

    expect(result).toEqual({ ok: true });
    expect(tx.storeSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ value: { name: "Novo", logo } }) }),
    );
  });
});
