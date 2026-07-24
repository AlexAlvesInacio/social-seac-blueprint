import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserRound,
  Truck,
  Package,
  HeartHandshake,
  KeyRound,
  Download,
  Clock,
  PackageX,
  AlertTriangle,
  PhoneCall,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  downloadCSV,
  type TipoRelatorio,
  type ResultadoRelatorio,
  type FiltrosRelatorio,
} from "@/lib/relatorios-store";
import { gerarRelatorioSupabase } from "@/lib/relatorios/relatorios-supabase";
import { useBeneficiosEstoque, useFamiliasSupabase } from "@/lib/familias/use-familias-supabase";
import { registrarAuditoria } from "@/lib/auditoria-store";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — SEAC Social" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tipo: (search.tipo as TipoRelatorio | undefined) ?? undefined,
  }),
  component: RelatoriosPage,
});

type CardConfig = {
  tipo: TipoRelatorio;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
};

const CARDS: CardConfig[] = [
  { tipo: "familias", icon: Users, title: "Famílias", desc: "Cadastros e situação das famílias." },
  {
    tipo: "assistidos",
    icon: UserRound,
    title: "Assistidos",
    desc: "Lista de assistidos e benefícios.",
  },
  { tipo: "entregas", icon: Truck, title: "Entregas", desc: "Entregas realizadas no período." },
  {
    tipo: "bloqueio_prazo",
    icon: Clock,
    title: "Retiradas bloqueadas por prazo",
    desc: "Tentativas antes do prazo mínimo.",
  },
  {
    tipo: "bloqueio_estoque",
    icon: PackageX,
    title: "Retiradas bloqueadas por estoque",
    desc: "Tentativas sem saldo disponível.",
  },
  {
    tipo: "atencao_45",
    icon: AlertTriangle,
    title: "Famílias em atenção 45 dias+",
    desc: "Liberadas e sem retirada recente.",
  },
  {
    tipo: "contato_90",
    icon: PhoneCall,
    title: "Famílias com contato necessário 90 dias+",
    desc: "Inatividade prolongada.",
  },
  { tipo: "estoque", icon: Package, title: "Estoque", desc: "Saldo dos benefícios." },
  {
    tipo: "recebimentos",
    icon: HeartHandshake,
    title: "Doações / recebimentos",
    desc: "Doações recebidas e origem.",
  },
  {
    tipo: "liberacoes",
    icon: KeyRound,
    title: "Liberações excepcionais",
    desc: "Liberações fora do padrão.",
  },
];

function filtrosLabel(f: FiltrosRelatorio): string {
  const parts: string[] = [];
  if (f.de) parts.push(`de ${f.de}`);
  if (f.ate) parts.push(`até ${f.ate}`);
  if (f.bairro) parts.push(`bairro=${f.bairro}`);
  if (f.beneficio) parts.push(`benefício=${f.beneficio}`);
  if (f.status) parts.push(`status=${f.status}`);
  return parts.join(", ") || "sem filtros";
}

const STATUS_OPCOES = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
  { value: "liberado", label: "Liberado" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "avaliar", label: "Avaliar" },
  { value: "Registrado", label: "Registrado" },
  { value: "Pendente conferência", label: "Pendente conferência" },
  { value: "Cancelado", label: "Cancelado" },
  { value: "Em estoque", label: "Em estoque" },
  { value: "Atenção", label: "Atenção" },
  { value: "Estoque baixo", label: "Estoque baixo" },
  { value: "Sem estoque", label: "Sem estoque" },
];

