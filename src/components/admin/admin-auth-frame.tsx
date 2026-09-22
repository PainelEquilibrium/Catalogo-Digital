import Image from "next/image";
import type { Branding } from "@/domain/branding";
import { PoweredByEquilibrium } from "@/components/PoweredByEquilibrium";
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
          <Image
            src={branding.store.logo_url}
            alt={branding.store.name}
            width={160}
            height={48}
            className="h-10 w-auto object-contain"
            priority
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
