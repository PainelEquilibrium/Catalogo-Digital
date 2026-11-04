"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { themeStorageKey } from "@/components/layout/theme-script";
import { copyPtBr } from "@/lib/copy/pt-br";
import { cn } from "@/lib/utils";

export function AnimatedThemeToggler({ className }: { className?: string }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const transitioning = useRef(false);
  const [darkMode, setDarkMode] = useState(false);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const syncTheme = () =>
      setDarkMode(document.documentElement.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  async function onToggle() {
    if (!buttonRef.current || transitioning.current) return;
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    const applyTheme = () => {
      flushSync(() => {
        root.classList.toggle("dark", next);
        setDarkMode(next);
      });
      try {
        localStorage.setItem(themeStorageKey, next ? "dark" : "light");
      } catch {
        // O tema continua funcionando quando o navegador bloqueia armazenamento.
      }
    };

    if (!document.startViewTransition || reducedMotion) {
      applyTheme();
      return;
    }

    const { left, top, width, height } = buttonRef.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    transitioning.current = true;
    root.classList.add("theme-transition");
    try {
      const transition = document.startViewTransition(applyTheme);
      await transition.ready;
      await root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" },
      ).finished;
    } catch {
      // Uma transição cancelada não deve impedir a troca de tema.
      applyTheme();
    } finally {
      root.classList.remove("theme-transition");
      transitioning.current = false;
    }
  }

  const label = darkMode ? copyPtBr.theme.toggleLight : copyPtBr.theme.toggleDark;
  const Icon = darkMode ? Sun : Moon;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={darkMode ? "sun" : "moon"}
          initial={reducedMotion ? false : { opacity: 0, scale: 0.55, rotate: darkMode ? 25 : -25 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.33 }}
          className="flex"
        >
          <Icon aria-hidden="true" size={24} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
