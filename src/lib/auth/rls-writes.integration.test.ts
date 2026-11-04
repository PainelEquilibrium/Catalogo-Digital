import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in: RUN_RLS_INTEGRATION=1, RLS_DEV_PROJECT_REF=<ref>, RLS_DEV_CONFIRM=DEV:<ref>.
// Also needs DIRECT_URL, NEXT_PUBLIC_SUPABASE_{URL,ANON_KEY}, SUPABASE_SERVICE_ROLE_KEY.
// Creates disposable users (service role only to create/delete them) and removes them at the end.
const enabled = process.env.RUN_RLS_INTEGRATION === "1";
const tables = ["categories", "products", "product_images", "store_settings", "profiles", "audit_log", "storage_deletions"];
const scope = randomUUID();
const password = `Tmp-${randomUUID()}`;
const userIds: string[] = [];
const uploaded: string[] = [];
let admin: SupabaseClient;
let db: Client;
let url: string;
let anonKey: string;
let staff: SupabaseClient;
let inactive: SupabaseClient;
let pending: SupabaseClient;
let anon: SupabaseClient;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing integration configuration: ${name}`);
  return value;
}

const client = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

async function makeUser(label: string, flags: { is_active: boolean; must_change_password: boolean }) {
  const email = `rls-${label}-${scope}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`createUser ${label} failed`);
  const id = created.data.user.id;
  userIds.push(id);
  await db.query("UPDATE public.profiles SET role = 'manager', is_active = $2, must_change_password = $3 WHERE id = $1", [id, flags.is_active, flags.must_change_password]);
  const session = client();
  const login = await session.auth.signInWithPassword({ email, password });
  if (login.error) throw new Error(`login ${label} failed`);
  return { id, session };
}

describe.skipIf(!enabled)("RLS: escritas diretas fechadas (real DEV, opt-in)", () => {
  beforeAll(async () => {
    const ref = required("RLS_DEV_PROJECT_REF");
    if (!/^[a-z]{20}$/.test(ref) || required("RLS_DEV_CONFIRM") !== `DEV:${ref}`) {
      throw new Error("Explicit confirmed DEV project reference required");
    }
    url = required("NEXT_PUBLIC_SUPABASE_URL");
    if (new URL(url).origin !== `https://${ref}.supabase.co`) throw new Error("Supabase target does not match confirmed DEV reference");
    const target = new URL(required("DIRECT_URL"));
    if (target.hostname !== `db.${ref}.supabase.co` && !(target.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(target.username) === `postgres.${ref}`)) {
      throw new Error("Database target does not match confirmed DEV reference");
    }
    anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
    anon = client();
    db = new Client({ connectionString: required("DIRECT_URL") });
    await db.connect();
    staff = (await makeUser("staff", { is_active: true, must_change_password: false })).session;
    inactive = (await makeUser("inactive", { is_active: false, must_change_password: false })).session;
    pending = (await makeUser("pending", { is_active: true, must_change_password: true })).session;
  }, 60_000);

  afterAll(async () => {
    try {
      if (staff && uploaded.length) await staff.storage.from("product-image-variants").remove(uploaded);
      if (db) {
        await db.query("DELETE FROM public.profiles WHERE id = ANY($1::uuid[])", [userIds]);
      }
      for (const id of userIds) await admin.auth.admin.deleteUser(id);
    } finally {
      await db?.end();
    }
  }, 60_000);

  it("staff não grava direto em nenhuma tabela pela chave pública", async () => {
    for (const table of tables) {
      const { error } = await staff.from(table).insert({});
      expect(error?.code, table).toBe("42501");
    }
  });

  it("anon e authenticated não leem audit_log nem storage_deletions", async () => {
    for (const actor of [anon, staff]) {
      for (const table of ["audit_log", "storage_deletions"]) {
        const { error } = await actor.from(table).select("id").limit(1);
        expect(error?.code, table).toBe("42501");
      }
    }
  });

  async function isStaff(id: string) {
    const { rows } = await db.query("SELECT public.is_staff() AS ok FROM (SELECT set_config('request.jwt.claim.sub', $1, true)) s", [id]);
    return rows[0].ok as boolean;
  }

  it("is_staff() é falso com is_active=false e com must_change_password=true", async () => {
    expect(await isStaff(userIds[0])).toBe(true);
    expect(await isStaff(userIds[1])).toBe(false);
    expect(await isStaff(userIds[2])).toBe(false);
  });

  it("Storage nega upload a conta desativada ou com troca pendente", async () => {
    const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: "white" } }).webp().toBuffer();
    for (const actor of [inactive, pending]) {
      const { error } = await actor.storage.from("product-image-variants").upload(`variants/${scope}/${randomUUID()}-card.webp`, bytes, { contentType: "image/webp" });
      expect(error).not.toBeNull();
    }
    const path = `variants/${scope}/${randomUUID()}-card.webp`;
    const ok = await staff.storage.from("product-image-variants").upload(path, bytes, { contentType: "image/webp" });
    expect(ok.error).toBeNull();
    uploaded.push(path);
  });

  it("Storage aceita image/jpeg no bucket público", async () => {
    const jpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: "white" } }).jpeg().toBuffer();
    const path = `variants/${scope}/${randomUUID()}-card.jpg`;
    const { error } = await staff.storage.from("product-image-variants").upload(path, jpeg, { contentType: "image/jpeg" });
    expect(error).toBeNull();
    uploaded.push(path);
  });

  it("usuário criado por trigger nasce sem acesso", async () => {
    const email = `rls-trigger-${scope}@example.test`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const id = created.data.user!.id;
    userIds.push(id);
    const { rows } = await db.query("SELECT is_active, must_change_password FROM public.profiles WHERE id = $1", [id]);
    expect(rows).toEqual([{ is_active: false, must_change_password: true }]);
  });
});
