import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ requireAction: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({ auth: { admin: { createUser: m.createUser, deleteUser: m.deleteUser } } }),
}));
vi.mock("@/lib/prisma/client", () => ({ prisma: { $transaction: m.transaction } }));

import { requireAction } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { createManager } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(requireAction).mockResolvedValue({ userId: "o", email: "o@x.y", name: "Dona", role: "owner" });
  m.createUser.mockResolvedValue({ data: { user: { id: "new-id" } }, error: null });
  m.transaction.mockRejectedValue(new Error("db down"));
});

describe("createManager rollback", () => {
  it("apaga o login criado quando a transação falha e registra só o id", async () => {
    m.deleteUser.mockResolvedValue({ error: null });
    const result = await createManager({ name: "Ana", email: "ana@x.com" });
    expect(result).toEqual({ ok: false, message: copyAdminPtBr.people.errorGeneric });
    expect(m.deleteUser).toHaveBeenCalledWith("new-id");
    expect(console.error).toHaveBeenCalledWith("createManager: falha na transação", "new-id");
  });

  it("registra quando a compensação também falha", async () => {
    m.deleteUser.mockResolvedValue({ error: { message: "boom" } });
    await createManager({ name: "Ana", email: "ana@x.com" });
    expect(console.error).toHaveBeenCalledWith("createManager: rollback do login falhou", "new-id");
  });
});
