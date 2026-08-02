import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { ParamNum } from "@/components/param-num";

afterEach(cleanup);

const AVISO_ZERO = "Com 0, o prazo mínimo deixa de existir.";

describe("ParamNum", () => {
  test("valor igual ao recomendado não gera aviso", () => {
    render(<ParamNum label="Prazo" value={25} onChange={() => {}} recomendado={25} />);
    expect(screen.queryByText(/fora do valor previsto/i)).toBeNull();
  });

  test("valor diferente do recomendado avisa e cita o previsto", () => {
    render(
      <ParamNum label="Prazo" value={10} onChange={() => {}} recomendado={25} unidade="dias" />,
    );
    expect(
      screen.getByText(/fora do valor previsto nas regras aprovadas \(25 dias\)/i),
    ).toBeDefined();
  });

  test("zero mostra o aviso forte de regra desligada, não o de divergência", () => {
    render(
      <ParamNum
        label="Prazo"
        value={0}
        onChange={() => {}}
        recomendado={25}
        avisoAoZerar={AVISO_ZERO}
      />,
    );
    expect(screen.getByText(AVISO_ZERO)).toBeDefined();
    expect(screen.queryByText(/fora do valor previsto/i)).toBeNull();
  });

  test("zero sem avisoAoZerar cai no aviso comum de divergência", () => {
    render(<ParamNum label="Qualquer" value={0} onChange={() => {}} recomendado={45} />);
    expect(screen.getByText(/fora do valor previsto/i)).toBeDefined();
  });

  test("sem recomendado, nenhum aviso é exibido", () => {
    render(<ParamNum label="Livre" value={0} onChange={() => {}} />);
    expect(screen.queryByText(/fora do valor previsto/i)).toBeNull();
  });
});
