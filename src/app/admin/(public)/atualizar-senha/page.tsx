import { AdminAuthFrame } from "@/components/admin/admin-auth-frame";
import { AdminPasswordForm } from "@/components/admin/admin-password-form";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

export default async function AdminUpdatePasswordPage() {
  const branding = await resolveBranding();

  return (
    <AdminAuthFrame branding={branding} title={copyAdminPtBr.password.title}>
      <AdminPasswordForm />
    </AdminAuthFrame>
  );
}
