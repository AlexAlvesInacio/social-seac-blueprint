import { createFileRoute } from "@tanstack/react-router";
import { Package, Ruler, FolderTree, Gift, HeartHandshake, Truck, Settings2, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — SEAC Social" }] }),
  component: ConfigPage,
});

const tabs = [
  { value: "itens", label: "Itens", desc: "Cadastro de itens", icon: Package },
  { value: "unidades", label: "Unidades", desc: "Medidas e unidades", icon: Ruler },
  { value: "categorias", label: "Categorias", desc: "Grupos de itens", icon: FolderTree },
  { value: "beneficios", label: "Benefícios", desc: "Tipos de benefícios", icon: Gift },
  { value: "doadores", label: "Doadores", desc: "Pessoas e organizações", icon: HeartHandshake },
  { value: "fornecedores", label: "Fornecedores", desc: "Fornecedores", icon: Truck },
  { value: "parametros", label: "Parâmetros", desc: "Regras e parâmetros", icon: Settings2 },
];

function ConfigPage() {
  return (
    <AppShell title="Configurações">
      <Tabs defaultValue="itens">
        <TabsList className="h-auto flex-wrap gap-2 bg-transparent p-0">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-col items-start gap-0.5 border border-border bg-card p-3 data-[state=active]:border-primary data-[state=active]:bg-primary/5">
              <div className="flex items-center gap-2 text-sm font-medium"><t.icon className="h-4 w-4" /> {t.label}</div>
              <span className="text-[10px] text-muted-foreground">{t.desc}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="itens" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Buscar item</Label><Input placeholder="Buscar" /></div>
                  <div><Label className="text-xs text-muted-foreground">Categoria</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem></SelectContent></Select>
                  </div>
                </div>
                <Button className="gap-2"><Plus className="h-4 w-4" /> Novo item</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Unidade padrão</TableHead>
                    <TableHead>Estoque mínimo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell colSpan={6} className="py-16 text-center text-sm text-muted-foreground">Nenhum item cadastrado.</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {tabs.filter((t) => t.value !== "itens").map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Configuração de {t.label.toLowerCase()} — em breve.</CardContent></Card>
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}