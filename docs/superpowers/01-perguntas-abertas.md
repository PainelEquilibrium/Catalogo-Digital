# Perguntas abertas — Catálogo Digital

**Status:** respondido em 18/09/2026. Registro canônico: [`02-respostas-das-perguntas-abertas.md`](./02-respostas-das-perguntas-abertas.md). Decisões incorporadas em [`00-contexto-e-decisoes.md`](./00-contexto-e-decisoes.md).

Este arquivo fica como o questionário original. Não usar como lista pendente.

---

**Data:** 18/09/2026  
**Para:** responder **antes** de spec ou plano.  
**Como responder:** copie o bloco no final, ou escreva `Q1: A`, `Q2: B`, etc. Se uma pergunta não importar agora, marque `depois`.

Se concordar com **todas** as recomendações, pode responder só:

> Aceito as recomendações.

---

## A. Produto e primeiro cliente

### Q1. Qual é a primeira loja deste repositório?

Há um projeto de ads no portfólio (**Mariah's Boutique**) com o mesmo recorte: moda feminina, malhas/tricô, jeans, plus size, venda via WhatsApp.

- **A (recomendado).** Mariah's Boutique — o `main` nasce como produto, a primeira branch cliente é dela.

### Q2. Qual nome comercial aparece na vitrine enquanto a loja não personaliza o branding?

- **A (recomendado).** Equilibrium Tecnologia (já fechado na conversa) + tagline de catálogo de moda.

### Q3. O JSON padrão versionado no `main` deve ser sempre Equilibrium, mesmo na branch da loja?

Na conversa: loja nova mostra Equilibrium; depois o admin grava overrides no banco.

- **A (recomendado).** Sim: `branding.config.json` no `main` = Equilibrium. A loja só sobrescreve no banco (ou, se precisar de default visual da loja no repo, só na branch `cliente-*`).

---

## B. Domínio, host e operação

### Q4. Como fica o domínio público?

Na conversa: domínio da Equilibrium compartilhado (`cliente.dominio` **ou** `catalogocliente.dominio`) + redirect se a loja tiver domínio próprio. O PRD simplificou para “domínio do cliente na Vercel”.

- **A (recomendado).** Subdomínio Equilibrium como padrão (`catalogo-<cliente>.<seu-dominio>` ou o padrão que você usar) **e** domínio próprio da loja como opcional (CNAME / redirect).

### Q5. Onde o app sobe?

- **A (recomendado).** Vercel, 1 projeto por branch `cliente-*` (como no PRD).

### Q6. Gerenciador de pacotes?

O portfólio Equilibrium usa **pnpm**. O leftover do Kimi usava npm.

- **A (recomendado).** pnpm.

---

## C. Stack de UI e versão

### Q7. Next.js

O PRD citou Next.js 15. A doc atual do `create-next-app` (set/2026) gera **Next.js 16** + React 19.

- **A (recomendado).** Next.js 16 (App Router, TypeScript, `src/`).

### Q8. Kit de UI do admin (e peças da vitrine que forem sistema de design)

- **A (recomendado).** Tailwind CSS + **shadcn/ui** + Zod + React Hook Form (padrão dos seus sites/apps).

### Q9. Visual da vitrine pública

O admin pode ser shadcn. A vitrine de moda pode (e talvez deva) ser mais autoral, dirigida pelos tokens do branding.

- **A (recomendado).** Vitrine com layout/CSS próprios em cima dos tokens de `branding.config.json`; shadcn só no admin e em controles genéricos (dialog, input, toast).

---

## D. Analytics, LGPD e jurídico

### Q10. GTM / consentimento / cookies

Há skill e template de GTM + LGPD no portfólio. O PRD antigo não cobriu isso.

- **A (recomendado).** Incluir na 1ª geração da vitrine: banner de cookies, Consent Mode v2, GTM, eventos `whatsapp_click` (e page view). Sem formulário de lead/`/obrigado` neste produto.

### Q11. Páginas legais (privacidade, cookies, termos)

- **A (recomendado).** Sim, no MVP público, no padrão Equilibrium (textos adaptáveis por loja, salvar no banco assim como branding).

---

## E. Dados, imagens e WhatsApp

### Q12. O que fazer com o SQL leftover (`docs/misc/0002_core_tables.sql`)?

É só um recorte (faltam migrations 0001, 0003–0005).

- **A (recomendado).** Tratar como rascunho. O spec redesenha o schema (tabelas, RLS, enums) com as práticas atuais do Supabase. Não aplicar esse arquivo como canônico.

### Q13. Imagens no Storage

A vitrine e o OG precisam de URL estável. URL assinada comete no compartilhamento.

- **A (recomendado).** Bucket público **somente** para variantes já processadas (thumb/card/detail/og). Upload original privado ou no mesmo prefixo, nunca o `service_role` no browser. Validação de MIME/tamanho no servidor.

### Q14. Onde roda o `sharp` → WebP?

- **A (recomendado).** Server Action / rota Node no Next.js (mais simples de operar).

### Q15. Fonte da verdade do WhatsApp

- **A (recomendado).** Banco (`store_settings` / campo dedicado) editável no admin; env `WHATSAPP_NUMBER` só como fallback de deploy.

### Q16. Campos agrupados (ex.: medidas busto/cintura)

O exemplo do PRD usa `type: "group"`; a lista de tipos do admin não tem `group`.

- **A (recomendado).** Tipos planos no MVP (`text`, `textarea`, `number`, `select`, `multiselect`, `boolean`, `url`). Medidas viram campos `number` separados (`busto_cm`, etc.). Sem `group` na 1ª geração.

---

## F. Admin, papéis e confiança

### Q17. Depois que a loja personaliza o branding, o **login/admin** usa a cara da loja ou continua Equilibrium?

- **A (recomendado).** Login e chrome do admin usam o branding **resolvido** (loja se já configurou; senão Equilibrium). Rodapé discreto “fornecido por Equilibrium Tecnologia”, que receberá componente próprio PoweredByEquilibrium.

### Q18. Convite de gestoras (`manager`)

- **A (recomendado).** Owner convida por e-mail (Supabase Invite). Sem self-signup público.

### Q19. Rollback no MVP

A conversa pediu auditoria + rollback real. É a parte mais cara do admin.

- **A (recomendado).** 1ª geração: log com snapshot before/after + timeline. Restore em 2 cliques **na geração seguinte** (ou no plano F3), para não travar a vitrine.
- **B.** Rollback real já no primeiro ciclo de implementação do admin, como no PRD.

---

## G. Qualidade e recorte do primeiro spec

### Q20. Testes

- **A (recomendado).** Vitest (unidade/domínio: branding merge, schema de campos, preço/“sob consulta”, vigência de campanha) + Playwright nos fluxos críticos (vitrine, filtro/URL, WhatsApp, login admin) quando o app existir.
- **B.** Só Playwright depois da vitrine.
- **C.** Testes só no final do produto.

### Q21. i18n

- **A (recomendado).** pt-BR nativo. Sem arquitetura i18n nesta geração (copy em um módulo/constantes, não espalhada crua, mas sem `next-intl`).
- **B.** Já deixar `next-intl` (ou similar) encaixado.

### Q22. Como fatiar o primeiro spec?

O PRD antigo tinha 5 fases numa peça só. Superpowers pede spec implementável.

- **A (recomendado).** Primeiro spec = **fundação + vitrine pública mínima** (home, categoria, produto, WhatsApp, branding em camadas, imagens). Admin de verdade no spec seguinte.
- **B.** Primeiro spec = fundação + admin de produtos/categorias **e** vitrine (MVP completo Kimi F0+F1).
- **C.** Um spec único do produto inteiro (F0–F4). Não recomendado.

---

## H. Opcional (não bloqueia, mas ajuda)

### Q23. Referências visuais da vitrine

Tem site, Instagram ou catálogo PDF da loja para copiar o clima (não o layout pixel a pixel)? Cole links se houver.

### Q24. Número de WhatsApp e domínio da primeira loja

Pode ficar em `.env` depois. Se já souber o padrão de hostname, anote aqui.

### Q25. Feature exclusiva já conhecida para o primeiro cliente?

- **A.** Não. Flags só como mecanismo.
- **B.** Sim. Qual?

---

## Bloco de resposta (copie)

```text
Q1:
Q2:
Q3:
Q4:
Q5:
Q6:
Q7:
Q8:
Q9:
Q10:
Q11:
Q12:
Q13:
Q14:
Q15:
Q16:
Q17:
Q18:
Q19:
Q20:
Q21:
Q22:
Q23:
Q24:
Q25:
```

### Recomendações resumidas

| Q   | Rec. | Em uma frase                                      |
| --- | ---- | ------------------------------------------------- |
| 1   | A    | Mariah's como primeiro cliente                    |
| 2   | A    | Fallback Equilibrium                              |
| 3   | A    | JSON do `main` = Equilibrium                      |
| 4   | A    | Subdomínio Equilibrium + domínio próprio opcional |
| 5   | A    | Vercel                                            |
| 6   | A    | pnpm                                              |
| 7   | A    | Next.js 16                                        |
| 8   | A    | shadcn no admin                                   |
| 9   | A    | Vitrine autoral + tokens                          |
| 10  | A    | GTM + LGPD na vitrine                             |
| 11  | A    | Páginas legais no MVP público                     |
| 12  | A    | SQL leftover = rascunho                           |
| 13  | A    | Variantes WebP públicas                           |
| 14  | A    | `sharp` no Next                                   |
| 15  | A    | WhatsApp no banco, env fallback                   |
| 16  | A    | Sem `group` no MVP                                |
| 17  | A    | Admin com branding resolvido                      |
| 18  | A    | Convite por e-mail                                |
| 19  | A    | Auditoria já; restore no ciclo seguinte           |
| 20  | A    | Vitest + Playwright crítico                       |
| 21  | A    | Só pt-BR                                          |
| 22  | A    | Primeiro spec = fundação + vitrine                |
