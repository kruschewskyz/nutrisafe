import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MacroBar from '../components/MacroBar';
import { api, errorMessage } from '../lib/api';
import { addDays, dayRange, formatDay, formatTime, isSameDay, rangeQuery, startOfDay } from '../lib/date';
import { fmt } from '../lib/nutrition';
import { MEAL_LABEL, type DashboardData, type Suggestions } from '../lib/types';

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const left = goal - consumed;
  return (
    <div className="relative mx-auto h-40 w-40" role="img" aria-label={`${fmt(consumed)} de ${fmt(goal)} calorias`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="12" className="stroke-slate-200 dark:stroke-slate-700" />
        <circle
          cx="60" cy="60" r={r} fill="none" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className={left < 0 ? 'stroke-red-500' : 'stroke-brand-500'}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{fmt(Math.abs(left))}</span>
        <span className="muted">{left >= 0 ? 'kcal restantes' : 'kcal acima'}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [data, setData] = useState<DashboardData | null>(null);
  const [sugg, setSugg] = useState<Suggestions | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const q = rangeQuery(dayRange(day));
    try {
      const d = await api<DashboardData>(`/api/dashboard?${q}`);
      setData(d);
      // Sugestões só quando há metas (perfil completo) e o dia é hoje.
      if (d.target && isSameDay(day, new Date())) setSugg(await api<Suggestions>(`/api/suggestions?${q}`));
      else setSugg(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [day]);

  useEffect(() => {
    void load();
  }, [load]);

  const t = data?.target;
  const c = data?.consumed;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <button className="btn-ghost" onClick={() => setDay(addDays(day, -1))} aria-label="Dia anterior">←</button>
        <h1 className="text-center text-base capitalize sm:text-2xl">
          {isSameDay(day, new Date()) ? 'Hoje · ' : ''}{formatDay(day)}
        </h1>
        <button className="btn-ghost" onClick={() => setDay(addDays(day, 1))} disabled={isSameDay(day, new Date())} aria-label="Próximo dia">→</button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {data && !t && (
        <div className="card text-center">
          <p className="mb-3">Complete seu perfil para calcular suas metas diárias automaticamente.</p>
          <Link to="/profile" className="btn-primary">Completar perfil</Link>
        </div>
      )}

      {data && c && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card space-y-4">
            <h2>Calorias</h2>
            {t ? <CalorieRing consumed={c.calories} goal={t.calories} /> : <p className="text-3xl font-bold">{fmt(c.calories)} kcal</p>}
            {t && <p className="muted text-center">{fmt(c.calories)} consumidas de {fmt(t.calories)} kcal</p>}
          </section>

          <section className="card space-y-4">
            <h2>Macronutrientes</h2>
            <MacroBar label="Proteínas" value={c.proteinG} goal={t?.proteinG} color="bg-blue-500" />
            <MacroBar label="Carboidratos" value={c.carbsG} goal={t?.carbsG} color="bg-amber-500" />
            <MacroBar label="Gorduras" value={c.fatG} goal={t?.fatG} color="bg-rose-500" />
          </section>

          <section className="card md:col-span-2">
            <h2 className="mb-3">Micronutrientes do dia</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['Fibras', `${fmt(c.fiberG, 1)} g`],
                ['Sódio', `${fmt(c.sodiumMg)} mg`],
                ['Ferro', `${fmt(c.ironMg, 1)} mg`],
                ['Cálcio', `${fmt(c.calciumMg)} mg`],
                ['Vitamina C', `${fmt(c.vitCMg)} mg`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-100 p-3 text-center dark:bg-slate-900">
                  <dt className="muted">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="muted mt-2">Alguns alimentos da base não têm todos os micronutrientes informados; os totais podem estar subestimados.</p>
          </section>
        </div>
      )}

      {data && (
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2>Refeições do dia</h2>
            <Link to="/meals" className="btn-primary">+ Registrar</Link>
          </div>
          {data.meals.length === 0 && <p className="muted">Nenhuma refeição registrada.</p>}
          {data.meals.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
              <div>
                <p className="font-medium">{MEAL_LABEL[m.type]} <span className="muted">· {formatTime(m.eatenAt)}</span></p>
                <p className="muted">{m.items.map((i) => i.foodName).join(', ')}</p>
              </div>
              <p className="whitespace-nowrap font-semibold">{fmt(m.totals.calories)} kcal</p>
            </div>
          ))}
        </section>
      )}

      {sugg && (
        <section className="card space-y-3">
          <h2>Sugestões para o resto do dia</h2>
          {sugg.message && <p>{sugg.message}</p>}
          {sugg.favorites.length > 0 && (
            <div>
              <p className="label">Dos seus favoritos</p>
              <ul className="space-y-1">
                {sugg.favorites.map((f) => (
                  <li key={f.id} className="flex justify-between">
                    <span>{f.name}</span>
                    <span className="muted">{fmt(f.totals.calories)} kcal · P {fmt(f.totals.proteinG)} g</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sugg.foods.length > 0 && (
            <div>
              <p className="label">Para completar suas proteínas</p>
              <ul className="space-y-1">
                {sugg.foods.map((f) => (
                  <li key={f.foodId} className="flex justify-between">
                    <span>{f.name} ({f.grams} g)</span>
                    <span className="muted">{f.calories} kcal · P {fmt(f.proteinG, 1)} g</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="muted">Sugestões automáticas e genéricas; não substituem orientação de nutricionista.</p>
        </section>
      )}
    </div>
  );
}
