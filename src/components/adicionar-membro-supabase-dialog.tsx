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
import { useCriarMembroSupabase } from "@/lib/familias/use-familias-supabase";
import type { PessoaTipoDocumentoSupabase } from "@/lib/familias/familias-supabase-types";
import { PessoaExistenteBanner } from "@/components/pessoa-existente-banner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familiaId: string;
  familiaNome: string;
};

const empty = {
  nome: "",
  parentesco: "",
  documento: "",
  tipoDocumento: "cpf" as PessoaTipoDocumentoSupabase,
  telefone: "",
  nascimento: "",
  pcd: false,
  gestante: false,
  pessoaId: "",
};

/**
 * Cadastro de membro familiar em família remota (UUID) via RPC transacional.
 * A RPC cria pessoa e vínculo, sem assistido — o documento é obrigatório porque
 * toda pessoa exige documento único (pessoas.documento é NOT NULL). Para
 * cadastrar alguém que também recebe benefício, usa-se o fluxo de assistido.
 */
export function AdicionarMembroSupabaseDialog({
  open,
  onOpenChange,
  familiaId,
  familiaNome,
}: Props) {
  const [form, setForm] = useState(empty);
  const [erros, setErros] = useState<Record<string, string>>({});
  const criarMembro = useCriarMembroSupabase();

  useEffect(() => {
    if (open) {
      setForm(empty);
      setErros({});
    }
  }, [open]);

  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Informe o nome.";
    if (!form.documento.trim()) e.documento = "CPF/RG é obrigatório.";
    setErros(e);
    if (Object.keys(e).length) return;

    try {
      await criarMembro.mutateAsync({
        familiaId,
        nome: form.nome,
        tipoDocumento: form.tipoDocumento,
        documento: form.documento,
        parentesco: form.parentesco,
        telefone: form.telefone,
        nascimento: form.nascimento,
        pcd: form.pcd,
        gestante: form.gestante,
        pessoaId: form.pessoaId || undefined,
      });
      toast.success("Membro adicionado.");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: string }).code === "23505") {
        setErros({ documento: "Já existe um cadastro com este documento." });
      }
      toast.error(err instanceof Error ? err.message : "Não foi possível adicionar o membro.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar membro familiar</DialogTitle>
          <DialogDescription>Vincular novo membro à família {familiaNome}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <section className="grid gap-3 md:grid-cols-2">
            <F label="Nome do membro *" erro={erros.nome}>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </F>
            <F label="Parentesco">
              <Input
                value={form.parentesco}
                onChange={(e) => set("parentesco", e.target.value)}
                placeholder="Filho, cônjuge, mãe..."
              />
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
                familiaDestinoId={familiaId}
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
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.pcd}
                onCheckedChange={(v) => set("pcd", v)}
                id="pcd-membro-sb"
              />
              <Label htmlFor="pcd-membro-sb" className="text-sm">
                PCD
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.gestante}
                onCheckedChange={(v) => set("gestante", v)}
                id="gestante-membro-sb"
              />
              <Label htmlFor="gestante-membro-sb" className="text-sm">
                Gestante
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={criarMembro.isPending} onClick={() => void salvar()}>
            {criarMembro.isPending ? "Salvando..." : "Salvar membro"}
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
