# Separação dos buckets de imagens — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Não iniciar agentes sem autorização do usuário.

**Goal:** Fazer imagens de produtos e capas carregarem no admin e na vitrine, mantendo originais privados e variantes públicas verificadas.

**Architecture:** Provisionar o bucket de variantes por migration Prisma e adaptar o serviço existente de upload e limpeza para dois buckets. Separar persistência de referência e limpeza física, com compensação para uploads novos. Migrar referências antigas por ferramenta operacional com simulação, manifesto, verificação de bytes e atualização condicional.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, pnpm, Prisma 7, Supabase Storage, sharp, Vitest e Playwright; sem dependências novas.

**Spec:** [2026-10-16-separacao-buckets-imagens-design.md](../specs/2026-10-16-separacao-buckets-imagens-design.md). Aprovação e autorização de implementação/testes DEV informadas pelo usuário em 16/10/2026. Implementação e corte DEV concluídos e validados em 17/10/2026. Cliente/produção não autorizado.

## Atualização de execução — 17/10/2026

| Tarefa | Estado registrado |
| --- | --- |
| 1 — Storage/RLS | Migration inicial e `20261017150000_prevent_image_bucket_changes` aplicadas no DEV; repetição sem pendências. P1 de UPDATE entre buckets: quatro falhas RED → matriz RLS real GREEN 7/7 em 49,2 s (quatro novas + três anteriores), em 17/10. |
| 2 — Upload/limpeza | Implementada localmente e revisada; testes locais registrados. |
| 3 — Ações/UI | Implementada localmente e revisada; auditoria atual das ações: 14 PASS em 17/10. Prova visual aprovada nos cenários admin da rodada final. |
| 4 — Inventário/simulação | Implementada e revisada; dry-run DEV registrado: 19 elegíveis, 41 ignorados, zero conflitos/falhas, sem updates. |
| 5 — Cópia/apply/rollback | Motor/CLI implementados e revisados; auditoria atual da transição: 48 PASS em 17/10. 76 variantes já copiadas; retomada copy-only do mesmo manifesto: 19 elegíveis, zero copiadas, 76 verificadas, zero updates/conflitos/falhas, 41 ignorados. Apply real: 19 elegíveis, zero cópias, 76 verificadas, 19 updates, 41 ignorados, zero conflitos/falhas. Retorno simulado: zero updates, 60 ignorados, zero conflitos/falhas; retorno real: 19 updates, 41 ignorados, zero conflitos/falhas. Reapply real: 19 updates, 76 verificadas, 41 ignorados, zero cópias/conflitos/falhas. Idempotência real: 19 elegíveis, zero cópias, 76 verificadas, zero updates, 60 ignorados, zero conflitos/falhas (exit 0). |
| 6 — E2E/docs/gates | E2E e documentação implementados localmente e revisados. `pnpm check` atual em 17/10: 180 PASS, 7 opt-in SKIP, typecheck aprovado, lint sem erros/9 warnings preexistentes; build aprovado com 16 páginas. Browser aprovado: admin 11/11 na rodada final (1,7 min), vitrine 8/8 na primeira rodada, sem mudança de runtime entre elas; 19 cenários distintos passaram, incluindo OG/otimizador. Revisão focada `e2e-cover-rereview.md` sem achados. |

Evidências anteriores: ledger `.superpowers/sdd/2026-10-16-separacao-buckets-imagens/progress.md` e relatórios/revisões locais das tarefas. Esta atualização documental registra execuções confirmadas pela coordenação, sem repeti-las. Buckets remoto privado/público estão corretos na leitura de 17/10. A migration adicional usa trigger `SECURITY INVOKER` no schema gerenciado do Supabase para impedir troca de bucket envolvendo os dois buckets, mantendo UPDATE no mesmo bucket; manutenção futura do Storage ou movimentação entre buckets exige revisão desta proteção. Os checklists abaixo registram passos comprovados no DEV. Servidor permaneceu parado durante apply/retorno; nenhum arquivo legado foi removido. Corte DEV concluído: 19 referências migradas, 41 externas preservadas, 19 originais e 76 variantes antigas mantidos. Warnings SVG/hydration preexistentes permanecem fora do escopo. Cliente/produção: não aplicável a esta execução, não executado. Sem commit/push; localhost:3000 permanece disponível pela coordenação.

## Restrições globais

