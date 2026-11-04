import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { replaceUserPassword } from "@/lib/auth/people-password";
import { prisma } from "@/lib/prisma/client";

// Opt-in: RUN_RLS_INTEGRATION=1, RLS_DEV_PROJECT_REF=<ref>, RLS_DEV_CONFIRM=DEV:<ref>.
const enabled = process.env.RUN_RLS_INTEGRATION === "1";
const scope = randomUUID();
const password = `Tmp-${randomUUID()}`;
let admin: SupabaseClient;
let userId = "";

const client = (url: string, key: string) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

describe.skipIf(!enabled)("reset de senha derruba sessões abertas (real DEV, opt-in)", () => {
  beforeAll(() => {
    const ref = process.env.RLS_DEV_PROJECT_REF ?? "";
    if (!/^[a-z]{20}$/.test(ref) || process.env.RLS_DEV_CONFIRM !== `DEV:${ref}`) {
      throw new Error("Explicit confirmed DEV project reference required");
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (new URL(url).origin !== `https://${ref}.supabase.co`) throw new Error("Supabase target does not match confirmed DEV reference");
    admin = client(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  });

  afterAll(async () => {
    if (userId) {
      await prisma.profile.deleteMany({ where: { id: userId } });
      await admin.auth.admin.deleteUser(userId);
    }
    await prisma.$disconnect();
  });

  it("reset derruba a sessão aberta", async () => {
    const email = `e2e-sess-${scope}@example.test`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error("createUser failed");
    userId = created.data.user.id;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const user = client(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
    const login = await user.auth.signInWithPassword({ email, password });
    const session = login.data.session;
    if (login.error || !session) throw new Error("login failed");
    expect((await user.auth.getUser(session.access_token)).error).toBeNull();

    await replaceUserPassword(admin, userId, `Nova-${randomUUID()}`);

    expect((await user.auth.getUser(session.access_token)).error).not.toBeNull();
    const refreshed = await client(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").auth.refreshSession({
      refresh_token: session.refresh_token,
    });
    expect(refreshed.error).not.toBeNull();
  });
});
