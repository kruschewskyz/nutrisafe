import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, errorMessage } from '../lib/api';
import { lastDaysRange, rangeQuery, tzOffset } from '../lib/date';
import { fmt } from '../lib/nutrition';
import type { ProgressData, WeightLog } from '../lib/types';

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function Progress() {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [data, setData] = useState<ProgressData | null>(null);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [p, w] = await Promise.all([
        api<ProgressData>(`/api/progress?${rangeQuery(lastDaysRange(rangeDays))}&tzOffsetMinutes=${tzOffset()}`),
        api<{ logs: WeightLog[] }>(`/api/progress/weight?${rangeQuery(lastDaysRange(180))}`),
      ]);
      setData(p);
      setWeights(w.logs);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [rangeDays]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addWeight(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/progress/weight', { method: 'POST', body: { weightKg: Number(weightInput.replace(',', '.')) } });
      setWeightInput('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const weightData = weights.map((w) => ({ date: shortDate(w.loggedAt.slice(0, 10)), kg: w.weightKg }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Progresso</h1>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600" role="group" aria-label="Período">
          {([7, 30] as const).map((n) => (
            <button
              key={n}
              className={`px-4 py-2 text-sm font-medium ${rangeDays === n ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-800'}`}
              onClick={() => setRangeDays(n)}
              aria-pressed={rangeDays === n}
            >
              {n === 7 ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {data && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Média kcal/dia', fmt(data.averages.calories)],
              ['Proteínas (g)', fmt(data.averages.proteinG)],
              ['Carboidratos (g)', fmt(data.averages.carbsG)],
              ['Gorduras (g)', fmt(data.averages.fatG)],
            ].map(([label, value]) => (
              <div key={label} className="card text-center">
                <p className="muted">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
            <p className="muted col-span-2 sm:col-span-4">
              Médias calculadas nos {data.daysLogged} dia(s) com registros no período.
            </p>
          </section>

          <section className="card">
            <h2 className="mb-3">Calorias por dia</h2>
            <div className="h-64" role="img" aria-label="Gráfico de barras das calorias diárias">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.days.map((d) => ({ ...d, label: shortDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} width={40} />
                  <Tooltip formatter={(v: number) => [`${v} kcal`, 'Calorias']} />
                  <Bar dataKey="calories" fill="#10b981" radius={[4, 4, 0, 0]} />
                  {data.target && <ReferenceLine y={data.target.calories} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Meta', fontSize: 11, fill: '#ef4444' }} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card">
            <h2 className="mb-3">Macronutrientes por dia (g)</h2>
            <div className="h-64" role="img" aria-label="Gráfico de linhas dos macronutrientes">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.days.map((d) => ({ ...d, label: shortDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} width={40} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="proteinG" name="Proteínas" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="carbsG" name="Carboidratos" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fatG" name="Gorduras" stroke="#e11d48" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}

      <section className="card space-y-3">
        <h2>Peso</h2>
        <form onSubmit={addWeight} className="flex gap-2">
          <label className="sr-only" htmlFor="weight">Peso em kg</label>
          <input id="weight" className="input" inputMode="decimal" placeholder="Peso atual (kg)" required value={weightInput} onChange={(e) => setWeightInput(e.target.value)} />
          <button className="btn-primary">Registrar</button>
        </form>
        {weightData.length > 1 ? (
          <div className="h-56" role="img" aria-label="Gráfico da evolução do peso">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} width={40} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip formatter={(v: number) => [`${v} kg`, 'Peso']} />
                <Line type="monotone" dataKey="kg" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="muted">Registre seu peso em pelo menos duas datas para ver o gráfico.</p>
        )}
      </section>
    </div>
  );
}
