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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAtualizarFamiliaSupabase } from "@/lib/familias/use-familias-supabase";
import type {
  FamiliaStatusSupabase,
  FamiliaSupabaseReadModel,
} from "@/lib/familias/familias-supabase-types";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familia: FamiliaSupabaseReadModel;
};

function toForm(f: FamiliaSupabaseReadModel) {
  return {
    nome: f.nome ?? "",
    endereco: f.endereco ?? "",
    numero: f.numero ?? "",
    complemento: f.complemento ?? "",
    bairro: f.bairro ?? "",
    cidade: f.cidade ?? "",
    uf: f.uf ?? "",
    cep: f.cep ?? "",
    status: f.status,
  };
}

/**
 * Edita os dados cadastrais de uma família remota via RPC atualizar_familia.
 * Escopo restrito às colunas da tabela familias (nome, endereço e status); o
 * responsável e demais pessoas não são alterados por aqui.
 */
export function EditarFamiliaSupabaseDialog({ open, onOpenChange, familia }: Props) {
  const [form, setForm] = useState(() => toForm(familia));
  const [erros, setErros] = useState<Record<string, string>>({});
  const atualizarFamilia = useAtualizarFamiliaSupabase();

  useEffect(() => {
    if (open) {
      setForm(toForm(familia));
      setErros({});
    }
  }, [open, familia]);

  const set = <K extends keyof ReturnType<typeof toForm>>(k: K, v: ReturnType<typeof toForm>[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    if (!form.nome.trim()) {
      setErros({ nome: "Informe o nome da família." });
      return;
    }
    setErros({});
    try {
      await atualizarFamilia.mutateAsync({
        familiaId: familia.id,
        nomeReferencia: form.nome,
        endereco: form.endereco,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        cep: form.cep,
        status: form.status,
      });
      toast.success("Família atualizada.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a família.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar família</DialogTitle>
          <DialogDescription>
            Atualize nome, endereço e status. O responsável é editado à parte.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <section className="grid gap-3 md:grid-cols-2">
            <F label="Nome da família *" erro={erros.nome}>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </F>
            <F label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as FamiliaStatusSupabase)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="liberado">Ativa</SelectItem>
                  <SelectItem value="avaliar">Em avaliação</SelectItem>
                  <SelectItem value="bloqueado">Bloqueada</SelectItem>
                  <SelectItem value="inativo">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </F>
          </section>
          <section className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <F label="Endereço">
                <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
              </F>
            </div>
            <F label="Número">
              <Input value={form.numero} onChange={(e) => set("numero", e.target.value)} />
            </F>
            <F label="Complemento">
              <Input
                value={form.complemento}
                onChange={(e) => set("complemento", e.target.value)}
              />
            </F>
            <F label="Bairro">
              <Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </F>
            <F label="Cidade">
              <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
            </F>
            <F label="UF">
              <Input
                maxLength={2}
                value={form.uf}
                onChange={(e) => set("uf", e.target.value.toUpperCase())}
              />
            </F>
            <F label="CEP">
              <Input value={form.cep} onChange={(e) => set("cep", e.target.value)} />
            </F>
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={atualizarFamilia.isPending} onClick={() => void salvar()}>
            {atualizarFamilia.isPending ? "Salvando..." : "Salvar alterações"}
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
