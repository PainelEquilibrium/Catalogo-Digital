type ThemeScriptProps = {
  enabled: boolean;
  defaultMode: "light" | "dark" | "auto";
};

const STORAGE_KEY = "catalogo-theme";

export function ThemeScript({ enabled, defaultMode }: ThemeScriptProps) {
  const script = `
(function () {
  try {
    var enabled = ${enabled ? "true" : "false"};
    if (!enabled) return;
    var key = "${STORAGE_KEY}";
    var stored = localStorage.getItem(key);
    var mode;
    if (stored === "light" || stored === "dark") {
      mode = stored;
    } else if ("${defaultMode}" === "dark") {
      mode = "dark";
    } else if ("${defaultMode}" === "light") {
      mode = "light";
    } else {
      mode = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    var root = document.documentElement;
    if (mode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  } catch (_) {}
})();
`.trim();

  return (
    <script
      id="catalogo-theme-init"
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}

export { STORAGE_KEY as themeStorageKey };
