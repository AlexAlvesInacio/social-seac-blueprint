## Objetivo

Fazer o sistema classificar automaticamente cada membro/assistido a partir da **data de nascimento**, eliminando os checkboxes manuais de "Criança" e "Idoso" (e derivando a faixa etária de forma consistente em toda a aplicação).

## Regras oficiais de faixa etária

- **Criança**: 0 a 12 anos completos (idade ≤ 12)
- **Adolescente**: 13 a 17 anos (nova categoria)
- **Adulto**: 18 a 59 anos
- **Idoso**: 60 anos ou mais

Gestante e PCD continuam sendo marcadores manuais (não dá para inferir da data).

## Onde aplicar

1. **`src/lib/familias-store.ts`**
   - Adicionar helper `calcularFaixaEtaria(nascimento)` → retorna `"crianca" | "adolescente" | "adulto" | "idoso"`.
   - Adicionar helper `calcularIdade(nascimento)`.
   - Manter os campos `crianca` / `idoso` no tipo `Membro` como **derivados** (calculados no `addMembro`/`update`), não mais definidos manualmente pelo formulário.
   - Adicionar campo `adolescente: boolean` derivado.

2. **`src/components/familia-detail-dialogs.tsx` — Adicionar membro familiar**
   - Remover os checkboxes "Criança" e "Idoso".
   - Manter apenas: Gestante, PCD.
   - Mostrar, ao lado da data de nascimento, um badge automático: "Criança (8 anos)", "Adolescente (15 anos)", "Adulto (34 anos)" ou "Idoso (67 anos)".
   - Ao salvar, gravar `crianca`, `adolescente`, `idoso` calculados a partir da data.

3. **`src/components/nova-familia-dialog.tsx`** (se hoje pede contagens manuais)
   - Manter o input de contagem manual apenas como fallback quando ainda não há membros cadastrados; após adicionar membros pela tela de detalhe, os contadores passam a ser calculados.

4. **`src/routes/familias.$id.tsx` — cards de resumo**
   - Calcular `criancas`, `idosos` (e agora `adolescentes`) via `useMemo` a partir da lista de `membros` da família, em vez de ler `familia.criancas` / `familia.idosos` fixos.
   - Adicionar coluna/badge "Faixa etária" na tabela de membros vinculados.

5. **`src/routes/familias.index.tsx`**
   - Filtros existentes ("com crianças", "com idosos", se houver) passam a considerar os membros derivados.

## Regras de borda

- Data de nascimento **vazia** → não classifica (nenhum badge, contadores não somam).
- Data **no futuro** ou inválida → bloquear salvar com mensagem "Data de nascimento inválida".
- Idade calculada com base em `new Date()` no momento do cálculo (não persistir idade, só a data).
- Aniversário do dia: já conta a idade nova.

## O que **não** muda

- Layout, paleta, menu lateral, topo, logo, estrutura dos cards e das abas.
- Regras de atendimento (25 dias, cesta padrão/extra) e estoque.
- Marcadores manuais de **Gestante** e **PCD**.

## Validação

1. Adicionar membro com nascimento 10/01/2018 → badge "Criança (8 anos)", contador de crianças +1.
2. Adicionar membro com nascimento 05/2010 → "Adolescente (15/16 anos)".
3. Adicionar membro com nascimento 1960 → "Idoso", contador de idosos +1.
4. Editar data de nascimento e ver reclassificação automática.
5. Data futura → erro de validação.
6. Cards de resumo da família refletem os membros cadastrados.
