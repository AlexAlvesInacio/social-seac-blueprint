import { describe, expect, test } from "bun:test";

import { mapFamiliaFromSupabase, mapFamiliasFromSupabase } from "@/lib/familias/familias-mapper";
import type {
  AssistidoSupabaseRow,
  FamiliaSupabaseAggregateRows,
  FamiliaSupabaseRow,
  MembroFamiliarSupabaseRow,
  ObservacaoSocialSupabaseRow,
  PessoaSupabaseRow,
} from "@/lib/familias/familias-supabase-types";
import { FamiliasSupabaseIntegrityError } from "@/lib/familias/familias-supabase-types";

const AUTOR = "00000000-0000-4000-8000-00000000aaaa";

function familiaRow(overrides: Partial<FamiliaSupabaseRow> = {}): FamiliaSupabaseRow {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    nome_referencia: "Família Teste",
    endereco: "Rua A",
    numero: "10",
    complemento: null,
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    cep: null,
    status: "liberado",
    acompanhamento: "em_dia",
    criado_em: "2026-07-01T10:00:00Z",
    atualizado_em: "2026-07-01T10:00:00Z",
    criado_por: AUTOR,
    atualizado_por: AUTOR,
    ...overrides,
  };
}

function pessoaRow(
  id: string,
  nome: string,
  overrides: Partial<PessoaSupabaseRow> = {},
): PessoaSupabaseRow {
  return {
    id,
    nome,
    tipo_documento: "cpf",
    documento: "111.111.111-11",
    documento_normalizado: "11111111111",
    telefone: "(11) 90000-0000",
    nascimento: "1990-01-01",
    pcd: false,
    observacoes: null,
    criado_em: "2026-07-01T10:00:00Z",
    atualizado_em: "2026-07-01T10:00:00Z",
    criado_por: AUTOR,
    atualizado_por: AUTOR,
    ...overrides,
  };
}

function membroRow(
  id: string,
  familiaId: string,
  pessoaId: string,
  overrides: Partial<MembroFamiliarSupabaseRow> = {},
): MembroFamiliarSupabaseRow {
  return {
    id,
    familia_id: familiaId,
    pessoa_id: pessoaId,
    parentesco: "Responsável",
    responsavel_principal: false,
    gestante: false,
    status: "ativo",
    criado_em: "2026-07-01T10:00:00Z",
    atualizado_em: "2026-07-01T10:00:00Z",
    criado_por: AUTOR,
    atualizado_por: AUTOR,
    ...overrides,
  };
}

function assistidoRow(
  id: string,
  familiaId: string,
  pessoaId: string,
  membroId: string,
  overrides: Partial<AssistidoSupabaseRow> = {},
): AssistidoSupabaseRow {
  return {
    id,
    familia_id: familiaId,
    pessoa_id: pessoaId,
    membro_familiar_id: membroId,
    tipo_cadastro: "definitivo",
    beneficio: "Cesta Padrão",
    status: "ativo",
    observacoes: null,
    criado_em: "2026-07-01T10:00:00Z",
    atualizado_em: "2026-07-01T10:00:00Z",
    criado_por: AUTOR,
    atualizado_por: AUTOR,
    ...overrides,
  };
}

function observacaoRow(
  id: string,
  familiaId: string,
  criadoEm: string,
  overrides: Partial<ObservacaoSocialSupabaseRow> = {},
): ObservacaoSocialSupabaseRow {
  return {
    id,
    familia_id: familiaId,
    pessoa_id: null,
    assistido_id: null,
    tipo: "social",
    texto: "Observação de teste",
    criado_em: criadoEm,
    criado_por: AUTOR,
    ...overrides,
  };
}

const FAMILIA_ID = "10000000-0000-4000-8000-000000000001";
const PESSOA_RESP = "20000000-0000-4000-8000-000000000001";
const PESSOA_FILHO = "20000000-0000-4000-8000-000000000002";
const MEMBRO_RESP = "30000000-0000-4000-8000-000000000001";
const MEMBRO_FILHO = "30000000-0000-4000-8000-000000000002";
const ASSISTIDO_RESP = "40000000-0000-4000-8000-000000000001";

function aggregateBase(): FamiliaSupabaseAggregateRows {
  return {
    familia: familiaRow(),
    pessoas: [
      pessoaRow(PESSOA_RESP, "Maria Responsável", { documento: "222.222.222-22" }),
      pessoaRow(PESSOA_FILHO, "João Filho", { nascimento: "2020-01-01" }),
    ],
    membros: [
      membroRow(MEMBRO_RESP, FAMILIA_ID, PESSOA_RESP, { responsavel_principal: true }),
      membroRow(MEMBRO_FILHO, FAMILIA_ID, PESSOA_FILHO, { parentesco: "Filho(a)" }),
    ],
    assistidos: [assistidoRow(ASSISTIDO_RESP, FAMILIA_ID, PESSOA_RESP, MEMBRO_RESP)],
    observacoes: [
      observacaoRow("50000000-0000-4000-8000-000000000001", FAMILIA_ID, "2026-07-01T10:00:00Z"),
      observacaoRow("50000000-0000-4000-8000-000000000002", FAMILIA_ID, "2026-07-02T10:00:00Z", {
        tipo: "saude_pcd",
      }),
    ],
  };
}

