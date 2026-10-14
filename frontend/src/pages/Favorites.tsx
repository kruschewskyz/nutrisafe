import { useCallback, useEffect, useState } from 'react';
import MealEditor, { toEditorItems, type EditorInitial } from '../components/MealEditor';
import { api, errorMessage } from '../lib/api';
import { fmt } from '../lib/nutrition';
import { MEAL_LABEL, type Favorite } from '../lib/types';

export default function Favorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [editor, setEditor] = useState<EditorInitial | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setFavorites((await api<{ favorites: Favorite[] }>('/api/favorites')).favorites);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logNow(f: Favorite) {
    setError('');
    setNotice('');
    try {
      await api(`/api/favorites/${f.id}/log`, { method: 'POST', body: { eatenAt: new Date().toISOString() } });
      setNotice(`“${f.name}” registrado agora.`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove(f: Favorite) {
    if (!window.confirm(`Excluir o favorito “${f.name}”?`)) return;
    try {
      await api(`/api/favorites/${f.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const toEditor = (f: Favorite): EditorInitial => ({
    id: f.id, type: f.type, eatenAt: new Date(), name: f.name,
    items: toEditorItems(f.items),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1>Favoritos</h1>
        {!editor && <button className="btn-primary" onClick={() => setEditor({ type: 'LUNCH', eatenAt: new Date(), name: '', items: [] })}>+ Novo</button>}
      </div>
      <p className="muted">Refeições prontas que você repete com frequência: registre com um toque.</p>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-900 dark:text-brand-100" role="status">{notice}</p>}

      {editor && (
        <MealEditor
          key={editor.id ?? 'new'}
          kind="favorite"
          initial={editor}
          onCancel={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void load();
          }}
        />
      )}

      {favorites.length === 0 && !editor && <p className="muted">Você ainda não tem favoritos.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {favorites.map((f) => (
          <article key={f.id} className="card space-y-2">
            <h2>{f.name}</h2>
            <p className="muted">{MEAL_LABEL[f.type]} · {fmt(f.totals.calories)} kcal · P {fmt(f.totals.proteinG)} g · C {fmt(f.totals.carbsG)} g · G {fmt(f.totals.fatG)} g</p>
            <p className="muted">{f.items.map((i) => `${i.foodName} (${fmt(i.grams)} g)`).join(', ')}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => void logNow(f)}>Registrar agora</button>
              <button className="btn-ghost" onClick={() => setEditor(toEditor(f))}>Editar</button>
              <button className="btn-ghost text-red-600" onClick={() => void remove(f)}>Excluir</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
