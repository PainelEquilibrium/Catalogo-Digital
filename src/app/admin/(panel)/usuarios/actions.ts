"use server";

import { auditActorFor, recordAudit } from "@/lib/audit/record";
import { normalizeLoginEmail } from "@/lib/auth/normalize-email";
import { replaceUserPassword } from "@/lib/auth/people-password";
import {
  checkPersonAction,
  type PersonAction,
  type PersonActionCode,
} from "@/lib/auth/permissions";
import { parseStaffRole } from "@/lib/auth/roles";
import { requireAction } from "@/lib/auth/server";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { prisma } from "@/lib/prisma/client";
import { createAdminSupabase } from "@/lib/supabase/admin";

const copy = copyAdminPtBr.people;

type Fail = { ok: false; message: string };

const MESSAGE_BY_CODE: Record<PersonActionCode, string> = {
  self: copy.errorSelf,
  last_owner: copy.errorLastOwner,
  // Suporte, dono(a) e gestor(a) recebem a mesma cópia: não revela que a conta oculta existe.
  support_protected: copy.errorUnavailable,
  owner_requires_support: copy.errorUnavailable,
  manager_forbidden: copy.errorUnavailable,
};

// Relê o alvo no servidor e aplica a regra única. Alvo ausente e conta de suporte respondem igual.
async function authorizeTarget(id: string, action: PersonAction) {
  const actorSession = await requireAction("people");
  const profile = await prisma.profile.findUnique({ where: { id } });
  const role = parseStaffRole(profile?.role);
  if (!profile || !role || role === "support") {
    return { ok: false as const, message: copy.errorUnavailable };
  }
  const activeOwnerCount = await prisma.profile.count({ where: { role: "owner", isActive: true } });
  const verdict = checkPersonAction({
    actor: { id: actorSession.userId, role: actorSession.role },
    target: { id: profile.id, role, isActive: profile.isActive },
    action,
    activeOwnerCount,
  });
  if (!verdict.ok) return { ok: false as const, message: MESSAGE_BY_CODE[verdict.code] };
  return { ok: true as const, actorSession, profile };
}

export async function createManager(input: {
  name: string;
  email: string;
}): Promise<{ ok: true; tempPassword: string } | Fail> {
  const session = await requireAction("people");
  const actor = auditActorFor(session);
  const name = input.name.trim();
  const email = normalizeLoginEmail(input.email);
  if (!name) return { ok: false, message: copy.errorName };
  if (!email) return { ok: false, message: copy.errorEmail };

  const tempPassword = generateTempPassword();
  const admin = createAdminSupabase();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (error || !data.user) {
    const duplicate = error?.code === "email_exists" || /already|registered|exists/i.test(error?.message ?? "");
    return { ok: false, message: duplicate ? copy.errorDuplicate : copy.errorGeneric };
  }

  const id = data.user.id;
  try {
    await prisma.$transaction(async (tx) => {
      // O trigger handle_new_user já criou a linha (inativa); aqui ela vira gestor(a) pendente de troca.
      const fields = { email, name, role: "manager", isActive: true, mustChangePassword: true, invitedBy: session.userId };
      await tx.profile.upsert({ where: { id }, update: fields, create: { id, ...fields } });
      await recordAudit(tx, actor, {
        entityType: "person",
        entityId: id,
        entityLabel: name,
        action: "person_create",
        after: { role: "manager", isActive: true },
      });
      await recordAudit(tx, actor, {
        entityType: "person",
        entityId: id,
        entityLabel: name,
        action: "temp_password_generated",
      });
    });
  } catch {
    await admin.auth.admin.deleteUser(id);
    return { ok: false, message: copy.errorGeneric };
  }
  return { ok: true, tempPassword };
}

export async function resetPersonPassword(
  id: string,
): Promise<{ ok: true; tempPassword: string } | Fail> {
  const result = await authorizeTarget(id, "reset_password");
  if (!result.ok) return result;
  const { actorSession, profile } = result;

  // Marca a troca obrigatória antes: se o passo seguinte falhar, a pessoa fica travada, não livre.
  await prisma.$transaction(async (tx) => {
    await tx.profile.update({ where: { id }, data: { mustChangePassword: true } });
    await recordAudit(tx, auditActorFor(actorSession), {
      entityType: "person",
      entityId: id,
      entityLabel: profile.name || profile.email,
      action: "temp_password_generated",
    });
  });

  const tempPassword = generateTempPassword();
  try {
    // A troca pela Admin API já revoga as sessões abertas (provado em people-sessions.integration.test).
    await replaceUserPassword(createAdminSupabase(), id, tempPassword);
  } catch {
    return { ok: false, message: copy.errorGeneric };
  }
  return { ok: true, tempPassword };
}

export async function setPersonActive(id: string, active: boolean): Promise<{ ok: true } | Fail> {
  const result = await authorizeTarget(id, active ? "reactivate" : "deactivate");
  if (!result.ok) return result;
  const { actorSession, profile } = result;

  await prisma.$transaction(async (tx) => {
    await tx.profile.update({ where: { id }, data: { isActive: active } });
    await recordAudit(tx, auditActorFor(actorSession), {
      entityType: "person",
      entityId: id,
      entityLabel: profile.name || profile.email,
      action: active ? "person_reactivate" : "person_deactivate",
      before: { isActive: profile.isActive },
      after: { isActive: active },
    });
  });
  return { ok: true };
}