function RelatoriosPage() {
  const familias = useFamiliasSupabase();
  const beneficiosQuery = useBeneficiosEstoque();
  const { tipo: tipoParam } = Route.useSearch();
  const [tipo, setTipo] = useState<TipoRelatorio | null>(tipoParam ?? null);
  useEffect(() => {
    if (tipoParam) setTipo(tipoParam);
  }, [tipoParam]);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [bairro, setBairro] = useState("all");
  const [beneficio, setBeneficio] = useState("all");
  const [status, setStatus] = useState("all");
  const [resultado, setResultado] = useState<ResultadoRelatorio | null>(null);
  const [gerando, setGerando] = useState(false);

  const bairros = useMemo(
    () => Array.from(new Set((familias.data ?? []).map((f) => f.bairro).filter(Boolean))).sort(),
    [familias.data],
  );
  const beneficios = useMemo(
    () => (beneficiosQuery.data ?? []).map((b) => b.nome),
    [beneficiosQuery.data],
  );

  const filtros: FiltrosRelatorio = {
    de: de || undefined,
    ate: ate || undefined,
    bairro: bairro !== "all" ? bairro : undefined,
    beneficio: beneficio !== "all" ? beneficio : undefined,
    status: status !== "all" ? status : undefined,
  };

  async function handleGerar() {
    if (!tipo) {
      toast.warning("Selecione um tipo de relatório antes de gerar.");
      return;
    }
    setGerando(true);
    try {
      const res = await gerarRelatorioSupabase(tipo, filtros);
      setResultado(res);
      registrarAuditoria({
        usuario: res.usuarioGerador,
        acao: "Relatório gerado",
        modulo: "Relatórios",
        registro: res.tituloRelatorio,
        observacao: `${res.totalRegistros} registro(s); filtros: ${filtrosLabel(filtros)}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar o relatório.");
    } finally {
      setGerando(false);
    }
  }

  function handleCSV() {
    if (!resultado) {
      toast.warning("Gere um relatório antes de exportar.");
      return;
    }
    downloadCSV(resultado);
    registrarAuditoria({
      usuario: resultado.usuarioGerador,
      acao: "Relatório exportado CSV",
      modulo: "Relatórios",
      registro: resultado.tituloRelatorio,
      observacao: `${resultado.totalRegistros} registro(s); filtros: ${filtrosLabel(resultado.filtrosAplicados)}`,
    });
    toast.success("CSV baixado.");
  }

  function limparFiltros() {
    setDe("");
    setAte("");
    setBairro("all");
    setBeneficio("all");
    setStatus("all");
  }

  return (
    <AppShell title="Relatórios">
      <p className="mb-3 text-sm text-muted-foreground">
        Selecione um tipo de relatório, aplique filtros e clique em Gerar relatório.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((r) => {
          const active = tipo === r.tipo;
          return (
            <Card
              key={r.tipo}
              onClick={() => setTipo(r.tipo)}
              className={`cursor-pointer transition-colors hover:border-primary ${active ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <r.icon className="h-4 w-4" />
                </div>
                <p className="mt-3 text-sm font-semibold">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <F label="Período de">
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </F>
          <F label="até">
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </F>
          <F label="Bairro">
            <Select value={bairro} onValueChange={setBairro}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {bairros.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Benefício">
            <Select value={beneficio} onValueChange={setBeneficio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {beneficios.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_OPCOES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <div className="flex flex-wrap justify-between gap-2 pt-2 md:col-span-5">
            <Button variant="outline" onClick={limparFiltros}>
              Limpar filtros
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCSV} disabled={!resultado}>
                CSV
              </Button>
              <Button className="gap-2" onClick={() => void handleGerar()} disabled={gerando}>
                {gerando ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {gerando ? "Gerando…" : "Gerar relatório"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!resultado && (
        <Card className="mt-4">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Selecione um tipo de relatório e clique em Gerar relatório.
          </CardContent>
        </Card>
      )}

      {resultado && (
        <Card className="mt-4">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
              <div>
                <p className="text-sm font-semibold">{resultado.tituloRelatorio}</p>
                <p className="text-xs text-muted-foreground">
                  {resultado.totalRegistros} registro(s) • gerado em{" "}
                  {new Date(resultado.dataHoraGeracao).toLocaleString("pt-BR")} por{" "}
                  {resultado.usuarioGerador}
                </p>
                <p className="text-xs text-muted-foreground">
                  Filtros: {filtrosLabel(resultado.filtrosAplicados)}
                </p>
              </div>
            </div>
            {resultado.linhas.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum registro encontrado para os filtros informados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {resultado.colunas.map((c) => (
                        <TableHead key={c}>{c}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.linhas.map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j} className="text-sm">
                            {String(cell)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
