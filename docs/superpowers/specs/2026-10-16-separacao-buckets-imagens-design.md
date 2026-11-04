# Spec: originais privados e variantes públicas de imagens

Data: 16/10/2026. Status atualizado em 17/10/2026: aprovada; implementação e corte DEV concluídos e validados. Cliente/produção não executado nem autorizado.

## 1. Objetivo

Corrigir o carregamento das imagens de produtos e capas de categorias no admin e na vitrine. Manter os arquivos originais no bucket privado atual, `product-images`, e armazenar as variantes processadas em um novo bucket público, `product-image-variants`.

A mesma URL pública de variante será usada nas rotas públicas e nas rotas protegidas do admin. A autenticação do admin continua protegendo páginas e operações de edição; não será necessária para baixar as variantes. Originais não serão usados como fonte de exibição.

Esta spec atende ao pedido de separar os buckets. Os nomes e o provisionamento por migration foram aprovados, assim como implementação e testes no DEV `fzmnuodimupkmptdvfee`. Cliente/produção permanece fora da autorização.

## 2. Diagnóstico e base existente

- `prisma/migrations/20260319160100_rls_extensions_storage/migration.sql` cria `product-images` com `public = false`, além de uma policy de SELECT para `variants/**`.
- `prisma/migrations/20260922190000_admin_staff_rls/migration.sql` permite operações de staff em `originals/**` e `variants/**` desse bucket.
- `src/lib/images/upload.ts` envia original e quatro variantes para o mesmo bucket, mas monta URLs `/storage/v1/object/public/product-images/...`.
- Na investigação de 16/10/2026, o bucket estava privado e as quatro variantes da Blusa Tricô Cashmere existiam. A URL pública retornou HTTP 400 com `Bucket not found`; o Next retornou `upstream response is invalid`. O download permitido pela policy retornou HTTP 200 e um WebP válido de 800 × 800.

A policy de SELECT não habilita a rota de download de bucket público. A correção deve alinhar armazenamento e URLs, preservando a privacidade dos originais.

## 3. Abordagem escolhida e alternativas

**Recomendada:** criar o bucket público por uma nova migration Prisma, com as policies necessárias, e adaptar o serviço compartilhado de imagens. Copiar e verificar variantes existentes antes de atualizar suas URLs. Não editar migrations já aplicadas.

**Alternativa operacional:** criar o bucket manualmente no Dashboard e aplicar as mesmas policies. A migration continua sendo a fonte versionada e deve reconhecer uma configuração manual equivalente sem erro. Divergências de nome, visibilidade ou policies devem ser detectadas e resolvidas antes da troca das URLs. Apenas criar o bucket no Dashboard não conclui a correção.

URLs assinadas para o bucket atual não foram escolhidas: o objetivo é ter variantes públicas estáveis, inclusive para compartilhamento e OG. Tornar `product-images` público não atende ao requisito de manter originais privados.

## 4. Contrato de armazenamento

| Uso | Bucket | Visibilidade | Caminho |
| --- | --- | --- | --- |
| Original de produto ou categoria | `product-images` | Privado | `originals/{entityId}/{uuid}` |
| Miniatura | `product-image-variants` | Público | `variants/{entityId}/{uuid}-thumb.webp` |
| Card e capa de categoria | `product-image-variants` | Público | `variants/{entityId}/{uuid}-card.webp` |
| Detalhe | `product-image-variants` | Público | `variants/{entityId}/{uuid}-detail.webp` |
| Open Graph | `product-image-variants` | Público | `variants/{entityId}/{uuid}-og.webp` |

Preservar os caminhos atuais e o UUID compartilhado. `entityId` é o UUID do produto ou da categoria, conforme o código atual. O novo bucket recebe exclusivamente variantes WebP; nunca originais.

Preservar as validações atuais: tamanho máximo de upload de 8 MB, JPEG/PNG/WebP, lado mínimo de 800 px, rejeição de HEIC, orientação e geração das quatro variantes por `sharp`.

