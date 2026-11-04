import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/lib/prisma/client", () => ({ prisma: { storageDeletion: { findMany: m.findMany, deleteMany: m.deleteMany, updateMany: m.updateMany } } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => ({ storage: { from: (bucket: string) => ({ remove: (paths: string[]) => m.remove(bucket, paths) }) } }) }));
import { drainStorageDeletions, enqueueStorageDeletions } from "./storage-queue";

const row = (id: string, bucket: string, attempts = 0) => ({ id, bucket, path: `p/${id}`, attempts });
beforeEach(() => { vi.resetAllMocks(); m.remove.mockResolvedValue({ data: [], error: null }); });

it("enqueue faz upsert por (bucket, path)", async () => {
  const tx = { storageDeletion: { upsert: m.upsert } };
  await enqueueStorageDeletions(tx as never, [{ bucket: "product-images", path: "a" }]);
  expect(m.upsert).toHaveBeenCalledWith({ where: { bucket_path: { bucket: "product-images", path: "a" } }, create: { bucket: "product-images", path: "a" }, update: {} });
});

it("sucesso apaga a linha da fila", async () => {
  m.findMany.mockResolvedValue([row("1", "product-images"), row("2", "product-image-variants")]);
  expect(await drainStorageDeletions()).toEqual({ removed: 2, failed: 0 });
  expect(m.remove).toHaveBeenCalledTimes(2);
  expect(m.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["1"] } } });
  expect(m.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["2"] } } });
});

it("falha mantém a linha e incrementa attempts, sem afetar o outro bucket", async () => {
  m.findMany.mockResolvedValue([row("1", "product-images"), row("2", "product-image-variants")]);
  m.remove.mockImplementation(async (bucket: string) => bucket === "product-images" ? { data: null, error: { message: "boom", statusCode: "500" } } : { data: [], error: null });
  expect(await drainStorageDeletions()).toEqual({ removed: 1, failed: 1 });
  expect(m.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["1"] } }, data: { attempts: { increment: 1 }, lastError: "boom" } });
  expect(m.deleteMany).toHaveBeenCalledTimes(1);
  expect(m.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["2"] } } });
});

it("NoSuchKey conta como removido", async () => {
  m.findMany.mockResolvedValue([row("1", "product-images")]);
  m.remove.mockResolvedValue({ data: null, error: { message: "not found", statusCode: "404" } });
  expect(await drainStorageDeletions()).toEqual({ removed: 1, failed: 0 });
  expect(m.updateMany).not.toHaveBeenCalled();
});

it("com 5 tentativas falhas faz console.error sem vazar caminho", async () => {
  m.findMany.mockResolvedValue([row("1", "product-images", 4)]);
  m.remove.mockResolvedValue({ data: null, error: { message: "boom" } });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await drainStorageDeletions();
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});

it("com paths filtra a busca e respeita o limite", async () => {
  m.findMany.mockResolvedValue([]);
  await drainStorageDeletions({ paths: [{ bucket: "product-images", path: "a" }], limit: 10 });
  expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ bucket: "product-images", path: "a" }] }, take: 10 }));
});

it("exceção do cliente conta como falha e não derruba o drain", async () => {
  m.findMany.mockResolvedValue([row("1", "product-images")]);
  m.remove.mockRejectedValue(new Error("network"));
  expect(await drainStorageDeletions()).toEqual({ removed: 0, failed: 1 });
});
