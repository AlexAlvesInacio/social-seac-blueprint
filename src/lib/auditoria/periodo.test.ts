import { describe, expect, test } from "bun:test";

import {
  dataLocalISO,
  diasAtrasLocalISO,
  hojeLocalISO,
  limitesDoPeriodo,
} from "@/lib/auditoria/periodo";

/**
 * Instante construído no fuso local. Assim as asserções valem em qualquer
 * máquina — inclusive numa que rode em UTC, como o WSL costuma fazer — sem
 * precisar pular teste por causa do fuso.
 */
function local(ano: number, mes: number, dia: number, hora = 0, minuto = 0): Date {
  return new Date(ano, mes - 1, dia, hora, minuto);
}

describe("dataLocalISO", () => {
  test("devolve a data do fuso local, que é a exibida na tabela", () => {
    // Às 22:33 em Brasília já é o dia seguinte em UTC; a tabela mostra 05/08.
    expect(dataLocalISO(local(2026, 8, 5, 22, 33).toISOString())).toBe("2026-08-05");
    expect(dataLocalISO(local(2026, 8, 6, 0, 15).toISOString())).toBe("2026-08-06");
  });

  test("aceita Date e zera à esquerda mês e dia", () => {
    expect(dataLocalISO(local(2026, 1, 9, 12))).toBe("2026-01-09");
  });

  test("data inválida → null", () => {
    expect(dataLocalISO("não-é-data")).toBeNull();
  });
});

describe("valores iniciais do filtro", () => {
  test("hoje e sete dias atrás saem no formato do input de data", () => {
    const agora = local(2026, 8, 6, 10);
    expect(hojeLocalISO(agora)).toBe("2026-08-06");
    expect(diasAtrasLocalISO(7, agora)).toBe("2026-07-30");
  });

  test("atravessa a virada de mês", () => {
    expect(diasAtrasLocalISO(7, local(2026, 8, 3, 10))).toBe("2026-07-27");
  });
});

describe("limitesDoPeriodo", () => {
  test("o limite superior é o início do dia seguinte, exclusivo", () => {
    const { desde, antesDe } = limitesDoPeriodo("2026-08-05", "2026-08-06");
    expect(desde).toBe(local(2026, 8, 5).toISOString());
    expect(antesDe).toBe(local(2026, 8, 7).toISOString());
  });

  test("um evento às 23:59 do último dia cai dentro da janela", () => {
    const { antesDe } = limitesDoPeriodo("2026-08-05", "2026-08-06");
    const fimDoDia = local(2026, 8, 6, 23, 59).toISOString();
    expect(fimDoDia < antesDe!).toBe(true);
  });

  test("um evento da madrugada seguinte cai fora", () => {
    const { antesDe } = limitesDoPeriodo("2026-08-05", "2026-08-06");
    expect(local(2026, 8, 7, 0, 1).toISOString() < antesDe!).toBe(false);
  });

  test("limite ausente ou malformado não restringe", () => {
    expect(limitesDoPeriodo("", "")).toEqual({ desde: null, antesDe: null });
    expect(limitesDoPeriodo("06/08/2026", "")).toEqual({ desde: null, antesDe: null });
  });
});
