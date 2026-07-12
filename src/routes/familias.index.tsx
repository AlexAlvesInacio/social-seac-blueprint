import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Eye, ArrowRight, AlertTriangle, MessageSquare, X } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useParametros } from "@/lib/config-store";
import { useFamilias } from "@/lib/familias-store";
import { NovaFamiliaDialog } from "@/components/nova-familia-dialog";

export const Route = createFileRoute("/familias/")({
  head: () => ({ meta: [{ title: "Famílias — SEAC Social" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    foco: (search.foco as "avaliar" | "contato90" | undefined) ?? undefined,
  }),
  component: FamiliasPage,
});

function FamiliasPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const todasFamilias = useFamilias((s) => s.familias);
  const { foco } = Route.useSearch();
  const exemploFamilias = foco === "avaliar"
    ? todasFamilias.filter((f) => f.status === "avaliar" || (f.tipoCadastro === "extra" && f.progressoExtra === "3/3"))
    : foco === "contato90"
      ? todasFamilias.filter((f) => f.acompanhamento === "sem_retirada_90")
      : todasFamilias;
  const selected = exemploFamilias.find((f) => f.id === selectedId) ?? null;
  const params = useParametros((s) => s.params);
  const toggleSelect = (id: number) =>
    setSelectedId((cur) => (cur === id ? null : id));

  const total = todasFamilias.length;
  const definitivos = todasFamilias.filter((f) => f.tipoCadastro === "definitivo").length;
  const extras = todasFamilias.filter((f) => f.tipoCadastro === "extra").length;
  const aguardandoAvaliacao = todasFamilias.filter((f) => f.status === "avaliar").length;
  const semRetirada90 = todasFamilias.filter((f) => f.acompanhamento === "sem_retirada_90").length;
  const bloqueadasInativas = todasFamilias.filter(
    (f) => f.status === "bloqueado" || f.status === "inativo",
  ).length;

  return (
    <AppShell
      title="Famílias"
      breadcrumbs={
        <span className="text-sm text-muted-foreground">
          Gerencie e acompanhe as famílias cadastradas no SEAC Social
        </span>
      }
      actions={
        <Button size="sm" className="gap-2" onClick={() => setNovaOpen(true)}>
          <Plus className="h-4 w-4" /> Nova família
        </Button>
      }
    >
      <NovaFamiliaDialog open={novaOpen} onOpenChange={setNovaOpen} />
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard value={String(total)} label="Total de famílias" />
        <SummaryCard value={String(definitivos)} label="Cadastros definitivos" />
        <SummaryCard value={String(extras)} label="Cadastros em avaliação" className="border-l-secondary" />
        <SummaryCard value={String(aguardandoAvaliacao)} label="Aguardando avaliação definitiva" className="border-l-warning" />
        <SummaryCard
          value={String(semRetirada90)}
          label={`Contato necessário (${params.inatividadeContatoDias}+ dias)`}
          className="border-l-destructive"
        />
        <SummaryCard value={String(bloqueadasInativas)} label="Bloqueadas/inativas" className="border-l-destructive" />
      </div>

      <p className="text-xs text-muted-foreground">
        Acompanhamento é apenas informativo. Não bloqueia entregas, não torna a família inativa automaticamente e não gera tarefa de contato.
      </p>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-6">
          <Field label="Nome"><Input placeholder="Buscar por nome" /></Field>
          <Field label="CPF / RG"><Input placeholder="Buscar por CPF ou RG" /></Field>
          <Field label="Telefone"><Input placeholder="(00) 00000-0000" /></Field>
          <Field label="Bairro">
            <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm">Limpar</Button>
            <Button size="sm" className="gap-2"><Search className="h-4 w-4" /> Buscar</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          {selected && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
              <span className="text-sm text-foreground">
                Família selecionada:{" "}
                <span className="font-semibold">{selected.nome}</span>
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1" asChild>
                  <Link to="/familias/$id" params={{ id: String(selected.id) }}>
                    <Eye className="h-3.5 w-3.5" /> Ver detalhes
                  </Link>
                </Button>
                {selected.status === "inativo" ? (
                  <Button variant="outline" size="sm" className="gap-1 text-muted-foreground" disabled>
                    <ArrowRight className="h-3.5 w-3.5" /> Ir para atendimento
                  </Button>
                ) : (
                  <Button size="sm" className="gap-1" asChild>
                    <Link to="/atendimento">
                      <ArrowRight className="h-3.5 w-3.5" /> Ir para atendimento
                    </Link>
                  </Button>
                )}
                {selected.progressoExtra === "3/3" && (
                  <Button variant="warning" size="sm" className="gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avaliar cadastro definitivo
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" /> Registrar observação
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={() => setSelectedId(null)}
                >
                  <X className="h-3.5 w-3.5" /> Limpar
                </Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Nome da família</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="whitespace-nowrap">CPF / RG</TableHead>
                  <TableHead className="whitespace-nowrap">Telefone</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Tipo de cadastro</TableHead>
                  <TableHead>Progresso Extra</TableHead>
                  <TableHead>Acompanhamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exemploFamilias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-16 text-center text-sm text-muted-foreground">
                      Nenhuma família cadastrada ainda.<br />
                      <Link to="/familias/$id" params={{ id: "exemplo" }} className="mt-2 inline-block text-primary hover:underline">
                        Ver exemplo de detalhe →
                      </Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  exemploFamilias.map((familia) => {
                    const isSelected = selectedId === familia.id;
                    return (
                    <TableRow
                      key={familia.id}
                      className={cn(isSelected && "bg-muted/40")}
                    >
                      <TableCell className="w-10">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(familia.id)}
                          aria-label={`Selecionar ${familia.nome}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          to="/familias/$id"
                          params={{ id: String(familia.id) }}
                          className="text-foreground hover:underline"
                        >
                          {familia.nome}
                        </Link>
                      </TableCell>
                      <TableCell>{familia.responsavel}</TableCell>
                      <TableCell className="whitespace-nowrap">{familia.documento}</TableCell>
                      <TableCell className="whitespace-nowrap">{familia.telefone}</TableCell>
                      <TableCell>{familia.bairro}</TableCell>
                      <TableCell>
                        {familia.tipoCadastro === "definitivo" ? (
                          <Badge>Definitivo</Badge>
                        ) : (
                          <Badge variant="warning">Avaliação</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {familia.status === "inativo" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : familia.tipoCadastro === "definitivo" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={familia.progressoExtra === "3/3" ? "text-warning font-medium" : "text-foreground font-medium"}>
                            {familia.progressoExtra}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <AcompanhamentoBadge status={familia.acompanhamento} params={params} />
                          {familia.ultimaRetirada !== "—" && (
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              Última retirada: {familia.ultimaRetirada}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {familia.status === "liberado" && <Badge>Liberado</Badge>}
                        {familia.status === "bloqueado" && <Badge variant="destructive">Bloqueado</Badge>}
                        {familia.status === "inativo" && <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
                        {familia.status === "avaliar" && (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Avaliar definitivo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function SummaryCard({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <Card className={cn("border-l-4 border-l-primary", className)}>
      <CardContent className="p-4">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function AcompanhamentoBadge({
  status,
  params,
}: {
  status: string;
  params: ReturnType<typeof useParametros.getState>["params"];
}) {
  if (status === "em_dia") return <Badge>Em dia</Badge>;
  if (status === "atencao_60" || status === "atencao_45")
    return <Badge variant="warning">Atenção {params.alertaLiberadoSemRetiradaDias} dias</Badge>;
  if (status === "sem_retirada_90")
    return <Badge variant="destructive">Contato necessário ({params.inatividadeContatoDias}+ dias)</Badge>;
  if (status === "inativo") return <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>;
  return <span className="text-muted-foreground">—</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
