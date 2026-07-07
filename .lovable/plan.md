# PRD — SEAC Social (Revisão 2)

Documento de planejamento revisado. **Nada de código, telas ou banco será criado nesta etapa.** Apenas apresentação para aprovação.

---

## 1. Visão geral

O **SEAC Social** é um sistema web para uma entidade social gerenciar atendimento a famílias vulneráveis: cadastro de famílias, assistidos e membros; controle de estoque de alimentos e benefícios; recebimentos (doações, compras, investimentos); entrega de cestas básicas e outros benefícios; relatórios.

Uso presencial, aos domingos, por operadores com pouca familiaridade técnica. Requisitos-chave: simples, rápido, em português do Brasil, tema claro (verde/turquesa/branco), menu lateral fixo, botões grandes.

---

## 2. Objetivo

- Organizar cadastro de famílias, assistidos e membros.
- Controlar elegibilidade de entregas (regra dos 25 dias, estoque, status do assistido).
- Registrar tentativas bloqueadas e liberações excepcionais.
- Controlar entrada, saída, ajustes e montagem de itens/benefícios.
- Registrar doações, compras e investimentos com referência ao doador/fornecedor.
- Gerar relatórios sociais, operacionais e financeiros.

---

## 3. Público usuário

Coordenadores da entidade (admin), atendentes de fila, responsáveis por estoque e recebimento, e usuários novos aguardando liberação (pendente).

---

## 4. Perfis de acesso

Perfis oficiais (nomes exatos, não usar `usuario`/`user`):

- **admin** — acesso total, gerencia usuários, configurações, composição de benefícios, libera entregas excepcionalmente.
- **atendente** — painel, atendimento, famílias, assistidos, membros, entregas. Visualiza bloqueios, **não libera**.
- **estoque** — painel, estoque, recebimentos, movimentações.
- **pendente** — sem acesso; aguarda liberação de admin.

Status permitidos do usuário: **ativo** ou **inativo**.

Regras de liberação:
- Primeiro usuário cadastrado vira **admin ativo** automaticamente.
- Se não existir admin ativo, o próximo cadastrado vira admin.
- Se já existir admin ativo, novos usuários entram como **pendente**.
- Pendente e inativo não acessam o sistema.

---

## 5. Escopo do MVP

1. Login e usuários.
2. Famílias, assistidos, membros.
3. **Cesta Extra e Cesta Padrão** (novos/sem cadastro vs. definitivo/aprovado).
4. Atendimento e entrega de benefício.
5. **Tentativas de entrega bloqueadas + liberação excepcional (admin)**.
6. Estoque (itens individuais + benefícios prontos).
7. Recebimentos (com referência a doador/fornecedor).
8. Configurações (itens, unidades, categorias, benefícios).
9. **Composição por benefício** (Cesta Básica, Kit Gestante, etc.).
10. Montagem de benefícios (a partir da composição).
11. Relatórios básicos, incluindo bloqueios, liberações e retiradas extras.

---

## 6. Fora do MVP

Não construir agora: Fila e Café, café da manhã, presença em fila, comida de rua, marmita externa, voluntários, validação facial, QR Code/carteirinha, app mobile, WhatsApp, check-in por celular. Ficam para fases futuras após homologação do core.

---

## 7. Fluxo principal

```text
Família
  ▼
Assistido (vinculado à família)
  ▼
Membros (composição familiar)
  ▼
Atendimento (busca CPF/RG/nome/telefone)
  ▼
Cadastro encontrado?
  ├── NÃO ──► Oferecer pré-cadastro e, se necessário, entregar Cesta Extra
  └── SIM ──► Status do cadastro
                ├── em_avaliação / extra ──► Cesta Extra (máx. 3 retiradas; 25 dias; alerta na 3ª)
                └── definitivo / aprovado ──► Cesta Padrão (25 dias; estoque; status)
                      ▼
                Elegibilidade: ativo? passou 25 dias? tem estoque?
                  ├── SIM ──► Entrega ──► Baixa automática (1 benefício) ──► Histórico + Movimentação
                  └── NÃO ──► Registra Tentativa Bloqueada (motivo + próxima data)
                                 ▼
                    Admin pode "Liberar excepcionalmente" (apenas bloqueio por prazo/social; observação obrigatória)
                                 ▼
                    Entrega vinculada à tentativa (liberacao_excepcional=true) ──► Baixa + Histórico + Movimentação
  ▼
Relatórios (entregas, bloqueios, liberações, retiradas extras, estoque, doações, social)
```

