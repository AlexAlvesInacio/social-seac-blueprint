import { createFileRoute } from "@tanstack/react-router";
import { Plus, UserCheck, UserX, UserCog } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — SEAC Social" }] }),
  component: UsuariosPage,
});

function UsuariosPage() {
  return (
    <AppShell title="Gestão de usuários" actions={<Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo usuário</Button>}>
      <p className="mb-4 text-sm text-muted-foreground">Apenas administradores podem gerenciar usuários.</p>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Papel</Label>
            <Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="atendente">atendente</SelectItem>
                <SelectItem value="estoque">estoque</SelectItem>
                <SelectItem value="pendente">pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Status</Label>
            <Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1 md:col-span-2"><Label className="text-xs text-muted-foreground">Buscar</Label><Input placeholder="Nome ou e-mail" /></div>
        </CardContent>
      </Card>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-2"><UserCog className="h-4 w-4" /> Alterar papel</Button>
        <Button variant="outline" size="sm" className="gap-2"><UserCheck className="h-4 w-4" /> Ativar</Button>
        <Button variant="outline" size="sm" className="gap-2"><UserX className="h-4 w-4" /> Inativar</Button>
        <Button variant="outline" size="sm">Liberar pendente</Button>
      </div>

      <Card className="mt-3">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell colSpan={6} className="py-16 text-center text-sm text-muted-foreground">Nenhum usuário cadastrado ainda.</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}