import { AdminAuthFrame } from "@/components/admin/admin-auth-frame";
import { AdminRecoveryForm } from "@/components/admin/admin-recovery-form";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

export default async function AdminRecoveryPage() {
  const branding = await resolveBranding();

  return (
    <AdminAuthFrame branding={branding} title={copyAdminPtBr.recovery.title}>
      <AdminRecoveryForm />
    </AdminAuthFrame>
  );
}