Esse fluxo é o núcleo do sistema.

---

## 8. Telas necessárias

| Rota | Descrição | Perfis |
|------|-----------|--------|
| `/auth` | Login/cadastro. Abre sem depender de profile carregado; profile criado automaticamente. | Todos |
| `/painel` | Indicadores: famílias, assistidos ativos, cestas em estoque, entregas hoje/mês, alertas de estoque baixo, últimas entregas, últimas tentativas bloqueadas. | admin, atendente, estoque |
| `/familias` | Lista/busca por nome, CPF/RG, telefone, bairro, status. | admin, atendente |
| `/familias/:id` | Detalhe: dados, endereço, composição, assistidos, membros, histórico de entregas e tentativas. | admin, atendente |
| `/atendimento` | Busca assistido por CPF/RG/nome/telefone. Mostra cenários: sem busca, pré-cadastro não encontrado (criar pré-cadastro + entregar Cesta Extra), assistido em avaliação (Cesta Extra com progresso 1/3, 2/3, 3/3), assistido definitivo (Cesta Padrão). Exibe última retirada, próxima data permitida, status liberado/bloqueado, motivo e ações. Liberação excepcional só para admin e só em bloqueio por prazo/social, com observação obrigatória. Bloqueio por falta de estoque não permite liberação excepcional. | admin, atendente |
| `/estoque` | Itens, saldos, mínimos, movimentações, alertas. | admin, estoque |
| `/recebimentos` | Entradas por item (doação/compra/investimento/ajuste) com doador/fornecedor referenciado. | admin, estoque |
| `/configuracoes` | Itens, unidades, categorias, benefícios, doadores/fornecedores, parâmetros. | admin |
| `/composicao-cesta` | Composição **por benefício** (Cesta Básica, Kit Gestante, etc.) + montagem. | admin |
| `/usuarios` | Lista, ativa/inativa, libera pendentes, altera papel. | admin |
| `/relatorios` | Relatórios sociais, operacionais, financeiros, bloqueios e liberações. | admin |
| `/auditoria` | Registro de alterações relevantes. | admin |

---

## 9. Regras de negócio

1. **Primeiro usuário vira admin ativo**; próximos ficam pendentes.
2. **Pendente/inativo não acessam** o sistema.
3. **Regra dos 25 dias** vale para Cesta Extra e Cesta Padrão (parâmetro configurável).
4. **Bloqueio sem estoque**: sem saldo do benefício correspondente, entrega não confirma.
5. **Bloqueio por assistido inativo**: assistido inativo não recebe.
6. **Cesta Extra vs. Cesta Padrão**: assistido em avaliação/pré-cadastrado/novo recebe Cesta Extra; assistido definitivo/aprovado recebe Cesta Padrão.
7. **Cesta Extra limitada a 3 retiradas consecutivas**: progresso 1/3, 2/3, 3/3, com controle de `retiradas_extra_realizadas`.
8. **Após a 3ª retirada extra consecutiva**: sistema exibe aviso fixo — "Assistido completou 3 retiradas extras. Avaliar cadastro definitivo para liberar Cesta Padrão no próximo mês.".
9. **Não há conversão automática** para cadastro definitivo; efetivação deve ser feita por admin/coordenação.
10. **Cesta Padrão só é liberada no próximo mês** após aprovação definitiva do cadastro.
11. **Baixa automática**: entrega confirmada baixa 1 unidade do benefício correspondente e gera movimentação.
12. **Histórico de entregas** imutável, com usuário, data/hora, benefício, observação.
13. **Movimentações de estoque** imutáveis, com `origem_tipo` + `origem_id` (recebimento, entrega, montagem, ajuste), saldo anterior e posterior.
14. **Tentativas bloqueadas são sempre registradas** — mesmo sem entrega — com motivo, próxima data permitida e tipo de cesta.
15. **Liberação excepcional apenas por admin**, apenas em bloqueio por prazo/social, com observação obrigatória. Registra quem liberou, quando, motivo original e observação.
16. **Entrega liberada excepcionalmente** é vinculada à tentativa original (`tentativa_entrega_id`) e marcada com `liberacao_excepcional=true`. Segue o mesmo fluxo de baixa/histórico/movimentação.
17. **Montagem** só ocorre com saldo suficiente de todos os itens da composição do benefício.
18. **RLS ativo** em todas as tabelas; verificação de papel via função `has_role(user_id, role)` SECURITY DEFINER; roles em tabela separada.

