import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

export function ThemeToggle({ enabled }: { enabled: boolean }) {
  return enabled ? <AnimatedThemeToggler /> : null;
}