- `product-images`: privado; novos uploads exclusivamente em `originals/{entityId}/{uuid}`.
- `product-image-variants`: público; exclusivamente `variants/{entityId}/{uuid}-{thumb|card|detail|og}.webp`.
- Preservar UUID e caminhos, `ProductImage.storagePath`, `Category.coverStoragePath`, colunas Prisma e interfaces de leitura das telas.
- Preservar limite de 8 MB, JPEG/PNG/WebP, lado mínimo de 800 px, rejeição de HEIC, orientação e quatro variantes sharp.
- Runtime com cliente Supabase da sessão; nenhuma service role no browser ou no runtime da vitrine.
- `public.is_staff()` governa escritas. UPDATE exige `USING` e `WITH CHECK`; autenticação isolada não basta.
- Não editar migrations aplicadas, tornar o bucket antigo público, apagar cópias legadas na transição, regenerar arquivos ausentes ou criar coleta automática de órfãos.
- Soft delete e restauração preservam arquivos. URLs externas, seed e placeholders não geram operações em Storage.
- Copy em pt-BR no módulo existente. Sem redesign, mudança global de `unoptimized`, bypass de autenticação ou chave em URL de imagem.
- Implementação e testes autorizados somente no DEV identificado; produção exige backup completo, restauração validada, simulação revisada e aprovação explícita do corte.
- Não fazer commit ou push sem pedido. Preservar as alterações locais de outros trabalhos, inclusive carrossel, branding e tema.

## Foco da revisão

1. Uma variante falha enquanto outras terminam: aguardar todas e compensar somente objetos criados nesta operação (tarefa 2).
2. Banco falha ou limpeza anterior falha: preservar capa ativa, distinguir alteração salva de limpeza pendente (tarefa 3).
3. Destino existente, variante ausente ou conteúdo divergente: não sobrescrever nem atualizar parcialmente as URLs (tarefa 5).
4. URL com host/prefixo malicioso, seed ou edição concorrente: não acessar destino arbitrário, apagar arquivos externos nem sobrescrever edição recente (tarefas 2, 4 e 5).
5. Download público não prova autorização de escrita: testar anon, autenticado sem staff, owner e manager, além de imagem realmente decodificada no browser (tarefas 1 e 6).

## Arquivos e responsabilidades

| Arquivo | Responsabilidade |
| --- | --- |
| `prisma/migrations/20261016180000_image_storage_buckets/migration.sql` (novo) | Provisionamento e policies dos dois buckets |
| `src/lib/images/upload.ts` | Contrato de buckets, uploads, URLs e limpeza |
| `src/lib/images/upload.test.ts` (novo) | Roteamento, compensação, referências externas e falhas parciais |
| `src/app/admin/(panel)/produtos/actions.ts` e `categorias/actions.ts` | Persistência antes da limpeza e compensação se banco falhar |
| `src/app/admin/(panel)/produtos/image-actions.test.ts` e `categorias/image-actions.test.ts` (novos) | Ordem e resultado das ações, com Prisma/Storage simulados |
| `src/components/admin/image-gallery-editor.tsx`, `category-form.tsx`, `src/lib/copy/admin-pt-br.ts` | Aviso de limpeza pendente e sincronização da referência salva |
| `src/lib/images/transition.ts` e `transition.test.ts` (novos) | Inventário, manifesto, cópia, verificação, aplicação e retorno condicionais |
| `scripts/migrate-image-variants.ts` (novo) | Entrada CLI operacional, autenticação, arquivos locais e relatório |
| `src/lib/images/storage-policies.integration.test.ts` (novo) | Matriz de permissões no DEV, com execução explicitamente habilitada |
| `e2e/admin.spec.ts`, `e2e/vitrine.spec.ts` | Carregamento real de imagens e regressões dos fluxos existentes |
| `README.md` | Provisionamento, operação, corte, evidências e limites do retorno |

Não alterar `prisma/schema.prisma`, `process-image-buffer.ts`, seed ou `next.config.ts` sem evidência de necessidade. Auditar também `product-card.tsx`, `product-gallery.tsx`, carrossel, páginas de produto/coleção, listagem/editor admin e metadados OG; mantê-los se já consomem URLs persistidas.

## Tarefa 1 — Provisionamento e autorização dos buckets

**Interfaces:** manter `public.is_staff()` existente. Produzir bucket privado de originais, bucket público de variantes e policies compatíveis com a leitura/limpeza de variantes legadas.

