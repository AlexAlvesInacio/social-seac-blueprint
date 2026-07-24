import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HeartHandshake, LoaderCircle, Search, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RegistrarEntregaSupabaseDialog } from "@/components/registrar-entrega-supabase-dialog";
import { useBuscarAssistidosAtendimento } from "@/lib/familias/use-familias-supabase";
import type { AssistidoBuscaResultado } from "@/lib/familias/familias-supabase-types";

export const Route = createFileRoute("/atendimento")({
  head: () => ({ meta: [{ title: "Atendimento — SEAC Social" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    assistido: typeof s.assistido === "string" ? s.assistido : undefined,
  }),
  component: AtendimentoPage,
});

const MIN_BUSCA = 3;

function AtendimentoPage() {
  const { assistido: assistidoParam } = Route.useSearch();
  const [query, setQuery] = useState(assistidoParam ?? "");
  const [termoBuscado, setTermoBuscado] = useState(assistidoParam ?? "");
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<AssistidoBuscaResultado | null>(null);

  const busca = useBuscarAssistidosAtendimento(termoBuscado);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const termo = query.trim();
    if (termo.length < MIN_BUSCA) {
      setErroBusca(`Digite pelo menos ${MIN_BUSCA} caracteres para buscar.`);
      return;
    }
    setErroBusca(null);
    setTermoBuscado(termo);
  };

  const buscou = termoBuscado.trim().length >= MIN_BUSCA;
  const resultados = busca.data ?? [];

  return (
    <AppShell title="Atendimento — Busca e entrega">
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por CPF, RG, nome ou telefone"
                aria-label="Termo de busca do assistido"
              />
              <Button type="submit" className="gap-2">
                <Search className="h-4 w-4" /> Buscar
              </Button>
            </form>
            {erroBusca && <p className="mt-2 text-sm text-destructive">{erroBusca}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              A busca localiza assistidos ativos cadastrados no Supabase.
            </p>
          </CardContent>
        </Card>

        <div>
          {!buscou ? (
            <EstadoVazio texto="Nenhuma busca realizada" />
          ) : busca.isPending ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Buscando…
            </div>
          ) : busca.isError ? (
            <p className="py-8 text-sm text-destructive">
              Não foi possível buscar. Verifique a conexão e tente novamente.
            </p>
          ) : resultados.length === 0 ? (
            <EstadoVazio texto="Nenhum assistido encontrado para os dados informados." />
          ) : (
            <div className="space-y-3">
              {resultados.map((assistido) => (
                <AssistidoResultadoCard
                  key={assistido.assistidoId}
                  assistido={assistido}
                  onRegistrar={() => setSelecionado(assistido)}
                />
              ))}
            </div>
          )}
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="regras">
            <AccordionTrigger className="text-sm">Regras e fluxo (referência)</AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Intervalo mínimo de <strong>25 dias</strong> entre retiradas; Cesta Extra limitada a{" "}
                <strong>3 retiradas</strong>. Falta de estoque <strong>bloqueia</strong> a entrega e
                não admite liberação excepcional.
              </p>
              <p>
                A liberação excepcional (antes do prazo) é exclusiva de administrador e exige
                motivo. As regras são reaplicadas no servidor ao registrar a entrega.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <RegistrarEntregaSupabaseDialog
        open={selecionado !== null}
        onOpenChange={(o) => {
          if (!o) setSelecionado(null);
        }}
        assistido={
          selecionado
            ? {
                id: selecionado.assistidoId,
                familiaId: selecionado.familiaId,
                nome: selecionado.nome,
                documento: selecionado.documento,
                telefone: selecionado.telefone,
                tipoCadastro: selecionado.tipoCadastro,
              }
            : null
        }
        familiaNome={selecionado?.familiaNome || "família"}
      />
    </AppShell>
  );
}

function AssistidoResultadoCard({
  assistido,
  onRegistrar,
}: {
  assistido: AssistidoBuscaResultado;
  onRegistrar: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{assistido.nome}</span>
              <Badge variant="outline">
                {assistido.tipoCadastro === "definitivo" ? "Definitivo" : "Extra"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Doc. {assistido.documento} · Família {assistido.familiaNome || "—"}
            </p>
          </div>
        </div>
        <Button className="gap-2" onClick={onRegistrar}>
          <HeartHandshake className="h-4 w-4" /> Registrar entrega
        </Button>
      </CardContent>
    </Card>
  );
}

function EstadoVazio({ texto }: { texto: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">{texto}</CardContent>
    </Card>
  );
}
