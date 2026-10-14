import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { fmt } from '../lib/nutrition';
import type { ActivityLevel, Goal, ProfileBundle, Sex, Targets } from '../lib/types';

const ACTIVITY: Record<ActivityLevel, string> = {
  SEDENTARY: 'Sedentário (pouco ou nenhum exercício)',
  LIGHT: 'Leve (1–3 dias/semana)',
  MODERATE: 'Moderado (3–5 dias/semana)',
  ACTIVE: 'Intenso (6–7 dias/semana)',
  VERY_ACTIVE: 'Muito intenso (treino pesado diário)',
};
const GOALS: Record<Goal, string> = { LOSE: 'Emagrecer', MAINTAIN: 'Manter o peso', GAIN: 'Ganhar massa' };

export default function Profile() {
  const { user, logout } = useAuth();
  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [form, setForm] = useState({
    birthDate: '', sex: 'FEMALE' as Sex, heightCm: '', weightKg: '',
    activityLevel: 'MODERATE' as ActivityLevel, goal: 'MAINTAIN' as Goal, autoGoals: true,
  });
  const [goals, setGoals] = useState({ calories: '', proteinG: '', carbsG: '', fatG: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const apply = useCallback((b: ProfileBundle) => {
    setBundle(b);
    if (b.profile) {
      setForm((f) => ({
        ...f,
        birthDate: b.profile!.birthDate, sex: b.profile!.sex, heightCm: String(b.profile!.heightCm),
        weightKg: String(b.profile!.weightKg), activityLevel: b.profile!.activityLevel, goal: b.profile!.goal,
      }));
    }
    if (b.target) {
      setGoals({
        calories: String(Math.round(b.target.calories)), proteinG: String(Math.round(b.target.proteinG)),
        carbsG: String(Math.round(b.target.carbsG)), fatG: String(Math.round(b.target.fatG)),
      });
    }
  }, []);

  useEffect(() => {
    api<ProfileBundle>('/api/profile').then(apply).catch((e) => setError(errorMessage(e)));
  }, [apply]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      apply(
        await api<ProfileBundle>('/api/profile', {
          method: 'PUT',
          body: {
            birthDate: form.birthDate, sex: form.sex, heightCm: Number(form.heightCm.replace(',', '.')),
            weightKg: Number(form.weightKg.replace(',', '.')), activityLevel: form.activityLevel,
            goal: form.goal, autoGoals: form.autoGoals,
          },
        }),
      );
      setNotice('Perfil salvo.');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function saveGoals(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      apply(
        await api<ProfileBundle>('/api/profile/goals', {
          method: 'PUT',
          body: {
            calories: Number(goals.calories), proteinG: Number(goals.proteinG),
            carbsG: Number(goals.carbsG), fatG: Number(goals.fatG),
          },
        }),
      );
      setNotice('Metas salvas.');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const est = bundle?.estimate;
  const goalField = (key: keyof Targets, label: string) => (
    <div>
      <label className="label" htmlFor={`g-${key}`}>{label}</label>
      <input id={`g-${key}`} className="input" type="number" inputMode="numeric" required value={goals[key]} onChange={(e) => setGoals({ ...goals, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-6">
      <h1>Perfil e metas</h1>
      <p className="muted">Olá, {user?.name}. O NutriSafe é destinado a maiores de 18 anos.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-900 dark:text-brand-100" role="status">{notice}</p>}

      <form onSubmit={saveProfile} className="card grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="birth">Data de nascimento</label>
          <input id="birth" className="input" type="date" required value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="sex">Sexo (para a fórmula de TMB)</label>
          <select id="sex" className="input" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as Sex })}>
            <option value="FEMALE">Feminino</option>
            <option value="MALE">Masculino</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="height">Altura (cm)</label>
          <input id="height" className="input" inputMode="decimal" required value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="weight">Peso (kg)</label>
          <input id="weight" className="input" inputMode="decimal" required value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="activity">Nível de atividade</label>
          <select id="activity" className="input" value={form.activityLevel} onChange={(e) => setForm({ ...form, activityLevel: e.target.value as ActivityLevel })}>
            {(Object.keys(ACTIVITY) as ActivityLevel[]).map((k) => <option key={k} value={k}>{ACTIVITY[k]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="goal">Objetivo</label>
          <select id="goal" className="input" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value as Goal })}>
            {(Object.keys(GOALS) as Goal[]).map((k) => <option key={k} value={k}>{GOALS[k]}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.autoGoals} onChange={(e) => setForm({ ...form, autoGoals: e.target.checked })} />
          Calcular metas diárias automaticamente ao salvar
        </label>
        <button className="btn-primary sm:col-span-2">Salvar perfil</button>
      </form>

      {est && (
        <section className="card space-y-2">
          <h2>Seu gasto calórico estimado</h2>
          <p>TMB (Mifflin-St Jeor): <strong>{fmt(est.bmr)} kcal</strong> · Gasto diário total: <strong>{fmt(est.tdee)} kcal</strong> · Idade: {est.age}</p>
          <p className="muted">
            Meta sugerida para “{GOALS[form.goal]}”: {fmt(est.suggested.calories)} kcal · P {fmt(est.suggested.proteinG)} g · C {fmt(est.suggested.carbsG)} g · G {fmt(est.suggested.fatG)} g.
            São estimativas populacionais, não aconselhamento médico; consulte um profissional de saúde antes de mudanças importantes na dieta.
          </p>
        </section>
      )}

      {bundle?.profile && (
        <form onSubmit={saveGoals} className="card space-y-3">
          <h2>Metas diárias (ajuste manual)</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {goalField('calories', 'Calorias (kcal)')}
            {goalField('proteinG', 'Proteínas (g)')}
            {goalField('carbsG', 'Carboidratos (g)')}
            {goalField('fatG', 'Gorduras (g)')}
          </div>
          <button className="btn-primary">Salvar metas</button>
        </form>
      )}

      <PrivacySection onDeleted={() => void logout()} />
    </div>
  );
}

function PrivacySection({ onDeleted }: { onDeleted: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  async function exportData() {
    setError('');
    try {
      const data = await api<unknown>('/api/privacy/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nutrisafe-meus-dados.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function logoutAll() {
    try {
      await api('/api/auth/logout-all', { method: 'POST' });
      onDeleted();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/privacy/account', { method: 'DELETE', body: { password, confirm } });
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="card space-y-4">
      <h2>Privacidade e segurança (LGPD)</h2>
      <p className="muted">Seus dados de saúde são seus: você pode baixar uma cópia ou apagar tudo definitivamente.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => void exportData()}>⬇️ Exportar meus dados (JSON)</button>
        <button className="btn-ghost" onClick={() => void logoutAll()}>Sair de todos os dispositivos</button>
        <button className="btn-ghost text-red-600" onClick={() => setOpen((v) => !v)}>Excluir minha conta</button>
      </div>
      {open && (
        <form onSubmit={deleteAccount} className="space-y-3 rounded-lg border border-red-300 p-3 dark:border-red-800">
          <p className="text-sm">Esta ação é <strong>permanente</strong>: perfil, refeições, favoritos e histórico serão apagados.</p>
          <div>
            <label className="label" htmlFor="del-pass">Sua senha</label>
            <input id="del-pass" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="del-confirm">Digite EXCLUIR para confirmar</label>
            <input id="del-confirm" className="input" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="btn-danger" disabled={confirm !== 'EXCLUIR' || !password}>Excluir definitivamente</button>
        </form>
      )}
    </section>
  );
}
