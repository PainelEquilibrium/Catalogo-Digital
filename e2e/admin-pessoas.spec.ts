import { test, expect, type Browser, type Page } from "@playwright/test";
import { copyAdminPtBr } from "../src/lib/copy/admin-pt-br";
import { createE2eAccount, db, deleteE2eAccount, type E2eAccount } from "./support/cleanup";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const copy = copyAdminPtBr.people;
const runId = Date.now();
const created: string[] = []; // e-mails de contas criadas pela UI
let owner: E2eAccount;
let otherOwner: E2eAccount;
let manager: E2eAccount;
let support: E2eAccount;

test.beforeAll(async () => {
  owner = await createE2eAccount({ role: "owner", mustChangePassword: false });
  otherOwner = await createE2eAccount({ role: "owner", mustChangePassword: false });
  manager = await createE2eAccount({ role: "manager", mustChangePassword: false });
  support = await createE2eAccount({ role: "support", mustChangePassword: false });
});

test.afterAll(async () => {
  for (const email of created) {
    const { rows } = await db.query("select id from profiles where email = $1", [email]);
    for (const row of rows) {
      await db.query("delete from audit_log where entity_id = $1", [row.id]);
      await deleteE2eAccount(row.id);
    }
  }
  for (const account of [owner, otherOwner, manager, support]) {
    if (!account) continue;
    await db.query("delete from audit_log where entity_id = $1", [account.id]);
    await deleteE2eAccount(account.id);
  }
  await db.end();
});

async function openAs(browser: Browser, account: E2eAccount): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/admin/login");
  await page.getByLabel(copyAdminPtBr.login.email).fill(account.email);
  await page.getByLabel(copyAdminPtBr.login.password).fill(account.password);
  await page.getByRole("button", { name: copyAdminPtBr.login.submit }).click();
  await expect(page).toHaveURL(/\/admin\/produtos/, { timeout: 60_000 });
  return page;
}

const row = (page: Page, email: string) => page.getByRole("row").filter({ hasText: email });

async function register(page: Page, name: string, email: string) {
  await page.getByLabel(copy.name).fill(name);
  await page.getByLabel(copy.email).fill(email);
  await page.getByRole("button", { name: copy.create, exact: true }).click();
}

let newEmail = "";
let newId = "";
let shownPassword = "";

test("dono cadastra gestor e a senha aparece uma única vez", async ({ browser }) => {
  const page = await openAs(browser, owner);
  await page.goto("/admin/usuarios");
  newEmail = `e2e-novo-${runId}@example.test`;
  created.push(newEmail);
  await register(page, `e2e-novo-${runId}`, newEmail);

  const shown = page.getByTestId("temp-password");
  await expect(shown).toBeVisible({ timeout: 30_000 });
  shownPassword = (await shown.textContent()) ?? "";
  expect(shownPassword).toMatch(/^[A-Za-z0-9_-]{24}$/);

  await page.getByRole("button", { name: copy.tempClose }).click();
  await page.reload();
  await expect(row(page, newEmail)).toContainText(copy.pendingPassword);
  await expect(page.getByText(shownPassword)).toHaveCount(0);
  expect(await page.content()).not.toContain(shownPassword);

  // A senha mostrada realmente funciona e leva à troca obrigatória.
  const { rows } = await db.query("select id from profiles where email = $1", [newEmail]);
  newId = rows[0].id;
  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto("/admin/login");
  await fresh.getByLabel(copyAdminPtBr.login.email).fill(newEmail);
  await fresh.getByLabel(copyAdminPtBr.login.password).fill(shownPassword);
  await fresh.getByRole("button", { name: copyAdminPtBr.login.submit }).click();
  await expect(fresh).toHaveURL(/\/admin\/atualizar-senha/, { timeout: 60_000 });
});

test("senha temporária não está em nenhuma coluna de profiles nem em audit_log", async () => {
  expect(shownPassword).not.toBe("");
  const profiles = await db.query("select row_to_json(p)::text as j from profiles p where id = $1", [newId]);
  const audit = await db.query("select row_to_json(a)::text as j from audit_log a where entity_id = $1", [newId]);
  expect(audit.rows.length).toBeGreaterThanOrEqual(2);
  for (const r of [...profiles.rows, ...audit.rows]) expect(r.j).not.toContain(shownPassword);
});

test("e-mail duplicado dá mensagem amigável, inclusive o da conta de suporte", async ({ browser }) => {
  const page = await openAs(browser, owner);
  await page.goto("/admin/usuarios");

  await register(page, "dup", newEmail);
  await expect(page.locator("p[role=alert]")).toHaveText(copy.errorDuplicate, { timeout: 30_000 });

  await register(page, "dup", support.email);
  await expect(page.locator("p[role=alert]")).toHaveText(copy.errorDuplicate, { timeout: 30_000 });
  expect(copy.errorDuplicate.toLowerCase()).not.toContain("suporte");
});

