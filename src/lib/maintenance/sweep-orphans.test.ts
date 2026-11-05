import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  productImage: vi.fn(), category: vi.fn(), product: vi.fn(), setting: vi.fn(), deletion: vi.fn(),
  queryRaw: vi.fn(), enqueue: vi.fn(), drain: vi.fn(), audit: vi.fn(), tx: {},
}));
vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    productImage: { findMany: m.productImage }, category: { findMany: m.category }, product: { findMany: m.product },
    storeSetting: { findMany: m.setting }, storageDeletion: { findMany: m.deletion },
    $queryRaw: m.queryRaw, $transaction: (fn: (tx: unknown) => unknown) => fn(m.tx),
  },
}));
vi.mock("@/lib/audit/record", () => ({ recordAudit: m.audit, SYSTEM_ACTOR: { id: null, name: "Sistema" } }));
vi.mock("./storage-queue", () => ({ enqueueStorageDeletions: m.enqueue, drainStorageDeletions: m.drain }));
vi.mock("@/lib/auth/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/auth/supabase-env", () => ({ getSupabasePublicConfig: vi.fn() }));
import { collectReferences, imageStem, planOrphanSweep, runOrphanSweep } from "./sweep-orphans";

const E = "3ed13f53-2f49-4e2a-9f67-fb6e0a5715c0";
const F = "bd5af2dc-a2c4-4447-b7be-b0b3dfd69aa3";
const now = new Date("2026-11-05T12:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);
const orig = (n: number) => `originals/${E}/${"00000000-0000-4000-8000-" + String(n).padStart(12, "0")}`;
const obj = (path: string, h = 25, bucket = "product-images") => ({ bucket, path, createdAt: ago(h) });
const plan = (objects: ReturnType<typeof obj>[], stems: string[] = [], paths: string[] = []) =>
  planOrphanSweep({ objects, referencedStems: new Set(stems), referencedPaths: new Set(paths), now });

beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); });

describe("imageStem", () => {
  it("extrai entidade/uuid de original e variantes, e rejeita o resto", () => {
    expect(imageStem(`originals/${E}/${F}`)).toBe(`${E}/${F}`);
    expect(imageStem(`variants/${E}/${F}-og.jpg`)).toBe(`${E}/${F}`);
    expect(imageStem(`variants/${E}/${F}-og.webp`)).toBe(`${E}/${F}`);
    expect(imageStem("seed/logo.png")).toBeNull();
    expect(imageStem(`variants/${E}/${F}-x.webp`)).toBeNull();
  });
});

describe("planOrphanSweep", () => {
  it("objeto sem referência há 25h é órfão; há 23h fica", () => {
    const fresh = Array.from({ length: 8 }, (_, i) => obj(orig(10 + i), 1));
    expect(plan([obj(orig(1), 25), obj(orig(2), 23), ...fresh])).toEqual({ kind: "ok", orphans: [{ bucket: "product-images", path: orig(1) }] });
  });
  it("cópia legada de imagem referenciada não é órfã", () => {
    const legacy = obj(`variants/${E}/${F}-og.webp`, 30, "product-images");
    expect(plan([legacy], [`${E}/${F}`])).toEqual({ kind: "ok", orphans: [] });
  });
  it("caminho referenciado só em store_settings não é órfão", () => {
    expect(plan([obj(orig(1))], [], [orig(1)])).toEqual({ kind: "ok", orphans: [] });
  });
  it("objeto já na fila não é órfão", () => {
    expect(plan([obj(orig(1))], [], [orig(1)])).toEqual({ kind: "ok", orphans: [] });
  });
  it("mais de 20% de órfãos aborta sem lista", () => {
    const objects = Array.from({ length: 100 }, (_, i) => obj(orig(i), i < 21 ? 25 : 1));
    const result = plan(objects);
    expect(result).toEqual({ kind: "aborted", reason: "too_many_orphans", orphanCount: 21 });
  });
  it("exatamente 20% prossegue", () => {
    const objects = Array.from({ length: 100 }, (_, i) => obj(orig(i), i < 20 ? 25 : 1));
    expect(plan(objects)).toMatchObject({ kind: "ok", orphans: expect.any(Array) });
    expect((plan(objects) as { orphans: unknown[] }).orphans).toHaveLength(20);
  });
  it("path fora do padrão nunca entra como órfão", () => {
    expect(plan([obj("seed/logo.png"), obj(`variants/${E}/${F}-card.webp`, 25, "outro-bucket"), obj(`originals/${E}/${F}`, 25, "product-image-variants")]))
      .toEqual({ kind: "ok", orphans: [] });
  });
  it("data nula ou inválida conta como recente", () => {
    expect(plan([{ bucket: "product-images", path: orig(1), createdAt: new Date("x") }])).toEqual({ kind: "ok", orphans: [] });
  });
  it("conjunto vazio é ok sem órfãos", () => {
    expect(plan([])).toEqual({ kind: "ok", orphans: [] });
  });
});

