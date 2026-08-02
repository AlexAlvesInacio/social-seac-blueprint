import { Input } from "@/components/ui/input";

/**
 * Campo numérico dos parâmetros de atendimento. Fica num arquivo próprio
 * porque deixou de ser só apresentação: sinaliza quando o valor foge do
 * previsto nas regras aprovadas e, no caso de 0, que a regra está desligada.
 *
 * A motivação está na issue #92 — o prazo mínimo ficou em 0 na produção, sem
 * que nada avisasse que a regra dos 25 dias tinha parado de valer.
 */
export function ParamNum({
  label,
  value,
  onChange,
  unidade,
  descricao,
  recomendado,
  avisoAoZerar,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unidade?: string;
  descricao?: string;
  /** Valor previsto nas regras aprovadas; divergência vira aviso na tela. */
  recomendado?: number;
  /** Texto extra quando o valor é 0 e isso desliga a regra por completo. */
  avisoAoZerar?: string;
}) {
  const desligado = avisoAoZerar !== undefined && value === 0;
  const divergente = recomendado !== undefined && value !== recomendado;

  return (
    <div
      className={
        desligado
          ? "rounded-md border border-destructive/50 bg-destructive/5 p-3"
          : divergente
            ? "rounded-md border border-warning/50 bg-warning/5 p-3"
            : "rounded-md border border-border bg-card p-3"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="pr-3 text-sm font-medium">{label}</div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            className="w-24"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          {unidade && <span className="text-xs text-muted-foreground">{unidade}</span>}
        </div>
      </div>
      {descricao && <p className="mt-2 text-xs text-muted-foreground">{descricao}</p>}
      {desligado ? (
        <p className="mt-2 text-xs font-medium text-destructive">{avisoAoZerar}</p>
      ) : divergente ? (
        <p className="mt-2 text-xs text-warning-foreground">
          Fora do valor previsto nas regras aprovadas ({recomendado}
          {unidade ? ` ${unidade}` : ""}). Confirme se é intencional.
        </p>
      ) : null}
    </div>
  );
}