test("e-mail ' Teste@X.com ' é salvo em minúsculas", async ({ browser }) => {
  const page = await openAs(browser, owner);
  await page.goto("/admin/usuarios");
  const lower = `e2e-caixa-${runId}@example.test`;
  created.push(lower);
  await register(page, `e2e-caixa-${runId}`, `  E2E-Caixa-${runId}@Example.TEST `);
  await expect(page.getByTestId("temp-password")).toBeVisible({ timeout: 30_000 });
  const { rows } = await db.query("select email from profiles where email = $1", [lower]);
  expect(rows).toHaveLength(1);
});

test("suporte não aparece na lista, nem para o dono, nem para o suporte", async ({ browser }) => {
  for (const account of [owner, support]) {
    const page = await openAs(browser, account);
    await page.goto("/admin/usuarios");
    await expect(page.getByRole("heading", { name: copy.title })).toBeVisible({ timeout: 30_000 });
    await expect(row(page, manager.email)).toHaveCount(1);
    await expect(page.getByText(support.email)).toHaveCount(0);
  }
});

test("gestor em /admin/usuarios é negado; chamada direta da action também", async ({ browser }) => {
  // Dono dispara um reset de verdade só para capturar o id da action; depois o gestor a repete.
  const ownerPage = await openAs(browser, owner);
  await ownerPage.goto("/admin/usuarios");
  const target = await createE2eAccount({ role: "manager", mustChangePassword: false });
  created.push(target.email);
  await ownerPage.reload();
  const call = ownerPage.waitForRequest((r) => r.method() === "POST" && "next-action" in r.headers());
  await row(ownerPage, target.email).getByRole("button", { name: copy.resetPassword }).click();
  const actionId = (await call).headers()["next-action"];
  await expect(ownerPage.getByTestId("temp-password")).toBeVisible({ timeout: 30_000 });
  await db.query("update profiles set must_change_password = false where id = $1", [target.id]);

  const replay = (page: Page, id: string) =>
    page.request.post("/admin/usuarios", {
      headers: { "next-action": actionId, "content-type": "text/plain;charset=UTF-8", accept: "text/x-component" },
      data: JSON.stringify([id]),
    });

  const managerPage = await openAs(browser, manager);
  await managerPage.goto("/admin/usuarios");
  await expect(managerPage).not.toHaveURL(/\/admin\/usuarios/);
  await expect(managerPage.getByRole("link", { name: copyAdminPtBr.chrome.people })).toHaveCount(0);

  const denied = await replay(managerPage, target.id);
  expect(await denied.text()).not.toMatch(/tempPassword/);
  const { rows } = await db.query("select must_change_password from profiles where id = $1", [target.id]);
  expect(rows[0].must_change_password).toBe(false);

  // Alvo suporte e id inexistente respondem exatamente igual para quem tem permissão.
  const asSupport = await replay(ownerPage, support.id);
  const asUnknown = await replay(ownerPage, "00000000-0000-4000-8000-000000000000");
  const normalize = (t: string) => t.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "ID");
  expect(await asSupport.text()).toContain(copy.errorUnavailable);
  expect(normalize(await asSupport.text())).toBe(normalize(await asUnknown.text()));
  const { rows: sup } = await db.query("select must_change_password, is_active from profiles where id = $1", [support.id]);
  expect(sup[0]).toEqual({ must_change_password: false, is_active: true });
});

test("dono não tem ação sobre outro dono nem sobre si", async ({ browser }) => {
  const page = await openAs(browser, owner);
  await page.goto("/admin/usuarios");
  await expect(row(page, otherOwner.email)).toHaveCount(1);
  await expect(row(page, otherOwner.email).getByRole("button")).toHaveCount(0);
  await expect(row(page, owner.email).getByRole("button")).toHaveCount(0);
  await expect(row(page, manager.email).getByRole("button")).toHaveCount(2);
});

test("pessoa desativada perde acesso com a sessão aberta", async ({ browser }) => {
  const managerPage = await openAs(browser, manager);
  const ownerPage = await openAs(browser, owner);
  await ownerPage.goto("/admin/usuarios");
  await row(ownerPage, manager.email).getByRole("button", { name: copy.deactivate }).click();
  await expect(row(ownerPage, manager.email)).toContainText(copy.statusInactive, { timeout: 30_000 });

  await managerPage.goto("/admin/produtos");
  await expect(managerPage).toHaveURL(/\/admin\/sem-acesso/, { timeout: 30_000 });
  await db.query("update profiles set is_active = true where id = $1", [manager.id]);
});

test("ações de suporte saem como 'Suporte Equilibrium'", async ({ browser }) => {
  const page = await openAs(browser, support);
  await page.goto("/admin/usuarios");
  await row(page, manager.email).getByRole("button", { name: copy.resetPassword }).click();
  await expect(page.getByTestId("temp-password")).toBeVisible({ timeout: 30_000 });
  const { rows } = await db.query(
    "select actor_name from audit_log where entity_id = $1 and actor_id = $2 and action = 'temp_password_generated'",
    [manager.id, support.id],
  );
  expect(rows.length).toBeGreaterThan(0);
  for (const r of rows) expect(r.actor_name).toBe("Suporte Equilibrium");
});
