import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";
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

export const Route = createFileRoute("/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — SEAC Social" }] }),
  component: AuditoriaPage,
});

function AuditoriaPage() {
  const { data, isPending, isError, refetch, isFetching } = useEventosAuditoria();
  const eventos = useMemo(() => data ?? [], [data]);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [autor, setAutor] = useState("all");
  const [acao, setAcao] = useState("all");
  const [modulo, setModulo] = useState("all");

  const autores = useMemo(() => Array.from(new Set(eventos.map((e) => e.autor))), [eventos]);
  const acoes = useMemo(() => Array.from(new Set(eventos.map((e) => e.acao))), [eventos]);
  const modulos = useMemo(() => Array.from(new Set(eventos.map((e) => e.modulo))), [eventos]);

  const filtered = useMemo(
    () =>
      eventos.filter((e) => {
        if (de && e.criadoEm.slice(0, 10) < de) return false;
        if (ate && e.criadoEm.slice(0, 10) > ate) return false;
        if (autor !== "all" && e.autor !== autor) return false;
        if (acao !== "all" && e.acao !== acao) return false;
        if (modulo !== "all" && e.modulo !== modulo) return false;
        return true;
      }),
    [eventos, de, ate, autor, acao, modulo],
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
                setDe("");
                setAte("");
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