---

## 9.5. Regras detalhadas de Cesta Extra e Cesta Padrão

O SEAC Social terá dois tipos principais de cesta para organizar o atendimento e a avaliação de novos assistidos:

### Cesta Extra

- Destinada a assistidos **novos**, **sem cadastro definitivo**, **pré-cadastrados** ou **em avaliação**.
- Controla até **3 retiradas extras consecutivas**.
- O progresso deve ser apresentado visualmente como **1/3**, **2/3** e **3/3**.
- A **regra dos 25 dias** também se aplica à Cesta Extra.
- Após completar a **3ª retirada extra consecutiva**, o sistema deve exibir o aviso fixo:
  > "Assistido completou 3 retiradas extras. Avaliar cadastro definitivo para liberar Cesta Padrão no próximo mês."
- O cadastro **não vira definitivo automaticamente**.
- A efetivação para cadastro definitivo deve ser feita por **admin/coordenação**.

### Cesta Padrão

- Destinada a assistidos com **cadastro definitivo/aprovado**.
- A **regra dos 25 dias** se aplica normalmente.
- Só pode ser liberada **no próximo mês** após a aprovação definitiva do cadastro.

### No atendimento

- Se **não encontrar cadastro**: mostrar opção de criar **pré-cadastro**.
- Se necessário, permitir **criar pré-cadastro e entregar Cesta Extra** na mesma ação.
- Se assistido estiver **em avaliação**: mostrar progresso das retiradas extras e usar Cesta Extra.
- Se assistido for **definitivo**: mostrar Cesta Padrão, última retirada, próxima data permitida e status liberado/bloqueado.
- Se **não houver estoque**: bloquear entrega e não permitir liberação excepcional.
- Toda retirada (Extra ou Padrão) deve gerar **histórico** e **movimentação de estoque** quando a lógica for implementada.

### Campos futuros sugeridos no cadastro do assistido

- `tipo_cadastro`: `extra` | `definitivo`
- `status_cadastro`: `em_avaliacao` | `aprovado` | `inativo`
- `retiradas_extra_realizadas`
- `data_ultima_retirada_extra`
- `elegivel_para_avaliacao_definitiva`
- `aprovado_definitivo_por`
- `aprovado_definitivo_em`

---

## 10. Modelo inicial de banco (conceitual)

### Tabelas

- **`profiles`** — id (auth.users), nome, email, telefone, status (`ativo`|`inativo`), timestamps.
- **`user_roles`** — user_id, role (`admin`|`atendente`|`estoque`|`pendente`). Roles em tabela separada.
- **`familias`** — id, nome_familia, endereco, bairro, cidade, uf, cep, telefone, whatsapp, moradores, criancas, idosos, gestantes, pcd, observacoes, status, created_by, timestamps.
- **`assistidos`** — id, familia_id, nome, cpf, rg, nascimento, telefone, responsavel_familiar, deficiencia, observacoes, status, **tipo_cadastro** (`extra`|`definitivo`), **status_cadastro** (`em_avaliacao`|`aprovado`|`inativo`), **retiradas_extra_realizadas** (int, default 0), **data_ultima_retirada_extra** (date, nullable), **elegivel_para_avaliacao_definitiva** (bool, default false), **aprovado_definitivo_por** (FK, nullable), **aprovado_definitivo_em** (timestamp, nullable), timestamps.
- **`membros`** — id, familia_id, nome, nascimento, parentesco, tipo (crianca/idoso/gestante/pcd/outro), observacoes.
- **`beneficios`** — id, nome, descricao, controla_estoque (bool), ativo (bool). Ex.: Cesta Básica, Marmita, Kit Gestante, Cesta de Natal, Kit Dia das Crianças, Kit Páscoa.
- **`itens_estoque`** — id, nome, tipo (`alimento`|`beneficio`), categoria, unidade, saldo_atual, estoque_minimo, ativo. Benefícios prontos com `controla_estoque=true` também existem aqui como item movimentável (ou referenciados via `beneficio_id`, a decidir na fase de banco).
- **`composicao_beneficio`** — id, **beneficio_id**, item_id, quantidade, unidade, ativo. Permite composição para qualquer benefício.
- **`doadores_fornecedores`** — id, nome, tipo (`doador`|`fornecedor`|`ambos`), contato, observacoes, ativo.
- **`recebimentos`** — id, data, item_id, quantidade, unidade, origem (`doacao`|`compra`|`investimento`|`ajuste`), **doador_fornecedor_id** (FK), valor_unitario, valor_total, nota_fiscal, validade, lote, local_armazenamento, usuario_id, observacao. *(No MVP, um item por lançamento; evolução prevista abaixo.)*
- **`montagens_beneficio`** — id, beneficio_id, data, quantidade, usuario_id, observacao.
- **`entregas`** — id, assistido_id, familia_id, beneficio_id, **tipo_cesta** (`extra`|`padrao`), data_hora, usuario_id, observacao, **liberacao_excepcional** (bool), **tentativa_entrega_id** (FK, nullable), **observacao_liberacao** (nullable).
- **`tentativas_entrega`** — id, assistido_id, familia_id, usuario_id (quem tentou), data_hora, motivo_bloqueio (`antes_25_dias`|`sem_estoque`|`assistido_inativo`|`outro`), proxima_data_permitida, observacao, status (`bloqueada`|`liberada_excepcionalmente`|`cancelada`), **liberado_por_usuario_id** (FK, nullable), **liberado_em** (nullable), **observacao_liberacao** (nullable).
- **`movimentacoes_estoque`** — id, item_id, tipo (`entrada`|`saida`|`ajuste`|`montagem`|`baixa_entrega`), quantidade, saldo_anterior, saldo_posterior, **origem_tipo** (`recebimento`|`entrega`|`montagem`|`ajuste`), **origem_id**, usuario_id, data_hora, observacao.
- **`configuracoes`** — chave/valor (ex.: `dias_entre_cestas=25`).
- **`auditoria`** — entidade, entidade_id, acao, usuario_id, dados_antes, dados_depois, data_hora.

