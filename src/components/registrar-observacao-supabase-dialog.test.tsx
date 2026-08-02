import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CriarObservacaoInput } from "@/lib/familias/familias-repository";

const criarMutate = mock(async (_input: CriarObservacaoInput) => ({ id: "o-1" }));

// Ver a nota em pessoa-existente-banner.test.tsx: o mock precisa preservar os
// demais exports, senão o outro arquivo de teste quebra ao importá-los.
const hooksReais = await import("@/lib/familias/use-familias-supabase");

mock.module("@/lib/familias/use-familias-supabase", () => ({
  ...hooksReais,
  useCriarObservacaoSupabase: () => ({ mutateAsync: criarMutate, isPending: false }),
}));
mock.module("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

const { RegistrarObservacaoSupabaseDialog } =
  await import("@/components/registrar-observacao-supabase-dialog");

const MEMBROS = [
  { pessoaId: "p-1", nome: "Joana Silva" },
  { pessoaId: "p-2", nome: "Carlos Lima" },
];

function montar(membros = MEMBROS) {
  return render(
    <RegistrarObservacaoSupabaseDialog
      open
      onOpenChange={() => {}}
      familiaId="f-1"
      familiaNome="Família Souza"
      membros={membros}
    />,
  );
}

beforeEach(() => criarMutate.mockClear());
afterEach(cleanup);

describe("RegistrarObservacaoSupabaseDialog", () => {
  test("por padrão registra a observação para a família inteira", async () => {
    const user = userEvent.setup();
    montar();
    await user.type(screen.getByRole("textbox"), "Visita domiciliar realizada");
    await user.click(screen.getByRole("button", { name: /registrar observação/i }));

    await waitFor(() => expect(criarMutate).toHaveBeenCalledTimes(1));
    expect(criarMutate.mock.calls[0][0]).toEqual({
      familiaId: "f-1",
      tipo: "social",
      texto: "Visita domiciliar realizada",
      pessoaId: undefined,
    });
  });

  test("vincula a observação ao membro escolhido", async () => {
    // pointerEventsCheck desligado: o Radix marca os gatilhos com
    // `pointer-events: none` enquanto o diálogo está aberto, e o user-event
    // recusaria o clique por isso — não é um bloqueio real para o usuário.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    montar();
    // O primeiro combobox é o tipo; o segundo é o "Refere-se a".
    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByRole("option", { name: "Carlos Lima" }));
    await user.type(screen.getByRole("textbox"), "Iniciou tratamento");
    await user.click(screen.getByRole("button", { name: /registrar observação/i }));

    await waitFor(() => expect(criarMutate).toHaveBeenCalledTimes(1));
    expect(criarMutate.mock.calls[0][0].pessoaId).toBe("p-2");
  });

  test("sem membros não exibe o seletor", () => {
    montar([]);
    expect(screen.queryByText("Toda a família")).toBeNull();
  });

  test("não envia observação vazia", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /registrar observação/i }));
    expect(criarMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/escreva a observação/i)).toBeDefined();
  });
});
