import { fmt } from '../lib/nutrition';

interface Props {
  label: string;
  value: number;
  goal?: number | null;
  unit?: string;
  color: string; // classe Tailwind de fundo, ex.: "bg-blue-500"
}

/** Barra de progresso de um macronutriente (consumido vs meta). */
export default function MacroBar({ label, value, goal, unit = 'g', color }: Props) {
  const pct = goal && goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  const over = !!goal && value > goal;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="muted">
          {fmt(value)}
          {goal ? ` / ${fmt(goal)}` : ''} {unit}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${over ? 'bg-red-500' : color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
