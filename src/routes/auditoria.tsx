import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, LoaderCircle } from "lucide-react";
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
import { useEventosAuditoria } from "@/lib/auditoria/auditoria-supabase";
import { diasAtrasLocalISO, hojeLocalISO } from "@/lib/auditoria/periodo";

export const Route = createFileRoute("/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — SEAC Social" }] }),
  component: AuditoriaPage,
});

/** Janela inicial: cobre a semana sem depender do teto de 500 eventos. */
const JANELA_PADRAO_DIAS = 7;

function AuditoriaPage() {
  const [de, setDe] = useState(() => diasAtrasLocalISO(JANELA_PADRAO_DIAS));
  const [ate, setAte] = useState(() => hojeLocalISO());
  const [autor, setAutor] = useState("all");
  const [acao, setAcao] = useState("all");
  const [modulo, setModulo] = useState("all");

  // O período vai para a consulta; os demais filtros seguem no cliente, sobre o
  // recorte já reduzido.
  const { data, isPending, isError, refetch, isFetching } = useEventosAuditoria({ de, ate });
  const eventos = useMemo(() => data?.eventos ?? [], [data]);
  const atingiuLimite = data?.atingiuLimite ?? false;

  const autores = useMemo(() => Array.from(new Set(eventos.map((e) => e.autor))), [eventos]);
  const acoes = useMemo(() => Array.from(new Set(eventos.map((e) => e.acao))), [eventos]);
  const modulos = useMemo(() => Array.from(new Set(eventos.map((e) => e.modulo))), [eventos]);

  const filtered = useMemo(
    () =>
      eventos.filter((e) => {
        if (autor !== "all" && e.autor !== autor) return false;
        if (acao !== "all" && e.acao !== acao) return false;
        if (modulo !== "all" && e.modulo !== modulo) return false;
        return true;
      }),
    [eventos, autor, acao, modulo],
  );

  return (
    <AppShell title="Histórico de ações">
      <p className="mb-3 text-sm text-muted-foreground">
        Registro imutável de atividades realizadas no sistema. Os eventos não podem ser editados nem
        removidos.
      </p>
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <F label="Período de">
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </F>
          <F label="até">
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </F>
          <F label="Autor">
            <Select value={autor} onValueChange={setAutor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {autores.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Tipo de ação">
            <Select value={acao} onValueChange={setAcao}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {acoes.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Módulo">
            <Select value={modulo} onValueChange={setModulo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {modulos.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <div className="flex justify-end md:col-span-5">
            <Button
              variant="outline"
              onClick={() => {
                // Volta à janela padrão, não a "todos os tempos": sem recorte a
                // consulta bate no teto de eventos e omite o excedente.
                setDe(diasAtrasLocalISO(JANELA_PADRAO_DIAS));
                setAte(hojeLocalISO());
                setAutor("all");
                setAcao("all");
                setModulo("all");
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {atingiuLimite && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Este período tem mais eventos do que a tela mostra — estão listados apenas os mais
            recentes. Reduza o intervalo de datas para ver o restante.
          </span>
        </div>
      )}

      <Card className="mt-4">
        <CardContent className="p-0">
          {isPending ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando histórico…
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar o histórico de auditoria.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data / hora</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Registro afetado</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(e.criadoEm).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">{e.autor}</TableCell>
                    <TableCell className="text-sm">{e.acao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.modulo}</TableCell>
                    <TableCell className="text-sm">{e.registro}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.observacao ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      Nenhum evento registrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
