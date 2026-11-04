import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  logo: { light: string; dark: string };
  alt: string;
  className?: string;
};

/**
 * Logo que acompanha o tema ativo. Renderiza as duas versões e a regra
 * `.brand-logo--*` em globals.css mostra só a do tema (`html.dark`), para
 * não depender de `prefers-color-scheme` nem de `dark:` do Tailwind.
 */
export function BrandLogo({ logo, alt, className }: BrandLogoProps) {
  const sizing = cn("h-8 w-auto object-contain", className);
  return (
    <>
      <Image
        src={logo.light}
        alt={alt}
        width={2000}
        height={502}
        className={cn("brand-logo brand-logo--light", sizing)}
        priority
      />
      <Image
        src={logo.dark}
        alt={alt}
        width={2000}
        height={502}
        className={cn("brand-logo brand-logo--dark", sizing)}
        priority
      />
    </>
  );
}
