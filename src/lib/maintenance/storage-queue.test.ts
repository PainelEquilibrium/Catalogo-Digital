import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  createMany: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/lib/prisma/client", () => ({ prisma: { storageDeletion: { findMany: m.findMany, deleteMany: m.deleteMany, updateMany: m.updateMany } } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => ({ storage: { from: (bucket: string) => ({ remove: (paths: string[]) => m.remove(bucket, paths) }) } }) }));
vi.mock("@/lib/auth/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/auth/supabase-env", () => ({ getSupabasePublicConfig: vi.fn() }));
import { drainStorageDeletions, enqueueStorageDeletions } from "./storage-queue";

const ENTITY = "3ed13f53-2f49-4e2a-9f67-fb6e0a5715c0";
const FILE = "bd5af2dc-a2c4-4447-b7be-b0b3dfd69aa3";
const ORIGINAL = `originals/${ENTITY}/${FILE}`;
const VARIANT = `variants/${ENTITY}/${FILE}-card.webp`;
// "1" -> original no bucket de originais; "2" -> variante no bucket de variantes.
const row = (id: string, bucket: string, attempts = 0, path = bucket === "product-images" ? ORIGINAL : VARIANT) => ({ id, bucket, path, attempts });
beforeEach(() => { vi.resetAllMocks(); m.remove.mockResolvedValue({ data: [], error: null }); });

it("enqueue grava tudo em um único createMany ignorando duplicados", async () => {
  const tx = { storageDeletion: { createMany: m.createMany } };
  await enqueueStorageDeletions(tx as never, [{ bucket: "product-images", path: "a" }, { bucket: "product-image-variants", path: "b" }]);
  expect(m.createMany).toHaveBeenCalledTimes(1);
  expect(m.createMany).toHaveBeenCalledWith({ data: [{ bucket: "product-images", path: "a" }, { bucket: "product-image-variants", path: "b" }], skipDuplicates: true });
});

it("enqueue sem objetos não consulta o banco", async () => {
  await enqueueStorageDeletions({ storageDeletion: { createMany: m.createMany } } as never, []);
  expect(m.createMany).not.toHaveBeenCalled();
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

it("NoSuchKey explícito conta como removido", async () => {
  m.findMany.mockResolvedValue([row("1", "product-images")]);
  m.remove.mockResolvedValue({ data: null, error: { message: "not found", statusCode: "404", code: "NoSuchKey" } });
  expect(await drainStorageDeletions()).toEqual({ removed: 1, failed: 0 });
  expect(m.updateMany).not.toHaveBeenCalled();
});

it("404 'Bucket not found' mantém a linha e incrementa attempts", async () => {
  m.findMany.mockResolvedValue([row("1", "product-images")]);
  m.remove.mockResolvedValue({ data: null, error: { message: "Bucket not found", statusCode: "404", code: "NoSuchBucket" } });
  expect(await drainStorageDeletions()).toEqual({ removed: 0, failed: 1 });
  expect(m.deleteMany).not.toHaveBeenCalled();
  expect(m.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["1"] } }, data: { attempts: { increment: 1 }, lastError: "Bucket not found" } });
});

it("linha inválida nunca vai ao Storage, conta como falha e as válidas seguem", async () => {
  m.findMany.mockResolvedValue([row("1", "product-images", 0, "../../outro/arquivo"), row("2", "outro-bucket", 0, ORIGINAL), row("3", "product-image-variants")]);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await drainStorageDeletions()).toEqual({ removed: 1, failed: 2 });
  expect(m.remove).toHaveBeenCalledTimes(1);
  expect(m.remove).toHaveBeenCalledWith("product-image-variants", [VARIANT]);
  expect(m.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["1", "2"] } }, data: { attempts: { increment: 1 }, lastError: "Invalid storage reference" } });
  expect(JSON.stringify(log.mock.calls)).not.toContain("outro");
  log.mockRestore();
});

it("com 5 tentativas falhas faz console.error sem vazar caminho", async () => {
  m.findMany.mockResolvedValue([row("1", "product-images", 4)]);
  m.remove.mockResolvedValue({ data: null, error: { message: "boom" } });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await drainStorageDeletions();
  expect(log).toHaveBeenCalled();
  const logged = JSON.stringify(log.mock.calls);
  expect(logged).not.toContain(ORIGINAL);
  expect(logged).not.toContain(ENTITY);
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

it("falha do banco em um bucket conta o lote como falha e não pula o próximo", async () => {
  m.findMany.mockResolvedValue([row("1", "product-images"), row("2", "product-image-variants")]);
  m.deleteMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => {
    if (where.id.in[0] === "1") throw new Error("db down");
  });
  expect(await drainStorageDeletions()).toEqual({ removed: 1, failed: 1 });
  expect(m.remove).toHaveBeenCalledTimes(2);
  expect(m.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["2"] } } });
});
