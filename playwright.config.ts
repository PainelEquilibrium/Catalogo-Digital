import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// Chamar só o spec de configurações não deve arrastar o projeto "chromium" inteiro como dependência.
// Qualquer outro arquivo ou filtro na linha de comando mantém a dependência: esse spec grava
// em store_settings e não pode rodar junto com os demais.
const VALUE_FLAGS = new Set(["-g", "--grep", "-gv", "--grep-invert", "-j", "--workers", "--project", "-c", "--config", "--reporter", "--retries", "--timeout", "--repeat-each", "--shard", "--max-failures"]);
const positionals = process.argv.slice(process.argv.indexOf("test") + 1).filter((arg, i, all) => !arg.startsWith("-") && !VALUE_FLAGS.has(all[i - 1] ?? ""));
const onlyGlobalSettingsSpec =
  positionals.length > 0 && positionals.every((arg) => /(^|[\\/])admin-configuracoes\.spec\.ts(:\d+)*$/.test(arg));

const e2eEnv = {
  WHATSAPP_NUMBER: "5511999998888",
  NEXT_PUBLIC_GTM_ID: "",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      ...e2eEnv,
    },
  },
  // admin-configuracoes troca preços, número e nome da loja no banco inteiro por um tempo.
  // Roda depois de todo o resto, em projeto próprio, para nenhum outro spec ler esse estado.
  // Task 26 consolida a configuração.
  projects: [
    {
      name: "chromium",
      testIgnore: "**/admin-configuracoes.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-global-settings",
      testMatch: "**/admin-configuracoes.spec.ts",
      dependencies: onlyGlobalSettingsSpec ? [] : ["chromium"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