## 5. Acesso e segurança

- `product-images` permanece privado. Acesso a originais exige sessão e papel de staff validado por `public.is_staff()`.
- Novas escritas nesse bucket ficam restritas a `originals/**` para staff. Variantes legadas permanecem acessíveis para a transição controlada, sem liberar originais para `anon`.
- A migration adicional `20261017150000_prevent_image_bucket_changes` foi aplicada no DEV em 17/10; a repetição confirmou ausência de migrations pendentes. Seu trigger `SECURITY INVOKER` bloqueia troca de bucket envolvendo `product-images` ou `product-image-variants`, preservando UPDATE no mesmo bucket. A regressão passou de quatro falhas RED para matriz real GREEN 7/7 (quatro novas e três anteriores). O trigger vive no schema gerenciado pelo Supabase: manutenção futura do Storage e operações de movimentação entre buckets exigem revisão desta proteção.
- `product-image-variants` é público para download. INSERT, UPDATE e DELETE exigem `authenticated`, `public.is_staff()` e prefixo `variants/**`. UPDATE tem condições de origem e destino; não basta estar autenticado.
- O runtime usa o cliente Supabase da sessão para upload e remoção, como hoje. Não introduzir service role no browser nem no runtime da vitrine.
- Não criar policy anônima de listagem do bucket público sem necessidade. Download por URL pública é suficiente.
- Variantes de rascunhos continuam acessíveis a quem tiver a URL, conforme a decisão anterior de rascunho não secreto. Excluir ou despublicar um produto não revoga uma URL pública já conhecida nem caches externos.

Um bucket público permite baixar qualquer arquivo nele por URL; o prefixo não torna arquivos privados. A proteção dos originais depende de mantê-los no bucket privado.

## 6. Upload e referências no banco

Centralizar a escolha dos dois buckets em `src/lib/images/upload.ts`, sem adicionar configuração por cliente ou um novo serviço de imagens.

1. Validar e processar o arquivo no servidor.
2. Enviar o original para `product-images`.
3. Enviar as quatro variantes para `product-image-variants`, com `Content-Type: image/webp` e sem sobrescrever objetos existentes.
4. Somente depois dos cinco uploads confirmados, persistir a referência no banco.

`ProductImage.storagePath` e `Category.coverStoragePath` continuam representando o caminho do original privado. `thumbUrl`, `cardUrl`, `detailUrl`, `ogUrl` e `Category.coverImageUrl` passam a usar `/storage/v1/object/public/product-image-variants/...`. Não é necessária alteração das colunas Prisma.

Se um upload ou a persistência no banco falhar, não apresentar sucesso nem gravar referências incompletas. Tentar remover somente os objetos criados por aquela operação, aguardando o término dos uploads em andamento antes da compensação. Se a limpeza também falhar, registrar os identificadores técnicos necessários para limpeza manual, sem tokens, e preservar o erro principal.

As telas continuam consumindo as URLs salvas. Não contornar a falha com originais, chave no `src`, `unoptimized` global ou desativação de proteções do Next. O hostname Supabase já está permitido em `next.config.ts`; confirmar que as novas URLs passam pelas regras existentes.

## 7. Remoção e substituição

Os helpers atuais assumem um único bucket. Adaptá-los e atualizar todos os consumidores em ações de produtos e categorias para distinguir bucket e caminho. Usar as referências persistidas e os caminhos derivados conhecidos; não remover objetos de URLs arbitrárias ou de outro host.

