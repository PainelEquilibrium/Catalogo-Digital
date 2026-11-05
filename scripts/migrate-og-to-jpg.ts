import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createAdminSupabase } from "../src/lib/supabase/admin";
import { validateTransitionEnvironment } from "../src/lib/images/transition";
import { runOgJpgTransition } from "../src/lib/images/og-jpg-transition";

async function main() {
  const args = process.argv.slice(2);
  const refIndex = args.indexOf("--project-ref");
  const projectRef = args[refIndex + 1];
  const apply = args.includes("--apply");
  if (refIndex < 0 || !projectRef || projectRef.startsWith("--") || args.some((a, i) => !["--apply", "--project-ref"].includes(a) && i !== refIndex + 1)) throw new Error("Invalid arguments");
  const databaseUrl = process.env.DATABASE_URL ?? "";
  validateTransitionEnvironment(projectRef, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", databaseUrl);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const report = await runOgJpgTransition({ prisma, storage: createAdminSupabase(), apply });
    console.log(JSON.stringify({ mode: apply ? "apply" : "simulation", ...report }));
    if (report.failed) process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error("Migration stopped. Check arguments, project and environment."); process.exitCode = 1; });