- [x] Criar `storage-policies.integration.test.ts`, habilitado somente com `RUN_STORAGE_INTEGRATION=1` e confirmação explícita de projeto DEV. Usar clientes reais por papel; credenciais apenas no ambiente. Sem perfil significa autenticado sem staff; não inventar novo papel no schema.
- [x] Testar: original não baixa sem credenciais nem pela rota pública; staff baixa original; variante pública baixa sem cookies; anon e autenticado sem staff não inserem/alteram/apagam; owner e manager operam nos prefixos permitidos. Negar `originals/**` no bucket público e novas escritas `variants/**` no privado, inclusive mudança de prefixo/bucket em UPDATE. Garantir ausência de listagem anônima no novo bucket.
- [x] Antes da migration, rodar o teste no DEV autorizado e registrar falha pela ausência do novo bucket/contrato. Não usar service role nos clientes que comprovam RLS.
- [x] Criar a migration indicada. Criar ou reconhecer bucket público equivalente; abortar diante de configuração divergente, sem tornar o bucket antigo público silenciosamente. Configurar variantes para MIME WebP; não reutilizar o limite de 8 MB como teto arbitrário de arquivo processado.
- [x] Substituir `product_images_staff_objects` por policies específicas: privado INSERT apenas em originais; SELECT/DELETE de staff em originais e variantes legadas; UPDATE sem permitir novas variantes no privado. Preservar a leitura legada `product_images_variants_public_read` durante a transição. No público, SELECT de staff para operações de manutenção e INSERT/UPDATE/DELETE de staff somente em variantes; nenhuma policy anon de listagem.
- [x] Verificar o conjunto efetivo de policies permissivas: nenhuma policy antiga pode continuar liberando escrita que a nova pretende negar. Reconhecer policies manuais equivalentes; divergência aborta para revisão, sem broadening automático.
- [x] Somente na execução autorizada, aplicar com `pnpm exec prisma migrate deploy` no DEV e repetir a matriz. Rodar uma segunda vez para confirmar ausência de reaplicação. Consultar metadados para comprovar visibilidades/policies; não manipular linhas de objetos para mover arquivos.

## Tarefa 2 — Uploads e limpeza no serviço compartilhado

**Files:** `upload.ts`, `upload.test.ts`.

**Interfaces:** preservar entrada/saída de `storeProcessedImage` e assinatura `publicObjectUrl(objectPath: string): string`, agora restrita a variantes no bucket público. Exportar `StorageObjectRef = { bucket: "product-images" | "product-image-variants"; path: string }`. Substituir `storagePathsForOriginal` por `storageObjectsForOriginal(storagePath: string): StorageObjectRef[]`; alterar `removeStorageObjects(objects: StorageObjectRef[]): Promise<void>` e atualizar todos os callers na tarefa 3.

- [x] Escrever testes: cinco uploads nos buckets corretos, `image/webp` nas variantes, `upsert: false`, UUID comum, URL nova e original privado. `storageObjectsForOriginal` só aceita formato gerado com UUIDs válidos; seed, URL, traversal e caminho desconhecido retornam lista vazia. Para um original válido, listar original privado e quatro variantes em cada bucket, permitindo limpeza de layouts novos e legados.
- [x] Escrever teste com uploads controlados por promises: uma variante rejeita antes de outra concluir; nenhuma limpeza ocorre antes de todos terminarem. Só objetos cujo upload foi confirmado entram na compensação. Se limpeza falhar, erro principal permanece e log técnico lista bucket/caminho sem credenciais.
- [x] Rodar `pnpm exec vitest run src/lib/images/upload.test.ts` e confirmar falhas esperadas antes da alteração.
- [x] Centralizar os dois nomes em `upload.ts`. Criar um cliente de sessão por operação. Usar execução sequencial ou `Promise.allSettled` com rastreamento das confirmações; não compensar com base apenas na lista de objetos planejados. Processar/validar antes do primeiro upload.
- [x] Agrupar remoções por bucket; tentar todos os grupos e reportar falhas. Tratar ausência real como limpeza concluída; não confundir erro de permissão/rede com objeto ausente. Não receber URLs arbitrárias como instrução de remoção.
- [x] Rodar os testes novos e `pnpm exec vitest run src/lib/images/process-image-buffer.test.ts src/lib/images/upload-errors.test.ts`. Confirmar preservação das validações existentes; nenhuma dependência nova.

