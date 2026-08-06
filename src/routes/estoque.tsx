import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, LoaderCircle, Package, PackageX, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { emAlerta, statusEstoque } from "@/lib/estoque/status-estoque";
import {
  useBeneficiosEstoque,
  useMovimentacoesEstoque,
  useRegistrarMovimentacaoEstoque,
} from "@/lib/estoque/use-estoque-supabase";
import type {
  BeneficioEstoque,
  MovimentacaoEstoqueTipo,
} from "@/lib/familias/familias-supabase-types";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [{ title: "Estoque — SEAC Social" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as "saldos" | "mov" | undefined) ?? undefined,
    foco: (search.foco as "alertas" | undefined) ?? undefined,
  }),
  component: EstoquePage,
});

type FormMov = {
  tipo: MovimentacaoEstoqueTipo & ("entrada" | "saida" | "ajuste");
  beneficioId: string;
  quantidade: string;
  motivo: string;
  observacao: string;
};

const formVazio: FormMov = {
  tipo: "entrada",
  beneficioId: "",
  quantidade: "",
  motivo: "",
  observacao: "",
};

function EstoquePage() {
  const { tab, foco } = Route.useSearch();
  const beneficios = useBeneficiosEstoque();
  const movimentacoes = useMovimentacoesEstoque();
  const registrar = useRegistrarMovimentacaoEstoque();

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<FormMov>(formVazio);
  const set = <K extends keyof FormMov>(k: K, v: FormMov[K]) => setForm((f) => ({ ...f, [k]: v }));

  const abrir = (tipo: FormMov["tipo"]) => {
    setForm({ ...formVazio, tipo, beneficioId: beneficios.data?.[0]?.id ?? "" });
    setAberto(true);
  };

  const lista = beneficios.data ?? [];
  const visiveis = foco === "alertas" ? lista.filter((b) => emAlerta(b.saldo, b.minimo)) : lista;

  const kpis = useMemo(() => {
    const abaixo = lista.filter((b) => emAlerta(b.saldo, b.minimo)).length;
    const sem = lista.filter((b) => b.saldo <= 0).length;
    return { total: lista.length, abaixo, sem };
  }, [lista]);

  const salvar = async () => {
    const qtd = Number(form.quantidade);
    if (!form.beneficioId) {
      toast.error("Selecione o benefício.");
      return;
    }
    if (!Number.isFinite(qtd) || qtd < 0 || (form.tipo !== "ajuste" && qtd <= 0)) {
      toast.error("Informe uma quantidade válida.");
      return;
    }
    try {
      const data = await registrar.mutateAsync({
        beneficioId: form.beneficioId,
        tipo: form.tipo,
        quantidade: qtd,
        motivo: form.motivo,
        observacao: form.observacao,
      });
      toast.success(`Movimentação registrada. Saldo atual: ${data.saldo_resultante}.`);
      setAberto(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível registrar a movimentação.",
      );
    }
  };

  return (
    <AppShell
      title="Estoque"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="gap-2" onClick={() => abrir("entrada")}>
            <Plus className="h-4 w-4" /> Nova entrada
          </Button>
          <Button size="sm" variant="outline" onClick={() => abrir("saida")}>
            Nova saída
          </Button>
          <Button size="sm" variant="outline" onClick={() => abrir("ajuste")}>
            Ajuste
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard icon={<Package className="h-4 w-4" />} label="Benefícios" valor={kpis.total} />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Abaixo do mínimo"
            valor={kpis.abaixo}
          />
          <KpiCard icon={<PackageX className="h-4 w-4" />} label="Sem estoque" valor={kpis.sem} />
        </div>

        <Tabs defaultValue={tab ?? "saldos"}>
          <TabsList>
            <TabsTrigger value="saldos">Saldos atuais</TabsTrigger>
            <TabsTrigger value="mov">Movimentações</TabsTrigger>
          </TabsList>

          <TabsContent value="saldos">
            <Card>
              <CardContent className="p-0">
                {beneficios.isPending ? (
                  <Carregando />
                ) : beneficios.isError ? (
                  <ErroLeitura />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Benefício</TableHead>
                        <TableHead>Saldo atual</TableHead>
                        <TableHead>Estoque mínimo</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiveis.map((b) => (
                        <SaldoLinha key={b.id} beneficio={b} />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mov">
            <Card>
              <CardContent className="p-0">
                {movimentacoes.isPending ? (
                  <Carregando />
                ) : movimentacoes.isError ? (
                  <ErroLeitura />
                ) : (movimentacoes.data ?? []).length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma movimentação registrada.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Benefício</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Qtd.</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(movimentacoes.data ?? []).map((m) => (
                        <TableRow key={`${m.origem}-${m.id}`}>
                          <TableCell className="text-sm">{formatarDataHora(m.criadoEm)}</TableCell>
                          <TableCell className="text-sm">{m.beneficioNome}</TableCell>
                          <TableCell className="text-sm capitalize">
                            {m.tipo === "baixa" ? "Baixa automática" : m.tipo}
                          </TableCell>
                          <TableCell className="text-sm">
                            {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                          </TableCell>
                          <TableCell className="text-sm">{m.saldoResultante ?? "—"}</TableCell>
                          <TableCell className="text-sm">{m.motivo ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {form.tipo === "entrada"
                ? "Nova entrada"
                : form.tipo === "saida"
                  ? "Nova saída"
                  : "Ajuste de saldo"}
            </SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <Campo label="Benefício">
              <Select value={form.beneficioId} onValueChange={(v) => set("beneficioId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {lista.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome} (saldo {b.saldo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label={form.tipo === "ajuste" ? "Novo saldo" : "Quantidade"}>
              <Input
                type="number"
                min={0}
                value={form.quantidade}
                onChange={(e) => set("quantidade", e.target.value)}
              />
            </Campo>
            <Campo label="Motivo">
              <Input value={form.motivo} onChange={(e) => set("motivo", e.target.value)} />
            </Campo>
            <Campo label="Observação">
              <Textarea
                rows={3}
                value={form.observacao}
                onChange={(e) => set("observacao", e.target.value)}
              />
            </Campo>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button disabled={registrar.isPending} onClick={() => void salvar()}>
              {registrar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function SaldoLinha({ beneficio }: { beneficio: BeneficioEstoque }) {
  const status = statusEstoque(beneficio.saldo, beneficio.minimo);
  const destaque = status === "Sem estoque" || status === "Estoque baixo";
  return (
    <TableRow>
      <TableCell className="text-sm font-medium">{beneficio.nome}</TableCell>
      <TableCell className="text-sm">{beneficio.saldo}</TableCell>
      <TableCell className="text-sm">{beneficio.minimo}</TableCell>
      <TableCell>
        <Badge variant={destaque ? "destructive" : status === "Atenção" ? "outline" : "secondary"}>
          {status}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

function KpiCard({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{valor}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Carregando() {
  return (
    <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
      <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando…
    </div>
  );
}

function ErroLeitura() {
  return (
    <p className="p-8 text-center text-sm text-destructive">
      Não foi possível carregar o estoque. Tente novamente.
    </p>
  );
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
