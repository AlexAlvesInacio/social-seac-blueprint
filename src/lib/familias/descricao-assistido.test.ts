import { describe, expect, test } from "bun:test";

import { descricaoAssistido } from "@/lib/familias/descricao-assistido";

describe("descricaoAssistido", () => {
  test("sem assistido → travessão", () => {
    expect(descricaoAssistido(undefined, "MARIA DE LOURDES DOS SANTOS")).toBe("—");
  });

  test("responsável: nome igual ao da família → mostra uma vez só", () => {
    expect(descricaoAssistido("MARIA DE LOURDES DOS SANTOS", "MARIA DE LOURDES DOS SANTOS")).toBe(
      "MARIA DE LOURDES DOS SANTOS",
    );
  });

  test("ignora caixa e espaços extras ao comparar", () => {
    expect(descricaoAssistido("Maria de Lourdes", "MARIA  DE   LOURDES ")).toBe("Maria de Lourdes");
  });

  test("membro com nome diferente → mostra a família", () => {
    expect(descricaoAssistido("JOÃO DOS SANTOS", "MARIA DE LOURDES DOS SANTOS")).toBe(
      "JOÃO DOS SANTOS — família MARIA DE LOURDES DOS SANTOS",
    );
  });
});
