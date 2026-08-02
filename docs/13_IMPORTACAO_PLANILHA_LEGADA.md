# Importação da planilha legada — análise

Estudo da `CESTAS SEAC 2026.xlsx` (2,5 MB, 14 abas) para decidir o que migrar
para o Supabase. Feito em 2026-08-02 sobre o arquivo real.

Este documento não contém dado pessoal: só estrutura e contagens. **A planilha
não deve ser versionada** — `*.xlsx` está no `.gitignore`.

## Resumo da conclusão

Dá para importar **o cadastro de pessoas e o histórico de entregas de 2026 com
data real** — 4.252 retiradas de 1.036 pessoas, entre 11/01/2026 e 02/08/2026.

O histórico anterior a 2026 continua indisponível por pessoa: o que existe são
contagens mensais e uma "última retirada" que parou em fevereiro de 2024.

> **Correção de uma versão anterior deste documento.** A primeira análise
> concluiu que não havia entrega individual com data. Estava errada: a varredura
> lia o cabeçalho na linha 1 de cada aba, e a aba `CONTROLE` — descartada por
> começar com o texto de regras — tem a tabela real a partir da **linha 14**. É
> ali que está o registro de retiradas de 2026.

## O que cada aba guarda

| Aba | Conteúdo | Serve para importar? |
| --- | --- | --- |
| `BANCO DE DADOS` | 1.180 pessoas: nome, RG, data de inserção | **Sim** — é o cadastro |
| `Cópia de BANCO DE DADOS` | 2.452 pessoas, mesma estrutura | Talvez — ver "Qual é a fonte?" |
| `BKP BANCO DE DADOS 20241006` | 895 pessoas, backup de out/2024 | Não (histórico) |
| `Datas` | RG + total de cestas + data máxima; 1.387 pessoas, 7.746 cestas | Parcial — ver abaixo |
| `COMPILADO 2024/2025/2026` | Totais **por dia da instituição**, sem vínculo com pessoa | Não |
| `ADICIONADOS` | 233 inclusões com data | Complementar |
| `GESTANTES 2024` | 141 entregas de enxoval em 2024 | Não (encerrado) |
| `RETIRAR CADASTRP EM MAR25` | 43 pessoas, contagem mensal 07/2024–03/2025 | Não (recorte) |
| `CONTROLE` | **4.252 retiradas de 2026 com data, por pessoa** (tabela a partir da linha 14; as primeiras linhas são as regras de preenchimento) | **Sim — é o histórico** |
| `Assiduidade Cesta Extra`, `Assiduidade cesta normal`, `CASOS DO FLAVIO` | Vazias | Não |

## Três achados que decidem o desenho

### 1. O histórico de 2026 existe, por pessoa e com data

A aba `CONTROLE`, a partir da linha 14, é o registro de retiradas:

| | |
| --- | --- |
| Retiradas registradas | 4.252 |
| Período | 11/01/2026 a 02/08/2026 |
| Dias de entrega | 29 |
| Pessoas distintas | 1.036 (por RG) |
| Cestas por registro | sempre 1 — cada linha é uma retirada |
| Marcadas "Primeira Vez" | 289 |

O campo `UNICO` é a chave: `RG-sequência-ano`, como `130132482-1-2026` — a
primeira retirada daquele RG em 2026. Serve tanto para deduplicar quanto para
conferir a ordem.

Distribuição por pessoa: 202 pessoas com 1 retirada, 104 com 2, 109 com 3, 122
com 4, 146 com 5, 180 com 6, 169 com 7 e 4 com 8.

**Consequência:** a regra dos 25 dias passa a funcionar desde o primeiro dia,
com data real. Quem retirou em 02/08 continua bloqueado no sistema novo — que é
exatamente o comportamento que se espera de uma migração.

As colunas mensais do `BANCO DE DADOS` (`janeiro`…`dezembro`) continuam sendo
contagens, e as `1.0`…`12.0` são fórmulas de apoio; nenhuma das duas serve. Os
`COMPILADO` trazem totais do dia da instituição, sem vínculo com pessoa.

### 2. Antes de 2026, o acompanhamento por pessoa parou em fevereiro de 2024

`Data ultima retirada` existe para 514 pessoas, no intervalo de 19/02/2023 a
**18/02/2024**. A aba `Datas` termina no mesmo dia.