- Remover uma foto deve limpar seu original privado e suas variantes públicas. Durante a compatibilidade, também considerar cópias legadas desse mesmo conjunto no bucket antigo.
- Remover foto e substituir capa não devem deixar uma referência ativa apontando para arquivos já removidos. Na remoção, desvincular a referência no banco antes da limpeza física; na substituição, persistir a nova capa antes de limpar a anterior.
- Se a gravação da nova capa falhar, manter a anterior e compensar os novos uploads. Se apenas a limpeza da capa anterior falhar, manter a nova capa válida e reportar a pendência sem desfazer a troca.
- Falha de limpeza após desvinculação deve ser distinguida de falha da alteração no banco, com indicação de limpeza pendente e registro técnico para atuação manual. Não há transação atômica entre Postgres e Storage.
- Soft delete e restauração de produtos/categorias continuam preservando arquivos.
- Caminhos de seed e URLs externas não devem provocar exclusão em Storage nem conversão automática para o novo bucket.

Não adicionar fila ou rotina automática de coleta de órfãos nesta entrega.

## 8. Transição das imagens existentes

Criar uma ferramenta operacional explícita, executada no servidor/terminal, com simulação como padrão e aplicação deliberada. Não executar cópia dentro da migration SQL nem durante uma requisição da aplicação.

### Inventário e preparação

Identificar `ProductImage` e capas de `Category`, incluindo rascunhos, itens inativos e lixeira. Selecionar apenas URLs do projeto Supabase esperado, do bucket antigo e do prefixo `variants/`. Preservar URLs externas, placeholders e referências já migradas. Enumerar objetos sem referência para relatório, sem apagá-los.

Antes da aplicação, salvar manifesto com IDs, URLs antigas/novas, caminhos, tamanho e SHA-256 dos arquivos de origem. Verificar destino correto, permissões e ausência de originais no bucket público. Em ambiente de cliente/produção, exigir backup completo, validação de restauração, simulação revisada e aprovação explícita do corte.

### Cópia e atualização

1. Copiar os bytes das variantes do bucket privado para o público, mantendo os caminhos. Utilizar a API de Storage; não manipular somente linhas de `storage.objects`.
2. Validar cada destino por download público sem credenciais: HTTP 200, WebP decodificável e SHA-256 igual à origem.
3. Se o destino já existir e for idêntico, reutilizá-lo. Se divergir, interromper aquele conjunto sem sobrescrever.
4. Atualizar as URLs de uma imagem de produto juntas, apenas quando suas quatro variantes estiverem verificadas. Para categorias, verificar todas as variantes do conjunto e atualizar a capa. Não alterar `storagePath` nem `coverStoragePath`.
5. Antes de atualizar, conferir que as referências ainda correspondem ao inventário; conflitos devem ser relatados, sem sobrescrever edições concorrentes.
6. Emitir contagens de elegíveis, copiados, verificados, atualizados, ignorados, conflitos e falhas. Reexecução não duplica nem corrompe arquivos.

Conjunto incompleto ou arquivo ausente bloqueia sua atualização e aparece no relatório. Regeneração de variantes ausentes não será automática nesta ferramenta.

### Corte e retorno

Pausar uploads, substituições e remoções de imagens durante o corte; a leitura do catálogo pode continuar. Provisionar o bucket/policies, copiar e verificar, disponibilizar o código compatível com os dois layouts e atualizar as referências. Retomar as mutações depois dos testes de carregamento e permissões.

Não apagar variantes legadas nem originais durante esta entrega. Um retorno de URLs usa o manifesto e atualização condicional, sem sobrescrever referências alteradas depois do corte. Isso restaura o estado anterior, incluindo a limitação conhecida de suas URLs públicas inválidas; não deve ser descrito como restauração de exibição funcional.

Após retomar uploads, existem arquivos novos apenas no bucket público: não voltar isoladamente ao código que assume um único bucket. Um retorno de aplicação deve manter suporte aos dois layouts ou exigir outro procedimento revisado. Não excluir o novo bucket no rollback automático.

## 9. Arquivos e contratos alcançados

