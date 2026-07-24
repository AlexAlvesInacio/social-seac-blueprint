-- Categoria "extra" para tentativas bloqueadas (cadastro extra que já completou o
-- limite de retiradas — cenário `extra_completou`). Até aqui o enum só tinha
-- 'prazo' e 'estoque', sem como categorizar o bloqueio SEAC1.
--
-- ADD VALUE precisa estar committado antes de ser usado; por isso vive numa
-- migration própria, separada da função que o referencia (20260724221323).

alter type public.tentativa_motivo add value if not exists 'extra';