Enquanto isso, o `COMPILADO 2026` registra entregas em janeiro e fevereiro de
2026. Ou seja: a operação continuou, o controle por pessoa é que deixou de ser
alimentado há cerca de dois anos.

**Consequência:** o histórico de 2023–2025 fica de fora. Importar aquelas datas
não acrescentaria nada — o registro de 2026 é mais recente para todo mundo que
aparece nos dois — e daria a impressão falsa de que o sistema conhece um
histórico que só tem até fev/2024.

### 3. O cadastro é mais fino do que os cabeçalhos sugerem

As colunas `ENDEREÇO`, `Nº`, `COMPLEMENTO`, `BAIRRO - COMUNIDADE`, `CEP` e
`FILHOS ATÉ 10 ANOS` existem em todas as versões da aba e estão **inteiramente
vazias** — nas três, sem exceção.

Só **83 das 1.180 pessoas** têm CPF com 11 dígitos (220 na cópia maior). O
identificador real em uso é o **RG**.

Também não há como agrupar famílias: sem endereço, não existe indício de quem
mora com quem. **Cada pessoa viraria uma família de uma pessoa só.**

## 196 pessoas têm entrega e não têm cadastro

Cruzando `CONTROLE` com `BANCO DE DADOS` pelo RG: dos 1.036 que retiraram em
2026, **840 estão no cadastro e 196 não**. A própria planilha tem uma coluna
chamada "Pessoas sem cadastro" na aba de controle, então a equipe conhece a
situação — o atendimento acontece antes do cadastro.

Isso precisa de decisão: essas 196 pessoas entram como cadastro criado a partir
do nome e RG que constam na linha de retirada, ou ficam de fora e a entrega
delas é descartada? Descartar significa perder a informação de que retiraram, e
com ela o bloqueio de prazo.

## Qualidade dos dados

- **73 RGs duplicados** na aba principal — a planilha tem coluna `Cadastro
  repetido`, então o problema é conhecido.
- **3 pessoas sem RG e sem CPF** — não têm como ser identificadas.
- **Situação cadastral incerta:** 553 marcadas `Evasão = Sim`, 230 `Não` e
  **397 sem marcação**.
- Cadastros por ano de inserção: 2022 (575), 2023 (39), 2024 (194), 2025 (227),
  2026 (145).

## Desenho da importação

Com o de-para fechado, o `CONTROLE` passa a ser a **fonte primária**: ele diz
quem foi efetivamente atendido em 2026. O `BANCO DE DADOS` vira fonte de
enriquecimento (CPF e data de inserção, quando existirem).

Isso resolve sozinho o critério de quem entra — as **1.038 pessoas atendidas
este ano**, em vez de escolher entre 1.180 cadastros de 2022 em diante ou as 230
marcadas como ativas.

| Etapa | O que entra |
| --- | --- |
| Pessoas | 1.038, com nome e RG do `CONTROLE`; CPF do `BANCO DE DADOS` quando houver |
| Famílias | uma por pessoa — não há endereço para agrupar |
| Tipo de cadastro | pela última retirada: 894 definitivo, 144 extra |
| Entregas | 4.252, com data real; comum → Cesta Padrão, diferenciada → Cesta Extra |

## Perguntas que ainda precisam de resposta

1. **O RG é o documento oficial?** O sistema aceita `cpf | rg | outro`; se a
   SEAC identifica por RG, o cadastro entra com `tipo_documento = 'rg'`.
4. **Que benefício cada retirada representa?** A planilha marca "CESTA
   DIFERENCIADA" em algumas linhas e o `COMPILADO` separa cesta comum,
   diferenciada e enxoval. O sistema tem Cesta Padrão, Cesta Extra e Kit
   Gestante — falta o de-para.
5. **As 196 pessoas sem cadastro** entram (criadas a partir do nome e RG da
   linha de retirada) ou ficam de fora?
6. **Divergência de contagem:** em 11/01/2026, `CONTROLE` tem 196 retiradas e
   `COMPILADO 2026` registra 185 cestas. Qual é a fonte para conferência?

## Caminhos possíveis para o histórico

**A. Cadastro + entregas de 2026 (recomendado).** Importa as pessoas e as 4.252
retiradas com as datas reais. A regra dos 25 dias funciona desde o primeiro
atendimento e o histórico da tela mostra o que de fato aconteceu. É o único
caminho em que a migração não perde informação.