- Nova migration em `prisma/migrations/`: bucket público e policies; preservar migrations históricas e o bucket privado.
- `src/lib/images/upload.ts`: upload, URL e limpeza por bucket; testes dos caminhos e das falhas.
- Ações de produtos e categorias: integração e tratamento das falhas de persistência/limpeza.
- Ferramenta de transição e seus testes: inventário, simulação, cópia, verificação e atualização condicional.
- `e2e/admin.spec.ts` e `e2e/vitrine.spec.ts`: confirmar carregamento real da fixture `public/images/clothes-placeholder-imagem.webp`, além da presença dos elementos.
- `README.md`: provisionamento por migration, alternativa manual equivalente, operação da transição e limites de retorno.

Auditar os consumidores de imagens de produtos, categorias, galeria, listagem admin e metadados OG. Reutilizar suas interfaces atuais; mudanças nesses componentes só se necessárias para consumir o contrato definido.

## 10. Critérios de aceite

1. Upload de produto e capa cria um original no bucket privado e quatro variantes no público.
2. Original falha em download sem credenciais, inclusive pela rota pública; staff mantém acesso permitido. Variantes retornam HTTP 200 sem cookies ou headers de autenticação.
3. `anon` e usuários sem papel de staff não conseguem escrever ou apagar nos buckets; owner e manager conseguem executar os fluxos autorizados.
4. Listagem e editor do admin, home/coleção, produto/galeria e capa de categoria carregam as imagens relevantes. OG aponta para uma variante pública acessível.
5. Testes no browser aguardam as imagens relevantes e verificam `complete === true` e `naturalWidth > 0`; presença do elemento não basta. Considerar lazy loading ao verificar imagens fora da tela.
6. A URL `/_next/image` de uma variante real responde HTTP 200 e conteúdo de imagem.
7. Remoção e substituição limpam os buckets corretos. Falhas parciais não destroem a capa ativa nem produzem confirmação falsa de sucesso completo.
8. Simulação da transição não escreve; aplicação verifica conteúdo antes de atualizar URLs; reexecução é segura; conflito não sobrescreve edição recente.
9. Registros existentes elegíveis, incluindo os da imagem investigada, funcionam depois da transição. URLs externas e seed permanecem preservados.
10. Executar testes de domínio afetados, lint, typecheck e fluxos E2E de imagens no DEV; registrar resultados e limites. Não executar testes destrutivos em projeto de cliente.

## 11. Fora de escopo

Redesign de telas, alteração do processamento `sharp`, HEIC, CDN adicional, bucket por cliente configurável, publicação condicionada das variantes, expiração de URLs, coleta automática de órfãos e remoção definitiva das cópias legadas.

Os placeholders SVG de home/categorias recusados pelo Next são um problema separado; não impedem diagnosticar ou validar as variantes WebP desta entrega.

## 12. Referências

- Migration base: `prisma/migrations/20260319160100_rls_extensions_storage/migration.sql`.
- Policies de staff: `prisma/migrations/20260922190000_admin_staff_rls/migration.sql`.
- Spec anterior: `docs/superpowers/specs/2026-09-21-admin-catalogo-design.md`.
- [Supabase — modelos de acesso de buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- [Supabase — controle de acesso no Storage](https://supabase.com/docs/guides/storage/security/access-control).

Implementação e acompanhamento: [plano aprovado](../plans/2026-10-16-separacao-buckets-imagens.md). Em 17/10, corte DEV concluído: 19 referências migradas e 41 externas preservadas; originais e variantes legadas mantidos. Migration adicional aplicada, matriz RLS real 7/7 PASS, `pnpm check` com 180 PASS/7 opt-in SKIP e 9 warnings preexistentes, typecheck e build aprovados. Apply, retorno, reapply e idempotência reais passaram; a idempotência verificou 76 variantes sem novas cópias ou updates. Browser: 11/11 cenários admin na rodada final e 8/8 vitrine na primeira rodada, sem mudança de runtime entre elas — 19 cenários distintos aprovados. Warnings SVG/hydration de baseline permanecem fora do escopo. Cliente/produção não executado; exige aprovação e preparação próprias.
