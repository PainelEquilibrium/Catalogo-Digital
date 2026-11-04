import { beforeEach, describe, expect, it, vi } from "vitest";
import { publicObjectUrl, storageObjectsForPersistedImage, removeStorageObjects, storageObjectsForOriginal, storeProcessedImage } from "./upload";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), client: vi.fn(), process: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ createServerSupabase: mocks.client }));
vi.mock("@/lib/auth/supabase-env", () => ({ getSupabasePublicConfig: () => ({ url: "https://project.supabase.co" }) }));
vi.mock("./process-image-buffer", () => ({ processImageBuffer: mocks.process }));
const entity = "11111111-1111-4111-8111-111111111111";
const uuid = "22222222-2222-4222-8222-222222222222";
const original = `originals/${entity}/${uuid}`;
const input = { bytes: Buffer.from("original"), scope: { kind: "product" as const, productId: entity } };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.client.mockResolvedValue({ storage: { from: (bucket: string) => ({ upload: (...args: unknown[]) => mocks.upload(bucket, ...args), remove: (paths: string[]) => mocks.remove(bucket, paths) }) } });
  mocks.process.mockResolvedValue({ thumb: Buffer.from("t"), card: Buffer.from("c"), detail: Buffer.from("d"), og: Buffer.from("o"), width: 800, height: 900 });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
});
describe("image storage", () => {
  it("routes original and four WebPs using one session and shared UUID", async () => {
    const result = await storeProcessedImage(input);
    expect(mocks.client).toHaveBeenCalledTimes(1);
    expect(mocks.upload).toHaveBeenCalledTimes(5);
    expect(mocks.upload.mock.calls[0]).toEqual(["product-images", result.storagePath, input.bytes, { contentType: "application/octet-stream", upsert: false }]);
    const imageId = result.storagePath.split("/")[2];
    for (const [index, variant] of ["thumb", "card", "detail", "og"].entries()) {
      const path = `variants/${entity}/${imageId}-${variant}.webp`;
      expect(mocks.upload.mock.calls[index + 1]).toEqual(["product-image-variants", path, expect.any(Buffer), { contentType: "image/webp", upsert: false }]);
      expect(result[`${variant}Url` as "thumbUrl"]).toBe(publicObjectUrl(path));
    }
    expect(() => publicObjectUrl(result.storagePath)).toThrow();
  });
  it("derives only strict generated paths, including legacy variants", () => {
    const objects = storageObjectsForOriginal(original);
    expect(objects).toHaveLength(9);
    expect(objects[0]).toEqual({ bucket: "product-images", path: original });
    for (const bucket of ["product-images", "product-image-variants"]) expect(objects.filter((object) => object.bucket === bucket)).toHaveLength(bucket === "product-images" ? 5 : 4);
    for (const path of ["seed/product", "https://evil.test/x", "originals/../x", "originals/entity/id", `${original}/../x`, "", `variants/${entity}/${uuid}-card.webp`]) expect(storageObjectsForOriginal(path)).toEqual([]);
    expect(() => publicObjectUrl(`variants/${entity}/../card.webp`)).toThrow();
  });
  it("validates before creating a session or uploading", async () => {
    mocks.process.mockRejectedValue(new Error("invalid image"));
    await expect(storeProcessedImage(input)).rejects.toThrow("invalid image");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("waits for in-flight uploads then compensates confirmed objects, preserving original error", async () => {
    let finish!: (value: { error: null }) => void;
    const primary = new Error("upload failed");
    mocks.upload.mockImplementation((_bucket, path: string) => path.endsWith("-thumb.webp") ? Promise.reject(primary) : path.endsWith("-og.webp") ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve({ error: null }));
    mocks.remove.mockRejectedValue(new Error("secret cleanup failure"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const pending = storeProcessedImage(input);
    const checked = expect(pending).rejects.toBe(primary);
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    expect(mocks.remove).not.toHaveBeenCalled();
    finish({ error: null });
    await checked;
    expect(mocks.remove).toHaveBeenCalledTimes(2);
    const removed = mocks.remove.mock.calls.flatMap((call) => call[1]);
    expect(removed).toHaveLength(4);
    expect(removed.some((path: string) => path.endsWith("-thumb.webp"))).toBe(false);
    expect(JSON.stringify(log.mock.calls)).toContain("product-image-variants");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
    log.mockRestore();
  });
  it("tries every cleanup bucket and propagates permission/network failures", async () => {
    mocks.remove.mockResolvedValueOnce({ error: { message: "permission denied" } });
    await expect(removeStorageObjects(storageObjectsForOriginal(original))).rejects.toThrow();
    expect(mocks.remove).toHaveBeenCalledTimes(2);
  });
  it("does not create a session for empty cleanup", async () => {
    await removeStorageObjects([]);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("accepts only explicit missing-object errors, not a generic 404", async () => {
    mocks.remove.mockResolvedValue({ error: { code: "NoSuchKey" } });
    await expect(removeStorageObjects(storageObjectsForOriginal(original))).resolves.toBeUndefined();
    mocks.remove.mockResolvedValue({ error: { statusCode: "404", message: "Bucket not found" } });
    await expect(removeStorageObjects(storageObjectsForOriginal(original))).rejects.toThrow();
  });
  it("rejects arbitrary cleanup instructions before removing anything", async () => {
    await expect(removeStorageObjects([{ bucket: "product-image-variants", path: "https://evil.test/x" }])).rejects.toThrow();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});

it("requires exact persisted URLs belonging to this project and derived objects", () => {
  const card = `https://project.supabase.co/storage/v1/object/public/product-image-variants/variants/${entity}/${uuid}-card.webp`;
  expect(storageObjectsForPersistedImage(original, { card })).toHaveLength(9);
  expect(storageObjectsForPersistedImage(original, { card: card.replace("product-image-variants", "product-images") })).toHaveLength(9);
  for (const invalid of [card.replace("project.supabase.co", "evil.test"), `${card}?x=1`, card.replace("-card.webp", "-og.webp"), null]) expect(storageObjectsForPersistedImage(original, { card: invalid })).toEqual([]);
  expect(storageObjectsForPersistedImage("seed/product", { card })).toEqual([]);
});