## Tarefa 3 — Persistência segura e limpeza pendente nas ações/UI

**Files:** ações, testes de ações, dois componentes admin e copy listados no mapa.

**Interfaces:** manter nomes/argumentos de `addProductImage`, `removeProductImage` e `setCategoryCover`. Para remoção e capa, sucesso passa a aceitar `{ ok: true; cleanupPending?: boolean }`; capa retorna também `coverImageUrl: string` quando salva. Falha continua `{ ok: false; message: string }`. Não mudar o retorno de ações alheias a imagens.

- [x] Testar que falha no aggregate/create de produto após upload compensa os objetos novos, não grava referência parcial e não exibe sucesso. Falha da compensação preserva erro principal e gera registro técnico.
- [x] Testar remoção: erro no delete da referência não chama Storage; sucesso no banco seguido de falha física retorna `ok: true, cleanupPending: true`. Remover somente a foto solicitada. Seed/URL externa não acionam Storage.
- [x] Testar substituição: erro na gravação preserva referência/objetos anteriores e compensa o novo conjunto; sucesso salva nova capa antes de limpar a anterior; erro nessa limpeza mantém capa nova e sinaliza pendência. Duas substituições concorrentes usam comparação de `coverStoragePath`/`coverImageUrl` anteriores; perdedora não sobrescreve edição recente e compensa somente os próprios arquivos novos.
- [x] Rodar `pnpm exec vitest run 'src/app/admin/(panel)/produtos/image-actions.test.ts' 'src/app/admin/(panel)/categorias/image-actions.test.ts'`; confirmar testes vermelhos antes das alterações e verdes depois.
- [x] Proteger toda persistência pós-upload com compensação; atualizar seleção de referências e callers para `StorageObjectRef[]`. Selecionar também URLs persistidas: exigir origin esperado e correspondência com o conjunto derivado antes de limpar; referência externa não autoriza remoção mesmo se acompanhada de caminho aparentemente válido. Na capa, fazer atualização condicional; na remoção, desvincular antes da limpeza. Registrar falhas de limpeza com IDs técnicos.
- [x] Nos componentes, renovar a lista/capa salva mesmo com `cleanupPending`; usar `toast.warning` em vez de confirmação de sucesso completo. Copy: “Foto removida. A limpeza dos arquivos ficou pendente.” e “Capa salva. A limpeza dos arquivos anteriores ficou pendente.”
- [x] No formulário de categoria, atualizar o estado para a URL confirmada e revogar o blob após sucesso; numa tentativa posterior que falhe, restaurar a última capa confirmada, não o valor inicial desatualizado. Testar essa sequência em browser na tarefa 6.

## Tarefa 4 — Inventário e simulação com manifesto

**Files:** `transition.ts`, `transition.test.ts`, `scripts/migrate-image-variants.ts`.

**Interfaces:** exportar `runImageVariantTransition(options): Promise<TransitionReport>`; `options` inclui `mode: "dry-run" | "apply" | "rollback"`, `writeEnabled: boolean`, `copyOnly: boolean`, `projectRef`, `manifestPath` e clientes Prisma/Storage fornecidos pelo runner. Relatório tem contadores `eligible`, `copied`, `verified`, `updated`, `skipped`, `conflicts`, `failed`. CLI padrão é dry-run; `--apply` habilita escrita e exige manifesto existente; `--rollback` seleciona retorno e, sozinho, apenas simula; `--copy-only` copia/verifica sem atualizar referências e não pode ser combinado com retorno.

