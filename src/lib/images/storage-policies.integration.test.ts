import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt in only after independently confirming this reference belongs to DEV.
// Required: STORAGE_DEV_PROJECT_REF, STORAGE_DEV_CONFIRM=DEV:<ref>, DIRECT_URL,
// NEXT_PUBLIC_SUPABASE_{URL,ANON_KEY}, STORAGE_{OWNER,MANAGER,NONSTAFF}_{EMAIL,PASSWORD}.
// STORAGE_LEGACY_VARIANT_{PATH,MANAGER_PATH}: isolated disposable legacy WebP fixtures.
// NONSTAFF must be an existing Auth user with no public.profiles row. No users are created.
const enabled = process.env.RUN_STORAGE_INTEGRATION === "1";
const privateBucket = "product-images";
const publicBucket = "product-image-variants";
const scope = randomUUID();
const original = `originals/${scope}/${randomUUID()}`;
const variant = `variants/${scope}/${randomUUID()}-card.webp`;
const created: { bucket: string; path: string }[] = [];
let owner: SupabaseClient;
let manager: SupabaseClient;
let nonstaff: SupabaseClient;
let anon: SupabaseClient;
let db: Client;
let bytes: Buffer;
let url: string;
let legacyVariant: string;
let managerLegacyVariant: string;
const tokens = new Map<SupabaseClient, string>();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing integration configuration: ${name}`);
  return value;
}

describe.skipIf(!enabled)("Storage policies (real DEV, opt-in)", () => {
  beforeAll(async () => {
    const ref = required("STORAGE_DEV_PROJECT_REF");
    if (!/^[a-z]{20}$/.test(ref) || required("STORAGE_DEV_CONFIRM") !== `DEV:${ref}`) {
      throw new Error("Explicit confirmed DEV project reference required");
    }
    url = required("NEXT_PUBLIC_SUPABASE_URL");
    if (new URL(url).origin !== `https://${ref}.supabase.co`) {
      throw new Error("Supabase target does not match confirmed DEV reference");
    }
    legacyVariant = required("STORAGE_LEGACY_VARIANT_PATH");
    managerLegacyVariant = required("STORAGE_LEGACY_VARIANT_MANAGER_PATH");
    const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    const legacyPathPattern = new RegExp(`^variants/${uuid}/${uuid}-card\\.webp$`, "i");
    if (!legacyPathPattern.test(legacyVariant) || !legacyPathPattern.test(managerLegacyVariant) || legacyVariant === managerLegacyVariant) {
      throw new Error("Expected isolated legacy variants/<UUID>/<UUID>-card.webp fixture");
    }
    const connectionString = required("DIRECT_URL");
    const target = new URL(connectionString);
    if (target.hostname !== `db.${ref}.supabase.co` &&
      !(target.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(target.username) === `postgres.${ref}`)) {
      throw new Error("Database target does not match confirmed DEV reference");
    }
    const key = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!key.startsWith("sb_publishable_")) {
      let role: string | undefined;
      try {
        role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
      } catch {
        throw new Error("Expected a publishable or anon key for RLS proof");
      }
      if (role !== "anon") throw new Error("Privileged keys cannot prove RLS");
    }
    const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    anon = client();
    // Every operation proving RLS uses anon key + real session, never service role.
    const login = async (role: "OWNER" | "MANAGER" | "NONSTAFF") => {
      const session = client();
      const { data, error } = await session.auth.signInWithPassword({ email: required(`STORAGE_${role}_EMAIL`), password: required(`STORAGE_${role}_PASSWORD`) });
      if (error || !data.session) throw new Error(`DEV ${role} login failed`);
      tokens.set(session, data.session.access_token);
      const profile = await session.from("profiles").select("role").eq("id", data.user.id);
      if (profile.error) throw new Error(`Cannot verify DEV ${role} profile`);
      expect(profile.data).toEqual(role === "NONSTAFF" ? [] : [{ role: role.toLowerCase() }]);
      return session;
    };
    owner = await login("OWNER");
    manager = await login("MANAGER");
    nonstaff = await login("NONSTAFF");
    db = new Client({ connectionString });
    await db.connect();
    bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).webp().toBuffer();
  }, 30_000);

  afterAll(async () => {
    try {
      if (owner) {
        for (const bucket of [privateBucket, publicBucket]) {
          const paths = created.filter((object) => object.bucket === bucket).map((object) => object.path);
          if (paths.length) {
            const result = await owner.storage.from(bucket).remove(paths);
            if (result.error) throw new Error(`DEV integration cleanup pending in ${bucket}/${scope}`);
          }
        }
      }
    } finally {
      await db?.end();
    }
  });

  async function upload(actor: SupabaseClient, bucket: string, path: string) {
    const result = await actor.storage.from(bucket).upload(path, bytes, { contentType: "image/webp", upsert: false });
    if (!result.error) created.push({ bucket, path });
    return result;
  }

  // Transaction rollback lets us test UPDATE of bucket_id directly under the real JWT/RLS,
  // without moving metadata independently of Storage's physical object operations.
  async function update(actor: SupabaseClient, bucket: string, path: string, destinationBucket: string, destinationPath: string) {
    await db.query("BEGIN");
    try {
      const token = tokens.get(actor);
      const claims = token ? JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) : {};
      await db.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      await db.query(actor === anon ? "SET LOCAL ROLE anon" : "SET LOCAL ROLE authenticated");
      const result = await db.query("UPDATE storage.objects SET bucket_id = $1, name = $2 WHERE bucket_id = $3 AND name = $4 RETURNING id", [destinationBucket, destinationPath, bucket, path]);
      return result.rowCount === 1;
    } catch (error) {
      if ((error as { code?: string }).code === "42501") return false;
      throw error;
    } finally {
      await db.query("ROLLBACK");
    }
  }

  it("preserves real legacy downloads and staff deletion without permitting legacy UPDATE", async () => {
    const legacyBytes = await owner.storage.from(privateBucket).download(legacyVariant);
    expect(legacyBytes.error).toBeNull();
    expect(legacyBytes.data).not.toBeNull();
    const expectedBytes = Buffer.from(await legacyBytes.data!.arrayBuffer());
    expect((await sharp(expectedBytes).metadata()).format).toBe("webp");
    for (const actor of [anon, owner, manager]) {
      const download = await actor.storage.from(privateBucket).download(legacyVariant);
      expect(download.error).toBeNull();
      expect(Buffer.from(await download.data!.arrayBuffer())).toEqual(expectedBytes);
    }
    for (const [staff, path] of [[owner, legacyVariant], [manager, managerLegacyVariant]] as const) {
      const fixture = await staff.storage.from(privateBucket).download(path);
      expect(fixture.error).toBeNull();
      expect((await sharp(Buffer.from(await fixture.data!.arrayBuffer())).metadata()).format).toBe("webp");
      expect(await update(staff, privateBucket, path, privateBucket, `originals/${scope}/${randomUUID()}`)).toBe(false);
      expect(await update(staff, privateBucket, path, privateBucket, `variants/${scope}/${randomUUID()}-card.webp`)).toBe(false);
      // Both fixtures are expressly disposable; prove physical deletion via real staff sessions.
      expect((await staff.storage.from(privateBucket).remove([path])).error).toBeNull();
      // Downloads may remain cached after deletion; verify authoritative metadata and current listing.
      const remaining = await db.query("SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = $1 AND name = $2) AS present", [privateBucket, path]);
      expect(remaining.rows[0].present).toBe(false);
      const slash = path.lastIndexOf("/");
      const listing = await staff.storage.from(privateBucket).list(path.slice(0, slash), { search: path.slice(slash + 1) });
      expect(listing.error).toBeNull();
      expect(listing.data?.some((object) => object.name === path.slice(slash + 1))).toBe(false);
    }
  }, 30_000);

  it("matches bucket and effective policy metadata", async () => {
    const { rows } = await db.query("SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = ANY($1)", [[privateBucket, publicBucket]]);
    expect(rows.find((row) => row.id === privateBucket)).toMatchObject({ public: false, name: privateBucket });
    expect(rows.find((row) => row.id === publicBucket)).toMatchObject({ public: true, name: publicBucket, allowed_mime_types: ["image/webp", "image/jpeg"], file_size_limit: null });
    const policies = await db.query("SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'");
    expect(policies.rows.some((row) => row.policyname === "product_images_staff_objects")).toBe(false);
    expect(policies.rows.some((row) => row.cmd === "SELECT" && row.roles.includes("anon") && row.qual.includes("'product-images'") && row.qual.includes("'variants'"))).toBe(true);
    for (const row of policies.rows.filter((row) => row.cmd === "UPDATE")) {
      expect(row.qual).toContain("is_staff()");
      expect(row.with_check).toContain("is_staff()");
    }
  });

  it.each([
    ["owner", privateBucket, "originals", publicBucket, "variants"],
    ["owner", publicBucket, "variants", privateBucket, "originals"],
    ["manager", privateBucket, "originals", publicBucket, "variants"],
    ["manager", publicBucket, "variants", privateBucket, "originals"],
  ])("denies combined bucket and prefix UPDATE for %s from %s/%s to %s/%s", async (role, bucket, prefix, destinationBucket, destinationPrefix) => {
    const staff = role === "owner" ? owner : manager;
    const path = `${prefix}/${scope}/${randomUUID()}-card.webp`;
    const destinationPath = `${destinationPrefix}/${scope}/${randomUUID()}-card.webp`;
    expect((await upload(staff, bucket, path)).error).toBeNull();
    // Both endpoints independently satisfy a permissive UPDATE policy; bucket-only tests miss this bypass.
    expect(await update(staff, bucket, path, destinationBucket, destinationPath)).toBe(false);
    const remaining = await db.query("SELECT bucket_id, name FROM storage.objects WHERE bucket_id = $1 AND name = $2", [bucket, path]);
    expect(remaining.rows).toEqual([{ bucket_id: bucket, name: path }]);
  });

  it("enforces downloads, CRUD, prefixes, cross-bucket updates, and anonymous listing", async () => {
    for (const staff of [owner, manager]) {
      const originalPath = staff === owner ? original : `originals/${scope}/${randomUUID()}`;
      const variantPath = staff === owner ? variant : `variants/${scope}/${randomUUID()}-card.webp`;
      expect((await upload(staff, privateBucket, originalPath)).error).toBeNull();
      expect((await upload(staff, publicBucket, variantPath)).error).toBeNull();
      expect((await staff.storage.from(privateBucket).download(originalPath)).error).toBeNull();
      expect(await update(staff, privateBucket, originalPath, privateBucket, `${originalPath}-updated`)).toBe(true);
      expect(await update(staff, publicBucket, variantPath, publicBucket, `variants/${scope}/${randomUUID()}-card.webp`)).toBe(true);
      expect(await update(staff, privateBucket, originalPath, privateBucket, `variants/${scope}/forbidden.webp`)).toBe(false);
      expect(await update(staff, publicBucket, variantPath, publicBucket, `originals/${scope}/forbidden`)).toBe(false);
      expect(await update(staff, privateBucket, originalPath, publicBucket, originalPath)).toBe(false);
      expect(await update(staff, publicBucket, variantPath, privateBucket, variantPath)).toBe(false);
      expect((await upload(staff, publicBucket, `originals/${scope}/${randomUUID()}`)).error).not.toBeNull();
      expect((await upload(staff, privateBucket, `variants/${scope}/${randomUUID()}-card.webp`)).error).not.toBeNull();
      const deleted = `variants/${scope}/${randomUUID()}-thumb.webp`;
      expect((await upload(staff, publicBucket, deleted)).error).toBeNull();
      expect((await staff.storage.from(publicBucket).remove([deleted])).error).toBeNull();
      expect((await staff.storage.from(publicBucket).download(deleted)).error).not.toBeNull();
      const deletedOriginal = `originals/${scope}/${randomUUID()}`;
      expect((await upload(staff, privateBucket, deletedOriginal)).error).toBeNull();
      expect((await staff.storage.from(privateBucket).remove([deletedOriginal])).error).toBeNull();
      expect((await staff.storage.from(privateBucket).download(deletedOriginal)).error).not.toBeNull();
    }
    for (const actor of [anon, nonstaff]) {
      expect((await actor.storage.from(privateBucket).download(original)).error).not.toBeNull();
      for (const [bucket, path] of [[privateBucket, original], [publicBucket, variant]]) {
        expect((await upload(actor, bucket, `${path}-denied.webp`)).error).not.toBeNull();
        expect(await update(actor, bucket, path, bucket, `${path}-denied.webp`)).toBe(false);
        await actor.storage.from(bucket).remove([path]);
        // DELETE can return an empty success under RLS; prove the object survived.
        const remaining = await db.query("SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = $1 AND name = $2) AS present", [bucket, path]);
        expect(remaining.rows[0].present).toBe(true);
      }
    }
    const publicOriginal = await fetch(`${url}/storage/v1/object/public/${privateBucket}/${original}`);
    expect(publicOriginal.ok).toBe(false);
    const noCredentials = await fetch(`${url}/storage/v1/object/${privateBucket}/${original}`);
    expect(noCredentials.ok).toBe(false);
    const publicVariant = await fetch(`${url}/storage/v1/object/public/${publicBucket}/${variant}`);
    expect(publicVariant.status).toBe(200);
    expect(Buffer.from(await publicVariant.arrayBuffer())).toEqual(bytes);
    const listing = await anon.storage.from(publicBucket).list(`variants/${scope}`);
    expect(listing.data ?? []).toEqual([]);
    const wrongMimePath = `variants/${scope}/${randomUUID()}.png`;
    const wrongMime = await owner.storage.from(publicBucket).upload(wrongMimePath, bytes, { contentType: "image/png" });
    if (!wrongMime.error) created.push({ bucket: publicBucket, path: wrongMimePath });
    expect(wrongMime.error).not.toBeNull();
  }, 60_000);
});
