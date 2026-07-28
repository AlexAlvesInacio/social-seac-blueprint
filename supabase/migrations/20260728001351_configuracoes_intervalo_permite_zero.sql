-- Permite intervalo_minimo_dias = 0 (sem intervalo mínimo entre retiradas).
--
-- O CHECK original exigia > 0. Passa a exigir >= 0, para o administrador poder
-- desligar a regra de prazo (0 = nenhuma espera). A RPC de atendimento já lê este
-- valor de configuracoes e trata 0 naturalmente como "nunca bloqueia por prazo"
-- (now() - 0 dias = agora; a última retirada nunca é > agora). limite_extra segue
-- exigindo > 0.

alter table public.configuracoes
  drop constraint if exists configuracoes_intervalo_positivo_check;

alter table public.configuracoes
  add constraint configuracoes_intervalo_nao_negativo_check
  check (intervalo_minimo_dias >= 0);
