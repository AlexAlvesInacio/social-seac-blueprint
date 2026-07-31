import { describe, expect, test } from "bun:test";

import { calcularFaixaEtaria, calcularIdade, rotuloFaixaEtaria } from "@/lib/familias/faixa-etaria";

/** Data ISO de quem completa `anos` anos exatamente hoje. */
function nascimentoHaAnos(anos: number, diasExtras = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anos);
  d.setDate(d.getDate() + diasExtras);
  return d.toISOString().slice(0, 10);
}

describe("calcularIdade", () => {
  test("sem nascimento → null", () => {
    expect(calcularIdade(undefined)).toBeNull();
    expect(calcularIdade("")).toBeNull();
  });

  test("data inválida → null", () => {
    expect(calcularIdade("não-é-data")).toBeNull();
  });

  test("data futura → null", () => {
    expect(calcularIdade(nascimentoHaAnos(-1))).toBeNull();
  });

  test("aniversário hoje → idade completa", () => {
    expect(calcularIdade(nascimentoHaAnos(30))).toBe(30);
  });

  test("aniversário ainda não chegou este ano → idade menos um", () => {
    // Nasceu há 30 anos, mas o aniversário é daqui a alguns dias.
    expect(calcularIdade(nascimentoHaAnos(30, 5))).toBe(29);
  });
});

describe("calcularFaixaEtaria — limites oficiais SEAC", () => {
  test("0 a 12 anos → criança", () => {
    expect(calcularFaixaEtaria(nascimentoHaAnos(0))).toBe("crianca");
    expect(calcularFaixaEtaria(nascimentoHaAnos(12))).toBe("crianca");
  });

  test("13 a 17 anos → adolescente", () => {
    expect(calcularFaixaEtaria(nascimentoHaAnos(13))).toBe("adolescente");
    expect(calcularFaixaEtaria(nascimentoHaAnos(17))).toBe("adolescente");
  });

  test("18 a 59 anos → adulto", () => {
    expect(calcularFaixaEtaria(nascimentoHaAnos(18))).toBe("adulto");
    expect(calcularFaixaEtaria(nascimentoHaAnos(59))).toBe("adulto");
  });

  test("60 anos ou mais → idoso", () => {
    expect(calcularFaixaEtaria(nascimentoHaAnos(60))).toBe("idoso");
    expect(calcularFaixaEtaria(nascimentoHaAnos(90))).toBe("idoso");
  });

  test("sem nascimento → null", () => {
    expect(calcularFaixaEtaria(undefined)).toBeNull();
  });
});

describe("rotuloFaixaEtaria", () => {
  test("rotula cada faixa em português", () => {
    expect(rotuloFaixaEtaria("crianca")).toBe("Criança");
    expect(rotuloFaixaEtaria("adolescente")).toBe("Adolescente");
    expect(rotuloFaixaEtaria("adulto")).toBe("Adulto");
    expect(rotuloFaixaEtaria("idoso")).toBe("Idoso");
  });

  test("null → travessão", () => {
    expect(rotuloFaixaEtaria(null)).toBe("—");
  });
});
