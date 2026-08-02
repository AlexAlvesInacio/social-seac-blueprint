import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentProfile } from "@/lib/auth/auth-service";
import { usePessoaPorDocumento, useTransferirPessoa } from "@/lib/familias/use-familias-supabase";
import type { PessoaExistente } from "@/lib/familias/familias-supabase-types";

const MOTIVO_MINIMO = 5;

type Props = {
  documento: string;
  /** pessoaId atualmente selecionado para reuso (""=nenhum). */
  pessoaIdSelecionado: string;
  onReutilizar: (pessoa: PessoaExistente) => void;
  onLimpar: () => void;
  /**
   * Família em que o cadastro está sendo feito. Quando informada, uma pessoa
   * ativa em outra família pode ser transferida para cá — sem ela, o banner só
   * avisa que a transferência seria necessária.
   */
  familiaDestinoId?: string;
};

/**
 * Detecta uma pessoa já cadastrada pelo documento e oferece reutilizá-la,
 * evitando o erro de documento duplicado. Se a pessoa é membro ativo de outra
 * família, oferece a transferência (só administrador, com motivo obrigatório).
 */
export function PessoaExistenteBanner({
  documento,
  pessoaIdSelecionado,
  onReutilizar,
  onLimpar,
  familiaDestinoId,
}: Props) {
  const { data: pessoa } = usePessoaPorDocumento(documento);
  const transferir = useTransferirPessoa();
  const [isAdmin, setIsAdmin] = useState(false);
  const [abrirTransferencia, setAbrirTransferencia] = useState(false);
  const [motivo, setMotivo] = useState("");

  const emOutraFamilia = Boolean(pessoa?.familiaAtivaId);

  useEffect(() => {
    if (!emOutraFamilia) return;
    let active = true;
    void getCurrentProfile().then(({ data }) => {
      if (active) setIsAdmin(data?.papel === "administrador");
    });
    return () => {
      active = false;
    };
  }, [emOutraFamilia]);

  // Trocar o documento digitado descarta o formulário pela metade.
  useEffect(() => {
    setAbrirTransferencia(false);
    setMotivo("");
    transferir.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa?.pessoaId]);

  if (!pessoa) return null;

  if (pessoa.familiaAtivaId) {
    const podeTransferir = isAdmin && Boolean(familiaDestinoId);
    const motivoValido = motivo.trim().length >= MOTIVO_MINIMO;

    return (
      <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-2 text-xs text-foreground">
        <div>
          <strong>{pessoa.nome}</strong> já é membro ativo da família{" "}
          <strong>{pessoa.familiaAtivaNome || "—"}</strong>.
        </div>

        {!podeTransferir ? (
          <div className="text-muted-foreground">
            {isAdmin
              ? "Reuso indisponível aqui — abra o cadastro pela família de destino para transferir."
              : "Reuso indisponível — a transferência entre famílias exige um administrador."}
          </div>
        ) : !abrirTransferencia ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              Transferir para esta família encerra o vínculo na anterior.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0"
              onClick={() => setAbrirTransferencia(true)}
            >
              Transferir
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              O vínculo em <strong>{pessoa.familiaAtivaNome}</strong> será encerrado, inclusive como
              assistida se ela receber benefício lá. O histórico de retiradas acompanha a pessoa:
              prazo e limite de Cesta Extra continuam valendo.
            </p>
            <Input
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo da transferência (obrigatório)"
              className="h-8 text-xs"
            />
            {transferir.isError ? (
              <p className="text-destructive">
                {transferir.error instanceof Error
                  ? transferir.error.message
                  : "Não foi possível transferir."}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={transferir.isPending}
                onClick={() => {
                  setAbrirTransferencia(false);
                  setMotivo("");
                  transferir.reset();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7"
                disabled={!motivoValido || transferir.isPending}
                onClick={() => {
                  if (!familiaDestinoId) return;
                  transferir.mutate(
                    { pessoaId: pessoa.pessoaId, familiaDestinoId, motivo },
                    { onSuccess: () => onReutilizar(pessoa) },
                  );
                }}
              >
                {transferir.isPending ? "Transferindo…" : "Confirmar transferência"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const selecionada = pessoaIdSelecionado === pessoa.pessoaId;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 p-2 text-xs">
      <span>
        {selecionada ? "Reutilizando: " : "Pessoa já cadastrada: "}
        <strong>{pessoa.nome}</strong>
        {pessoa.telefone ? ` · ${pessoa.telefone}` : ""}
      </span>
      {selecionada ? (
        <Button type="button" size="sm" variant="ghost" className="h-7" onClick={onLimpar}>
          Desfazer
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => onReutilizar(pessoa)}
        >
          Reutilizar
        </Button>
      )}
    </div>
  );
}
