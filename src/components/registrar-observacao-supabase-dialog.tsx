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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCriarObservacaoSupabase } from "@/lib/familias/use-familias-supabase";
import type { ObservacaoSocialTipoSupabase } from "@/lib/familias/familias-supabase-types";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familiaId: string;
  familiaNome: string;
};

const tiposObservacao: { value: ObservacaoSocialTipoSupabase; label: string }[] = [
  { value: "social", label: "Social" },
  { value: "atendimento", label: "Atendimento" },
  { value: "documento", label: "Documento" },
  { value: "endereco", label: "Endereço" },
  { value: "saude_pcd", label: "Saúde/PCD" },
  { value: "outro", label: "Outro" },
];

/**
 * Registra uma observação social em família remota (INSERT de tabela única,
 * gravado pela camada de serviço; autoria e data via trigger). É uma observação
 * no nível da família — pessoa/assistido específicos ficam para etapa futura.
 */
export function RegistrarObservacaoSupabaseDialog({
  open,
  onOpenChange,
  familiaId,
  familiaNome,
}: Props) {
  const [tipo, setTipo] = useState<ObservacaoSocialTipoSupabase>("social");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const criarObservacao = useCriarObservacaoSupabase();

  useEffect(() => {
    if (open) {
      setTipo("social");
      setTexto("");
      setErro(null);
    }
  }, [open]);

  const salvar = async () => {
    if (!texto.trim()) {
      setErro("Escreva a observação.");
      return;
    }
    setErro(null);
    try {
      await criarObservacao.mutateAsync({ familiaId, tipo, texto });
      toast.success("Observação registrada.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar a observação.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar observação</DialogTitle>
          <DialogDescription>Nova observação para {familiaNome}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo de observação</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as ObservacaoSocialTipoSupabase)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiposObservacao.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Observação</Label>
            <Textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} />
            {erro && <p className="text-xs text-destructive">{erro}</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            Data e usuário serão registrados automaticamente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={criarObservacao.isPending} onClick={() => void salvar()}>
            {criarObservacao.isPending ? "Registrando..." : "Registrar observação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
