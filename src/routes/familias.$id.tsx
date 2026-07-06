import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Pencil, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/familias/$id")({
  head: () => ({ meta: [{ title: "Detalhe da família — SEAC Social" }] }),
  component: FamiliaDetail,
});

function FamiliaDetail() {
  return (
    <AppShell
      title="Detalhe da família"
      breadcrumbs={
        <div className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
          <ChevronRight className="h-3 w-3" />
          <Link to="/familias" className="hover:text-foreground">Famílias</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Detalhe</span>
        </div>
      }
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2"><Pencil className="h-4 w-4" /> Editar família</Button>
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo assistido</Button>
          <Button size="sm" variant="secondary" className="gap-2"><Plus className="h-4 w-4" /> Novo membro</Button>
        </div>
      }
    >
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">Família (exemplo)</h2>
                <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Ativa</Badge>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-5">
                <Info label="Endereço" value="—" />
                <Info label="Bairro" value="—" />
                <Info label="Cidade" value="—" />
                <Info label="UF" value="—" />
                <Info label="CEP" value="—" />
                <Info label="Telefone / WhatsApp" value="—" />
                <Info label="Moradores" value="—" />
                <Info label="Crianças" value="—" />
                <Info label="Idosos" value="—" />
                <Info label="Gestantes" value="—" />
                <Info label="PCD" value="—" />
              </div>
              <div className="mt-4">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="text-sm">—</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="assistidos" className="mt-6">
        <TabsList>
          <TabsTrigger value="assistidos">Assistidos vinculados</TabsTrigger>
          <TabsTrigger value="membros">Membros vinculados</TabsTrigger>
          <TabsTrigger value="entregas">Histórico de entregas</TabsTrigger>
          <TabsTrigger value="bloqueios">Tentativas bloqueadas</TabsTrigger>
        </TabsList>
        <TabsContent value="assistidos">
          <EmptyCard text="Nenhum assistido vinculado ainda." />
        </TabsContent>
        <TabsContent value="membros">
          <EmptyCard text="Nenhum membro vinculado ainda." />
        </TabsContent>
        <TabsContent value="entregas">
          <EmptyCard text="Nenhuma entrega registrada." />
        </TabsContent>
        <TabsContent value="bloqueios">
          <EmptyCard text="Nenhuma tentativa bloqueada." />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-16 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}