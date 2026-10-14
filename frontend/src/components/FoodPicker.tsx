import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import type { Food } from '../lib/types';

/**
 * Busca de alimentos (com debounce) e criação de alimento personalizado.
 * Todo texto vindo da API é renderizado como TEXTO pelo React (escapado automaticamente):
 * nunca usamos dangerouslySetInnerHTML.
 */
export default function FoodPicker({ onPick }: { onPick: (food: Food) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const data = await api<{ foods: Food[] }>(`/api/foods?q=${encodeURIComponent(q)}&limit=10`);
        if (!controller.signal.aborted) setResults(data.foods);
      } catch (e) {
        if (!controller.signal.aborted) setError(errorMessage(e));
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-2">
      <label className="label" htmlFor="food-search">Buscar alimento</label>
      <input
        id="food-search"
        className="input"
        placeholder="Ex.: arroz, frango, banana…"
        value={query}
        maxLength={60}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {searching && <p className="muted">Buscando…</p>}
      {error && <p className="error">{error}</p>}

      {results.length > 0 && (
        <ul className="max-h-56 divide-y divide-slate-200 overflow-auto rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {results.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => {
                  onPick(f);
                  setQuery('');
                  setResults([]);
                }}
              >
                <span>
                  {f.name}
                  {f.brand ? <span className="muted"> · {f.brand}</span> : null}
                </span>
                <span className="muted whitespace-nowrap">{Math.round(f.calories)} kcal/100g</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && !searching && results.length === 0 && !error && (
        <p className="muted">Nenhum resultado.</p>
      )}

      <button type="button" className="text-sm font-medium text-brand-600 underline" onClick={() => setCreating((v) => !v)}>
        {creating ? 'Cancelar alimento personalizado' : 'Não achei: criar alimento personalizado'}
      </button>
      {creating && (
        <CustomFoodForm
          onCreated={(f) => {
            onPick(f);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CustomFoodForm({ onCreated }: { onCreated: (f: Food) => void }) {
  const [name, setName] = useState('');
  const [vals, setVals] = useState({ calories: '', proteinG: '', carbsG: '', fatG: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { food } = await api<{ food: Food }>('/api/foods', {
        method: 'POST',
        body: {
          name,
          calories: Number(vals.calories),
          proteinG: Number(vals.proteinG),
          carbsG: Number(vals.carbsG),
          fatG: Number(vals.fatG),
        },
      });
      onCreated(food);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof vals, label: string) => (
    <div>
      <label className="label" htmlFor={`cf-${key}`}>{label}</label>
      <input
        id={`cf-${key}`}
        className="input"
        type="number"
        inputMode="decimal"
        min={0}
        step="0.1"
        required
        value={vals[key]}
        onChange={(e) => setVals({ ...vals, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="card space-y-3">
      <p className="muted">Informe os valores por 100 g do alimento.</p>
      <div>
        <label className="label" htmlFor="cf-name">Nome</label>
        <input id="cf-name" className="input" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('calories', 'Calorias (kcal)')}
        {field('proteinG', 'Proteínas (g)')}
        {field('carbsG', 'Carboidratos (g)')}
        {field('fatG', 'Gorduras (g)')}
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Salvando…' : 'Salvar e usar'}</button>
    </form>
  );
}