- [x] Definir manifesto JSON versionado: projeto/origin esperado, data, IDs de imagem/categoria, referências antigas/novas, original, quatro caminhos, tamanho e SHA-256 de cada fonte, bloqueios encontrados. Journal separado registra cópias/verificações/atualizações; nunca substituir o snapshot antigo depois de escrever remotamente.
- [x] Testar inventário paginado sem filtros de publicação/soft delete: incluir rascunhos, inativos e lixeira. Aceitar somente host exato do Supabase esperado, rota pública do bucket antigo e caminhos derivados do original com UUID comum. Rejeitar URL com credenciais, host parecido, traversal, caminho incompatível ou conjunto misto; classificar sem migrar automaticamente. Preservar seed, externas, placeholders e conjuntos já migrados.
- [x] Inventariar fontes pelas APIs de Storage com paginação; relatar variantes órfãs sem removê-las. Fonte ausente/incompleta bloqueia o conjunto, sem regeneração. Calcular tamanho/SHA-256 dos bytes, não confiar apenas em metadata/ETag.
- [x] Rodar `pnpm exec vitest run src/lib/images/transition.test.ts` e confirmar falha inicial; implementar inventário e manifesto. Assert de dry-run: zero `upload`, `remove`, atualização de DB ou criação de bucket; escrita apenas dos artefatos locais.
- [x] Criar runner com `dotenv/config`, Prisma e `createClient` já instalado. Usar `NEXT_PUBLIC_SUPABASE_URL`, anon key e `IMAGE_MIGRATION_ACCESS_TOKEN` de uma sessão staff, com persistência/refresh de sessão desativados; token nunca vai no manifesto/log/argumento de CLI. Confirmar ambiente/projeto e conexão Prisma antes de operar; expiração de token interrompe execução de forma retomável.
- [x] Documentar/comprovar `pnpm exec tsx scripts/migrate-image-variants.ts --project-ref <ref-dev> --manifest <arquivo-local.json>` como simulação. Validar argumentos e manifesto antes de qualquer rede; aplicação nunca aceita host arbitrário vindo apenas do manifesto. Guardar artefatos fora do versionamento e rejeitar sobrescrita acidental do inventário original.

## Tarefa 5 — Cópia verificada, aplicação e retorno condicionais

**Files/interfaces:** estender o motor/runner da tarefa 4, sem novo serviço de runtime.

- [x] Testar cópia sem overwrite, destino idêntico reutilizado, destino divergente preservado, HTTP público diferente de 200, WebP inválido, hash diferente e fonte ausente. Para categoria também exigir as quatro variantes; não atualizar só porque o card existe.
- [x] Testar atomicidade por registro: quatro URLs de produto atualizadas juntas somente após verificação; falha de uma variante mantém todas antigas. `storagePath`/`coverStoragePath` não mudam. Comparar no mesmo UPDATE todas as referências inventariadas; zero registros afetados significa conflito. Não depender de leitura seguida de UPDATE incondicional.
- [x] Testar retomada após cópia e antes de gravar no banco, reexecução sem duplicação e retorno que só restaura registros ainda iguais aos valores novos do manifesto. Edição posterior não é sobrescrita. Manifesto de outro projeto, versão desconhecida ou adulterado com caminhos fora do contrato é rejeitado.
- [x] Implementar transferência de bytes pela API Storage entre buckets, `upsert: false`; não usar copy no mesmo bucket por engano nem alterar `storage.objects` diretamente. Antes de copiar, reler fonte e comparar ao manifesto. Se upload encontrar objeto existente, baixar/verificar; nunca sobrescrever para resolver conflito.
- [x] Validar destino por `fetch` público sem Authorization/cookies, rejeitando redirecionamento para outro host; exigir HTTP 200, decodificação sharp WebP e SHA-256 igual ao inventário. Verificar ausência de originais no público antes de atualizar referências.
- [x] Persistir manifesto antes da primeira escrita e journal após cada fase. Erros isolados bloqueiam seu conjunto e entram no relatório; falha de autenticação/projeto interrompe execução. Saída não zero se houver falhas/conflitos, sem esconder conjuntos já atualizados. Testar `copyOnly`: zero updates no banco; execução posterior sem essa flag verifica novamente os destinos antes de atualizar.
- [x] Rodar `pnpm exec vitest run src/lib/images/transition.test.ts` até passar. Exercitar em DEV autorizado: `--apply --manifest <arquivo>`; retorno usa `--rollback --apply --manifest <arquivo>`. Sem `--apply`, retorno apenas simula. Nunca apagar objetos em apply/rollback.


## Tarefa 6 — Prova em DEV, operação e documentação

**Files:** `e2e/admin.spec.ts`, `e2e/vitrine.spec.ts`, `README.md`; ajustes de testes anteriores se necessários. Sem autorização para corte em cliente/produção.

