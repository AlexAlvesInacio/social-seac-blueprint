import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCriarPreCadastro } from "@/lib/familias/use-familias-supabase";
import type { PessoaTipoDocumentoSupabase } from "@/lib/familias/familias-supabase-types";
import { PessoaExistenteBanner } from "@/components/pessoa-existente-banner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** true = variante "Criar pré-cadastro + entregar Cesta Extra". */
  entregar: boolean;
  /** Termo buscado, usado para pré-preencher nome ou documento. */
  termoInicial?: string;
};

function estadoInicial(termo: string) {
  const t = (termo ?? "").trim();
  // Só dígitos/traços/pontos → provavelmente documento; senão, nome.
  const pareceDocumento = t.length > 0 && /^[\d.\-/ ]+$/.test(t);
  return {
    nome: pareceDocumento ? "" : t,
    documento: pareceDocumento ? t : "",
    tipoDocumento: "cpf" as PessoaTipoDocumentoSupabase,
    telefone: "",
    nascimento: "",
    pcd: false,
    pessoaId: "",
  };
}

/**
 * Pré-cadastro de assistido (cadastro "extra") a partir do atendimento quando a
 * busca não encontra ninguém. A RPC cria família implícita + pessoa + assistido; na
 * variante `entregar`, já registra a entrega de Cesta Extra (respeitando estoque).
 */
export function PreCadastroDialog({ open, onOpenChange, entregar, termoInicial = "" }: Props) {
  const [form, setForm] = useState(() => estadoInicial(termoInicial));
  const [erros, setErros] = useState<Record<string, string>>({});
  const criar = useCriarPreCadastro();

  useEffect(() => {
    if (open) {
      setForm(estadoInicial(termoInicial));
      setErros({});
    }
  }, [open, termoInicial]);

  const set = <K extends keyof ReturnType<typeof estadoInicial>>(
    k: K,
    v: ReturnType<typeof estadoInicial>[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Informe o nome.";
    if (!form.documento.trim()) e.documento = "CPF/RG é obrigatório.";
    setErros(e);
    if (Object.keys(e).length) return;

    try {
      const data = await criar.mutateAsync({
        nome: form.nome,
        tipoDocumento: form.tipoDocumento,
        documento: form.documento,
        telefone: form.telefone,
        nascimento: form.nascimento,
        pcd: form.pcd,
        entregar,
        pessoaId: form.pessoaId || undefined,
      });
      if (data.status === "criado_e_entregue") {
        toast.success(
          `Pré-cadastro criado e Cesta Extra entregue. Saldo restante: ${data.saldo_resultante}.`,
        );
      } else if (data.status === "criado_sem_estoque") {
        toast.warning(
          "Pré-cadastro criado, mas sem saldo de Cesta Extra — entrega não realizada. Tentativa registrada.",
        );
      } else {
        toast.success("Pré-cadastro criado.");
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: string }).code === "23505") {
        setErros({ documento: "Já existe um cadastro com este documento." });
      }
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o pré-cadastro.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entregar ? "Pré-cadastro + entrega de Cesta Extra" : "Criar pré-cadastro"}
          </DialogTitle>
          <DialogDescription>
            Cria um assistido em avaliação (Cesta Extra){" "}
            {entregar ? "e já registra a entrega, respeitando o estoque." : "sem entrega agora."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <section className="grid gap-3 md:grid-cols-2">
            <F label="Nome *" erro={erros.nome}>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </F>
            <F label="Tipo de documento">
              <Select
                value={form.tipoDocumento}
                onValueChange={(v) => set("tipoDocumento", v as PessoaTipoDocumentoSupabase)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="rg">RG</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label="CPF / RG *" erro={erros.documento}>
              <Input
                value={form.documento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, documento: e.target.value, pessoaId: "" }))
                }
              />
              <PessoaExistenteBanner
                documento={form.documento}
                pessoaIdSelecionado={form.pessoaId}
                onReutilizar={(p) => setForm((f) => ({ ...f, pessoaId: p.pessoaId, nome: p.nome }))}
                onLimpar={() => set("pessoaId", "")}
              />
            </F>
            <F label="Telefone">
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
            </F>
            <F label="Data de nascimento">
              <Input
                type="date"
                value={form.nascimento}
                onChange={(e) => set("nascimento", e.target.value)}
              />
            </F>
          </section>
          <div className="flex items-center gap-2">
            <Switch checked={form.pcd} onCheckedChange={(v) => set("pcd", v)} id="pcd-precad" />
            <Label htmlFor="pcd-precad" className="text-sm">
              PCD
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={criar.isPending} onClick={() => void salvar()}>
            {criar.isPending ? "Salvando..." : entregar ? "Criar e entregar" : "Criar pré-cadastro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, erro, children }: { label: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
