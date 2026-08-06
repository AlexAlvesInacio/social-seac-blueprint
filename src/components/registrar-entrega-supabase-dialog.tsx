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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  formatBR,
  recusaDoBeneficioAdicional,
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
import { descricaoAssistido } from "@/lib/familias/descricao-assistido";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assistido: AssistidoParaEntrega | null;
  familiaNome: string;
};

const MOTIVO_MINIMO = 5;

/** Estado de um benefício adicional marcado no diálogo. */
type ExtraSelecionado = { quantidade: string; justificativa: string };

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
  const [perfilNome, setPerfilNome] = useState<string | null>(null);
  // Benefícios adicionais marcados na visita: presença da chave = marcado.
  const [extras, setExtras] = useState<Record<string, ExtraSelecionado>>({});

  useEffect(() => {
    if (!open) {
      setMotivo("");
      setExtras({});
      return;
    }
    let active = true;
    void getCurrentProfile().then(({ data }) => {
      if (!active) return;
      setIsAdmin(data?.papel === "administrador");
      setPerfilNome(data?.nome_completo ?? null);
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

  const adicionais = resumoQuery.data?.beneficiosAdicionais ?? [];

  const alternarExtra = (id: string, marcado: boolean) =>
    setExtras((prev) => {
      if (!marcado) {
        const { [id]: _removido, ...resto } = prev;
        void _removido;
        return resto;
      }
      return { ...prev, [id]: { quantidade: "1", justificativa: "" } };
    });

  const editarExtra = (id: string, campo: keyof ExtraSelecionado, valor: string) =>
    setExtras((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], [campo]: valor } } : prev));

  const extrasSelecionados = Object.entries(extras).map(([beneficioId, e]) => ({
    beneficioId,
    quantidade: Number(e.quantidade),
    justificativa: e.justificativa,
  }));

  const extraInvalido = extrasSelecionados.some(
    (e) =>
      recusaDoBeneficioAdicional(
        { quantidade: e.quantidade, justificativa: e.justificativa },
        isAdmin,
      ) !== null,
  );

  const confirmarEntrega = async (excepcional: boolean) => {
    if (!assistido) return;
    try {
      const data = await registrarEntrega.mutateAsync({
        assistidoId: assistido.id,
        familiaId: assistido.familiaId,
        excepcional,
        observacao: excepcional ? motivo : undefined,
        beneficiosExtras: extrasSelecionados.map((e) => ({
          beneficioId: e.beneficioId,
          quantidade: e.quantidade,
          justificativa: e.quantidade > 1 ? e.justificativa : undefined,
        })),
      });
      if (data.status === "entregue") {
        const adicionaisEntregues = data.extras
          .map((e) => `${e.beneficio}${e.quantidade > 1 ? ` ×${e.quantidade}` : ""}`)
          .join(", ");
        toast.success(
          `Entrega registrada (${data.beneficio}). Saldo restante: ${data.saldo_resultante}.` +
            (adicionaisEntregues ? ` Também entregue: ${adicionaisEntregues}.` : ""),
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
          <DialogDescription>{descricaoAssistido(assistido?.nome, familiaNome)}</DialogDescription>
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

            {/* Adicionais só aparecem quando a visita pode virar entrega: o
                benefício sazonal nunca sai sozinho. */}
            {(elegibilidade.cenario === "liberado_padrao" ||
              elegibilidade.cenario === "liberado_extra" ||
              (elegibilidade.cenario === "bloqueio_25dias" && isAdmin)) &&
              adicionais.length > 0 && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-xs font-semibold">Entregar também nesta visita</p>
                  {adicionais.map((b) => {
                    const marcado = extras[b.id] !== undefined;
                    const semSaldo = b.controlaEstoque && b.saldo <= 0;
                    const qtd = Number(extras[b.id]?.quantidade ?? "1");
                    return (
                      <div key={b.id} className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={marcado}
                            disabled={semSaldo || salvando}
                            onCheckedChange={(v) => alternarExtra(b.id, v === true)}
                          />
                          <span className={semSaldo ? "text-muted-foreground" : ""}>{b.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {semSaldo ? "sem saldo em estoque" : `saldo ${b.saldo}`}
                          </span>
                        </label>

                        {marcado && (
                          <div className="ml-6 space-y-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground">Quantidade</Label>
                              <Input
                                type="number"
                                min={1}
                                className="h-8 w-20"
                                value={extras[b.id].quantidade}
                                onChange={(e) => editarExtra(b.id, "quantidade", e.target.value)}
                              />
                              <span className="text-xs text-muted-foreground">
                                1 por família é o padrão
                              </span>
                            </div>

                            {qtd > 1 &&
                              (isAdmin ? (
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">
                                    Aprovado por {perfilNome ?? "administrador"} — justificativa
                                    (obrigatória)
                                  </Label>
                                  <Textarea
                                    rows={2}
                                    value={extras[b.id].justificativa}
                                    onChange={(e) =>
                                      editarExtra(b.id, "justificativa", e.target.value)
                                    }
                                    placeholder="Por que esta família leva mais de uma unidade?"
                                  />
                                </div>
                              ) : (
                                <p className="text-xs text-destructive">
                                  Somente um administrador pode autorizar mais de 1 por família.
                                </p>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            {(elegibilidade.cenario === "liberado_padrao" ||
              elegibilidade.cenario === "liberado_extra") && (
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={salvando || extraInvalido}
                  onClick={() => void confirmarEntrega(false)}
                >
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
                      disabled={salvando || extraInvalido || motivo.trim().length < MOTIVO_MINIMO}
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
