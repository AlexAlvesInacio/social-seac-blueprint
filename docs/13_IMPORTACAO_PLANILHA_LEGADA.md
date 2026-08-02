# Importação da planilha legada — análise

Estudo da `CESTAS SEAC 2026.xlsx` (2,5 MB, 14 abas) para decidir o que migrar
para o Supabase. Feito em 2026-08-02 sobre o arquivo real.

Este documento não contém dado pessoal: só estrutura e contagens. **A planilha
não deve ser versionada** — `*.xlsx` está no `.gitignore`.

## Resumo da conclusão

O que dá para importar é **o cadastro de pessoas — nome e RG**. O histórico de
entregas por pessoa, com datas, **não existe na planilha** em forma utilizável:
o que há são contagens mensais e uma "última retirada" que parou de ser
atualizada em fevereiro de 2024.

Isso não é limitação da importação; é o que o arquivo contém.

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
| `CONTROLE` | Regras de preenchimento | Não |
| `Assiduidade Cesta Extra`, `Assiduidade cesta normal`, `CASOS DO FLAVIO` | Vazias | Não |

## Três achados que decidem o desenho

### 1. Não existe entrega individual com data

As colunas mensais (`janeiro`…`dezembro`) são **contagens inteiras**, não datas.
As colunas `1.0`…`12.0` são fórmulas de apoio, não dados. Os `COMPILADO` trazem
o total de cestas por dia da instituição — por exemplo, 11/01/2026: 185 cestas —
mas **sem dizer quem retirou**.

Ou seja: sabe-se quantas cestas saíram em cada dia, e quantas cada pessoa já
retirou no total, mas não *quando cada pessoa* retirou.

**Consequência:** não é possível reconstruir a tabela `entregas` com fidelidade.
Qualquer data por pessoa seria inventada — e alimentaria a regra dos 25 dias com
ficção.

### 2. O acompanhamento por pessoa parou em fevereiro de 2024

`Data ultima retirada` existe para 514 pessoas, no intervalo de 19/02/2023 a
**18/02/2024**. A aba `Datas` termina no mesmo dia.

Enquanto isso, o `COMPILADO 2026` registra entregas em janeiro e fevereiro de
2026. Ou seja: a operação continuou, o controle por pessoa é que deixou de ser
alimentado há cerca de dois anos.

**Consequência:** importar essas datas como "última retirada" seria importar
informação vencida. Como todas estão a mais de 25 dias, elas não bloqueariam
ninguém — só dariam a impressão falsa de que o sistema conhece o histórico.

### 3. O cadastro é mais fino do que os cabeçalhos sugerem

As colunas `ENDEREÇO`, `Nº`, `COMPLEMENTO`, `BAIRRO - COMUNIDADE`, `CEP` e
`FILHOS ATÉ 10 ANOS` existem em todas as versões da aba e estão **inteiramente
vazias** — nas três, sem exceção.

Só **83 das 1.180 pessoas** têm CPF com 11 dígitos (220 na cópia maior). O
identificador real em uso é o **RG**.

Também não há como agrupar famílias: sem endereço, não existe indício de quem
mora com quem. **Cada pessoa viraria uma família de uma pessoa só.**

## Qualidade dos dados

- **73 RGs duplicados** na aba principal — a planilha tem coluna `Cadastro
  repetido`, então o problema é conhecido.
- **3 pessoas sem RG e sem CPF** — não têm como ser identificadas.
- **Situação cadastral incerta:** 553 marcadas `Evasão = Sim`, 230 `Não` e
  **397 sem marcação**.
- Cadastros por ano de inserção: 2022 (575), 2023 (39), 2024 (194), 2025 (227),
  2026 (145).

## Perguntas que precisam de resposta antes de importar

1. **Qual é a fonte?** `BANCO DE DADOS` tem 1.180 pessoas e `Cópia de BANCO DE
   DADOS` tem 2.452. Qual é a atual?
2. **Quem entra?** Importar as 1.180, só as 230 marcadas como ativas, ou só as
   372 inseridas em 2025–2026? As 397 sem marcação precisam de critério.
3. **O RG é o documento oficial?** O sistema aceita `cpf | rg | outro`; se a
   SEAC identifica por RG, o cadastro entra com `tipo_documento = 'rg'`.
4. **Quem já foi atendido este ano** entra com algum histórico, ou todo mundo
   começa liberado?

## Caminhos possíveis para o histórico

**A. Só o cadastro (recomendado).** Importa as pessoas; o histórico fica
arquivado na planilha. O sistema começa a contar entregas a partir do go-live.
Simples, honesto, e nenhuma regra é alimentada com dado inventado. O custo: no
primeiro atendimento ninguém está bloqueado por prazo.

**B. Cadastro + histórico como observação.** Cada pessoa importada recebe uma
observação social do tipo "Documento" registrando o que a planilha sabia — total
de cestas retiradas e data da última, com a ressalva de que o dado é de até
fev/2024. A informação fica visível para quem atende, sem virar entrega.
Custo: uma observação por pessoa.

**C. Cadastro + entregas sintéticas.** Criar registros de entrega com datas
aproximadas. **Não recomendo.** Inventaria fatos no ledger, e o histórico
passaria a misturar o que aconteceu com o que supomos.

## Nota sobre o estoque

A planilha **não tem inventário** — nada de itens, quantidades ou saldos. A
carga inicial de estoque (issue #46) continua dependendo da contagem física,
pelo procedimento em `12_RUNBOOK_OPERACAO.md`.
