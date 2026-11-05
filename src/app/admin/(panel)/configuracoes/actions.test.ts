import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ transaction: vi.fn(), enqueue: vi.fn(), drain: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
  requireAction: vi.fn(),
  StaffAuthError: class StaffAuthError extends Error {},
}));
vi.mock("@/lib/maintenance/storage-queue", () => ({ enqueueStorageDeletions: m.enqueue, drainStorageDeletions: m.drain }));
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
      $executeRaw: vi.fn(),
    };
    m.transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    const result = await saveSettingsSection("store", { store: { name: "Novo" } });

    expect(result).toEqual({ ok: true });
    expect(tx.storeSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ value: { name: "Novo", logo } }) }),
    );
  });

  it("restaurar a loja enfileira logo e OG enviados e limpa share.og_image; arquivo local não entra", async () => {
    vi.mocked(requireAction).mockResolvedValue({ userId: "o", email: "o@x.y", name: "Dona", role: "owner" });
    const base = "https://x.supabase.co/storage/v1/object/public/product-image-variants/variants/00000000-0000-4000-8000-000000000001";
    const logo = `${base}/11111111-1111-4111-8111-111111111111-detail.webp`;
    const og = `${base}/11111111-1111-4111-8111-111111111111-og.jpg`;
    const tx = {
      storeSetting: {
        findMany: vi.fn().mockResolvedValue([{ key: "store", value: { logo: { light: logo, dark: "/images/logo-white-3.webp" } } }]),
        findUnique: vi.fn().mockResolvedValue({ key: "share", value: { og_image: og } }),
        deleteMany: vi.fn(),
        delete: vi.fn(),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
      $executeRaw: vi.fn(),
    };
    m.transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    expect(await restoreSettingsSection("store")).toEqual({ ok: true });

    const queued = m.enqueue.mock.calls[0][1];
    expect(queued.map((o: { path: string }) => o.path.split("/").pop())).toEqual([
      "11111111-1111-4111-8111-111111111111-detail.webp",
      "11111111-1111-4111-8111-111111111111-og.jpg",
    ]);
    expect(tx.storeSetting.delete).toHaveBeenCalledWith({ where: { key: "share" } });
    expect(m.drain).toHaveBeenCalledWith(expect.objectContaining({ paths: queued }));
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
