# Conhecimento oficial — SEAC Social

## Identidade e objetivos

O **SEAC Social** é o sistema de apoio à operação social do SEAC — Sopa,
Esperança, Amor e Caridade. Seu objetivo social é organizar o atendimento com
respeito, continuidade e rastreabilidade. Seu objetivo operacional é reunir o
cadastro de famílias e pessoas, a análise de elegibilidade, a entrega de
benefícios, o estoque e o histórico em um fluxo único.

O público atendido é formado por famílias acompanhadas pelo SEAC, seus
responsáveis, assistidos autorizados a receber benefícios e demais membros
familiares. Os usuários internos previstos são administradores, atendentes e
responsáveis pelo estoque.

## Fluxo principal

Família → Assistido → Membro familiar → Atendimento → Entrega → Estoque →
Histórico → Painel.

## Conceitos oficiais

- **Família:** núcleo cadastral acompanhado pelo SEAC.
- **Responsável:** pessoa de referência da família; conta como morador.
- **Assistido:** pessoa habilitada a passar pelo atendimento e receber benefício.
- **Membro familiar:** integrante do núcleo; pode não ser assistido.
- **Cadastro definitivo:** cadastro aprovado, associado à Cesta Padrão.
- **Cadastro extra/em avaliação:** cadastro provisório, associado à Cesta Extra.
- **Cesta Padrão:** benefício do cadastro definitivo.
- **Cesta Extra:** benefício temporário, limitado a três retiradas acompanhadas.
- **Tentativa bloqueada:** atendimento impedido por prazo ou falta de estoque,
  que ainda deve ser registrado.
- **Liberação excepcional:** entrega antes do prazo, permitida somente a
  administrador, com motivo obrigatório; nunca contorna falta de estoque.

## Regras não negociáveis

- O responsável conta como morador.
- Evitar duplicidade por CPF, RG ou outro documento.
- Somente assistidos recebem benefícios; membro familiar não é automaticamente
  assistido.
- O intervalo mínimo entre retiradas é de 25 dias.
- Cadastro extra pode realizar até três retiradas de Cesta Extra.
- O sistema não converte automaticamente cadastro extra em definitivo.
- Falta de estoque bloqueia a entrega sem liberação excepcional.
- Liberação excepcional é exclusiva de administrador e exige motivo.
- Toda tentativa gera histórico; ações relevantes geram auditoria.
- Entrega confirmada gera movimento do tipo **“Baixa automática”**, com origem
  **“Entrega realizada”**, no benefício em estoque.
- O alerta após 45 dias é informativo.
- O contato necessário após 90 dias é informativo e não inativa automaticamente.

## Atendimento — estados e registros obrigatórios

- Antes de qualquer busca, exibir **“Nenhuma busca realizada”**.
- Após busca sem resultado, exibir **“Nenhum assistido encontrado para os dados
  informados.”** e oferecer criação de pré-cadastro, com ou sem primeira entrega
  de Cesta Extra, sempre respeitando o estoque.
- Com resultado, a função central `verificarElegibilidadeAtendimento` determina
  um dos cenários: `liberado_padrao`, `liberado_extra`, `bloqueio_25dias`,
  `bloqueio_estoque` ou `extra_completou`.
- Bloqueio por prazo informa próxima data e dias restantes; pode ter liberação
  excepcional por administrador, com motivo.
- Bloqueio por estoque permite somente registrar a tentativa bloqueada.
- Cadastro extra que completou três retiradas aguarda avaliação e não é
  convertido automaticamente.
- O accordion “Regras e fluxo” é somente explicativo; a regra executável está
  na função central.

Pré-cadastro pode se referir a nova família ou novo assistido. Quando for
implementado de forma persistente, deve gravar documento pesquisado, tipo do
pré-cadastro, data/hora, usuário, motivo ou contexto e vínculo com família ou
pessoa quando aplicável. Pré-cadastro criado e pré-cadastro criado com entrega
de Cesta Extra são eventos distintos e obrigatórios no histórico.

No código atual, as ações de pré-cadastro oferecidas diretamente pelo estado de
busca sem resultado apenas exibem mensagens; elas ainda não persistem família,
assistido, entrega ou evento próprio de pré-cadastro.

Para o fluxo de atendimento, `REGRAS_ATENDIMENTO_SEAC.md` é a fonte oficial
específica. As demais regras homologadas estão em
`docs/REGRAS_APROVADAS_SEAC_SOCIAL.md`.

## Situação atual comprovada pelo código

- Frontend avançado em React e TanStack Start.
- Dados funcionais de parte dos módulos armazenados em Zustand com persistência
  no `localStorage`, incluindo dados de demonstração.
- A tela de autenticação é simulada: o formulário apenas navega ao painel.
- Existe fundação técnica do Supabase (dependência, cliente e serviço inicial),
  mas ela não está conectada à tela de autenticação nem aos módulos de negócio.
- Não há schema PostgreSQL, migrations, RLS, Storage ou persistência remota.
- Famílias, assistidos, membros, atendimento, auditoria, configurações e parte
  dos relatórios funcionam localmente.
- Usuários e recebimentos são predominantemente protótipos visuais.
- Estoque combina saldo local do atendimento com bases estáticas; os formulários
  manuais de movimentação ainda não persistem alterações.
- Homologação visual/funcional local não significa prontidão para produção.

## Stack atual

- TypeScript, React 19 e Vite.
- TanStack Start, Router e React Query.
- Tailwind CSS e componentes Radix UI.
- Zustand com middleware de persistência local.
- Recharts para visualizações.
- Supabase JavaScript apenas como fundação ainda não integrada.
- Bun como gerenciador oficial do projeto.

## Arquitetura desejada

- Interface React sem acesso direto espalhado à persistência.
- Serviços tipados por domínio entre interface e banco.
- Supabase Auth para identidade e sessão.
- PostgreSQL para dados relacionais.
- RLS para autorização por usuário e papel.
- Storage para anexos quando entrar no escopo.
- Auditoria persistente e protegida contra alteração por usuários comuns.
- Migração gradual dos stores, sem trocar todos os módulos de uma vez.

## Padrão de trabalho e restrições

1. Ler `AGENTS.md`, este documento, as regras oficiais e a documentação do
   domínio antes de alterar comportamento.
2. Verificar o código atual antes de afirmar o status de uma funcionalidade.
3. Preservar telas e regras homologadas, salvo mudança explicitamente aprovada.
4. Trabalhar em etapas pequenas, tipadas, compiláveis e compatíveis com Lovable.
5. Nunca registrar segredos, tokens, senhas ou chaves privadas.
6. Nunca usar `service_role` no frontend.
7. Nunca apagar stores locais antes da homologação da substituição.
8. Nunca reescrever histórico já sincronizado com Lovable.

## Roadmap resumido

- Sprint 0: documentação e fundação.
- Sprint 1: Supabase e autenticação real.
- Sprint 2: famílias, assistidos e membros.
- Sprint 3: atendimento e entregas.
- Sprint 4: estoque e movimentações.
- Sprint 5: recebimentos e relatórios.
- Sprint 6: testes, segurança e publicação.
