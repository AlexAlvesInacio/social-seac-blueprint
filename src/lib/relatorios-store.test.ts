import { describe, expect, test } from "bun:test";

import {
  relatorioParaCSV,
  type ResultadoRelatorio,
  type TipoRelatorio,
} from "@/lib/relatorios-store";

function resultado(
  colunas: string[],
  linhas: (string | number)[][],
  tipo: TipoRelatorio = "familias",
): ResultadoRelatorio {
  return {
    tipo,
    tituloRelatorio: "Teste",
    colunas,
    linhas,
    totalRegistros: linhas.length,
    dataHoraGeracao: "2026-02-01T00:00:00.000Z",
    usuarioGerador: "teste",
    filtrosAplicados: {},
  };
}

const BOM = "﻿";

describe("relatorioParaCSV", () => {
  test("gera cabeçalho + linhas com BOM e CRLF", () => {
    const csv = relatorioParaCSV(resultado(["Nome", "Idade"], [["Ana", 30]]));
    expect(csv).toBe(`${BOM}Nome;Idade\r\nAna;30`);
  });

  test("escapa campos com ponto e vírgula entre aspas", () => {
    const csv = relatorioParaCSV(resultado(["Obs"], [["a; b"]]));
    expect(csv).toBe(`${BOM}Obs\r\n"a; b"`);
  });

  test("duplica aspas internas e envolve o campo", () => {
    const csv = relatorioParaCSV(resultado(["Obs"], [['diz "oi"']]));
    expect(csv).toBe(`${BOM}Obs\r\n"diz ""oi"""`);
  });

  test("campos simples não são escapados", () => {
    const csv = relatorioParaCSV(resultado(["A", "B"], [["x", "y"]]));
    expect(csv).toBe(`${BOM}A;B\r\nx;y`);
  });
});
