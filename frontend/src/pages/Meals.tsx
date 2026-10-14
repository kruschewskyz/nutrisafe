import { useCallback, useEffect, useState } from 'react';
import MealEditor, { toEditorItems, type EditorInitial } from '../components/MealEditor';
import { api, errorMessage } from '../lib/api';
import { addDays, dayRange, formatDay, formatTime, isSameDay, rangeQuery, startOfDay } from '../lib/date';
import { fmt } from '../lib/nutrition';
import { MEAL_LABEL, type Meal } from '../lib/types';

type EditorState = { kind: 'meal' | 'favorite'; initial: EditorInitial } | null;

export default function Meals() {
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [editor, setEditor] = useState<EditorState>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api<{ meals: Meal[] }>(`/api/meals?${rangeQuery(dayRange(day))}`);
      setMeals(data.meals);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [day]);

  useEffect(() => {
    void load();
  }, [load]);

  const newMealAt = () => {
    // Hoje: agora. Outros dias: 12:00 do dia selecionado.
    const base = isSameDay(day, new Date()) ? new Date() : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0);
    return base;
  };

  async function remove(m: Meal) {
    if (!window.confirm('Excluir esta refeição?')) return;
    try {
      await api(`/api/meals/${m.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button className="btn-ghost" onClick={() => setDay(addDays(day, -1))} aria-label="Dia anterior">←</button>
        <h1 className="text-center text-base capitalize sm:text-2xl">{formatDay(day)}</h1>
        <button className="btn-ghost" onClick={() => setDay(addDays(day, 1))} aria-label="Próximo dia">→</button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {editor ? (
        <MealEditor
          key={editor.initial.id ?? 'new'}
          kind={editor.kind}
          initial={editor.initial}
          onCancel={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void load();
          }}
        />
      ) : (
        <button
          className="btn-primary w-full sm:w-auto"
          onClick={() => setEditor({ kind: 'meal', initial: { type: 'LUNCH', eatenAt: newMealAt(), items: [] } })}
        >
          + Nova refeição
        </button>
      )}

      <div className="space-y-3">
        {meals.length === 0 && !editor && <p className="muted">Nenhuma refeição neste dia.</p>}
        {meals.map((m) => (
          <article key={m.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2>{MEAL_LABEL[m.type]} <span className="muted font-normal">· {formatTime(m.eatenAt)}</span></h2>
                <p className="text-sm">
                  <strong>{fmt(m.totals.calories)} kcal</strong> · P {fmt(m.totals.proteinG, 1)} g · C {fmt(m.totals.carbsG, 1)} g · G {fmt(m.totals.fatG, 1)} g
                </p>
              </div>
            </div>
            <ul className="muted space-y-0.5">
              {m.items.map((i) => (
                <li key={i.id}>{i.foodName} — {fmt(i.grams)} g ({fmt(i.nutrients.calories)} kcal)</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn-ghost" onClick={() => setEditor({ kind: 'meal', initial: { id: m.id, type: m.type, eatenAt: new Date(m.eatenAt), items: toEditorItems(m.items) } })}>
                Editar
              </button>
              <button className="btn-ghost" onClick={() => setEditor({ kind: 'favorite', initial: { type: m.type, eatenAt: new Date(), name: MEAL_LABEL[m.type], items: toEditorItems(m.items) } })}>
                ⭐ Salvar como favorito
              </button>
              <button className="btn-ghost text-red-600" onClick={() => void remove(m)}>Excluir</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
