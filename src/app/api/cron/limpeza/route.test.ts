import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ purge: vi.fn(), prune: vi.fn(), drain: vi.fn(), sweep: vi.fn() }));
vi.mock("@/lib/maintenance/purge-trash", () => ({ purgeExpiredTrash: m.purge, pruneOldAudit: m.prune }));
vi.mock("@/lib/maintenance/storage-queue", () => ({ drainStorageDeletions: m.drain }));
vi.mock("@/lib/maintenance/sweep-orphans", () => ({ runOrphanSweep: m.sweep }));
import { GET } from "./route";

const req = (auth?: string) => new Request("http://x/api/cron/limpeza", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "segredo");
  m.purge.mockResolvedValue({ products: 1, categories: 0, blocked: 0, failed: 0 });
  m.drain.mockResolvedValue({ removed: 2, failed: 0 });
  m.prune.mockResolvedValue(3);
  m.sweep.mockResolvedValue({ removed: 4, aborted: false });
});

it("sem header, ou com segredo errado, responde 401", async () => {
  expect((await GET(req())).status).toBe(401);
  expect((await GET(req("Bearer errado"))).status).toBe(401);
  expect((await GET(req("Bearer curto"))).status).toBe(401);
  expect((await GET(req("Bearer segredx"))).status).toBe(401);
  expect(m.purge).not.toHaveBeenCalled();
});

it("com CRON_SECRET vazio no ambiente responde 401", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await GET(req("Bearer "))).status).toBe(401);
  expect((await GET(req("Bearer"))).status).toBe(401);
});

it("com segredo certo roda as etapas e devolve só contagens", async () => {
  const res = await GET(req("Bearer segredo"));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    products: 1, categories: 0, blocked: 0, failed: 0, storage: { removed: 2, failed: 0 }, orphans: { removed: 4, aborted: false }, auditPruned: 3,
  });
});

it("falha em uma etapa não impede as seguintes e a rota responde 500", async () => {
  m.purge.mockRejectedValue(new Error("db"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const res = await GET(req("Bearer segredo"));
  expect(res.status).toBe(500);
  expect(m.drain).toHaveBeenCalled();
  expect(m.prune).toHaveBeenCalled();
});

it("item que falhou na limpeza faz a rota responder 500", async () => {
  m.purge.mockResolvedValue({ products: 0, categories: 0, blocked: 0, failed: 1 });
  expect((await GET(req("Bearer segredo"))).status).toBe(500);
});

it("varredura que falha responde 500 e a poda ainda roda", async () => {
  m.sweep.mockRejectedValue(new Error("db"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await GET(req("Bearer segredo"))).status).toBe(500);
  expect(m.prune).toHaveBeenCalled();
});

it("varredura abortada é estado seguro: 200 com aborted no corpo e a poda roda", async () => {
  m.sweep.mockResolvedValue({ removed: 0, aborted: true });
  const res = await GET(req("Bearer segredo"));
  expect(res.status).toBe(200);
  expect((await res.json()).orphans).toEqual({ removed: 0, aborted: true });
  expect(m.prune).toHaveBeenCalled();
});
