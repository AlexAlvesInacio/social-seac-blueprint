import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  formatBR,
  verificarElegibilidadeAtendimento,
  type Elegibilidade,
} from "@/lib/atendimento-regras";
import { getCurrentProfile } from "@/lib/auth/auth-service";
import type { AssistidoSupabaseReadModel } from "@/lib/familias/familias-supabase-types";
import {
  useRegistrarEntregaSupabase,
  useRegistrarTentativaSupabase,
  useResumoAtendimento,
} from "@/lib/familias/use-familias-supabase";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assistido: AssistidoSupabaseReadModel | null;
  familiaNome: string;
};

const MOTIVO_MINIMO = 5;

export function RegistrarEntregaSupabaseDialog({
  open,
  onOpenChange,
  assistido,
  familiaNome,
}: Props) {
  const assistidoId = open && assistido ? assistido.id : "";
  const resumoQuery = useResumoAtendimento(assistidoId);
  const registrarEntrega = useRegistrarEntregaSupabase();
  const registrarTentativa = useRegistrarTentativaSupabase();
  const [motivo, setMotivo] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!open) {
      setMotivo("");
      return;
    }
    let active = true;
    void getCurrentProfile().then(({ data }) => {
      if (active) setIsAdmin(data?.papel === "administrador");
    });
    return () => {
      active = false;
    };
  }, [open]);

  const salvando = registrarEntrega.isPending || registrarTentativa.isPending;

  const elegibilidade: Elegibilidade | null =
    assistido && resumoQuery.data
      ? verificarElegibilidadeAtendimento(
          {
            nome: assistido.nome,
            documento: assistido.documento,
            telefone: assistido.telefone ?? "",
            familia: familiaNome,
            endereco: "",
            tipoCadastro: assistido.tipoCadastro,
            ultimaRetiradaISO: resumoQuery.data.ultimaRetiradaISO,
            retiradasExtras: resumoQuery.data.retiradasExtras,
          },
          {
            cestaPadrao: resumoQuery.data.saldoPadrao,
            cestaExtra: resumoQuery.data.saldoExtra,
          },
        )
      : null;

  const confirmarEntrega = async (excepcional: boolean) => {
    if (!assistido) return;
    try {
      const data = await registrarEntrega.mutateAsync({
        assistidoId: assistido.id,
        familiaId: assistido.familiaId,
        excepcional,
        observacao: excepcional ? motivo : undefined,
      });
      toast.success(
        `Entrega registrada (${data.beneficio}). Saldo restante: ${data.saldo_resultante}.`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar a entrega.");
    }
  };

  const registrarBloqueio = async (motivoTipo: "prazo" | "estoque") => {
    if (!assistido) return;
    try {
      await registrarTentativa.mutateAsync({
        assistidoId: assistido.id,
        familiaId: assistido.familiaId,
        motivo: motivoTipo,
      });
      toast.success("Tentativa bloqueada registrada.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar a tentativa.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar entrega</DialogTitle>
          <DialogDescription>
            {assistido ? `${assistido.nome} — ${familiaNome}` : "—"}
          </DialogDescription>
        </DialogHeader>

        {resumoQuery.isPending ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Verificando elegibilidade…
          </div>
        ) : resumoQuery.isError || !elegibilidade ? (
          <p className="py-6 text-sm text-destructive">
            Não foi possível verificar a elegibilidade. Tente novamente.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <CenarioResumo elegibilidade={elegibilidade} />

            {(elegibilidade.cenario === "liberado_padrao" ||
              elegibilidade.cenario === "liberado_extra") && (
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button disabled={salvando} onClick={() => void confirmarEntrega(false)}>
                  {salvando ? "Registrando…" : `Confirmar entrega — ${elegibilidade.beneficio}`}
                </Button>
              </DialogFooter>
            )}

            {elegibilidade.cenario === "bloqueio_25dias" && (
              <div className="space-y-3">
                {isAdmin ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Motivo da liberação excepcional (obrigatório)
                    </Label>
                    <Textarea
                      rows={3}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Descreva o motivo da liberação antes do prazo."
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Somente um administrador pode liberar excepcionalmente antes do prazo.
                  </p>
                )}
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    disabled={salvando}
                    onClick={() => void registrarBloqueio("prazo")}
                  >
                    Registrar tentativa
                  </Button>
                  {isAdmin && (
                    <Button
                      disabled={salvando || motivo.trim().length < MOTIVO_MINIMO}
                      onClick={() => void confirmarEntrega(true)}
                    >
                      {salvando ? "Liberando…" : "Liberar excepcionalmente"}
                    </Button>
                  )}
                </DialogFooter>
              </div>
            )}

            {elegibilidade.cenario === "bloqueio_estoque" && (
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button disabled={salvando} onClick={() => void registrarBloqueio("estoque")}>
                  Registrar tentativa
                </Button>
              </DialogFooter>
            )}

            {elegibilidade.cenario === "extra_completou" && (
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CenarioResumo({ elegibilidade }: { elegibilidade: Elegibilidade }) {
  switch (elegibilidade.cenario) {
    case "liberado_padrao":
      return (
        <div className="text-sm">
          <Badge className="mr-2 bg-primary/15 text-primary hover:bg-primary/15">Liberado</Badge>
          Elegível para <strong>Cesta Padrão</strong>.
        </div>
      );
    case "liberado_extra":
      return (
        <div className="text-sm">
          <Badge className="mr-2 bg-primary/15 text-primary hover:bg-primary/15">Liberado</Badge>
          Elegível para <strong>Cesta Extra</strong> — retirada {elegibilidade.progresso}/3.
        </div>
      );
    case "bloqueio_25dias":
      return (
        <div className="text-sm">
          <Badge variant="destructive" className="mr-2">
            Bloqueado (25 dias)
          </Badge>
          Próxima data permitida: <strong>{formatBR(elegibilidade.proximaDataISO)}</strong> (faltam{" "}
          {elegibilidade.diasRestantes} {elegibilidade.diasRestantes === 1 ? "dia" : "dias"}).
        </div>
      );
    case "bloqueio_estoque":
      return (
        <div className="text-sm">
          <Badge variant="destructive" className="mr-2">
            Sem estoque
          </Badge>
          Sem saldo de <strong>{elegibilidade.beneficio}</strong>. Não é permitida liberação
          excepcional por falta de estoque.
        </div>
      );
    case "extra_completou":
      return (
        <div className="text-sm">
          <Badge variant="destructive" className="mr-2">
            Extra completou
          </Badge>
          Já foram feitas 3 retiradas de Cesta Extra; aguardar avaliação de cadastro definitivo.
        </div>
      );
  }
}
