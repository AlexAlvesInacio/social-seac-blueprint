# Status de implementação

Avaliação baseada no código atual. “Homologado” em documentos anteriores pode
significar experiência visual ou funcionamento local, não produção.

| Área | Classificação | Evidência e limite atual |
| --- | --- | --- |
| Login | Protótipo visual | `/auth` apenas navega ao painel; não chama o serviço Supabase. |
| Usuários | Protótipo visual | Tabela vazia e botões sem persistência ou autorização real. |
| Famílias | Funcional apenas localmente | CRUD parcial em Zustand/localStorage com dados seed. |
| Assistidos | Funcional apenas localmente | Inclusão e consulta no store local; sem banco/RLS. |
| Membros | Funcional apenas localmente | Inclusão, faixa etária e vínculo no store local. |
| Atendimento | Implementação parcial local | Busca, elegibilidade, entregas e bloqueios funcionam em stores locais; admin é simulado e os botões de pré-cadastro da busca sem resultado apenas exibem mensagens, sem persistir. |
| Estoque | Implementação parcial local | Entrega confirmada reduz o saldo local do benefício; bases complementares são estáticas, diálogos de entrada/saída/ajuste não salvam e não há persistência real. |
| Recebimentos | Protótipo visual | KPIs, formulário e histórico estáticos; salvar não persiste nem movimenta estoque. |
| Auditoria | Funcional apenas localmente | Eventos Zustand/localStorage; pode ser limpa pela interface, portanto não é imutável. |
| Relatórios | Funcional apenas localmente | Gera tabelas/CSV de stores e bases estáticas locais. |
| Painel | Funcional apenas localmente | Consolida stores locais e algumas bases estáticas. |
| Supabase | Não implementado funcionalmente | Fundação de cliente/auth existe, mas sem schema, migrations, conexão aos fluxos ou dados remotos. |
| Segurança | Não implementado | Sem proteção de rotas, RLS, autorização real, política de backup ou auditoria imutável. |
| Testes | Não implementado | Não há script ou suíte automatizada de testes no projeto. |

## Divergências relevantes

- `HOMOLOGACAO_SEAC_SOCIAL.md` descreve login do administrador, usuários
  pendentes/inativos e logout como homologados, mas o código atual não
  implementa autenticação.
- O mesmo documento descreve recebimentos aumentando estoque; a tela atual é
  estática e informa que a entrada efetiva será controlada posteriormente.
- Estoque é descrito como funcional para entradas, saídas e ajustes, porém os
  botões de salvar dos diálogos apenas os fecham.
- A documentação de Atendimento prevê pré-cadastro com e sem entrega, mas os
  botões exibidos após busca sem resultado atualmente apenas mostram mensagens.
- A documentação anterior usa “dados reais” para dados dos stores locais. Eles
  são reais apenas dentro da sessão/localStorage do protótipo, não em banco.
- Perfis aprovados aparecem como `admin`, `atendente`, `estoque`, `pendente`,
  misturando papel e estado. A fundação nova separa papéis
  `administrador/atendente/estoque` de status `pendente/ativo/inativo`.
- `docs/11_FUNDACAO_SUPABASE.md` comprova que há fundação técnica, mas também
  declara corretamente que autenticação, tabelas, RLS e módulos não foram
  integrados.
