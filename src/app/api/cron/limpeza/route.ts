import { timingSafeEqual } from "node:crypto";
import { pruneOldAudit, purgeExpiredTrash } from "@/lib/maintenance/purge-trash";
import { drainStorageDeletions } from "@/lib/maintenance/storage-queue";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  let failed = false;
  const body: Record<string, unknown> = {};

  // Etapas isoladas: uma falha não impede as seguintes.
  try {
    const purged = await purgeExpiredTrash(now);
    Object.assign(body, purged);
    if (purged.failed) failed = true;
  } catch {
    failed = true;
    console.error("Cron step failed", { step: "purge" });
  }
  try {
    body.storage = await drainStorageDeletions({ limit: 500 });
  } catch {
    failed = true;
    console.error("Cron step failed", { step: "drain" });
  }
  // Task 11: etapa de varredura entra aqui, antes da poda.
  try {
    body.auditPruned = await pruneOldAudit(now);
  } catch {
    failed = true;
    console.error("Cron step failed", { step: "audit" });
  }

  return Response.json(body, { status: failed ? 500 : 200 });
}
