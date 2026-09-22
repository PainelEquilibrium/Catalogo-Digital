import Image from "next/image";
import Link from "next/link";
import type { Branding } from "@/domain/branding";

type HomeHeroProps = {
  hero: Branding["hero"];
};

export function HomeHero({ hero }: HomeHeroProps) {
  if (!hero.enabled) {
    return null;
  }

  return (
    <section
      className="relative mx-auto w-full max-w-6xl px-4 sm:px-6"
      aria-labelledby="home-hero-title"
    >
      <div className="relative aspect-[16/9] max-h-[min(70vh,640px)] w-full overflow-hidden rounded-[var(--radius)] bg-[var(--color-surface)]">
        <Image
          src={hero.image_url}
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1152px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--color-text)_55%,transparent)] via-[color-mix(in_srgb,var(--color-text)_15%,transparent)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 sm:p-10">
          <h1
            id="home-hero-title"
            className="font-heading text-3xl font-medium tracking-tight text-white sm:text-4xl md:text-5xl"
          >
            {hero.title}
          </h1>
          {hero.subtitle ? (
            <p className="max-w-xl text-base text-white/90 sm:text-lg">
              {hero.subtitle}
            </p>
          ) : null}
          {hero.cta_label && hero.cta_link ? (
            <div className="pt-1">
              <Link
                href={hero.cta_link}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-[var(--color-background)] px-5 text-sm font-medium text-[var(--color-text)] transition-opacity hover:opacity-90"
              >
                {hero.cta_label}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
