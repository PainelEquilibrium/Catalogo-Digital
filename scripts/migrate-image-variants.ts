import "dotenv/config";
import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createClient } from "@supabase/supabase-js";
import { readTransitionManifest, runImageVariantTransition, validateTransitionEnvironment } from "../src/lib/images/transition";
async function main() {
  const args = process.argv.slice(2), values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["--project-ref", "--manifest"].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith("--") || values.has(arg)) throw new Error("Invalid or duplicate argument");
      values.set(arg, value);
    } else if (["--apply", "--rollback", "--copy-only"].includes(arg)) flags.add(arg);
    else throw new Error("Unknown argument");
  }
  const projectRef = values.get("--project-ref"), manifestPath = values.get("--manifest");
  if (!projectRef || !manifestPath || (flags.has("--rollback") && flags.has("--copy-only"))) throw new Error("Invalid arguments");
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", databaseUrl = process.env.DATABASE_URL ?? "";
  validateTransitionEnvironment(projectRef, origin, databaseUrl);
  // Snapshots contain operational inventory; require an ignored destination.
  for (const path of [manifestPath, `${manifestPath}.journal.json`]) await promisify(execFile)("git", ["check-ignore", "--quiet", "--", path]);
  const mode = flags.has("--rollback") ? "rollback" : flags.has("--apply") ? "apply" : "dry-run";
  if (mode !== "dry-run") {
    await readTransitionManifest(manifestPath, projectRef, origin);
  } else for (const path of [manifestPath, `${manifestPath}.journal.json`]) {
    try { await access(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    throw new Error("Artifact exists; choose a new manifest path");
  }
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, token = process.env.IMAGE_MIGRATION_ACCESS_TOKEN;
  if (!key || !token) throw new Error("Anon key and staff session required");
  if (!key.startsWith("sb_publishable_")) {
    const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8"));
    if (payload.role !== "anon") throw new Error("Only anon/publishable keys allowed");
  }
  const storage = createClient(origin, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const report = await runImageVariantTransition({ mode, writeEnabled: flags.has("--apply"), copyOnly: flags.has("--copy-only"), projectRef, expectedOrigin: origin, manifestPath, prisma, storage, accessToken: token });
    console.log(JSON.stringify({ eligible: report.eligible, copied: report.copied, verified: report.verified, updated: report.updated, skipped: report.skipped, conflicts: report.conflicts, failed: report.failed }));
    if (report.failed || report.conflicts) process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error("Transition stopped. Check arguments, project, staff session and artifact paths. Inspect the journal before resuming; completed writes are preserved."); process.exitCode = 1; });
