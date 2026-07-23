import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { useAuditoria } from "@/lib/auditoria-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — SEAC Social" }] }),
  component: AuditoriaPage,
});

function AuditoriaPage() {
  const eventos = useAuditoria((s) => s.eventos);
  const limpar = useAuditoria((s) => s.limpar);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [usuario, setUsuario] = useState("all");
  const [acao, setAcao] = useState("all");
  const [modulo, setModulo] = useState("all");

  const usuarios = useMemo(() => Array.from(new Set(eventos.map((e) => e.usuario))), [eventos]);
  const acoes = useMemo(() => Array.from(new Set(eventos.map((e) => e.acao))), [eventos]);
  const modulos = useMemo(() => Array.from(new Set(eventos.map((e) => e.modulo))), [eventos]);

  const filtered = useMemo(
    () =>
      eventos.filter((e) => {
        if (de && e.datahora.slice(0, 10) < de) return false;
        if (ate && e.datahora.slice(0, 10) > ate) return false;
        if (usuario !== "all" && e.usuario !== usuario) return false;
        if (acao !== "all" && e.acao !== acao) return false;
        if (modulo !== "all" && e.modulo !== modulo) return false;
        return true;
      }),
    [eventos, de, ate, usuario, acao, modulo],
  );

  return (
    <AppShell title="Histórico de ações">
      <p className="mb-3 text-sm text-muted-foreground">
        Registro de atividades realizadas no sistema.
      </p>
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <F label="Período de">
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </F>
          <F label="até">
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </F>
          <F label="Usuário">
            <Select value={usuario} onValueChange={setUsuario}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {usuarios.map((u) => (
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
          <div className="md:col-span-5 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDe("");
                setAte("");
                setUsuario("all");
                setAcao("all");
                setModulo("all");
              }}
            >
              Limpar filtros
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> Limpar histórico
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todo o histórico de auditoria?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação remove permanentemente todos os eventos registrados até agora,
                    incluindo entradas duplicadas legadas. Não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => limpar()}>Limpar histórico</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Registro afetado</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mounted &&
                filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(e.datahora).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">{e.usuario}</TableCell>
                    <TableCell className="text-sm">{e.acao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.modulo}</TableCell>
                    <TableCell className="text-sm">{e.registro}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.observacao ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              {mounted && filtered.length === 0 && (
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
