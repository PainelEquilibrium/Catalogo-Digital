import type { Branding } from "@/domain/branding";
import { PoweredByEquilibrium } from "@/components/PoweredByEquilibrium";
import { BrandLogo } from "@/components/layout/brand-logo";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

type AdminAuthFrameProps = {
  branding: Branding;
  title: string;
  children: React.ReactNode;
};

export function AdminAuthFrame({
  branding,
  title,
  children,
}: AdminAuthFrameProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandLogo
            logo={branding.store.logo}
            alt={branding.store.name}
            className="h-10"
          />
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        </div>
        {children}
        <div className="flex justify-center pt-4">
          <PoweredByEquilibrium
            variant="footer"
            label={copyAdminPtBr.chrome.poweredBy}
            showTextFallback={false}
          />
        </div>
      </div>
    </div>
  );
}
