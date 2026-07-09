# Regras oficiais de atendimento — SEAC Social

Este documento é a fonte oficial das regras de atendimento e entrega de
benefícios do SEAC Social. Toda alteração de comportamento nas telas de
Atendimento, Famílias, Estoque e Histórico deve refletir estas regras.
A lógica central está em `src/lib/atendimento-regras.ts`
(função `verificarElegibilidadeAtendimento`).

## 1. Intervalo mínimo (regra dos 25 dias)

- O assistido só pode receber nova cesta após **25 dias** da última retirada.
- Se ainda não completou 25 dias, a entrega é **bloqueada**.
- A tela deve exibir a **próxima data permitida** e quantos dias faltam.
- Liberação excepcional: **apenas Administrador**, com **motivo obrigatório**.
- Vale tanto para Cesta Padrão quanto para Cesta Extra.

## 2. Cadastro definitivo

- Assistido com cadastro definitivo recebe **Cesta Padrão**.
- Respeita a regra dos 25 dias.
- Se houver estoque e estiver no prazo → liberar entrega.
- Se não houver estoque → bloquear e registrar tentativa bloqueada.

## 3. Cadastro extra / em avaliação

- Assistido novo, pré-cadastrado ou em avaliação recebe **Cesta Extra**.
- Pode receber **até 3 retiradas extras** acompanhadas.
- Exibir progresso: `1/3`, `2/3`, `3/3`.
- Após a 3ª retirada, exibir alerta para avaliação de cadastro definitivo.
- **Não converter automaticamente** para definitivo.

## 4. Sem cadastro encontrado

- Antes de buscar: “Nenhuma busca realizada”.
- Após buscar e não encontrar: “Nenhum assistido encontrado para os dados
  informados.”
- Ações disponíveis:
  - Criar pré-cadastro
  - Criar pré-cadastro e entregar Cesta Extra (respeitando estoque)

## 5. Falta de estoque

- Sem saldo suficiente do benefício → **bloquear entrega**.
- **Não permitir** liberação excepcional por falta de estoque.
- Permitir apenas “Registrar tentativa bloqueada”.

## 6. Registro obrigatório

Toda tentativa deve gerar histórico:
- Entrega realizada
- Tentativa bloqueada por prazo
- Tentativa bloqueada por estoque
- Liberação excepcional
- Pré-cadastro criado
- Pré-cadastro criado com entrega de Cesta Extra

## 7. Estoque

Quando uma entrega for confirmada:
- Baixa automática do benefício no estoque.
- Movimentação tipo **“Baixa automática”**, origem **“Entrega realizada”**.
- Relacionar com assistido, família, usuário responsável e data/hora.

## 8. Auditoria

Toda ação importante registra:
- Usuário
- Data/hora
- Tipo de ação
- Módulo
- Registro afetado
- Observação/motivo quando existir

## 9. Função central de elegibilidade

A tela `/atendimento` deve chamar `verificarElegibilidadeAtendimento(assistido, estoque)`
e renderizar o cenário retornado. Cenários possíveis:

- `liberado_padrao`
- `liberado_extra` (com `progresso` 1, 2 ou 3)
- `bloqueio_25dias` (com `diasRestantes` e `proximaData`)
- `bloqueio_estoque`
- `extra_completou` (3 retiradas extras já feitas — aguardar avaliação)

Regras textuais no accordion “Regras e fluxo (referência)” servem apenas como
explicação para o usuário — não controlam o comportamento da tela.