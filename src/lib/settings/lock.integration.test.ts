import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { lockSettingKeys } from "./lock";

// Opt-in: RUN_RLS_INTEGRATION=1, RLS_DEV_PROJECT_REF=<ref>, RLS_DEV_CONFIRM=DEV:<ref>, DATABASE_URL.
const enabled = process.env.RUN_RLS_INTEGRATION === "1";
const key = `e2e-lock-${Date.now()}`;
let prisma: PrismaClient;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Dois "salvamentos" que leem, esperam o outro ler (ou 1,5 s) e gravam um campo cada; devolve os campos que sobraram.
async function race(locked: boolean): Promise<string[]> {
  await prisma.storeSetting.deleteMany({ where: { key } });
  await prisma.storeSetting.create({ data: { key, value: {} } });
  let reads = 0;
  let bothRead!: () => void;
  const barrier = new Promise<void>((resolve) => (bothRead = resolve));
  const write = (field: string) =>
    prisma.$transaction(async (tx) => {
      if (locked) await lockSettingKeys(tx, [key]);
      const row = await tx.storeSetting.findUnique({ where: { key } });
      if (++reads === 2) bothRead();
      await Promise.race([barrier, sleep(1500)]);
      await tx.storeSetting.update({ where: { key }, data: { value: { ...(row?.value as object), [field]: true } } });
    });
  await Promise.all([write("a"), write("b")]);
  return Object.keys((await prisma.storeSetting.findUniqueOrThrow({ where: { key } })).value as object).sort();
}

describe.skipIf(!enabled)("lockSettingKeys (real DEV, opt-in)", () => {
  afterAll(async () => {
    await prisma?.storeSetting.deleteMany({ where: { key } });
    await prisma?.$disconnect();
  });

  it("sem trava um dos salvamentos se perde; com trava os dois permanecem", async () => {
    const ref = process.env.RLS_DEV_PROJECT_REF ?? "";
    if (!/^[a-z]{20}$/.test(ref) || process.env.RLS_DEV_CONFIRM !== `DEV:${ref}`) {
      throw new Error("Explicit confirmed DEV project reference required");
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    expect(await race(false)).toHaveLength(1);
    expect(await race(true)).toEqual(["a", "b"]);
  }, 30_000);
});