- [x] Ampliar E2E existente usando `public/images/clothes-placeholder-imagem.webp`: após upload de produto/capa, aguardar imagens relevantes, rolar as lazy e verificar `complete && naturalWidth > 0`. Confirmar listagem/editor admin, home/coleção, produto/galeria e capa; excluir imagens decorativas/placeholders alheios à entrega dos asserts.
- [x] Comprovar URL OG pública e uma requisição `/_next/image` real com HTTP 200 e `Content-Type: image/*`; testar a URL da variante também por request sem cookies, sem aproveitar sessão do admin.
- [x] Exercitar substituição e remoção de arquivos próprios de teste, soft delete/restauração sem apagar arquivos e duas substituições sucessivas de capa seguidas de falha simulada. Na simulação de limpeza pendente, conferir aviso e referência salva visível; fixtures de falha não entram no runtime de produção.
- [x] Registrar baseline antes das mudanças. Na validação final rodar `pnpm check`, `pnpm build`, os E2E afetados e a matriz Storage opt-in no DEV autorizado. Separar falhas existentes de regressões; não apresentar mocks como prova de RLS real.
- [x] Executar dry-run operacional no DEV; revisar contagens, URLs, hashes e bloqueios. Incluir o registro investigado na spec somente se elegível no inventário atual; não assumir que o estado remoto de 16/10 permanece igual.
- [x] Documentar corte ordenado: pausar uploads/substituições/remoções em todas as instâncias; esperar operações em voo; identificar projeto e registrar estado/backup; provisionar bucket/policies; copiar/verificar; disponibilizar código compatível; atualizar referências condicionalmente; comprovar permissões e imagens; retomar mutações. CLI separa fases de cópia/verificação e atualização por `--copy-only` em apply; somente a segunda fase atualiza DB. Leituras podem continuar.
- [ ] **N/A nesta execução — cliente/produção não executado.** Para corte em cliente/produção, preparar antes pacote concreto de revisão: backup de DB e objetos Storage, inventário de Auth/config/policies necessários, restauração isolada validada, manifesto e simulação. Submeter esse pacote à aprovação explícita antes de executar o corte. Nenhum reset de banco de cliente.
- [x] Documentar alternativa Dashboard: criar configuração equivalente, inspecionar políticas e executar migration versionada; não editar histórico/checksum nem marcar migration aplicada sem equivalência comprovada.
- [x] Documentar retorno: pausar mutações; simular retorno condicional; revisar conflitos; aplicar só URLs ainda correspondentes ao manifesto. Isso recupera URLs antigas possivelmente inválidas, não garante exibição funcional. Manter novo bucket e suporte aos dois layouts, especialmente depois de novos uploads; não reverter isoladamente para código de bucket único.
- [x] Registrar evidências e limites no README/entrega: contagens, testes executados, originais privados, variantes públicas, pendências manuais. Não incluir tokens, credenciais, manifesto com dados operacionais ou dumps no Git.

## Cobertura e encerramento

| Aceite da spec | Tarefas |
| --- | --- |
| 1: um original privado e quatro variantes públicas | 1–2, 6 |
| 2–3: download e matriz de autorização | 1, 6 |
| 4–6: telas, OG, decodificação browser e otimizador Next | 6 |
| 7: remoção/substituição sem perda de referência ativa | 2–3, 6 |
| 8–9: simulação, verificação, concorrência, reexecução e legado | 4–6 |
| 10: checks, E2E DEV e limites | 6 |

**Dependências:** tarefas 1 e 2 definem armazenamento; 3 depende de 2; 5 depende de 4; validação remota de 2/3/5 depende de 1; 6 integra tudo. Executar sequencialmente por padrão. Fazer checkpoints locais sem commit automático.

**Auto-revisão original do plano (escopo), com estado de execução atualizado:** todos os dez critérios têm tarefa; callers de limpeza e avisos UI incluídos; testes operacionais ficam em `src/**/*.test.ts` para o Vitest existente descobri-los; nenhuma dependência ou alteração de schema de aplicação. Corte e retorno preservam originais e cópias legadas. Implementação e gates DEV concluídos conforme evidências acima; não equivale a execução ou aprovação de cliente/produção.

## Documentação de referência

- [Supabase: visibilidade dos buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals): download público não substitui policies de escrita.
- [Supabase: controle de acesso no Storage](https://supabase.com/docs/guides/storage/security/access-control): policies por operação, bucket e prefixo.
- Antes de escrever SQL/RLS na implementação, carregar `supabase-postgres-best-practices`, revisar documentação atual/Context7 e consultar changelog. O leitor web desta sessão não aceitou o content-type de `https://supabase.com/changelog.md`; não tratar esse índice como verificado.
