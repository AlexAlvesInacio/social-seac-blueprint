# Roadmap

## Sprint 0 — Documentação e fundação

- Objetivo: consolidar regras, arquitetura, segurança e status real.
- Entregáveis: conhecimento central, documentos técnicos e fundação isolada.
- Aceite: documentos coerentes com código e regras; lint/build diagnosticados.
- Fora do escopo: integração funcional e migrações.

## Sprint 1 — Supabase e autenticação

- Objetivo: identidade, sessão e perfis reais.
- Entregáveis: projeto configurado, migrations de perfis, RLS, login/logout,
  recuperação de senha, aprovação e proteção de rotas.
- Aceite: papéis/status validados no banco e testes de acesso negativo.
- Fora do escopo: migração dos módulos operacionais.

## Sprint 2 — Famílias e assistidos

- Objetivo: substituir persistência local dos cadastros centrais.
- Entregáveis: famílias, assistidos, membros e observações no banco, serviços e
  validação de duplicidade.
- Aceite: fluxos homologados preservados, RLS e migração testadas.
- Fora do escopo: entrega e estoque remotos.

## Sprint 3 — Atendimento

- Objetivo: elegibilidade, bloqueios e entregas persistentes.
- Entregáveis: serviços transacionais, histórico, exceções e auditoria.
- Aceite: cenários oficiais testados, inclusive concorrência e idempotência.
- Fora do escopo: recebimentos e relatórios finais.

## Sprint 4 — Estoque

- Objetivo: saldo confiável e movimentações rastreáveis.
- Entregáveis: itens, benefícios, composição, entradas, saídas, ajustes e baixas.
- Aceite: nenhum saldo negativo; entrega e montagem transacionais.
- Fora do escopo: nota fiscal eletrônica e lotes/validade.

## Sprint 5 — Recebimentos e relatórios

- Objetivo: registrar origens e consultar dados consolidados reais.
- Entregáveis: recebimentos/itens, entradas vinculadas, relatórios e CSV.
- Aceite: filtros e totais conferidos; exportações auditadas.
- Fora do escopo: PDF e Excel nativo, salvo nova aprovação.

## Sprint 6 — Testes, segurança e publicação

- Objetivo: elevar o sistema de homologação para operação segura.
- Entregáveis: testes, revisão RLS/LGPD, backup, observabilidade e runbook.
- Aceite: checklist de produção, restauração testada e homologação final.
- Fora do escopo: novas funcionalidades não necessárias à publicação.

