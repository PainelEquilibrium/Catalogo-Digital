import { describe, it, expect, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runImageVariantTransition, validateTransitionEnvironment, type TransitionOptions } from "./transition";
const entity = "09f26de1-a39b-4e3a-88a8-abc52496ff70", image = "c05cfb74-082c-413c-a537-8750347e4b5d";
const origin = "https://test.supabase.co";
const path = (v: string) => `variants/${entity}/${image}-${v}.webp`;
function fixture(manifestPath: string) {
  const row: { id: string; storagePath: string; [key: string]: string } = { id: image, productId: entity, storagePath: `originals/${entity}/${image}`, ...Object.fromEntries(["thumb", "card", "detail", "og"].map(v => [`${v}Url`, `${origin}/storage/v1/object/public/product-images/${path(v)}`])) };
  const upload = vi.fn(), remove = vi.fn(), update = vi.fn(), createBucket = vi.fn();
  const download = vi.fn(async () => ({ data: new Blob(["bytes"]), error: null }));
  const list = vi.fn(async () => ({ data: [{ name: "orphan.webp", id: "file" }], error: null }));
  const findMany = vi.fn(async ({ skip }: { skip: number }) => skip === 0 ? [row] : []);
  const options = { mode: "dry-run", writeEnabled: false, copyOnly: false, projectRef: "test", expectedOrigin: origin, manifestPath, pageSize: 1,
    prisma: { $queryRaw: vi.fn(async () => [{ present: false }]), productImage: { findMany, update }, category: { findMany: vi.fn(async () => []) }, profile: { findUnique: vi.fn(async () => ({ role: "owner" })) } },
    storage: { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "staff" } }, error: null })) }, storage: { createBucket, from: () => ({ download, list: vi.fn(async (_prefix, { offset }) => offset === 0 ? list() : { data: [], error: null }), upload, remove }) } }
  } as unknown as TransitionOptions;
  return { options, row, upload, remove, update, createBucket, download, findMany };
}
describe("transition dry-run", () => {
  it("rejects mismatched DB and URL projects", () => {
    expect(() => validateTransitionEnvironment("test", "https://evil.test", "postgres://x:y@host/db")).toThrow();
    expect(() => validateTransitionEnvironment("test", origin, "postgres://postgres.other:y@host/db")).toThrow();
  });
  it("pages all records, hashes bytes, reports orphans and performs zero remote writes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "images-"));
    try {
      const f = fixture(join(dir, "manifest.json"));
      const report = await runImageVariantTransition(f.options);
      expect(report.eligible).toBe(1); expect(report.updated).toBe(0);
      expect(f.findMany).toHaveBeenCalledWith({ skip: 1, take: 1, orderBy: { id: "asc" } });
      expect(report.manifest.entries[0].sources).toHaveLength(4);
      expect(report.manifest.entries[0].sources[0]).toMatchObject({ size: 5, sha256: "277089d91c0bdf4f2e6862ba7e4a07605119431f5d13f726dd352b06f1b206a9" });
      expect(report.manifest.orphans).toEqual(["variants/orphan.webp"]);
      for (const spy of [f.upload, f.remove, f.update, f.createBucket]) expect(spy).not.toHaveBeenCalled();
      expect(JSON.parse(await readFile(f.options.manifestPath, "utf8")).version).toBe(1);
      await expect(runImageVariantTransition(f.options)).rejects.toThrow();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("blocks mixed references without downloads", async () => {
    const dir = await mkdtemp(join(tmpdir(), "images-"));
    try {
      const f = fixture(join(dir, "m.json")); f.row.cardUrl = `${origin}/storage/v1/object/public/product-image-variants/${path("card")}`;
      expect((await runImageVariantTransition(f.options)).failed).toBe(1); expect(f.download).not.toHaveBeenCalled();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});


it("checks all four category sources and blocks missing variants", async () => {
  const dir = await mkdtemp(join(tmpdir(), "images-"));
  try {
    const f = fixture(join(dir, "category.json"));
    f.options.prisma.productImage.findMany = vi.fn(async () => []) as unknown as typeof f.options.prisma.productImage.findMany;
    f.options.prisma.category.findMany = vi.fn(async ({ skip }: { skip: number }) => skip ? [] : [{ id: entity, coverStoragePath: f.row.storagePath, coverImageUrl: f.row.cardUrl }]) as unknown as typeof f.options.prisma.category.findMany;
    f.download.mockImplementation(async () => ({ data: null, error: { status: 404 } }) as never);
    const report = await runImageVariantTransition(f.options);
    expect(report.failed).toBe(1); expect(f.download).toHaveBeenCalledTimes(4);
    expect(report.manifest.entries[0].blockers).toHaveLength(4);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it("stops on lost authentication without writing a snapshot", async () => {
  const dir = await mkdtemp(join(tmpdir(), "images-"));
  try {
    const f = fixture(join(dir, "expired.json"));
    f.options.storage.auth.getUser = vi.fn(async () => ({ data: { user: null }, error: { status: 401 } })) as unknown as typeof f.options.storage.auth.getUser;
    await expect(runImageVariantTransition(f.options)).rejects.toThrow("Session expired");
    await expect(readFile(f.options.manifestPath)).rejects.toThrow();
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it("rejects unsafe host, credentials, traversal and mixed sets", async () => {
  for (const bad of ["https://test.supabase.co.evil/x", "https://user:secret@test.supabase.co/storage/v1/object/public/product-images/" + path("card"), origin + "/storage/v1/object/public/product-images/variants/../x"] ) {
    const dir = await mkdtemp(join(tmpdir(), "images-"));
    try {
      const f = fixture(join(dir, "unsafe.json")); f.row.cardUrl = bad;
      expect((await runImageVariantTransition(f.options)).failed).toBe(1);
      expect(f.download).not.toHaveBeenCalled();
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
});


// Apply uses real WebP bytes; mocks exercise Storage boundaries, never the decoder.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { readTransitionManifest } from "./transition";
async function applyFixture() {
  const dir = await mkdtemp(join(tmpdir(), "images-apply-"));
  const f = fixture(join(dir, "manifest.json"));
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).webp().toBuffer();
  const targets = new Map<string, Buffer>();
  const sourceDownload = vi.fn(async () => ({ data: new Blob([bytes]), error: null }));
  const targetDownload = vi.fn(async (key: string) => targets.has(key) ? { data: new Blob([new Uint8Array(targets.get(key)!)]), error: null } : { data: null, error: { status: 404 } });
  const upload = vi.fn(async (key: string, body: Buffer, _options: { upsert: boolean; contentType: string }) => {
    expect(_options).toEqual({ upsert: false, contentType: "image/webp" });
    if (targets.has(key)) return { data: null, error: { status: 409 } };
    targets.set(key, body); return { data: { path: key }, error: null };
  });
  const updateMany = vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, string> }) => {
    if (!Object.entries(where).every(([k, v]) => f.row[k] === v)) return { count: 0 };
    Object.assign(f.row, data); return { count: 1 };
  });
  f.options.prisma.productImage.updateMany = updateMany as never;
  f.options.prisma.productImage.findFirst = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    const choices = (where.OR ?? [where]) as Record<string, unknown>[];
    return choices.some(choice => Object.entries(choice).every(([k,v]) => f.row[k] === v)) ? { id: image } : null;
  }) as never;
  f.options.storage.storage.from = vi.fn((bucket: string) => ({
    download: bucket === "product-images" ? sourceDownload : targetDownload, upload, remove: f.remove,
    list: vi.fn(async () => ({ data: [], error: null }))
  })) as never;
  const inventory = await runImageVariantTransition(f.options);
  const fetchMock = vi.fn(async (url: string) => {
    const key = url.split("/product-image-variants/")[1];
    return new Response(targets.has(key) ? new Uint8Array(targets.get(key)!) : null, { status: targets.has(key) ? 200 : 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const options = { ...f.options, mode: "apply" as const, writeEnabled: true };
  return { ...f, dir, bytes, targets, sourceDownload, targetDownload, upload, updateMany, fetchMock, inventory, options };
}
async function withApply(test: (f: Awaited<ReturnType<typeof applyFixture>>) => Promise<void>) {
  const f = await applyFixture();
  try { await test(f); } finally { vi.unstubAllGlobals(); await rm(f.dir, { recursive: true, force: true }); }
}
describe("transition apply and rollback", () => {
  it("copies without overwrite, atomically CASes all references, resumes and preserves snapshot", () => withApply(async f => {
    const snapshot = await readFile(f.options.manifestPath, "utf8");
    expect((await runImageVariantTransition(f.options)).updated).toBe(1);
    expect(f.upload).toHaveBeenCalledTimes(4);
    for (const call of f.upload.mock.calls) expect(call[2]).toEqual({ upsert: false, contentType: "image/webp" });
    expect(f.updateMany.mock.calls[0][0].where).toEqual({ id: image, productId: entity, storagePath: f.row.storagePath, ...Object.fromEntries(Object.entries(f.inventory.manifest.entries[0].oldReferences).map(([k,v]) => [`${k}Url`, v])) });
    expect(Object.keys(f.updateMany.mock.calls[0][0].data)).toHaveLength(4);
    expect((await runImageVariantTransition(f.options)).conflicts).toBe(0);
    expect(f.upload).toHaveBeenCalledTimes(4);
    expect(await readFile(f.options.manifestPath, "utf8")).toBe(snapshot);
    expect(f.remove).not.toHaveBeenCalled();
  }));
  it("copyOnly resumes with fresh public verification and no initial database writes", () => withApply(async f => {
    expect((await runImageVariantTransition({ ...f.options, copyOnly: true })).updated).toBe(0);
    expect(f.updateMany).not.toHaveBeenCalled();
    f.fetchMock.mockClear();
    expect((await runImageVariantTransition(f.options)).updated).toBe(1);
    expect(f.fetchMock.mock.calls.length).toBeGreaterThanOrEqual(5);
  }));
  it.each(["source missing", "source changed", "target changed", "http", "redirect", "invalid webp", "public hash", "public original"])("blocks %s without database writes", issue => withApply(async f => {
    if (issue === "source missing") f.sourceDownload.mockResolvedValue({ data: null, error: { status: 404 } } as never);
    if (issue === "source changed") f.sourceDownload.mockResolvedValue({ data: new Blob(["different"]), error: null });
    if (issue === "target changed") f.targets.set(path("thumb"), Buffer.from("other"));
    if (issue === "http") f.fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    if (issue === "redirect") f.fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { Location: "https://evil.test" } }));
    if (issue === "invalid webp") f.fetchMock.mockResolvedValue(new Response("invalid", { status: 200 }));
    if (issue === "public hash") f.fetchMock.mockResolvedValue(new Response(await sharp({ create: { width: 3, height: 3, channels: 3, background: "blue" } }).webp().toBuffer(), { status: 200 }));
    if (issue === "public original") f.fetchMock.mockImplementation(async () => new Response(f.bytes, { status: 200 }));
    const report = await runImageVariantTransition(f.options);
    expect(report.failed + report.conflicts).toBe(1); expect(f.updateMany).not.toHaveBeenCalled();
    if (issue === "target changed") expect(f.targets.get(path("thumb"))).toEqual(Buffer.from("other"));
    expect(f.remove).not.toHaveBeenCalled();
  }));
  it("reports CAS conflicts and never overwrites a later edit", () => withApply(async f => {
    f.row.cardUrl = "later-edit";
    expect((await runImageVariantTransition(f.options)).conflicts).toBe(1);
    expect(f.row.cardUrl).toBe("later-edit");
  }));
  it("simulates rollback without writes, rolls back exact new refs and refuses later edits", () => withApply(async f => {
    await runImageVariantTransition(f.options); f.updateMany.mockClear();
    const rollback = { ...f.options, mode: "rollback" as const };
    await runImageVariantTransition({ ...rollback, writeEnabled: false }); expect(f.updateMany).not.toHaveBeenCalled();
    expect((await runImageVariantTransition(rollback)).updated).toBe(1);
    await runImageVariantTransition(f.options); f.row.cardUrl = "later-edit";
    expect((await runImageVariantTransition(rollback)).conflicts).toBe(1); expect(f.row.cardUrl).toBe("later-edit");
  }));
  it.each(["version", "project", "id", "path", "duplicate", "url", "shape", "entity"])("rejects tampered manifest %s before storage", issue => withApply(async f => {
    const m = structuredClone(f.inventory.manifest);
    if (issue === "version") m.version = 2 as never;
    if (issue === "project") m.projectRef = "other";
    if (issue === "id") m.entries[0].id = "invalid";
    if (issue === "path") m.entries[0].sources[0].path = "variants/../original";
    if (issue === "duplicate") m.entries[0].sources[1] = m.entries[0].sources[0];
    if (issue === "url") m.entries[0].newReferences.card = "https://evil.test/x";
    if (issue === "shape") m.entries[0].oldReferences = null as never;
    if (issue === "entity") m.entries[0].original = `originals/${image}/${entity}`;
    await writeFile(f.options.manifestPath, JSON.stringify(m)); f.sourceDownload.mockClear();
    await expect(readTransitionManifest(f.options.manifestPath, "test", origin)).rejects.toThrow();
    await expect(runImageVariantTransition(f.options)).rejects.toThrow(); expect(f.sourceDownload).not.toHaveBeenCalled();
  }));
});

it("recursively pages Storage folders and multiple category pages", async () => {
  const dir = await mkdtemp(join(tmpdir(), "images-pages-"));
  try {
    const f = fixture(join(dir, "manifest.json"));
    const categories = [{ id: entity, coverStoragePath: f.row.storagePath, coverImageUrl: f.row.cardUrl }, { id: image, coverStoragePath: `originals/${image}/${entity}`, coverImageUrl: `${origin}/storage/v1/object/public/product-images/variants/${image}/${entity}-card.webp` }];
    const categoryPages = vi.fn(async ({ skip }: { skip: number }) => categories.slice(skip, skip + 1));
    f.options.prisma.category.findMany = categoryPages as never;
    const list = vi.fn(async (prefix: string, { offset }: { offset: number }) => ({ data: offset === 0 ? prefix === "variants" ? [{ name: "nested", id: null }] : [{ name: "first.webp", id: "1" }] : offset === 1 && prefix !== "variants" ? [{ name: "second.webp", id: "2" }] : [], error: null }));
    f.options.storage.storage.from = vi.fn(() => ({ list, download: f.download })) as never;
    const report = await runImageVariantTransition(f.options);
    expect(report.eligible).toBe(3);
    expect(categoryPages).toHaveBeenCalledWith({ skip: 2, take: 1, orderBy: { id: "asc" } });
    expect(report.manifest.orphans).toEqual(["variants/nested/first.webp", "variants/nested/second.webp"]);
    expect(list).toHaveBeenCalledWith("variants/nested", expect.objectContaining({ offset: 2 }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it("refuses a globally present public original before the first Storage write", () => withApply(async f => {
  f.options.prisma.$queryRaw = vi.fn(async () => [{ present: true }]) as never;
  await expect(runImageVariantTransition(f.options)).rejects.toThrow("Public bucket");
  expect(f.upload).not.toHaveBeenCalled(); expect(f.updateMany).not.toHaveBeenCalled();
}));
it("rechecks global originals before updating after copies", () => withApply(async f => {
  f.options.prisma.$queryRaw = vi.fn().mockResolvedValueOnce([{ present: false }]).mockResolvedValue([{ present: true }]) as never;
  await expect(runImageVariantTransition(f.options)).rejects.toThrow("Public bucket");
  expect(f.upload).toHaveBeenCalledTimes(4); expect(f.updateMany).not.toHaveBeenCalled();
}));
it("resumes after successful copies and a failed database phase", () => withApply(async f => {
  f.updateMany.mockRejectedValueOnce(new Error("database unavailable"));
  expect((await runImageVariantTransition(f.options)).failed).toBe(1);
  expect(f.targets.size).toBe(4);
  expect((await runImageVariantTransition(f.options)).updated).toBe(1);
  expect(f.upload).toHaveBeenCalledTimes(4);
  const journal = await readFile(`${f.options.manifestPath}.journal.json`, "utf8");
  expect(journal).toContain('"kind":"failed"'); expect(journal).toContain('"kind":"updated"');
}));
it("stops immediately on session expiry during copy and never updates", () => withApply(async f => {
  f.options.storage.auth.getUser = vi.fn().mockResolvedValueOnce({ data: { user: { id: "staff" } }, error: null }).mockResolvedValue({ data: { user: null }, error: { status: 401 } }) as never;
  await expect(runImageVariantTransition(f.options)).rejects.toThrow("Staff session invalid");
  expect(f.upload).not.toHaveBeenCalled(); expect(f.updateMany).not.toHaveBeenCalled();
}));
it("stops immediately on Storage authentication denial", () => withApply(async f => {
  f.targetDownload.mockResolvedValue({ data: null, error: { status: 403 } });
  await expect(runImageVariantTransition(f.options)).rejects.toThrow("Session expired");
  expect(f.upload).not.toHaveBeenCalled(); expect(f.updateMany).not.toHaveBeenCalled();
}));
it("reuses a concurrent identical upload and preserves a concurrent divergent upload", () => withApply(async f => {
  f.upload.mockImplementation(async (key) => { f.targets.set(key, f.bytes); return { data: null, error: { status: 409 } } as never; });
  expect((await runImageVariantTransition(f.options)).updated).toBe(1);
  expect(f.targets.size).toBe(4); expect(f.remove).not.toHaveBeenCalled();
}));
it("refuses malformed journal before uploads", () => withApply(async f => {
  await writeFile(`${f.options.manifestPath}.journal.json`, JSON.stringify({ version: 1, projectRef: "other", events: [] }));
  await expect(runImageVariantTransition(f.options)).rejects.toThrow("Invalid journal"); expect(f.upload).not.toHaveBeenCalled();
}));
it("sends no credentials and refuses automatic redirects on every public check", () => withApply(async f => {
  await runImageVariantTransition(f.options);
  for (const call of f.fetchMock.mock.calls as unknown as [string, RequestInit][]) expect(call[1]).toEqual({ headers: {}, credentials: "omit", redirect: "manual", cache: "no-store" });
}));
it("requires all four category variants before its conditional cover update", () => withApply(async f => {
  const m = f.inventory.manifest;
  m.entries[0] = { ...m.entries[0], kind: "category", id: entity, oldReferences: { card: m.entries[0].oldReferences.card }, newReferences: { card: m.entries[0].newReferences.card } };
  await writeFile(f.options.manifestPath, JSON.stringify(m));
  const update = vi.fn(async () => ({ count: 1 }));
  f.options.prisma.category.updateMany = update as never;
  f.fetchMock.mockImplementation(async (url: string) => url.endsWith("-og.webp") ? new Response(null, { status: 503 }) : new Response(url.includes("/originals/") ? null : f.bytes, { status: url.includes("/originals/") ? 404 : 200 }));
  expect((await runImageVariantTransition(f.options)).failed).toBe(1); expect(update).not.toHaveBeenCalled();
  f.fetchMock.mockImplementation(async (url: string) => new Response(url.includes("/originals/") ? null : f.bytes, { status: url.includes("/originals/") ? 404 : 200 }));
  expect((await runImageVariantTransition(f.options)).updated).toBe(1);
  expect(update).toHaveBeenCalledWith({ where: { id: entity, coverStoragePath: m.entries[0].original, coverImageUrl: m.entries[0].oldReferences.card }, data: { coverImageUrl: m.entries[0].newReferences.card } });
}));
it("accepts independent database image UUID while guarding the original product identity", () => withApply(async f => {
  const independent = "99f26de1-a39b-4e3a-88a8-abc52496ff70";
  f.row.id = independent;
  const m = f.inventory.manifest; m.entries[0].id = independent;
  await writeFile(f.options.manifestPath, JSON.stringify(m));
  expect((await runImageVariantTransition(f.options)).updated).toBe(1);
  expect(f.updateMany.mock.calls[0][0].where).toMatchObject({ id: independent, productId: entity });
}));
it("isolates failed sets and reports later successful updates", () => withApply(async f => {
  const m = f.inventory.manifest;
  const first = m.entries[0];
  m.entries.push({ ...first, kind: "category", id: entity, oldReferences: { card: first.oldReferences.card }, newReferences: { card: first.newReferences.card } });
  await writeFile(f.options.manifestPath, JSON.stringify(m));
  f.options.prisma.category.updateMany = vi.fn(async () => ({ count: 1 })) as never;
  f.fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
  const report = await runImageVariantTransition(f.options);
  expect(report.failed).toBe(1); expect(report.updated).toBe(1);
  expect(f.updateMany).not.toHaveBeenCalled();
}));
it("simulates rollback against current references and reports edits without any writes", () => withApply(async f => {
  await runImageVariantTransition(f.options);
  f.row.cardUrl = "later-edit"; f.updateMany.mockClear(); f.upload.mockClear();
  const journal = await readFile(`${f.options.manifestPath}.journal.json`, "utf8");
  const report = await runImageVariantTransition({ ...f.options, mode: "rollback", writeEnabled: false });
  expect(report.conflicts).toBe(1); expect(f.updateMany).not.toHaveBeenCalled(); expect(f.upload).not.toHaveBeenCalled();
  expect(await readFile(`${f.options.manifestPath}.journal.json`, "utf8")).toBe(journal);
}));
it.each([
  { status: 404, statusCode: "NoSuchKey" },
  { status: 400, statusCode: "404", code: "NoSuchKey" },
  { status: 400, statusCode: "NoSuchKey" },
  { status: 400, code: "NoSuchKey" }
])("creates missing destinations for explicit Storage absence %j", error => withApply(async f => {
  f.targetDownload.mockResolvedValue({ data: null, error } as never);
  expect((await runImageVariantTransition(f.options)).updated).toBe(1);
  expect(f.upload).toHaveBeenCalledTimes(4);
}));
it.each([{ status: 500, statusCode: "InternalError" }, { status: 0, statusCode: "NetworkError" }])("blocks other destination errors without creation %j", error => withApply(async f => {
  f.targetDownload.mockResolvedValue({ data: null, error } as never);
  expect((await runImageVariantTransition(f.options)).failed).toBe(1);
  expect(f.upload).not.toHaveBeenCalled(); expect(f.updateMany).not.toHaveBeenCalled();
}));
it("checks staff at set boundaries and before CAS, refusing role loss after verification", () => withApply(async f => {
  const profile = vi.mocked(f.options.prisma.profile.findUnique);
  profile.mockReset();
  profile.mockResolvedValueOnce({ role: "owner" } as never).mockResolvedValueOnce({ role: "owner" } as never).mockResolvedValue({ role: "member" } as never);
  await expect(runImageVariantTransition(f.options)).rejects.toThrow("Staff session invalid");
  expect(profile).toHaveBeenCalledTimes(3);
  expect(f.upload).toHaveBeenCalledTimes(4); expect(f.updateMany).not.toHaveBeenCalled();
}));
it("checks staff once per copy-only set without redundant per-variant lookups", () => withApply(async f => {
  const m = f.inventory.manifest, first = m.entries[0];
  m.entries.push({ ...first, kind: "category", id: entity, oldReferences: { card: first.oldReferences.card }, newReferences: { card: first.newReferences.card } });
  await writeFile(f.options.manifestPath, JSON.stringify(m));
  const getUser = vi.mocked(f.options.storage.auth.getUser); getUser.mockClear();
  const profile = vi.mocked(f.options.prisma.profile.findUnique); profile.mockClear();
  expect((await runImageVariantTransition({ ...f.options, copyOnly: true })).failed).toBe(0);
  expect(getUser).toHaveBeenCalledTimes(3); expect(profile).toHaveBeenCalledTimes(3);
  expect(f.updateMany).not.toHaveBeenCalled();
}));
it("stops on expired source JWT after the set staff check", () => withApply(async f => {
  f.sourceDownload.mockResolvedValue({ data: null, error: { status: 401 } } as never);
  await expect(runImageVariantTransition(f.options)).rejects.toThrow("Session expired");
  expect(f.upload).not.toHaveBeenCalled(); expect(f.updateMany).not.toHaveBeenCalled();
}));