### Relacionamentos essenciais

- `familia 1—N assistidos`, `familia 1—N membros`.
- `assistido 1—N entregas`, `assistido 1—N tentativas_entrega`.
- `beneficio 1—N composicao_beneficio`, `beneficio 1—N entregas`, `beneficio 1—N montagens_beneficio`.
- `doador_fornecedor 1—N recebimentos`.
- `recebimento 1—1 movimentacao_estoque` (entrada).
- `montagem 1—N movimentacoes_estoque` (saídas dos itens + entrada do benefício pronto).
- `entrega 1—1 movimentacao_estoque` (baixa).
- `tentativa_entrega 0..1—1 entrega` (quando liberada excepcionalmente e concluída).

### RLS e segurança

- RLS ativo em todas as tabelas.
- `has_role(user_id, role)` SECURITY DEFINER; nunca aberta a `public`/`anon` sem necessidade.
- `profiles`: usuário lê o próprio; admin lê todos.
- `user_roles`: usuário lê os próprios; admin gerencia todos.
- `familias`, `assistidos`, `membros`, `entregas`, `tentativas_entrega`: admin e atendente.
- **Liberação em `tentativas_entrega`** (update dos campos `liberado_*`): apenas admin.
- `itens_estoque`, `recebimentos`, `movimentacoes_estoque`, `montagens_beneficio`, `composicao_beneficio`, `beneficios`, `doadores_fornecedores`: admin e estoque (escrita conforme papel).
- `configuracoes`: apenas admin.
- `auditoria`: escrita via triggers; leitura apenas admin.

---

## 11. Regras de estoque

**Itens individuais** (alimentos/higiene/etc.) e **benefícios prontos** (Cesta Básica, Marmita, Kit Gestante, Cesta de Natal, Kit Dia das Crianças, Kit Páscoa) convivem no controle de estoque. Itens iniciais obrigatórios: Cesta Básica, Marmita, Kit Gestante.

**Unidades**: UN, KG, Pacote, Caixa, Fardo, Litro, Grama, Quilo.
**Categorias**: Alimento, Higiene, Limpeza, Descartável, Outros.

**Recebimentos**
- Sempre com `doador_fornecedor_id` (referência, não texto livre).
- Aumenta saldo do item e gera movimentação `origem_tipo=recebimento`.
- Origem `doacao`/`compra`/`investimento`/`ajuste` alimentam relatórios financeiros distintos.
- **MVP**: lançamento item a item.
- **Evolução futura prevista**: cabeçalho `recebimentos` + linhas `recebimento_itens` (ex.: 200 Arroz 5kg + 100 Feijão 1kg + 50 Óleo 900ml num mesmo lançamento). O modelo do MVP deve permitir essa evolução sem migração destrutiva.

