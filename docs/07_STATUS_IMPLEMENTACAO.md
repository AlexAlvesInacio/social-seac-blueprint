# Status de implementação

Avaliação baseada no código atual (reconciliado em 2026-07-26). Cobre a migração do
protótipo (Zustand/localStorage) para o Supabase, concluída módulo a módulo nas PRs
#10–#40. “Homologado” em documentos antigos pode significar apenas experiência visual
ou funcionamento local — este arquivo é a fonte de status corrente.

| Área | Classificação | Evidência e limite atual |
| --- | --- | --- |
| Login | Implementado (Supabase Auth) | `/auth` chama `signIn` real, valida sessão e status (`pendente`/`inativo`), e protege rotas via `RequireActiveProfile`. |
| Usuários | Implementado (Supabase) | Fluxo administrativo por RPC (`aprovar_usuario`, `inativar_usuario`, `alterar_papel_usuario`) com RLS em `profiles`. |
| Famílias | Supabase-only | Schema + RLS + RPCs; criação/edição de família e do responsável. A criação (`criar_familia_com_responsavel`) passou a cadastrar o responsável **também como assistido** (tipo definitivo/extra) na mesma transação — regra registrada em `REGRAS_APROVADAS_SEAC_SOCIAL.md` §1. O dual-source foi aposentado em 2026-07-30: lista, detalhe e cadastros usam exclusivamente o Supabase; `familias-store`, `atendimento-store` e os dialogs locais foram removidos, e os helpers de faixa etária migraram para `src/lib/familias/faixa-etaria.ts`. |
| Assistidos | Migrado ao Supabase | Criação via `criar_assistido_em_familia` (com reuso de pessoa existente, `p_pessoa_id`) e leitura no agregado da família. Avaliação manual no atendimento (estado "Extra completou"): aprovar (`aprovar_assistido_definitivo`, Extra → Definitivo) ou negar (`inativar_assistido`). |
| Membros | Migrado ao Supabase | Criação via `criar_membro_em_familia` (com reuso de pessoa) e leitura no agregado. |
| Observações sociais | Migrado ao Supabase | Registro por INSERT (policy de equipe ativa); leitura no detalhe, com nome do autor resolvido via `profiles.nome_completo`. |
| Atendimento | Migrado ao Supabase | `entregas`/`tentativas_bloqueadas` + `registrar_entrega_atendimento` (retorno estruturado; grava a tentativa — prazo/estoque/extra — atomicamente) e `registrar_tentativa_bloqueada`. Enforcement server-side de 25 dias/limite extra (lidos de `configuracoes`) e estoque; liberação excepcional só admin+motivo; baixa automática no ledger; pré-cadastro persistido (`criar_pre_cadastro`). |
| Estoque (benefícios) | Migrado ao Supabase | `beneficios.saldo` real + ledger `movimentacoes_estoque`; entrada/saída/ajuste via `registrar_movimentacao_estoque`. Saldo só muda via RPC (trigger de proteção do ledger). |
| Itens / Composição / Montagem | Migrado ao Supabase | `itens_estoque` + ledger `movimentacoes_itens`; `composicao_beneficio`; `montar_cesta` transacional. Saldo protegido por trigger. |
| Recebimentos | Migrado ao Supabase | `criar_recebimento` (cabeçalho + itens). Itens vinculados ao catálogo (`recebimento_itens.item_id`) geram entrada no estoque. |
| Painel | Migrado ao Supabase | Consolida estoque, entregas e demografia lidos do Supabase. |
| Relatórios | Migrado ao Supabase | 10+ tipos + CSV lendo do Supabase, incluindo bloqueios por prazo/estoque/extra. |
| Auditoria | Migrado ao Supabase (imutável) | Tabela `auditoria_eventos` append-only (só SELECT/INSERT; sem UPDATE/DELETE). A tela lê do banco, resolve o autor e não permite limpar o histórico. |
| Configurações | Migrado ao Supabase | Os **parâmetros de regra** (`configuracoes`: 25 dias, limite extra, etc.) estão no banco e são autoritativos no atendimento (admin edita). Em 2026-07-30, os cadastros auxiliares migraram por completo: unidades/categorias/doadores/fornecedores em tabelas próprias (migration `20260731004140`; RLS: equipe de estoque consulta, só admin altera) e as abas Itens/Benefícios religadas às tabelas reais `itens_estoque`/`beneficios` (migration `20260731005549`: campos de cadastro tipo/observacao, normalização de categoria/unidade e policies de insert/delete). Camada em `src/lib/cadastros/`; `config-store` foi removido. |
| Supabase | Implementado nos domínios ativos | Cliente, migrations versionadas, RLS e RPCs cobrindo profiles, famílias/pessoas/membros/assistidos/observações, atendimento/entregas/tentativas, benefícios+itens+composição+movimentações, recebimentos, configurações e auditoria. |
| Segurança | Revisada e endurecida (2026-08-02) | RLS em todas as tabelas expostas; RPCs de escrita `SECURITY INVOKER` com `search_path=''`; autoria/timestamps por trigger. A security review geral (#45) achou e corrigiu quatro pontos, **todos verificados no banco de produção e não apenas no código**: saldo não pode nascer inflado no INSERT (#78), entregas/tentativas só nascem nas RPCs de atendimento (#79), CSV de relatórios neutraliza fórmulas (#80) e os grants padrão do Supabase foram revogados de `authenticated` em 15 tabelas (#86). Faltam: restauração testada (#44) e suíte de testes de componentes. |
| Testes | Parcial (lógica pura) | `bun test` cobre as regras de atendimento, a lógica de relatórios (incluindo a neutralização de fórmula no CSV), as faixas etárias oficiais e o mapper de famílias (48 testes em 2026-08-02). Sem testes de componentes/hooks/Supabase; validação de UI segue por `bun run lint` + `bun run build` e homologação manual. |
| Dados | **Carregados da planilha legada (2026-08-02)** | 1.018 pessoas e famílias, 4.170 entregas com data real (11/01 a 02/08/2026), 875 assistidos definitivos e 143 extra, importados de `CESTAS SEAC 2026.xlsx` por `scripts/importar-planilha.py`. A importação é idempotente pela chave `origem_externa`; 48 linhas ficaram de fora e estão no relatório de rejeitados. **O estoque segue zerado** — a planilha não tem inventário, e a carga inicial depende da contagem física (procedimento em `12_RUNBOOK_OPERACAO.md`). Análise da fonte em `13_IMPORTACAO_PLANILHA_LEGADA.md`. |

## Divergências e riscos relevantes

- **[Resolvido — 2026-07-30] Protótipo local de famílias (dual-source) aposentado.**
  `familias.index.tsx` e `familias.$id.tsx` são Supabase-only; ids numéricos no
  detalhe mostram mensagem de identificador inválido. `familias-store.ts`,
  `atendimento-store.ts` e `familia-detail-dialogs.tsx` foram removidos (era o
  follow-up da tarefa 9). A coluna "Progresso Extra" saiu da lista — o dado era
  exclusivo do protótipo local e nunca existiu no read model remoto.
- **Transferência de pessoa entre famílias ativas.** O reuso de pessoa existente já
  funciona (`p_pessoa_id`); a transferência (pessoa já ativa em outra família) ainda
  não — o cadastro avisa e recusa (`SEAP1`).
- **Vínculo de observação a pessoa/assistido específico.** A observação social é da
  família; ligá-la a uma pessoa/assistido específico continua pendente.
- **[Resolvido — 2026-07-30] Cadastros auxiliares consolidados no Supabase.**
  `config-store.ts` foi removido: unidades/categorias/doadores/fornecedores têm
  tabelas próprias e as abas Itens/Benefícios editam `itens_estoque`/`beneficios`
  diretamente (saldo continua protegido — só muda via RPCs de movimentação).
  Convenção nova: `itens_estoque.categoria`/`unidade` guardam o **nome** do
  cadastro auxiliar (ex.: "Alimentos", "Pacote"); os seeds antigos foram
  normalizados na migration `20260731005549`.
- **Papéis vs. status.** Perfis usam papéis `administrador/atendente/estoque`
  separados dos status `pendente/ativo/inativo` (não confundir as duas colunas).
- **[2026-08-02] A API do Supabase tem dois tetos que só aparecem com volume.**
  `max_rows = 1000` corta respostas em silêncio, e a URL tem limite de tamanho:
  500 ids num `.in()` passam, 1.000 devolvem HTTP 400. Toda consulta que possa
  crescer precisa paginar por `range` e quebrar os filtros em lotes — há
  helpers em `familias-repository.ts` (`todasAsPaginas`, `porLotesDeIds`).
  Foi o que derrubou Painel e Famílias depois da importação.
- **[2026-08-02] A lista de famílias carrega o agregado inteiro.** Filtros e
  paginação são no cliente; funcionam, mas a tela baixa ~4.000 linhas a cada
  abertura. A paginação no servidor está registrada na issue #107.
- **[2026-08-02] Saldo só entra por movimentação, nunca por `update`.** Depois
  da migration `20260802143000`, `update ... set saldo` é recusado com `SEAS1` e
  item novo nasce obrigatoriamente com saldo 0. Isso muda o procedimento de
  carga de estoque: não existe mais "corrigir o saldo no banco", existe lançar
  um **Ajuste** (que define o saldo alvo absoluto e grava o delta no ledger).
  Vale para a carga inicial e para qualquer inventário posterior.
- **[2026-08-02] Tabela nova nasce sem grant.** A `20260802170000` removeu o
  `alter default privileges` que concedia tudo a `anon` e `authenticated`. Toda
  migration que criar tabela precisa conceder explicitamente o que aquela tabela
  usa, senão a aplicação falha no primeiro acesso. É intencional: o modo de
  falha passou de silencioso (tabela aberta) para barulhento (tabela fechada).

## Achados da revisão da PR #27 (itens/composição/montagem) — situação atual

- **[Corrigido] Deadlock em montagens concorrentes.** `montar_cesta` recebeu
  `order by c.item_id` (migration `20260724213726`).
- **[Resolvido — tarefa 4] Papel `estoque` não acessava o estoque.** Novo predicado
  `private.usuario_atual_pode_gerir_estoque()` (admin + atendente + estoque) aplicado
  às RLS/RPCs de estoque, itens, composição e recebimentos.
- **[Resolvido — tarefa 3] Ledger burlável por `UPDATE` direto no saldo.** Trigger
  `private.impedir_alteracao_saldo_direta()` em `beneficios`/`itens_estoque` bloqueia
  alteração de `saldo` fora das RPCs (flag transacional `seac.saldo_via_rpc`).
- **[Resolvido — 2026-08-02, issue #78] O mesmo ledger era burlável no `INSERT`.**
  A security review geral achou que o trigger acima só cobria `UPDATE`, então um
  registro de catálogo podia *nascer* com saldo arbitrário e, via
  `definir_composicao_beneficio` + `montar_cesta`, virar saldo real de Cesta Padrão.
  A migration `20260802143000` estende o trigger para `before insert or update`
  (todo registro nasce com saldo 0), tira `saldo` do grant de INSERT do cliente e
  dá aos benefícios do motor de regras um `codigo` imutável, protegido contra
  rename/exclusão — o nome é parte do contrato porque as RPCs de atendimento
  resolvem Cesta Padrão/Extra por nome.
- **[Resolvido — 2026-08-02, issue #79] Motor de regras do atendimento era
  opcional.** A security review geral achou que `entregas`/`tentativas_bloqueadas`
  aceitavam INSERT direto pelo PostgREST, contornando prazo de 25 dias, limite de
  extras, bloqueio por estoque e a exigência de administrador+motivo na liberação
  excepcional. A migration `20260802150000` cria o trigger
  `private.impedir_registro_atendimento_direto()` (flag `seac.atendimento_via_rpc`),
  ligado nas três RPCs de atendimento por `alter function ... set`. Toda RPC nova
  que grave nessas tabelas precisa do mesmo `alter function`.
- **[Resolvido — 2026-08-02, issue #80] CSV de relatórios não neutralizava
  fórmulas.** `csvEscape` tratava só `;`, aspas e quebras de linha, então uma
  célula começando com `=`, `+`, `-`, `@` ou tab era avaliada pelo Excel/Calc
  (CWE-1236) — um nome de família ou observação virava fórmula na máquina de
  quem exporta. Agora essas células recebem apóstrofo antes do envelopamento;
  números seguem numéricos.
- **[Resolvido em parte — 2026-07-31] `familias-repository.ts` catch-all.** O domínio
  de estoque foi extraído para `src/lib/estoque/` (repositório + hooks + query keys
  próprias; benefícios, itens, movimentações, composição e montagem). O repositório
  de famílias caiu de ~2150 para ~1660 linhas e ainda hospeda recebimentos e as
  consultas de atendimento/painel — extrações futuras seguem o mesmo padrão. Os
  tipos de leitura/erro continuam compartilhados em `familias-supabase-types.ts`.
