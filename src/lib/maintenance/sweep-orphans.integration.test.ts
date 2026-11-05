import { describe, expect, it } from "vitest";

// Opt-in: RUN_RLS_INTEGRATION=1, RLS_DEV_PROJECT_REF=<ref>, RLS_DEV_CONFIRM=DEV:<ref>.
// Somente leitura: não chama runOrphanSweep (que apagaria); só confere o acesso a storage.objects e as referências.
const enabled = process.env.RUN_RLS_INTEGRATION === "1";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing integration configuration: ${name}`);
  return value;
}

describe.skipIf(!enabled)("varredura de órfãos: leitura real no DEV (opt-in, somente leitura)", () => {
  it("DATABASE_URL lê storage.objects e as referências são coletadas", async () => {
    const ref = required("RLS_DEV_PROJECT_REF");
    if (!/^[a-z]{20}$/.test(ref) || required("RLS_DEV_CONFIRM") !== `DEV:${ref}`) {
      throw new Error("Explicit confirmed DEV project reference required");
    }
    if (new URL(required("NEXT_PUBLIC_SUPABASE_URL")).origin !== `https://${ref}.supabase.co`) throw new Error("Supabase target does not match confirmed DEV reference");
    const target = new URL(required("DATABASE_URL"));
    if (!target.hostname.includes(ref) && decodeURIComponent(target.username) !== `postgres.${ref}`) throw new Error("Database target does not match confirmed DEV reference");

    const { prisma } = await import("@/lib/prisma/client");
    const { collectReferences, planOrphanSweep } = await import("./sweep-orphans");
    const rows = await prisma.$queryRaw<{ bucket_id: string; name: string; created_at: Date | null }[]>`
      SELECT bucket_id, name, created_at FROM storage.objects WHERE bucket_id IN ('product-images', 'product-image-variants')`;
    expect(Array.isArray(rows)).toBe(true);
    for (const row of rows) expect(row.created_at === null || row.created_at instanceof Date).toBe(true);
    const refs = await collectReferences();
    const plan = planOrphanSweep({ objects: rows.map((r) => ({ bucket: r.bucket_id, path: r.name, createdAt: r.created_at ?? new Date() })), ...refs, now: new Date() });
    expect(["ok", "aborted"]).toContain(plan.kind);
    await prisma.$disconnect();
  });
});