**Composição por benefício**
- `composicao_beneficio(beneficio_id, item_id, quantidade, unidade, ativo)`.
- Configurável para Cesta Básica, Kit Gestante, Cesta de Natal, etc.

**Montagem**
- Para montar N unidades de um benefício: baixa N × quantidade de cada item da composição ativa e aumenta o saldo do benefício pronto em N.
- Bloqueia se saldo insuficiente.
- Gera movimentações com `origem_tipo=montagem` e `origem_id` = id da montagem.

**Entrega**
- Baixa 1 unidade do benefício entregue.
- Gera movimentação `origem_tipo=entrega`, `origem_id` = id da entrega.

**Ajuste manual**
- Gera movimentação `origem_tipo=ajuste`.

---

## 12. Relatórios

**Sociais/operacionais**
- Famílias: cadastradas, ativas, inativas, por bairro, com crianças/idosos/gestantes/PCD.
- Assistidos: ativos, inativos, por bairro/família/documento.
- Entregas: por dia/mês/assistido/família/bairro/usuário/benefício.
- **Bloqueios**: total, por motivo (antes_25_dias, sem_estoque, assistido_inativo, outro), período, usuário, bairro.
- **Liberações excepcionais**: total, quem liberou, motivo original, observação, assistido/família, data.
- Social geral: pessoas impactadas, crianças/idosos/gestantes/PCD atendidos, cestas entregues.

**Estoque**
- Saldo por item/benefício, entradas, saídas, ajustes, baixas por entrega, montagens, itens abaixo do mínimo.

**Financeiros / recebimentos**
- Doações por doador/período/item/valor estimado.
- Compras por fornecedor/período/item/valor.
- Investimento próprio por período/item/valor.

**Configuração**
- Composição vigente de cada benefício.

---

## 13. Critérios de aceite do MVP

1. `/auth` abre sem depender de profile; profile criado automaticamente.
2. Primeiro usuário vira admin ativo; próximos ficam pendentes.
3. Admin gerencia papéis e status em `/usuarios`; pendente/inativo bloqueados.
4. Atendente, estoque e pendente respeitam suas restrições em todas as rotas.
5. Famílias, assistidos e membros cadastráveis e editáveis.
6. `/atendimento` localiza assistido e mostra elegibilidade correta.
7. **Toda tentativa bloqueada é registrada** com motivo e próxima data.
8. **Atendente vê o bloqueio mas não libera**; **admin libera excepcionalmente** com observação obrigatória.
9. Entrega liberada excepcionalmente confirma normalmente, baixa 1 unidade, gera histórico e movimentação, vincula à tentativa original e marca `liberacao_excepcional=true`.
10. Entrega comum baixa 1 unidade da Cesta Básica pronta e gera movimentação com `origem_tipo=entrega`.
11. `/recebimentos` registra com `doador_fornecedor_id`, aumenta estoque e gera movimentação com `origem_tipo=recebimento`.
12. `/composicao-cesta` gerencia composição por benefício e permite montar, respeitando saldos e gerando movimentações com `origem_tipo=montagem`.
13. `/painel` mostra indicadores corretos e alertas de estoque baixo.
14. Relatórios de famílias, entregas, **bloqueios**, **liberações excepcionais**, estoque, doações/compras/investimento e social geral retornam dados coerentes.
15. RLS testado com os quatro perfis; nenhum acesso indevido.
16. Interface pt-BR, tema claro, verde/turquesa/branco, menu lateral fixo, botões grandes.

---

## 14. Ordem recomendada de desenvolvimento

1. Login, primeiro admin, `profiles`, `user_roles`, `has_role`, RLS base, `/usuarios`.
2. Famílias, assistidos, membros (`/familias`, `/familias/:id`).
3. `beneficios`, `itens_estoque`, `doadores_fornecedores`, configurações mínimas.
4. `composicao_beneficio` e `/composicao-cesta`.
5. Atendimento com regra dos 25 dias, bloqueio por estoque/status e **registro de tentativas bloqueadas**.
6. **Liberação excepcional (admin)** + entrega vinculada à tentativa.
7. Estoque e movimentações (`origem_tipo` + `origem_id`).
8. Recebimentos com `doador_fornecedor_id` (item a item, banco preparado para evoluir para cabeçalho + itens).
9. Montagem de benefícios.
10. Relatórios básicos (incluindo bloqueios e liberações).
11. Auditoria interna.
12. Homologação completa dos quatro perfis antes de discutir módulos futuros (que **não fazem parte deste PRD**).
