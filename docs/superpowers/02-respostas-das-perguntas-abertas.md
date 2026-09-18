# Respostas das perguntas abertas

**Data:** 18/09/2026  
**Status:** rodada encerrada. Escolhas incorporadas em `00-contexto-e-decisoes.md`, `README.md` e `CLAUDE.md`.  
**Formato:** o questionário original com só a opção escolhida (todas **A**), mais notas que não cabiam numa letra.

Não reabrir estas perguntas sem pedido explícito. Q24 continua em branco de propósito (env no provisionamento).

---

## Resumo

| Q | Escolha | Travado |
| --- | --- | --- |
| 1 | A | Primeiro cliente: Mariah's Boutique. `main` = produto |
| 2 | A | Fallback de marca: Equilibrium Tecnologia |
| 3 | A | `branding.config.json` no `main` = sempre Equilibrium |
| 4 | A | Subdomínio Equilibrium + domínio próprio opcional |
| 5 | A | Vercel, 1 projeto por `cliente-*` |
| 6 | A | pnpm |
| 7 | A | Next.js 16, App Router, `src/` |
| 8 | A | Admin: Tailwind + shadcn + Zod + RHF |
| 9 | A | Vitrine autoral sobre tokens; shadcn só em controles genéricos |
| 10 | A | GTM + Consent Mode v2 + banner; `whatsapp_click`; sem lead form |
| 11 | A + nota | Legais no MVP público; **textos no banco**, como branding |
| 12 | A | SQL leftover = rascunho; spec redesenha schema |
| 13 | A | Variantes WebP públicas; upload validado no servidor |
| 14 | A | `sharp` no Next (Server Action / rota Node) |
| 15 | A | WhatsApp no banco; env fallback |
| 16 | A | Tipos planos; sem `group` |
| 17 | A + nota | Admin com branding resolvido + componente **`PoweredByEquilibrium`** |
| 18 | A + nota | Convite por e-mail **e** gestão de usuários no painel (sem SQL) |
| 19 | A | Auditoria/timeline na 1ª geração do admin; restore depois |
| 20 | A | Vitest + Playwright nos fluxos críticos |
| 21 | A | Só pt-BR |
| 22 | A | Primeiro spec = fundação + vitrine (admin no seguinte) |
| 23 | refs | Drive New York + Poolside FM Store (clima, não cópia) |
| 24 | — | Hostname/WhatsApp reais: provisionamento |
| 25 | A | Sem feature exclusiva conhecida; flags só como mecanismo |

### Notas que não eram letra de múltipla escolha

- **Segmento (anotado em `00`):** produto para lojas de **roupa em geral**. Mariah's é o primeiro cliente, não o teto do modelo.
- **Q11:** privacidade, cookies e termos salvam no banco no mesmo espírito do branding.
- **Q17:** rodapé “fornecido por Equilibrium Tecnologia” vira o componente `PoweredByEquilibrium`.
- **Q18:** o admin precisa manter usuárias (convite, papel, desativar) sem abrir o Supabase no dia a dia.
- **Q23:** “componentes de sites conhecidos de design… minimalistas mas funcionais”:
  - https://www.lapa.ninja/post/poolside-fm-store/
  - https://www.lapa.ninja/post/thedrivenewyork/ · https://thedrivenewyork.com/

---

## A. Produto e primeiro cliente

### Q1. Qual é a primeira loja deste repositório?

- **A.** Mariah's Boutique — o `main` nasce como produto, a primeira branch cliente é dela.

### Q2. Qual nome comercial aparece na vitrine enquanto a loja não personaliza o branding?

- **A.** Equilibrium Tecnologia + tagline de catálogo de moda.

### Q3. O JSON padrão versionado no `main` deve ser sempre Equilibrium, mesmo na branch da loja?

- **A.** Sim: `branding.config.json` no `main` = Equilibrium. A loja só sobrescreve no banco (ou, se precisar de default visual da loja no repo, só na branch `cliente-*`).

---

## B. Domínio, host e operação

### Q4. Como fica o domínio público?

- **A.** Subdomínio Equilibrium como padrão **e** domínio próprio da loja como opcional (CNAME / redirect).

### Q5. Onde o app sobe?

- **A.** Vercel, 1 projeto por branch `cliente-*`.

### Q6. Gerenciador de pacotes?

- **A.** pnpm.

---

## C. Stack de UI e versão

### Q7. Next.js

- **A.** Next.js 16 (App Router, TypeScript, `src/`).

### Q8. Kit de UI do admin

- **A.** Tailwind CSS + **shadcn/ui** + Zod + React Hook Form.

### Q9. Visual da vitrine pública

- **A.** Vitrine com layout/CSS próprios em cima dos tokens de `branding.config.json`; shadcn só no admin e em controles genéricos (dialog, input, toast).

---

## D. Analytics, LGPD e jurídico

### Q10. GTM / consentimento / cookies

- **A.** Incluir na 1ª geração da vitrine: banner de cookies, Consent Mode v2, GTM, eventos `whatsapp_click` (e page view). Sem formulário de lead/`/obrigado`.

### Q11. Páginas legais

- **A.** Sim, no MVP público, no padrão Equilibrium (textos adaptáveis por loja, **salvar no banco assim como branding**).

---

## E. Dados, imagens e WhatsApp

### Q12. SQL leftover

- **A.** Tratar como rascunho. O spec redesenha o schema com as práticas atuais do Supabase.

### Q13. Imagens no Storage

- **A.** Bucket público **somente** para variantes já processadas. Upload original privado ou no mesmo prefixo, nunca `service_role` no browser. Validação de MIME/tamanho no servidor.

### Q14. Onde roda o `sharp` → WebP?

- **A.** Server Action / rota Node no Next.js.

### Q15. Fonte da verdade do WhatsApp

- **A.** Banco editável no admin; env `WHATSAPP_NUMBER` só como fallback de deploy.

### Q16. Campos agrupados

- **A.** Tipos planos no MVP. Medidas viram campos `number` separados. Sem `group`.

---

## F. Admin, papéis e confiança

### Q17. Branding no login/admin

- **A.** Login e chrome do admin usam o branding **resolvido**. Rodapé discreto com componente próprio **`PoweredByEquilibrium`**.

### Q18. Convite de gestoras

- **A.** Owner convida por e-mail (Supabase Invite). Sem self-signup público. **Manutenção de usuários no painel admin**, sem acessar o banco no dia a dia.

### Q19. Rollback no MVP

- **A.** 1ª geração do admin: log com snapshot + timeline. Restore em 2 cliques na geração seguinte.

---

## G. Qualidade e recorte do primeiro spec

### Q20. Testes

- **A.** Vitest (domínio) + Playwright (vitrine, filtro/URL, WhatsApp, login admin quando existir).

### Q21. i18n

- **A.** pt-BR nativo. Sem `next-intl`.

### Q22. Como fatiar o primeiro spec?

- **A.** Fundação + vitrine pública mínima. Admin de verdade no spec seguinte.

---

## H. Opcional

### Q23. Referências visuais

Componentes de sites conhecidos, minimalistas mas funcionais:

- https://www.lapa.ninja/post/poolside-fm-store/
- https://www.lapa.ninja/post/thedrivenewyork/ ou https://thedrivenewyork.com/?ref=lapaninja

### Q24. Número de WhatsApp e domínio da primeira loja

Em branco. Preencher no provisionamento / `.env`.

### Q25. Feature exclusiva já conhecida?

- **A.** Não. Flags só como mecanismo.
