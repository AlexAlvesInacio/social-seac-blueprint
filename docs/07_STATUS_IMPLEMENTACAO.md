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
| Segurança | Boa, com pendências | RLS em todas as tabelas expostas; RPCs de escrita `SECURITY INVOKER` com `search_path=''`; autoria/timestamps por trigger; enforcement das regras de atendimento no banco; ledger de saldo não-burlável (trigger + flag transacional); papel `estoque` habilitado no domínio de estoque. Faltam: backup testado e suíte de testes. |
| Testes | Não implementado | Sem suíte automatizada. Validação por `bun run lint` + `bun run build` e testes manuais. |

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

## Achados da revisão da PR #27 (itens/composição/montagem) — situação atual

- **[Corrigido] Deadlock em montagens concorrentes.** `montar_cesta` recebeu
  `order by c.item_id` (migration `20260724213726`).
- **[Resolvido — tarefa 4] Papel `estoque` não acessava o estoque.** Novo predicado
  `private.usuario_atual_pode_gerir_estoque()` (admin + atendente + estoque) aplicado
  às RLS/RPCs de estoque, itens, composição e recebimentos.
- **[Resolvido — tarefa 3] Ledger burlável por `UPDATE` direto no saldo.** Trigger
  `private.impedir_alteracao_saldo_direta()` em `beneficios`/`itens_estoque` bloqueia
  alteração de `saldo` fora das RPCs (flag transacional `seac.saldo_via_rpc`).
- **[Dívida — aberta] `src/lib/familias/familias-repository.ts` catch-all.** Continua
  hospedando famílias + estoque + recebimentos + atendimento. O padrão-alvo é uma
  pasta por domínio (ex.: `src/lib/auditoria/`, `src/lib/configuracoes/` já existem);
  extrair `src/lib/estoque/` segue como dívida de organização.
