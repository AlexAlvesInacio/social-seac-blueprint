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
import { registrarAuditoria } from "@/lib/auditoria/auditoria-supabase";
import { getCurrentProfile } from "@/lib/auth/auth-service";
import { useConfiguracoes } from "@/lib/configuracoes/configuracoes-supabase";
import type { AssistidoParaEntrega } from "@/lib/familias/familias-supabase-types";
import {
  useAprovarAssistidoDefinitivo,
  useInativarAssistido,
  useRegistrarEntregaSupabase,
  useRegistrarTentativaSupabase,
  useResumoAtendimento,
} from "@/lib/familias/use-familias-supabase";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assistido: AssistidoParaEntrega | null;
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
  const configQuery = useConfiguracoes();
  const intervaloMinimoDias = configQuery.data?.intervaloMinimoDias ?? 25;
  const limiteExtra = configQuery.data?.limiteExtra ?? 3;
  const registrarEntrega = useRegistrarEntregaSupabase();
  const registrarTentativa = useRegistrarTentativaSupabase();
  const aprovarDefinitivo = useAprovarAssistidoDefinitivo();
  const inativarAssistido = useInativarAssistido();
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

  const salvando =
    registrarEntrega.isPending ||
    registrarTentativa.isPending ||
    aprovarDefinitivo.isPending ||
    inativarAssistido.isPending;

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
          undefined,
          { intervaloMinimoDias, limiteExtra },
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
      if (data.status === "entregue") {
        toast.success(
          `Entrega registrada (${data.beneficio}). Saldo restante: ${data.saldo_resultante}.`,
        );
      } else {
        // O servidor reaplicou as regras e bloqueou (ex.: saldo/prazo mudou desde a
        // verificação). A tentativa já foi registrada pela própria RPC.
        toast.warning(mensagemBloqueioServidor(data.status, intervaloMinimoDias, limiteExtra));
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar a entrega.");
    }
  };

  const aprovarCadastroDefinitivo = async () => {
    if (!assistido) return;
    try {
      await aprovarDefinitivo.mutateAsync({
        assistidoId: assistido.id,
        familiaId: assistido.familiaId,
      });
      registrarAuditoria({
        acao: "Cadastro aprovado como definitivo",
        modulo: "Atendimento",
        registro: `${assistido.nome} (${assistido.documento})`,
        observacao: "Extra → Definitivo; passa a receber Cesta Padrão.",
      });
      toast.success("Cadastro aprovado como definitivo — passa a receber Cesta Padrão.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível aprovar o cadastro.");
    }
  };

  const negarCadastro = async () => {
    if (!assistido) return;
    try {
      await inativarAssistido.mutateAsync({
        assistidoId: assistido.id,
        familiaId: assistido.familiaId,
      });
      registrarAuditoria({
        acao: "Cadastro negado (assistido inativado)",
        modulo: "Atendimento",
        registro: `${assistido.nome} (${assistido.documento})`,
        observacao: "Avaliação após 3 Cestas Extra: cadastro negado; assistido inativado.",
      });
      toast.success("Cadastro negado — assistido inativado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível negar o cadastro.");
    }
  };

  const registrarBloqueio = async (motivoTipo: "prazo" | "estoque" | "extra") => {
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
            <CenarioResumo
              elegibilidade={elegibilidade}
              intervaloMinimoDias={intervaloMinimoDias}
              limiteExtra={limiteExtra}
            />

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
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Avalie o cadastro: <strong>aprovar</strong> torna o assistido definitivo (passa a
                  receber <strong>Cesta Padrão</strong>); <strong>negar</strong> inativa o assistido
                  (deixa de receber e sai da busca).
                </p>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Fechar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={salvando}
                    onClick={() => void negarCadastro()}
                  >
                    {inativarAssistido.isPending ? "Negando…" : "Negar cadastro"}
                  </Button>
                  <Button disabled={salvando} onClick={() => void aprovarCadastroDefinitivo()}>
                    {aprovarDefinitivo.isPending ? "Aprovando…" : "Aprovar cadastro"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function mensagemBloqueioServidor(
  status: "bloqueado_prazo" | "bloqueado_estoque" | "bloqueado_extra",
  intervaloMinimoDias: number,
  limiteExtra: number,
): string {
  switch (status) {
    case "bloqueado_prazo":
      return `Entrega bloqueada pelo servidor: intervalo mínimo de ${intervaloMinimoDias} dias não cumprido. Tentativa registrada.`;
    case "bloqueado_estoque":
      return "Entrega bloqueada pelo servidor: sem saldo em estoque. Tentativa registrada.";
    case "bloqueado_extra":
      return `Entrega bloqueada pelo servidor: cadastro extra já completou o limite de ${limiteExtra} retiradas. Tentativa registrada.`;
  }
}

function CenarioResumo({
  elegibilidade,
  intervaloMinimoDias,
  limiteExtra,
}: {
  elegibilidade: Elegibilidade;
  intervaloMinimoDias: number;
  limiteExtra: number;
}) {
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
          Elegível para <strong>Cesta Extra</strong> — retirada {elegibilidade.progresso}/
          {limiteExtra}.
        </div>
      );
    case "bloqueio_25dias":
      return (
        <div className="text-sm">
          <Badge variant="destructive" className="mr-2">
            Bloqueado ({intervaloMinimoDias} dias)
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
          Já foram feitas {limiteExtra} retiradas de Cesta Extra; aguardar avaliação de cadastro
          definitivo.
        </div>
      );
  }
}
