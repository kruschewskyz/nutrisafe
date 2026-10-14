import { useMemo, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { toLocalInput } from '../lib/date';
import { fmt, portion, sum } from '../lib/nutrition';
import { MEAL_LABEL, type Food, type MealItem, type MealType, type Nutrients } from '../lib/types';
import FoodPicker from './FoodPicker';

export interface EditorItem {
  foodId: string;
  name: string;
  grams: number;
  per100: Nutrients; // valores por 100 g (para a prévia)
}

export interface EditorInitial {
  id?: string; // presente = edição
  type: MealType;
  eatenAt: Date;
  name?: string; // só para favoritos
  items: EditorItem[];
}

interface Props {
  kind: 'meal' | 'favorite';
  initial: EditorInitial;
  onSaved: () => void;
  onCancel: () => void;
}

const toPer100 = (f: Food): Nutrients => ({
  calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG,
  fiberG: f.fiberG, sodiumMg: f.sodiumMg, ironMg: f.ironMg, calciumMg: f.calciumMg, vitCMg: f.vitCMg,
});

/** Itens salvos só trazem os nutrientes da porção; derivamos os valores por 100 g (apenas para a prévia). */
export function toEditorItems(items: MealItem[]): EditorItem[] {
  return items.map((i) => {
    const k = i.grams > 0 ? 100 / i.grams : 0;
    const n = i.nutrients;
    return {
      foodId: i.foodId,
      name: i.foodName,
      grams: i.grams,
      per100: {
        calories: n.calories * k, proteinG: n.proteinG * k, carbsG: n.carbsG * k, fatG: n.fatG * k,
        fiberG: n.fiberG * k, sodiumMg: n.sodiumMg * k, ironMg: n.ironMg * k, calciumMg: n.calciumMg * k, vitCMg: n.vitCMg * k,
      },
    };
  });
}

/** Formulário para criar/editar refeição OU favorito (CRUD completo). */
export default function MealEditor({ kind, initial, onSaved, onCancel }: Props) {
  const [type, setType] = useState<MealType>(initial.type);
  const [eatenAt, setEatenAt] = useState(toLocalInput(initial.eatenAt));
  const [name, setName] = useState(initial.name ?? '');
  const [items, setItems] = useState<EditorItem[]>(initial.items);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => sum(items.map((i) => portion(i.per100, i.grams))), [items]);

  function addFood(f: Food) {
    setItems((prev) => [...prev, { foodId: f.id, name: f.name, grams: 100, per100: toPer100(f) }]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0) return setError('Adicione pelo menos um alimento.');
    setBusy(true);
    setError('');
    const apiItems = items.map((i) => ({ foodId: i.foodId, grams: i.grams }));
    try {
      if (kind === 'meal') {
        const body = { type, eatenAt: new Date(eatenAt).toISOString(), items: apiItems };
        await api(initial.id ? `/api/meals/${initial.id}` : '/api/meals', {
          method: initial.id ? 'PUT' : 'POST',
          body,
        });
      } else {
        const body = { name, type, items: apiItems };
        await api(initial.id ? `/api/favorites/${initial.id}` : '/api/favorites', {
          method: initial.id ? 'PUT' : 'POST',
          body,
        });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2>
        {kind === 'meal' ? (initial.id ? 'Editar refeição' : 'Nova refeição') : initial.id ? 'Editar favorito' : 'Novo favorito'}
      </h2>

      {kind === 'favorite' && (
        <div>
          <label className="label" htmlFor="fav-name">Nome do favorito</label>
          <input id="fav-name" className="input" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="meal-type">Tipo</label>
          <select id="meal-type" className="input" value={type} onChange={(e) => setType(e.target.value as MealType)}>
            {(Object.keys(MEAL_LABEL) as MealType[]).map((t) => (
              <option key={t} value={t}>{MEAL_LABEL[t]}</option>
            ))}
          </select>
        </div>
        {kind === 'meal' && (
          <div>
            <label className="label" htmlFor="meal-time">Data e hora</label>
            <input id="meal-time" className="input" type="datetime-local" required value={eatenAt} onChange={(e) => setEatenAt(e.target.value)} />
          </div>
        )}
      </div>

      <FoodPicker onPick={addFood} />

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it, idx) => {
            const n = portion(it.per100, it.grams);
            return (
              <li key={`${it.foodId}-${idx}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 p-2 dark:bg-slate-900">
                <span className="min-w-[8rem] flex-1 font-medium">{it.name}</span>
                <label className="sr-only" htmlFor={`g-${idx}`}>Gramas de {it.name}</label>
                <input
                  id={`g-${idx}`}
                  className="input w-24"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={5000}
                  step="1"
                  value={it.grams}
                  onChange={(e) => {
                    const grams = Math.min(5000, Math.max(0, Number(e.target.value)));
                    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, grams } : p)));
                  }}
                />
                <span className="muted w-8">g</span>
                <span className="muted w-20 text-right">{fmt(n.calories)} kcal</span>
                <button
                  type="button"
                  className="btn-ghost px-2"
                  aria-label={`Remover ${it.name}`}
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm">
        <strong>{fmt(totals.calories)} kcal</strong> · P {fmt(totals.proteinG, 1)} g · C {fmt(totals.carbsG, 1)} g · G {fmt(totals.fatG, 1)} g
      </p>

      {error && <p className="error">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy || items.some((i) => !(i.grams > 0))}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
