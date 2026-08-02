-- Fecha o achado SEG-2 da security review geral (issue #79): o motor de regras
-- do atendimento era opcional.
--
-- `grant insert on public.entregas to authenticated` + a policy "Equipe ativa
-- insere entregas" (with check apenas usuario_atual_pode_gerir_familias())
-- permitiam que um atendente ativo gravasse uma entrega direto pelo PostgREST.
-- Todas as regras — 25 dias, limite de 3 retiradas extras, bloqueio por
-- estoque, liberação excepcional só por administrador com motivo — vivem dentro
-- do corpo de registrar_entrega_atendimento, e nada obrigava a escrita a passar
-- por lá. A entrega forjada ainda contaminava a leitura: elegibilidade,
-- enforcement server-side e o histórico de estoque (que sintetiza entrega sem
-- ledger como "Baixa automática") passam a divergir do saldo real.
--
-- A correção repete o padrão que já protege o saldo (20260725003804): um
-- trigger exige um flag transacional que só as RPCs ligam. A diferença é como o
-- flag é ligado — aqui usamos `alter function ... set`, que aplica o parâmetro
-- na entrada da função e o restaura na saída, em vez de um `set_config` no
-- corpo. Isso evita reescrever três corpos grandes de RPC só para inserir uma
-- linha (risco alto de divergência) e ainda fecha a janela do flag mais cedo do
-- que `set_config(..., is_local => true)`, que valeria até o fim da transação.

-- ============================================================================
-- 1) Trigger: entregas e tentativas só nascem dentro das RPCs
-- ============================================================================

create function private.impedir_registro_atendimento_direto()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(current_setting('seac.atendimento_via_rpc', true), '') <> 'on' then
    raise exception
      'Entregas e tentativas só podem ser registradas pelas funções de atendimento (que aplicam prazo, limite extra e estoque).'
      using errcode = 'SEAS2';
  end if;
  return new;
end;
$$;

comment on function private.impedir_registro_atendimento_direto() is
  'Bloqueia INSERT direto em entregas/tentativas_bloqueadas; só permite quando o flag seac.atendimento_via_rpc está ligado (setado por alter function nas RPCs de atendimento).';

create trigger entregas_somente_via_rpc
before insert on public.entregas
for each row execute function private.impedir_registro_atendimento_direto();

create trigger tentativas_somente_via_rpc
before insert on public.tentativas_bloqueadas
for each row execute function private.impedir_registro_atendimento_direto();

-- ============================================================================
-- 2) As três RPCs que gravam nessas tabelas ligam o flag
-- ============================================================================
-- O `set` vale só durante a execução da função, inclusive nos triggers que ela
-- dispara, e é restaurado na saída — mesmo mecanismo do `set search_path = ''`
-- já usado em todas as funções do projeto. Os corpos não mudam.
--
-- Estas são as únicas funções que inserem em entregas/tentativas_bloqueadas no
-- estado atual do schema; qualquer RPC nova que grave nessas tabelas precisa do
-- mesmo `alter function`, senão o próprio trigger a rejeita (falha explícita, e
-- não silenciosa).

alter function public.registrar_entrega_atendimento(uuid, boolean, text)
  set seac.atendimento_via_rpc = 'on';

alter function public.registrar_tentativa_bloqueada(uuid, public.tentativa_motivo, text)
  set seac.atendimento_via_rpc = 'on';

alter function public.criar_pre_cadastro(
  text, public.pessoa_tipo_documento, text, text, date, boolean, boolean, text, uuid
) set seac.atendimento_via_rpc = 'on';
