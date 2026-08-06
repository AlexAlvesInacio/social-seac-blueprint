import { describe, expect, test } from "bun:test";

import { emAlerta, STATUS_ALERTA, statusEstoque } from "@/lib/estoque/status-estoque";

describe("statusEstoque", () => {
  test("saldo zerado ou negativo → sem estoque, mesmo sem mínimo", () => {
    expect(statusEstoque(0, 0)).toBe("Sem estoque");
    expect(statusEstoque(0, 30)).toBe("Sem estoque");
    expect(statusEstoque(-5, 30)).toBe("Sem estoque");
  });

  test("sem mínimo definido, qualquer saldo positivo está em estoque", () => {
    expect(statusEstoque(1, 0)).toBe("Em estoque");
    expect(statusEstoque(500, 0)).toBe("Em estoque");
  });

  test("abaixo de metade do mínimo → estoque baixo", () => {
    expect(statusEstoque(14, 30)).toBe("Estoque baixo");
    expect(statusEstoque(1, 30)).toBe("Estoque baixo");
  });

  test("metade exata do mínimo ainda é atenção, não estoque baixo", () => {
    expect(statusEstoque(15, 30)).toBe("Atenção");
  });

  test("entre metade e o mínimo → atenção", () => {
    expect(statusEstoque(29, 30)).toBe("Atenção");
  });

  test("no mínimo ou acima → em estoque", () => {
    expect(statusEstoque(30, 30)).toBe("Em estoque");
    expect(statusEstoque(31, 30)).toBe("Em estoque");
  });
});

describe("emAlerta", () => {
  test("só 'Em estoque' fica fora do alerta", () => {
    expect(emAlerta(30, 30)).toBe(false);
    expect(emAlerta(29, 30)).toBe(true);
    expect(emAlerta(14, 30)).toBe(true);
    expect(emAlerta(0, 30)).toBe(true);
  });

  test("STATUS_ALERTA cobre exatamente os três status críticos", () => {
    expect(STATUS_ALERTA.has("Sem estoque")).toBe(true);
    expect(STATUS_ALERTA.has("Estoque baixo")).toBe(true);
    expect(STATUS_ALERTA.has("Atenção")).toBe(true);
    expect(STATUS_ALERTA.has("Em estoque")).toBe(false);
  });
});
