import { createHash } from "node:crypto";
import { writeFile, readFile, appendFile } from "node:fs/promises";
import sharp from "sharp";
import type { PrismaClient } from "../../generated/prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const variants = ["thumb", "card", "detail", "og"] as const;
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const originalPattern = new RegExp(`^originals/(${uuid})/(${uuid})$`, "i");
export type TransitionEntry = {
  kind: "product" | "category"; id: string; original: string | null;
  oldReferences: Record<string, string | null>; newReferences: Record<string, string>;
  sources: { path: string; size: number; sha256: string }[];
  blockers: string[]; classification: "eligible" | "skipped" | "blocked";
};
export type TransitionManifest = { version: 1; projectRef: string; origin: string; createdAt: string; entries: TransitionEntry[]; orphans: string[] };
export type TransitionJournal = { version: 1; projectRef: string; events: { kind: "copied" | "verified" | "updated" | "rolled-back" | "failed" | "conflict"; id: string; path?: string; reason?: string; at: string }[] };
export type TransitionReport = { eligible: number; copied: number; verified: number; updated: number; skipped: number; conflicts: number; failed: number; manifest: TransitionManifest };
export type TransitionOptions = {
  mode: "dry-run" | "apply" | "rollback"; writeEnabled: boolean; copyOnly: boolean;
  projectRef: string; expectedOrigin: string; manifestPath: string;
  prisma: Pick<PrismaClient, "productImage" | "category" | "profile" | "$queryRaw">;
  storage: SupabaseClient; pageSize?: number;
  accessToken?: string;
};
export function validateTransitionEnvironment(projectRef: string, origin: string, databaseUrl: string): string {
  if (!/^[a-z0-9]+$/.test(projectRef) || origin !== `https://${projectRef}.supabase.co`) throw new Error("Expected Supabase project mismatch");
  const db = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(db.protocol) || !((db.hostname === `db.${projectRef}.supabase.co`) || (db.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(db.username) === `postgres.${projectRef}`))) throw new Error("Prisma project mismatch");
  return origin;
}
export async function readTransitionManifest(path: string, projectRef: string, origin: string): Promise<TransitionManifest> {
  const value = JSON.parse(await readFile(path, "utf8"));
  if (!value || value.version !== 1 || value.projectRef !== projectRef || value.origin !== origin || origin !== `https://${projectRef}.supabase.co` || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || !Array.isArray(value.entries) || !Array.isArray(value.orphans) || !value.orphans.every((p: unknown) => typeof p === "string" && p.startsWith("variants/") && !p.split("/").some(s => !s || s === "." || s === ".."))) throw new Error("Invalid transition manifest");
  const ids = new Set<string>();
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  for (const entry of value.entries) {
    if (!entry || !["product", "category"].includes(entry.kind) || typeof entry.id !== "string" || !new RegExp(`^${uuid}$`, "i").test(entry.id) || ids.has(`${entry.kind}:${entry.id}`) || !["eligible", "skipped", "blocked"].includes(entry.classification) || !(entry.original === null || typeof entry.original === "string") || !Array.isArray(entry.sources) || !Array.isArray(entry.blockers) || !entry.blockers.every((b: unknown) => typeof b === "string") || !record(entry.oldReferences) || !record(entry.newReferences)) throw new Error("Invalid manifest entry");
    ids.add(`${entry.kind}:${entry.id}`);
    const keys = entry.kind === "product" ? variants : ["card"];
    if (Object.keys(entry.oldReferences).length !== keys.length || !keys.every(k => entry.oldReferences[k] === null || typeof entry.oldReferences[k] === "string") || Object.keys(entry.newReferences).some(k => !keys.includes(k as "card"))) throw new Error("Invalid reference shape");
    const match = originalPattern.exec(entry.original ?? "");
    const paths = match ? variants.map(v => `variants/${match[1]}/${match[2]}-${v}.webp`) : [];
    for (const [k, url] of Object.entries(entry.newReferences)) if (!match || url !== `${origin}/storage/v1/object/public/product-image-variants/variants/${match[1]}/${match[2]}-${k}.webp`) throw new Error("Invalid destination");
    const unique = new Set<string>();
    for (const source of entry.sources) {
      if (!source || !paths.includes(source.path) || unique.has(source.path) || !Number.isSafeInteger(source.size) || source.size <= 0 || typeof source.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error("Invalid manifest source");
      unique.add(source.path);
    }
    if (entry.classification === "eligible" && (!match || (entry.kind === "category" && match[1] !== entry.id) || entry.sources.length !== 4 || entry.blockers.length || Object.keys(entry.newReferences).length !== keys.length || !keys.every(k => entry.oldReferences[k] === `${origin}/storage/v1/object/public/product-images/variants/${match[1]}/${match[2]}-${k}.webp`))) throw new Error("Invalid eligible set");
  }
  return value;
}
export async function assertTransitionStaff(options: TransitionOptions): Promise<void> {
  const { data, error } = await options.storage.auth.getUser(options.accessToken);
  if (error || !data.user) throw new Error("Session expired or invalid; resume with a valid staff session");
  const profile = await options.prisma.profile.findUnique({ where: { id: data.user.id }, select: { role: true } });
  if (!profile || !["owner", "manager"].includes(profile.role)) throw new Error("Staff session required");
}
function fatalAuth(error: { status?: number; statusCode?: string } | null): void {
  if (error && (error.status === 401 || error.status === 403 || ["401", "403"].includes(error.statusCode ?? ""))) throw new TransitionFatalError("Session expired or denied; resume with a valid staff session");
}
class TransitionFatalError extends Error {}
class TransitionConflict extends Error {}
function matches(bytes: Buffer, source: TransitionEntry["sources"][number]): boolean {
  return bytes.length === source.size && createHash("sha256").update(bytes).digest("hex") === source.sha256;
}
async function executeManifest(options: TransitionOptions): Promise<TransitionReport> {
  const manifest = await readTransitionManifest(options.manifestPath, options.projectRef, options.expectedOrigin);
  // The initial JSON header is immutable; subsequent phases are newline-delimited events.
  const journalPath = `${options.manifestPath}.journal.json`;
  const journalText = await readFile(journalPath, "utf8");
  const end = journalText.indexOf("\n{\"kind\":");
  const journal = JSON.parse(end < 0 ? journalText : journalText.slice(0, end));
  if (journal.version !== 1 || journal.projectRef !== options.projectRef || !Array.isArray(journal.events)) throw new Error("Invalid journal");
  const phases = end < 0 ? [] : journalText.slice(end + 1).split("\n").map(line => JSON.parse(line));
  for (const phase of [...journal.events, ...phases]) {
    if (!phase || !["copied", "verified", "updated", "rolled-back", "failed", "conflict"].includes(phase.kind) || typeof phase.id !== "string" || !manifest.entries.some(e => e.id === phase.id) || typeof phase.at !== "string" || !Number.isFinite(Date.parse(phase.at)) || (phase.path !== undefined && !manifest.entries.some(e => e.id === phase.id && e.sources.some(s => s.path === phase.path)))) throw new Error("Invalid journal event");
  }
  const report: TransitionReport = { eligible: 0, copied: 0, verified: 0, updated: 0, skipped: 0, conflicts: 0, failed: 0, manifest };
  async function event(kind: TransitionJournal["events"][number]["kind"], entry: TransitionEntry, path?: string, reason?: string) {
    await appendFile(journalPath, `\n${JSON.stringify({ kind, id: entry.id, ...(path ? { path } : {}), ...(reason ? { reason } : {}), at: new Date().toISOString() })}`);
  }
  async function staff() {
    try { await assertTransitionStaff(options); } catch { throw new TransitionFatalError("Staff session invalid; resume with a valid session"); }
  }
  async function noPublicOriginals() {
    // Staff Storage SELECT is prefix-restricted, so list('originals') cannot prove absence.
    try {
      const rows = await options.prisma.$queryRaw<{ present: boolean }[]>`SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'product-image-variants' AND (name = 'originals' OR name LIKE 'originals/%')) AS present`;
      if (rows.length !== 1 || rows[0].present !== false) throw new Error();
    } catch { throw new TransitionFatalError("Public bucket contains originals or audit failed"); }
  }
  await staff();
  if (options.mode === "apply" && options.writeEnabled) await noPublicOriginals();
  const fieldRefs = (entry: TransitionEntry, refs: Record<string, string | null>) => entry.kind === "product" ? Object.fromEntries(variants.map(v => [`${v}Url`, refs[v]])) : { coverImageUrl: refs.card };
  async function publicRequest(url: string) {
    return fetch(url, { headers: {}, credentials: "omit", redirect: "manual", cache: "no-store" });
  }
  for (const entry of manifest.entries) {
    if (entry.classification !== "eligible") { report[entry.classification === "blocked" ? "failed" : "skipped"]++; continue; }
    report.eligible++;
    await staff();
    const originalField = entry.kind === "product" ? "storagePath" : "coverStoragePath";
    const identity = { id: entry.id, [originalField]: entry.original, ...(entry.kind === "product" ? { productId: originalPattern.exec(entry.original!)![1] } : {}) };
    if (!options.writeEnabled) {
      const newWhere = { ...identity, ...fieldRefs(entry, entry.newReferences) };
      const oldWhere = { ...identity, ...fieldRefs(entry, entry.oldReferences) };
      const current = entry.kind === "product"
        ? await options.prisma.productImage.findFirst({ where: { OR: [newWhere, oldWhere] }, select: { id: true } })
        : await options.prisma.category.findFirst({ where: { OR: [newWhere, oldWhere] }, select: { id: true } });
      report[current ? "skipped" : "conflicts"]++;
      continue;
    }
    try {
      if (options.mode === "apply") {
        for (const source of entry.sources) {
          const original = await options.storage.storage.from("product-images").download(source.path);
          fatalAuth(original.error);
          if (original.error || !original.data) throw new Error("Source unavailable");
          const bytes = Buffer.from(await original.data.arrayBuffer());
          if (!matches(bytes, source)) throw new Error("Source changed");
          const target = await options.storage.storage.from("product-image-variants").download(source.path);
          fatalAuth(target.error);
          if (target.data && !target.error) {
            if (!matches(Buffer.from(await target.data.arrayBuffer()), source)) throw new TransitionConflict("Destination differs");
          } else {
            // Only an explicit missing-object response authorizes creation.
            const missing = target.error as { status?: number; statusCode?: string; code?: string } | null;
            if (missing?.status !== 404 && ![missing?.statusCode, missing?.code].some(code => code === "404" || code === "NoSuchKey")) throw new Error("Destination check failed");
            const uploaded = await options.storage.storage.from("product-image-variants").upload(source.path, bytes, { upsert: false, contentType: "image/webp" });
            fatalAuth(uploaded.error);
            if (uploaded.error) {
              const existing = await options.storage.storage.from("product-image-variants").download(source.path);
              fatalAuth(existing.error);
              if (existing.error || !existing.data || !matches(Buffer.from(await existing.data.arrayBuffer()), source)) throw new TransitionConflict("Upload conflict or unavailable destination");
            } else report.copied++;
          }
          await event("copied", entry, source.path);
          const response = await publicRequest(`${options.expectedOrigin}/storage/v1/object/public/product-image-variants/${source.path}`);
          if (response.status !== 200) throw new Error("Public destination unavailable");
          const publicBytes = Buffer.from(await response.arrayBuffer());
          const metadata = await sharp(publicBytes, { failOn: "warning" }).metadata();
          if (metadata.format !== "webp") throw new Error("Destination is not WebP");
          await sharp(publicBytes, { failOn: "warning" }).raw().toBuffer();
          if (!matches(publicBytes, source)) throw new Error("Public destination differs");
          report.verified++; await event("verified", entry, source.path);
        }
        const exposed = await publicRequest(`${options.expectedOrigin}/storage/v1/object/public/product-image-variants/${entry.original}`);
        if (![400, 404].includes(exposed.status)) throw new Error("Cannot prove original absent from public bucket");
        if (options.copyOnly) continue;
      }
      if (options.mode === "apply") await noPublicOriginals();
      await staff();
      const before = fieldRefs(entry, options.mode === "rollback" ? entry.newReferences : entry.oldReferences);
      const after = fieldRefs(entry, options.mode === "rollback" ? entry.oldReferences : entry.newReferences);
      const where = { ...identity, ...before };
      const result = entry.kind === "product"
        ? await options.prisma.productImage.updateMany({ where, data: after })
        : await options.prisma.category.updateMany({ where, data: after });
      if (result.count === 0) {
        // A second conditional read distinguishes an already-applied set from a concurrent edit.
        const same = { ...identity, ...after };
        const current = entry.kind === "product" ? await options.prisma.productImage.findFirst({ where: same, select: { id: true } }) : await options.prisma.category.findFirst({ where: same, select: { id: true } });
        if (!current) throw new TransitionConflict("Record changed");
        report.skipped++;
      } else { report.updated++; await event(options.mode === "rollback" ? "rolled-back" : "updated", entry); }
    } catch (error) {
      if (error instanceof TransitionFatalError) throw error;
      const conflict = error instanceof TransitionConflict;
      report[conflict ? "conflicts" : "failed"]++;
      const message = error instanceof Error ? error.message : "";
      const safeReasons = ["Source unavailable", "Source changed", "Destination check failed", "Public destination unavailable", "Destination is not WebP", "Public destination differs", "Cannot prove original absent from public bucket"];
      await event(conflict ? "conflict" : "failed", entry, undefined, conflict || safeReasons.includes(message) ? message : "Verification or database operation failed");
    }
  }
  return report;
}
export async function runImageVariantTransition(options: TransitionOptions): Promise<TransitionReport> {
  const { mode, writeEnabled, copyOnly, projectRef, expectedOrigin, prisma, storage, manifestPath } = options;
  if (expectedOrigin !== `https://${projectRef}.supabase.co`) throw new Error("Expected origin mismatch");
  if (copyOnly && mode === "rollback") throw new Error("copy-only cannot rollback");
  if (mode !== "dry-run") return executeManifest(options);
  if (writeEnabled) throw new Error("Dry-run cannot write remotely");
  const pageSize = options.pageSize ?? 100;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error("Invalid page size");
  await assertTransitionStaff(options);
  const manifest: TransitionManifest = { version: 1, projectRef, origin: expectedOrigin, createdAt: new Date().toISOString(), entries: [], orphans: [] };
  const referenced = new Set<string>();
  async function inspect(kind: "product" | "category", id: string, original: string | null, refs: Record<string, string | null>, entityId: string) {
    await assertTransitionStaff(options);
    const entry: TransitionEntry = { kind, id, original, oldReferences: refs, newReferences: {}, sources: [], blockers: [], classification: "skipped" };
    manifest.entries.push(entry);
    const match = originalPattern.exec(original ?? "");
    if (!match) return;
    if (match[1] !== entityId) { entry.blockers.push("Original entity mismatch"); entry.classification = "blocked"; return; }
    const paths = variants.map(v => `variants/${match[1]}/${match[2]}-${v}.webp`);
    const buckets = new Set<string>();
    for (const [variant, raw] of Object.entries(refs)) {
      const path = paths[variants.indexOf(variant as typeof variants[number])];
      const oldUrl = `${expectedOrigin}/storage/v1/object/public/product-images/${path}`;
      const newUrl = `${expectedOrigin}/storage/v1/object/public/product-image-variants/${path}`;
      if (raw === oldUrl) { buckets.add("old"); referenced.add(path); }
      else if (raw === newUrl) buckets.add("new");
      else { entry.blockers.push(`Incompatible ${variant} reference`); }
      entry.newReferences[variant] = newUrl;
    }
    if (!buckets.has("old") && !entry.blockers.length) return;
    if (buckets.size > 1) entry.blockers.push("Mixed buckets");
    if (!buckets.has("old")) { entry.classification = "blocked"; return; }
    for (const path of paths) referenced.add(path);
    if (!entry.blockers.length) {
      for (const path of paths) {
        const { data, error } = await storage.storage.from("product-images").download(path);
        fatalAuth(error);
        if (error || !data) { entry.blockers.push(`Missing source: ${path}`); continue; }
        const bytes = Buffer.from(await data.arrayBuffer());
        entry.sources.push({ path, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
      }
    }
    entry.classification = entry.blockers.length ? "blocked" : "eligible";
  }
  for (let skip = 0;; skip += pageSize) {
    const rows = await prisma.productImage.findMany({ skip, take: pageSize, orderBy: { id: "asc" } });
    for (const row of rows) await inspect("product", row.id, row.storagePath, { thumb: row.thumbUrl, card: row.cardUrl, detail: row.detailUrl, og: row.ogUrl }, row.productId);
    if (rows.length < pageSize) break;
  }
  for (let skip = 0;; skip += pageSize) {
    const rows = await prisma.category.findMany({ skip, take: pageSize, orderBy: { id: "asc" } });
    for (const row of rows) if (row.coverImageUrl || row.coverStoragePath) await inspect("category", row.id, row.coverStoragePath, { card: row.coverImageUrl }, row.id);
    if (rows.length < pageSize) break;
  }
  async function list(prefix: string): Promise<void> {
    for (let offset = 0;; offset += pageSize) {
      await assertTransitionStaff(options);
      const { data, error } = await storage.storage.from("product-images").list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
      fatalAuth(error);
      if (error || !data) throw new Error("Storage inventory failed; no snapshot created");
      for (const item of data) {
        if (!item.name || item.name.includes("/") || item.name === "." || item.name === "..") throw new Error("Unsafe Storage listing");
        const path = `${prefix}/${item.name}`;
        if (!item.id) await list(path);
        else if (!referenced.has(path)) manifest.orphans.push(path);
      }
      if (data.length < pageSize) break;
    }
  }
  await list("variants");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { flag: "wx" });
  await writeFile(`${manifestPath}.journal.json`, JSON.stringify({ version: 1, projectRef, events: [] } satisfies TransitionJournal, null, 2), { flag: "wx" });
  return { eligible: manifest.entries.filter(e => e.classification === "eligible").length, copied: 0, verified: 0, updated: 0, skipped: manifest.entries.filter(e => e.classification === "skipped").length, conflicts: 0, failed: manifest.entries.filter(e => e.classification === "blocked").length, manifest };
}
