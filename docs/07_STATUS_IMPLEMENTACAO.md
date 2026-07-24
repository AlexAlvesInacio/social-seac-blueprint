# Status de implementação

Avaliação baseada no código atual (atualizado em 2026-07-23, após a migração do
domínio de famílias para o Supabase — PRs #10 a #17). “Homologado” em documentos
anteriores pode significar experiência visual ou funcionamento local, não produção.

> **Nota (2026-07-24):** a tabela abaixo ainda descreve estoque, recebimentos,
> relatórios e painel como “local/protótipo”, mas as PRs #23–#27 já migraram
> essas fatias para o Supabase (estoque de benefícios + ledger, recebimentos,
> relatórios lendo do banco, painel repintado e, na #27, itens de estoque,
> composição de cesta e montagem). A reconciliação da tabela está pendente; os
> achados de revisão da #27 registrados na seção de riscos referem-se a essas
> fatias novas.

| Área | Classificação | Evidência e limite atual |
| --- | --- | --- |
| Login | Implementado (Supabase Auth) | `/auth` chama `signIn` real, valida sessão e status (`pendente`/`inativo`), e protege rotas via `RequireActiveProfile`. |
| Usuários | Implementado (Supabase) | Fluxo administrativo por RPC (`aprovar_usuario`, `inativar_usuario`, `alterar_papel_usuario`) com RLS em `profiles`. |
| Famílias | Migrado ao Supabase (leitura + escrita) | Schema + RLS + RPCs. Lista (com fallback ao store local) e detalhe por UUID; criação e edição de família e edição do responsável via RPC. O store local ainda coexiste (dual-source) até homologação. |
| Assistidos | Migrado ao Supabase (criação + leitura) | Criação via `criar_assistido_em_familia` no detalhe remoto; leitura no agregado da família. |
| Membros | Migrado ao Supabase (criação + leitura) | Criação via `criar_membro_em_familia`; leitura no agregado. Faixa etária calculada em leitura. |
| Observações sociais | Migrado ao Supabase | Registro por INSERT (policy de equipe ativa) e leitura no detalhe remoto. |
| Atendimento | Migrado ao Supabase | Tabelas `entregas` e `tentativas_bloqueadas` + RPCs `registrar_entrega_atendimento`/`registrar_tentativa_bloqueada` (migration `20260723233626`). Enforcement server-side dos 25 dias (SEAC2), 3 extras (SEAC1) e estoque (SEAC3); liberação excepcional só admin+motivo. A tela `/atendimento` e o histórico da família (entregas + tentativas) leem do Supabase. `atendimento-regras.ts` (client) é só exibição. A entrega gera baixa automática no ledger `movimentacoes_estoque` (motivo "Baixa automática", vínculo `entrega_id`; migration `20260724220332`). `registrar_entrega_atendimento` retorna status estruturado e grava a tentativa bloqueada (prazo/estoque/extra) atomicamente no mesmo passo (migrations `20260724221321`/`20260724221323`). Pendência: pré-cadastro não persistido. |
| Estoque | Implementação parcial local | Entrega confirmada reduz o saldo local; bases complementares estáticas; diálogos de entrada/saída/ajuste não persistem. Sem tabela no Supabase. |
| Recebimentos | Protótipo visual | KPIs, formulário e histórico estáticos; salvar não persiste nem movimenta estoque. |
| Auditoria | Funcional apenas localmente | Módulo de auditoria em Zustand/localStorage, mutável pela interface. As tabelas de famílias no banco têm autoria por trigger, mas não há trilha imutável do módulo de Auditoria. |
| Relatórios | Funcional apenas localmente | Gera tabelas/CSV de stores e bases estáticas locais. |
| Painel | Funcional apenas localmente | Consolida stores locais e algumas bases estáticas. |
| Supabase | Implementado para auth e famílias | Cliente, migrations versionadas, RLS e RPCs cobrindo `profiles` e o domínio de famílias (`familias`, `pessoas`, `membros_familiares`, `assistidos`, `observacoes_sociais`). Atendimento, estoque, recebimentos e relatórios ainda não têm backend. |
| Segurança | Parcial | RLS em todas as tabelas expostas; RPCs de escrita `SECURITY INVOKER`; `SECURITY DEFINER` só em bootstrap/triggers com `search_path=''`; proteção de rota por perfil ativo; autoria/timestamps por trigger. Faltam: backup testado, auditoria imutável do módulo Auditoria e enforcement das regras de atendimento/estoque no banco. |
| Testes | Não implementado | Sem suíte automatizada. A migração de famílias foi validada por build, `typecheck` e testes manuais end-to-end (navegador headless). |

## Divergências e riscos relevantes

- **Fonte de verdade dupla (dual-source).** `familias.index.tsx` usa Supabase
  quando há linhas e cai para o store local caso contrário; `familias.$id.tsx`
  resolve o detalhe por UUID (Supabase) ou por id numérico (store local). É
  intencional durante a migração, mas o store local só deve ser removido após
  homologação explícita.
- **Regras críticas já têm enforcement server-side.** O bloqueio dos 25 dias, o
  limite de extras e o de falta de estoque são aplicados nas RPCs de atendimento
  (`registrar_entrega_atendimento`), não mais burláveis pelo cliente. O
  `atendimento-regras.ts` (client) é só exibição. Resíduo legado: o store
  `atendimento-store.ts` (localStorage) não recebe mais escritas, mas ainda é lido
  pelo caminho local de detalhe de família (`FamiliaLocalDetail`, id numérico) —
  sua remoção fica adiada para quando o `familias-store` local for aposentado.
- **Escopo pendente em famílias.** Reuso/transferência de pessoa existente
  (as RPCs recusam documento duplicado), vínculo de observação a pessoa/assistido
  específico e exibição do nome do autor (hoje UUID do perfil).
- **Documentos antigos.** `HOMOLOGACAO_SEAC_SOCIAL.md` e afins descrevem como
  “homologado” comportamentos que eram apenas locais; tratar este arquivo como a
  fonte de status corrente.
- **Papéis vs. status.** Perfis usam papéis `administrador/atendente/estoque`
  separados dos status `pendente/ativo/inativo` (não confundir as duas colunas).

## Achados da revisão da PR #27 (itens/composição/montagem) — 2026-07-24

Registrados aqui como dívida para fatias futuras (nenhum bloqueou o merge da #27;
a lógica de negócio crítica roda no servidor, transacional, com backstop `SEAI1`).

- **[Corrigido na #27] Deadlock em montagens concorrentes.** `public.montar_cesta`
  adquiria os locks (`FOR UPDATE`) dos itens em ordem não determinística. Resolvido
  pela migration `20260724213726_montar_cesta_order_by_deadlock.sql`
  (`order by c.item_id` no loop). Sem pendência.

- **[A decidir] Papel `estoque` não acessa o estoque de itens.** As tabelas
  `itens_estoque`, `movimentacoes_itens` e `composicao_beneficio` e suas RPCs
  (`registrar_movimentacao_item`, `definir_composicao_beneficio`, `montar_cesta`)
  usam o predicado `private.usuario_atual_pode_gerir_familias()`, que só admite
  `administrador` e `atendente` — o papel `estoque` é recusado. É consistente com
  as fatias #23–#26, mas semanticamente estranho (o papel chamado `estoque` não
  movimenta estoque). Se o acesso do papel `estoque` for desejado, criar um
  predicado dedicado (ex.: `private.usuario_atual_pode_gerir_estoque()`).

- **[Dívida sistêmica] Ledger de itens burlável por `UPDATE` direto no `saldo`.**
  `grant update on public.itens_estoque to authenticated` + a policy de update
  permitem alterar `saldo` diretamente, sem gravar em `movimentacoes_itens` —
  furando a integridade do ledger insert-only. Não é regressão da #27: o mesmo
  padrão já existe em `public.beneficios` (homologado). Mitigável com grant por
  coluna (excluir `saldo`) ou revogando `UPDATE` e forçando toda escrita de saldo
  via RPC. Vale um passo transversal cobrindo os dois estoques.

- **[Convenção] `src/lib/familias/familias-repository.ts` virou catch-all
  (~1776 linhas).** Além de famílias, hospeda estoque, benefícios, recebimentos e
  agora itens/composição/montagem. O padrão-alvo é uma pasta por domínio
  (`src/lib/relatorios/` já existe). Introduzido nas fatias #23–#26, não na #27;
  candidato a extração de `src/lib/estoque/` numa fatia futura.
