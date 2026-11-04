import { redirect } from "next/navigation";
import { AdminAuthFrame } from "@/components/admin/admin-auth-frame";
import { AdminPasswordForm } from "@/components/admin/admin-password-form";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { requireSignedInProfile, StaffAuthError } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

export default async function AdminUpdatePasswordPage() {
  try {
    await requireSignedInProfile();
  } catch (error) {
    if (!(error instanceof StaffAuthError)) throw error;
    redirect(error.code === "unauthenticated" ? "/admin/login" : "/admin/sem-acesso");
  }

  const branding = await resolveBranding();

  return (
    <AdminAuthFrame branding={branding} title={copyAdminPtBr.password.title}>
      <AdminPasswordForm />
    </AdminAuthFrame>
  );
}
