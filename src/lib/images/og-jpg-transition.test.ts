import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ process: vi.fn(), enqueue: vi.fn() }));
vi.mock("./process-image-buffer", () => ({ processImageBuffer: m.process }));
vi.mock("@/lib/maintenance/storage-queue", () => ({ enqueueStorageDeletions: m.enqueue }));
vi.mock("@/lib/auth/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/auth/supabase-env", () => ({ getSupabasePublicConfig: vi.fn() }));
import { runOgJpgTransition } from "./og-jpg-transition";

const E = "3ed13f53-2f49-4e2a-9f67-fb6e0a5715c0";
const U = "bd5af2dc-a2c4-4447-b7be-b0b3dfd69aa3";
const base = "https://x.supabase.co/storage/v1/object/public/product-image-variants";
const webp = `${base}/variants/${E}/${U}-og.webp`;
const jpg = `${base}/variants/${E}/${U}-og.jpg`;
const row = { id: "p1", storagePath: `originals/${E}/${U}`, ogUrl: webp };

function setup(products: object[], categories: object[] = [], opts: { count?: number; upload?: unknown; txFail?: boolean } = {}) {
  const tx = {
    productImage: { updateMany: vi.fn().mockResolvedValue({ count: opts.count ?? 1 }) },
    category: { updateMany: vi.fn().mockResolvedValue({ count: opts.count ?? 1 }) },
  };
  const prisma = {
    productImage: { findMany: vi.fn().mockResolvedValueOnce(products) },
    category: { findMany: vi.fn().mockResolvedValueOnce(categories) },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const upload = vi.fn().mockResolvedValue(opts.upload ?? { error: null });
  const remove = vi.fn().mockResolvedValue({});
  const download = vi.fn().mockResolvedValue({ data: new Blob(["x"]), error: null });
  const storage = { storage: { from: vi.fn(() => ({ upload, remove, download, getPublicUrl: (p: string) => ({ data: { publicUrl: `${base}/${p}` } }) })) } };
  return { prisma, storage, tx, upload, remove, download };
}
const run = (s: ReturnType<typeof setup>, apply: boolean) => runOgJpgTransition({ prisma: s.prisma as never, storage: s.storage as never, apply });

beforeEach(() => { vi.resetAllMocks(); m.process.mockResolvedValue({ og: Buffer.from("jpg") }); });

describe("runOgJpgTransition", () => {
  it("simulação não grava nem envia nada", async () => {
    const s = setup([row]);
    expect(await run(s, false)).toEqual({ eligible: 1, converted: 0, skipped: 0, failed: 0 });
    expect(s.download).not.toHaveBeenCalled(); expect(s.upload).not.toHaveBeenCalled(); expect(s.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("apply: envia JPG, atualiza ogUrl e enfileira o OG WebP antigo", async () => {
    const s = setup([row]);
    expect(await run(s, true)).toEqual({ eligible: 1, converted: 1, skipped: 0, failed: 0 });
    expect(s.upload).toHaveBeenCalledWith(`variants/${E}/${U}-og.jpg`, Buffer.from("jpg"), { contentType: "image/jpeg", upsert: false });
    expect(s.tx.productImage.updateMany).toHaveBeenCalledWith({ where: { id: "p1", ogUrl: webp }, data: { ogUrl: jpg } });
    expect(m.enqueue).toHaveBeenCalledWith(s.tx, [{ bucket: "product-image-variants", path: `variants/${E}/${U}-og.webp` }]);
  });
  it("linha com ogUrl .jpg é pulada", async () => {
    const s = setup([{ ...row, ogUrl: jpg }]);
    expect(await run(s, true)).toEqual({ eligible: 0, converted: 0, skipped: 1, failed: 0 });
    expect(s.upload).not.toHaveBeenCalled();
  });
  it("URL externa de seed é pulada", async () => {
    const s = setup([{ ...row, storagePath: "https://img.example/a.jpg" }]);
    expect(await run(s, true)).toEqual({ eligible: 0, converted: 0, skipped: 1, failed: 0 });
  });
  it("falha de uma foto não para as outras nem apaga o WebP", async () => {
    const s = setup([{ ...row, id: "bad" }, row]);
    m.process.mockRejectedValueOnce(new Error("small"));
    expect(await run(s, true)).toEqual({ eligible: 2, converted: 1, skipped: 0, failed: 1 });
    expect(m.enqueue).toHaveBeenCalledTimes(1);
  });
  it("falha do banco remove o JPG recém-criado e conta como falha", async () => {
    const s = setup([row], [], { count: 0 });
    expect(await run(s, true)).toEqual({ eligible: 1, converted: 0, skipped: 0, failed: 1 });
    expect(s.remove).toHaveBeenCalledWith([`variants/${E}/${U}-og.jpg`]);
    expect(m.enqueue).not.toHaveBeenCalled();
  });
  it("JPG pré-existente é reaproveitado e não é removido em falha", async () => {
    const s = setup([row], [], { count: 0, upload: { error: { message: "The resource already exists" } } });
    expect((await run(s, true)).failed).toBe(1);
    expect(s.remove).not.toHaveBeenCalled();
  });
  it("capa de categoria ganha coverOgUrl", async () => {
    const s = setup([], [{ id: E, coverStoragePath: `originals/${E}/${U}`, coverOgUrl: webp }]);
    expect((await run(s, true)).converted).toBe(1);
    expect(s.tx.category.updateMany).toHaveBeenCalledWith({ where: { id: E, coverOgUrl: webp }, data: { coverOgUrl: jpg } });
  });
});
