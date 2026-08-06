import { describe, expect, test } from "bun:test";

import { contarBeneficios, contarVisitas, type EntregaContavel } from "@/lib/painel/visitas";

const entrega = (over: Partial<EntregaContavel> = {}): EntregaContavel => ({
  assistidoId: "a1",
  criadoEm: "2026-08-06T19:39:00.000Z",
  quantidade: 1,
  ...over,
});

describe("contarVisitas", () => {
  test("lista vazia → zero", () => {
    expect(contarVisitas([])).toBe(0);
  });

  test("cesta e adicional na mesma visita contam como uma", () => {
    // O caso real que motivou a mudança: Cesta Padrão + Ovo de Páscoa às 19:39.
    const visita = [entrega(), entrega()];
    expect(contarVisitas(visita)).toBe(1);
    expect(contarBeneficios(visita)).toBe(2);
  });

  test("mesmo assistido em instantes diferentes são visitas diferentes", () => {
    expect(contarVisitas([entrega(), entrega({ criadoEm: "2026-09-06T10:00:00.000Z" })])).toBe(2);
  });

  test("assistidos diferentes no mesmo instante são visitas diferentes", () => {
    expect(contarVisitas([entrega(), entrega({ assistidoId: "a2" })])).toBe(2);
  });
});

describe("contarBeneficios", () => {
  test("soma a quantidade, não as linhas", () => {
    // Uma família autorizada a levar 3 ovos: 1 linha, 3 unidades.
    expect(contarBeneficios([entrega({ quantidade: 3 })])).toBe(3);
    expect(contarBeneficios([entrega(), entrega({ quantidade: 3 })])).toBe(4);
  });

  test("quantidade inválida não subtrai do total", () => {
    expect(contarBeneficios([entrega({ quantidade: 0 }), entrega({ quantidade: -2 })])).toBe(0);
    expect(contarBeneficios([entrega({ quantidade: 2 }), entrega({ quantidade: -5 })])).toBe(2);
  });
});