function mockRefs() {
  m.productImage.mockResolvedValue([{ storagePath: `originals/${E}/${F}`, thumbUrl: `https://x.supabase.co/storage/v1/object/public/product-image-variants/variants/${E}/${F}-thumb.webp`, cardUrl: "", detailUrl: "", ogUrl: "" }]);
  m.category.mockResolvedValue([{ coverImageUrl: null, coverStoragePath: null, coverOgUrl: null, description: null, fieldsSchema: [] }]);
  m.product.mockResolvedValue([]);
  m.setting.mockResolvedValue([{ value: { logo: { deep: [orig(7)] } } }]);
  m.deletion.mockResolvedValue([{ bucket: "product-images", path: orig(9) }]);
}

describe("collectReferences", () => {
  it("coleta stems de URLs, caminhos em JSON profundo e a fila", async () => {
    mockRefs();
    const refs = await collectReferences();
    expect(refs.referencedStems.has(`${E}/${F}`)).toBe(true);
    expect(refs.referencedStems.has(imageStem(orig(7))!)).toBe(true);
    expect(refs.referencedPaths.has(orig(7))).toBe(true);
    expect(refs.referencedPaths.has(orig(9))).toBe(true);
  });
  it("inclui itens na lixeira (sem filtro de deletedAt)", async () => {
    mockRefs();
    await collectReferences();
    expect(m.category.mock.calls[0][0]?.where).toBeUndefined();
    expect(m.product.mock.calls[0][0]?.where).toBeUndefined();
  });
});

describe("runOrphanSweep", () => {
  it("falha ao ler referências propaga e nada é apagado", async () => {
    mockRefs();
    m.setting.mockRejectedValue(new Error("db down"));
    await expect(runOrphanSweep(now)).rejects.toThrow("db down");
    expect(m.queryRaw).not.toHaveBeenCalled();
    expect(m.enqueue).not.toHaveBeenCalled();
    expect(m.drain).not.toHaveBeenCalled();
  });
  it("enfileira, audita em uma transação e drena só os órfãos", async () => {
    mockRefs();
    m.queryRaw.mockResolvedValue([
      { bucket_id: "product-images", name: orig(1), created_at: ago(30) },
      { bucket_id: "product-images", name: orig(7), created_at: ago(30) },
      { bucket_id: "product-images", name: orig(2), created_at: null },
      ...Array.from({ length: 7 }, (_, i) => ({ bucket_id: "product-images", name: orig(100 + i), created_at: ago(1) })),
    ]);
    m.drain.mockResolvedValue({ removed: 1, failed: 0 });
    const result = await runOrphanSweep(now);
    const orphans = [{ bucket: "product-images", path: orig(1) }];
    expect(m.enqueue).toHaveBeenCalledWith(m.tx, orphans);
    expect(m.audit).toHaveBeenCalledWith(m.tx, { id: null, name: "Sistema" }, expect.objectContaining({ entityType: "system", after: { count: 1, objects: orphans } }));
    expect(m.drain).toHaveBeenCalledWith({ paths: orphans, limit: 1 });
    expect(result).toEqual({ removed: 1, aborted: false });
  });
  it("aborta sem apagar nem enfileirar e registra a contagem", async () => {
    mockRefs();
    m.queryRaw.mockResolvedValue([{ bucket_id: "product-images", name: orig(1), created_at: ago(30) }]);
    expect(await runOrphanSweep(now)).toEqual({ removed: 0, aborted: true });
    expect(m.enqueue).not.toHaveBeenCalled();
    expect(m.drain).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("Orphan sweep aborted", { reason: "too_many_orphans", orphanCount: 1 });
  });
});
