"use server";

import { revalidatePath } from "next/cache";
import { mergeSettingValue, parseSectionInput, sectionKeys, type SettingsSection } from "@/domain/settings-sections";
import type { Prisma } from "@/generated/prisma/client";
import { auditActorFor, recordAudit } from "@/lib/audit/record";
import { requireAction, StaffAuthError } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { processBrandAsset, storeAssetRefsIn, uploadBrandAsset } from "@/lib/images/brand-asset";
import type { StorageObjectRef } from "@/lib/images/upload";
import { mapUploadError, MAX_UPLOAD_BYTES, messageForUploadError } from "@/lib/images/upload-errors";
import { drainStorageDeletions, enqueueStorageDeletions } from "@/lib/maintenance/storage-queue";
import { prisma } from "@/lib/prisma/client";
import { lockSettingKeys } from "@/lib/settings/lock";

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

// Chaves que a seção grava; "store" também mexe em share.og_image (OG do logo).
const lockedKeys = (section: SettingsSection) => (section === "store" ? [...sectionKeys.store, "share"] : sectionKeys[section]);

// Arquivos enviados que ficaram sem referência; saem do Storage depois do commit.
async function drainAfterCommit(refs: StorageObjectRef[]) {
  if (!refs.length) return;
  try {
    await drainStorageDeletions({ paths: refs, limit: refs.length });
  } catch {
    console.error("settings: limpeza do Storage pendente"); // a fila repete na tarefa diária
  }
}

async function writeSection(
  section: SettingsSection,
  action: string,
  apply: (tx: Prisma.TransactionClient, userId: string, before: Record<string, unknown>) => Promise<StorageObjectRef[] | void>,
  after: unknown,
): Promise<Result> {
  const auth = await authorize();
  if (auth.denied) return auth.denied;
  const { session } = auth;
  let released: StorageObjectRef[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      await lockSettingKeys(tx, lockedKeys(section));
      const before = Object.fromEntries(
        (await tx.storeSetting.findMany({ where: { key: { in: sectionKeys[section] } } })).map((r) => [r.key, r.value]),
      );
      released = (await apply(tx, session.userId, before)) ?? [];
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
  await drainAfterCommit(released);
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
    async (tx, _userId, before) => {
      await tx.storeSetting.deleteMany({ where: { key: { in: sectionKeys[section] } } });
      const refs = storeAssetRefsIn(before);
      if (section === "store") refs.push(...(await dropShareImage(tx, before)));
      await enqueueStorageDeletions(tx, refs);
      return refs;
    },
    undefined,
  );
}

// O OG do logo mora em share.og_image; ao restaurar a loja ele volta ao padrão (só se for arquivo enviado).
async function dropShareImage(tx: Prisma.TransactionClient, before: Record<string, unknown>): Promise<StorageObjectRef[]> {
  const row = await tx.storeSetting.findUnique({ where: { key: "share" } });
  const { og_image, ...rest } = (row?.value ?? {}) as Record<string, unknown>;
  const refs = storeAssetRefsIn(og_image);
  if (!refs.length) return [];
  before.share = row?.value; // entra na auditoria da restauração
  if (Object.keys(rest).length) await tx.storeSetting.update({ where: { key: "share" }, data: { value: rest as Prisma.InputJsonValue } });
  else await tx.storeSetting.delete({ where: { key: "share" } });
  return refs;
}

const ASSET_TARGETS = {
  logo_light: { section: "store", key: "store", path: ["logo", "light"], minSide: 64 },
  logo_dark: { section: "store", key: "store", path: ["logo", "dark"], minSide: 64 },
  icon_light: { section: "store", key: "store", path: ["icon", "light"], minSide: 64 },
  icon_dark: { section: "store", key: "store", path: ["icon", "dark"], minSide: 64 },
  hero: { section: "home", key: "hero", path: ["image_url"], minSide: 800 },
} as const;

type AssetKind = keyof typeof ASSET_TARGETS;

const nest = (path: readonly string[], leaf: unknown) => path.reduceRight<unknown>((acc, k) => ({ [k]: acc }), leaf);
const leafAt = (value: unknown, path: readonly string[]) =>
  path.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), value);

export async function saveStoreAsset(
  kind: AssetKind,
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const auth = await authorize();
  if (auth.denied) return auth.denied;
  if (!Object.hasOwn(ASSET_TARGETS, kind)) return { ok: false, message: copy.errorInvalid };
  const target = ASSET_TARGETS[kind];

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: copyAdminPtBr.upload.errorNoFile };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: messageForUploadError("too_large") };
  const bytes = Buffer.from(await file.arrayBuffer());

  let stored: { webpUrl: string; ogUrl?: string };
  try {
    // OG só do logo claro, sobre o fundo da loja.
    const background = kind === "logo_light" ? (await resolveBranding()).theme.background_color : undefined;
    stored = await uploadBrandAsset(await processBrandAsset(bytes, { minSide: target.minSide, background }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/smallest side/.test(message)) return { ok: false, message: copy.assetTooSmall.replace("{min}", String(target.minSide)) };
    return { ok: false, message: messageForUploadError(mapUploadError(error, bytes.length)) };
  }

  const patches = [
    { key: target.key as string, path: target.path as readonly string[], url: stored.webpUrl },
    ...(stored.ogUrl ? [{ key: "share", path: ["og_image"] as readonly string[], url: stored.ogUrl }] : []),
  ];
  const replaced: StorageObjectRef[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      await lockSettingKeys(tx, patches.map((p) => p.key));
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const { key, path, url } of patches) {
        const current = await tx.storeSetting.findUnique({ where: { key } });
        const old = leafAt(current?.value, path);
        replaced.push(...storeAssetRefsIn(old));
        const json = mergeSettingValue(current?.value ?? {}, nest(path, url)) as Prisma.InputJsonValue;
        await tx.storeSetting.upsert({
          where: { key },
          update: { value: json, updatedBy: auth.session.userId },
          create: { key, value: json, updatedBy: auth.session.userId },
        });
        before[key] = nest(path, old);
        after[key] = nest(path, url);
      }
      await enqueueStorageDeletions(tx, replaced);
      await recordAudit(tx, auditActorFor(auth.session), {
        entityType: "settings",
        entityId: target.section,
        entityLabel: copy.sectionLabels[target.section],
        action: "settings_update",
        before,
        after,
      });
    });
  } catch {
    console.error("settings: falha ao gravar arquivo da loja", kind);
    // O que acabou de subir não tem referência: vai para a fila e sai do Storage.
    const orphans = storeAssetRefsIn([stored.webpUrl, stored.ogUrl]);
    try {
      await prisma.$transaction((tx) => enqueueStorageDeletions(tx, orphans));
      await drainAfterCommit(orphans);
    } catch {
      console.error("settings: arquivo enviado ficou sem referência"); // a varredura diária recolhe
    }
    return { ok: false, message: copy.errorGeneric };
  }
  revalidatePath("/", "layout");
  await drainAfterCommit(replaced);
  return { ok: true, url: stored.webpUrl };
}
