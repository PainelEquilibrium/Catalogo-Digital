"use server";

import { revalidatePath } from "next/cache";
import { mergeSettingValue, parseSectionInput, sectionKeys, type SettingsSection } from "@/domain/settings-sections";
import type { Prisma } from "@/generated/prisma/client";
import { auditActorFor, recordAudit } from "@/lib/audit/record";
import { requireAction, StaffAuthError } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { prisma } from "@/lib/prisma/client";

const copy = copyAdminPtBr.settings;

type Result = { ok: true } | { ok: false; message: string };

async function authorize() {
  try {
    return { session: await requireAction("settings") };
  } catch (error) {
    if (error instanceof StaffAuthError) return { denied: { ok: false, message: copy.errorDenied } as const };
    throw error;
  }
}

async function writeSection(
  section: SettingsSection,
  action: string,
  apply: (tx: Prisma.TransactionClient, userId: string) => Promise<unknown>,
  after: unknown,
): Promise<Result> {
  const auth = await authorize();
  if (auth.denied) return auth.denied;
  const { session } = auth;
  try {
    await prisma.$transaction(async (tx) => {
      const before = Object.fromEntries(
        (await tx.storeSetting.findMany({ where: { key: { in: sectionKeys[section] } } })).map((r) => [r.key, r.value]),
      );
      await apply(tx, session.userId);
      await recordAudit(tx, auditActorFor(session), {
        entityType: "settings",
        entityId: section,
        entityLabel: copy.sectionLabels[section],
        action,
        before,
        after,
      });
    });
  } catch {
    console.error("settings: falha na transação", section);
    return { ok: false, message: copy.errorGeneric };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveSettingsSection(section: SettingsSection, input: unknown): Promise<Result> {
  const auth = await authorize();
  if (auth.denied) return auth.denied;
  if (!Object.hasOwn(sectionKeys, section)) return { ok: false, message: copy.errorInvalid };
  const parsed = parseSectionInput(section, input);
  if (!parsed.ok) return { ok: false, message: copy.errorInvalid };

  return writeSection(
    section,
    "settings_update",
    async (tx, userId) => {
      for (const { key, value } of parsed.rows) {
        // Preserva o que outras telas gravaram na mesma chave (ex.: logo enviado); legais são trocados por inteiro.
        const current = await tx.storeSetting.findUnique({ where: { key } });
        const json = (key === "legal" || !current ? value : mergeSettingValue(current.value, value)) as Prisma.InputJsonValue;
        await tx.storeSetting.upsert({
          where: { key },
          update: { value: json, updatedBy: userId },
          create: { key, value: json, updatedBy: userId },
        });
      }
    },
    Object.fromEntries(parsed.rows.map((r) => [r.key, r.value])),
  );
}

export async function restoreSettingsSection(section: SettingsSection): Promise<Result> {
  if (!Object.hasOwn(sectionKeys, section)) return { ok: false, message: copy.errorInvalid };
  return writeSection(
    section,
    "settings_restore",
    (tx) => tx.storeSetting.deleteMany({ where: { key: { in: sectionKeys[section] } } }),
    undefined,
  );
}