describe("mapFamiliaFromSupabase", () => {
  test("resolve o responsável principal ativo e projeta os dados de contato da família", () => {
    const familia = mapFamiliaFromSupabase(aggregateBase());

    expect(familia.nome).toBe("Família Teste");
    expect(familia.responsavel).toBe("Maria Responsável");
    expect(familia.documento).toBe("222.222.222-22");
    expect(familia.responsavelPrincipal?.id).toBe(MEMBRO_RESP);
  });

  test("membro responsável inativo não vira responsável da família", () => {
    const aggregate = aggregateBase();
    aggregate.membros[0].status = "inativo";

    const familia = mapFamiliaFromSupabase(aggregate);

    expect(familia.responsavelPrincipal).toBeNull();
    expect(familia.responsavel).toBe("");
    expect(familia.documento).toBe("");
  });

  test("vincula assistidos ao membro e expõe o assistido ativo como assistidoId", () => {
    const familia = mapFamiliaFromSupabase(aggregateBase());
    const responsavel = familia.membros.find((m) => m.id === MEMBRO_RESP);
    const filho = familia.membros.find((m) => m.id === MEMBRO_FILHO);

    expect(responsavel?.assistidos.map((a) => a.id)).toEqual([ASSISTIDO_RESP]);
    expect(responsavel?.assistidoId).toBe(ASSISTIDO_RESP);
    expect(filho?.assistidos).toEqual([]);
    expect(filho?.assistidoId).toBeUndefined();
  });

  test("assistido inativo não é apontado como assistidoId do membro", () => {
    const aggregate = aggregateBase();
    aggregate.assistidos[0].status = "inativo";

    const familia = mapFamiliaFromSupabase(aggregate);
    const responsavel = familia.membros.find((m) => m.id === MEMBRO_RESP);

    expect(responsavel?.assistidos).toHaveLength(1);
    expect(responsavel?.assistidoId).toBeUndefined();
  });

  test("assistido herda nome/documento/nascimento da pessoa", () => {
    const familia = mapFamiliaFromSupabase(aggregateBase());
    const assistido = familia.assistidos[0];

    expect(assistido.nome).toBe("Maria Responsável");
    expect(assistido.documento).toBe("222.222.222-22");
    expect(assistido.tipoCadastro).toBe("definitivo");
  });

  test("marca faixas etárias do membro a partir do nascimento da pessoa", () => {
    const familia = mapFamiliaFromSupabase(aggregateBase());
    const filho = familia.membros.find((m) => m.id === MEMBRO_FILHO);

    // Nascido em 2020 → criança nas regras oficiais.
    expect(filho?.crianca).toBe(true);
    expect(filho?.adolescente).toBe(false);
    expect(filho?.idoso).toBe(false);
  });

  test("ordena observações da mais recente para a mais antiga e traduz o tipo", () => {
    const familia = mapFamiliaFromSupabase(aggregateBase());

    expect(familia.observacoes.map((o) => o.id)).toEqual([
      "50000000-0000-4000-8000-000000000002",
      "50000000-0000-4000-8000-000000000001",
    ]);
    expect(familia.observacoes[0].tipo).toBe("Saúde/PCD");
    expect(familia.observacoes[1].tipo).toBe("Social");
  });

  test("pessoa referenciada e não carregada → FamiliasSupabaseIntegrityError", () => {
    const aggregate = aggregateBase();
    aggregate.pessoas = aggregate.pessoas.filter((p) => p.id !== PESSOA_FILHO);

    expect(() => mapFamiliaFromSupabase(aggregate)).toThrow(FamiliasSupabaseIntegrityError);
  });
});

describe("mapFamiliasFromSupabase", () => {
  test("particiona membros, assistidos e observações por família", () => {
    const outraFamiliaId = "10000000-0000-4000-8000-000000000002";
    const outraPessoaId = "20000000-0000-4000-8000-000000000009";
    const outroMembroId = "30000000-0000-4000-8000-000000000009";
    const base = aggregateBase();

    const familias = mapFamiliasFromSupabase(
      [base.familia, familiaRow({ id: outraFamiliaId, nome_referencia: "Família Dois" })],
      [...base.pessoas, pessoaRow(outraPessoaId, "Ana Dois")],
      [
        ...base.membros,
        membroRow(outroMembroId, outraFamiliaId, outraPessoaId, { responsavel_principal: true }),
      ],
      base.assistidos,
      base.observacoes,
    );

    expect(familias).toHaveLength(2);
    const [primeira, segunda] = familias;
    expect(primeira.membros).toHaveLength(2);
    expect(primeira.assistidos).toHaveLength(1);
    expect(primeira.observacoes).toHaveLength(2);
    expect(segunda.responsavel).toBe("Ana Dois");
    expect(segunda.membros).toHaveLength(1);
    expect(segunda.assistidos).toHaveLength(0);
    expect(segunda.observacoes).toHaveLength(0);
  });
});
