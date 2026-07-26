import { describe, expect, test } from "bun:test";

import {
  formatBR,
  verificarElegibilidadeAtendimento,
  type AssistidoRegra,
  type EstoqueBeneficio,
} from "@/lib/atendimento-regras";

const HOJE = "2026-02-01";
const ESTOQUE_OK: EstoqueBeneficio = { cestaPadrao: 10, cestaExtra: 10 };

function assistido(over: Partial<AssistidoRegra> = {}): AssistidoRegra {
  return {
    nome: "Fulano",
    documento: "00000000000",
    telefone: "",
    familia: "Família",
    endereco: "",
    tipoCadastro: "definitivo",
    ultimaRetiradaISO: null,
    retiradasExtras: 0,
    ...over,
  };
}

describe("verificarElegibilidadeAtendimento", () => {
  test("definitivo sem retirada anterior e com estoque → liberado_padrao", () => {
    const r = verificarElegibilidadeAtendimento(assistido(), ESTOQUE_OK, HOJE);
    expect(r).toEqual({ cenario: "liberado_padrao", beneficio: "Cesta Padrão" });
  });

  test("extra sem retiradas → liberado_extra com progresso 1", () => {
    const r = verificarElegibilidadeAtendimento(
      assistido({ tipoCadastro: "extra", retiradasExtras: 0 }),
      ESTOQUE_OK,
      HOJE,
    );
    expect(r).toEqual({ cenario: "liberado_extra", beneficio: "Cesta Extra", progresso: 1 });
  });

  test("extra com 1 e 2 retiradas → progresso 2 e 3", () => {
    const r1 = verificarElegibilidadeAtendimento(
      assistido({ tipoCadastro: "extra", retiradasExtras: 1 }),
      ESTOQUE_OK,
      HOJE,
    );
    const r2 = verificarElegibilidadeAtendimento(
      assistido({ tipoCadastro: "extra", retiradasExtras: 2 }),
      ESTOQUE_OK,
      HOJE,
    );
    expect(r1).toMatchObject({ cenario: "liberado_extra", progresso: 2 });
    expect(r2).toMatchObject({ cenario: "liberado_extra", progresso: 3 });
  });

  test("extra que já completou 3 retiradas → extra_completou (tem precedência sobre 25 dias)", () => {
    const r = verificarElegibilidadeAtendimento(
      assistido({ tipoCadastro: "extra", retiradasExtras: 3, ultimaRetiradaISO: "2026-01-31" }),
      ESTOQUE_OK,
      HOJE,
    );
    expect(r).toEqual({ cenario: "extra_completou", beneficio: "Cesta Extra" });
  });

  test("dentro dos 25 dias → bloqueio_25dias com próxima data e dias restantes", () => {
    // Última retirada 24 dias antes de HOJE (2026-01-08): próxima = 2026-02-02, falta 1 dia.
    const r = verificarElegibilidadeAtendimento(
      assistido({ ultimaRetiradaISO: "2026-01-08" }),
      ESTOQUE_OK,
      HOJE,
    );
    expect(r).toEqual({
      cenario: "bloqueio_25dias",
      beneficio: "Cesta Padrão",
      proximaDataISO: "2026-02-02",
      diasRestantes: 1,
    });
  });

  test("exatamente 25 dias depois → liberado (prazo cumprido)", () => {
    // Última em 2026-01-07; próxima = 2026-02-01 = HOJE → diasRestantes 0 → libera.
    const r = verificarElegibilidadeAtendimento(
      assistido({ ultimaRetiradaISO: "2026-01-07" }),
      ESTOQUE_OK,
      HOJE,
    );
    expect(r).toMatchObject({ cenario: "liberado_padrao" });
  });

  test("bloqueio_25dias tem precedência sobre falta de estoque", () => {
    const r = verificarElegibilidadeAtendimento(
      assistido({ ultimaRetiradaISO: "2026-01-20" }),
      { cestaPadrao: 0, cestaExtra: 0 },
      HOJE,
    );
    expect(r).toMatchObject({ cenario: "bloqueio_25dias" });
  });

  test("fora do prazo mas sem estoque → bloqueio_estoque", () => {
    const r = verificarElegibilidadeAtendimento(
      assistido({ ultimaRetiradaISO: "2025-01-01" }),
      { cestaPadrao: 0, cestaExtra: 10 },
      HOJE,
    );
    expect(r).toEqual({ cenario: "bloqueio_estoque", beneficio: "Cesta Padrão" });
  });

  test("overrides de intervalo e limite são respeitados", () => {
    // intervalo 10 dias: última 2026-01-25 (7 dias antes) → ainda bloqueado.
    const bloq = verificarElegibilidadeAtendimento(
      assistido({ ultimaRetiradaISO: "2026-01-25" }),
      ESTOQUE_OK,
      HOJE,
      { intervaloMinimoDias: 10 },
    );
    expect(bloq).toMatchObject({ cenario: "bloqueio_25dias" });

    // limite extra 1: com 1 retirada já completou.
    const completou = verificarElegibilidadeAtendimento(
      assistido({ tipoCadastro: "extra", retiradasExtras: 1 }),
      ESTOQUE_OK,
      HOJE,
      { limiteExtra: 1 },
    );
    expect(completou).toMatchObject({ cenario: "extra_completou" });
  });
});

describe("formatBR", () => {
  test("formata YYYY-MM-DD em DD/MM/AAAA", () => {
    expect(formatBR("2026-01-05")).toBe("05/01/2026");
  });
  test("null → travessão", () => {
    expect(formatBR(null)).toBe("—");
  });
});