Exige atenção em três pontos: as entregas precisam entrar **sem** movimentar o
estoque (são fatos passados, o saldo atual já reflete a saída) e sem passar pelo
motor de regras, que recusaria retiradas em intervalo menor que 25 dias; e o
benefício de cada linha precisa ser decidido — ver "Perguntas".

**B. Só o cadastro.** O histórico fica arquivado na planilha e o sistema conta a
partir do go-live. Mais simples, mas joga fora a informação de quem retirou
recentemente: alguém que pegou cesta em 02/08 poderia pegar outra no dia
seguinte, sem que o sistema soubesse.

**C. Cadastro + histórico como observação.** Uma observação por pessoa
registrando total e última data, sem virar entrega. Fica visível para quem
atende, mas **não alimenta a regra de prazo** — o bloqueio dependeria de alguém
ler a observação e decidir na mão.

## As duas fontes batem (não havia divergência)

O `COMPILADO` separa cesta comum de cesta diferenciada; o `CONTROLE` lista as
duas na mesma tabela, com um `X` marcando as diferenciadas. Somando as duas
colunas do `COMPILADO`, o número bate com o total do `CONTROLE` **em 29 de 29
dias**, e as 340 marcações `X` correspondem exatamente à soma da coluna de
diferenciadas.

| Data | CONTROLE | COMPILADO comum | + diferenciada | = |
| --- | --- | --- | --- | --- |
| 11/01/2026 | 196 | 185 | 11 | 196 |
| 18/01/2026 | 213 | 202 | 11 | 213 |
| 22/02/2026 | 237 | 219 | 18 | 237 |

Total de 2026: **3.912 cestas comuns + 340 diferenciadas = 4.252**. Enxoval está
zerado em 2026 (a aba `GESTANTES` cobre 2024).

Isso dá a contagem por tipo, mas não o de-para. A coluna do `CONTROLE` se chama
"Pessoas sem cadastro / Cesta diferenciada", o que sugeria que os dois conceitos
fossem o mesmo. **Não são:**

| | no cadastro | fora do cadastro |
| --- | --- | --- |
| Cesta diferenciada | 182 | 158 |
| Cesta comum | 3.780 | 132 |

As 158 diferenciadas de gente fora do cadastro são exatamente as marcadas
"Primeira Vez" — quem chega sem cadastro leva diferenciada. Mas **182
diferenciadas foram para pessoas já cadastradas**, então o tipo não é só uma
consequência da falta de cadastro.

**De-para confirmado pelo usuário em 2026-08-02:** cesta diferenciada **é** a
Cesta Extra. Logo, cesta comum → Cesta Padrão.

## O de-para se sustenta nos dados

No sistema o benefício não é escolhido na entrega: decorre do tipo de cadastro
do assistido. Então a pergunta vira "que tipo de cadastro cada pessoa tem?", e a
planilha responde sozinha:

| | pessoas |
| --- | --- |
| Só cesta comum | 835 |
| Só diferenciada | 142 |
| Receberam os dois tipos | 61 |

Os 61 pareciam um problema — no sistema ninguém recebe os dois. Mas a ordem
cronológica mostra que não são exceção, e sim o fluxo normal:

| | |
| --- | --- |
| Extras primeiro, depois comuns (avaliação → definitivo) | **58** |
| Comuns primeiro, depois extras | 2 |
| Alternando | 1 |

É exatamente `aprovar_assistido_definitivo` acontecendo no papel. **Regra de
importação: o tipo de cadastro é o da última retirada** — 894 definitivos e 144
extras. Os 3 casos fora do padrão seguem a mesma regra e entram no relatório de
conferência.

Dois números que validam a migração antes de ela acontecer:

- **Ninguém passou de 3 Cestas Extra.** O máximo é exatamente 3 (44 pessoas), o
  que confirma que a SEAC já pratica o limite que o sistema aplica.
- **657 pessoas retiraram nos últimos 25 dias** e ficariam corretamente
  bloqueadas por prazo no dia seguinte à importação.

## Nota sobre o estoque

A planilha **não tem inventário** — nada de itens, quantidades ou saldos. A
carga inicial de estoque (issue #46) continua dependendo da contagem física,
pelo procedimento em `12_RUNBOOK_OPERACAO.md`.
