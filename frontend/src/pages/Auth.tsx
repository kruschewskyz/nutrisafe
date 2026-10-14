import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <p className="mb-6 text-center text-3xl font-bold text-brand-600">🥗 NutriSafe</p>
      <div className="card space-y-4">
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Shell title="Entrar">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Senha</label>
          <input id="password" className="input" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <div className="flex justify-between text-sm">
        <Link className="text-brand-600 underline" to="/forgot-password">Esqueci minha senha</Link>
        <Link className="text-brand-600 underline" to="/register">Criar conta</Link>
      </div>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!accepted) return setError('É necessário aceitar os termos para criar a conta.');
    setBusy(true);
    setError('');
    try {
      await register({ ...form, acceptTerms: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Shell title="Criar conta">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Nome</label>
          <input id="name" className="input" autoComplete="name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="password">Senha</label>
          <input id="password" className="input" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <p className="muted mt-1">Mínimo de 10 caracteres, com letras e números. Frases longas são ótimas senhas.</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>
            Concordo com o tratamento dos meus dados pessoais e de saúde para o funcionamento do app. Posso exportar ou
            excluir meus dados a qualquer momento em Perfil. Declaro ter 18 anos ou mais.
          </span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Criando…' : 'Criar conta'}</button>
      </form>
      <p className="text-sm">Já tem conta? <Link className="text-brand-600 underline" to="/login">Entrar</Link></p>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email }, auth: false });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Recuperar senha">
      {sent ? (
        <p>Se o e-mail estiver cadastrado, enviamos as instruções para redefinir a senha. O link vale por 1 hora.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" className="input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Enviando…' : 'Enviar link'}</button>
        </form>
      )}
      <Link className="text-sm text-brand-600 underline" to="/login">Voltar ao login</Link>
    </Shell>
  );
}

export function ResetPassword() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  // Captura o token e o remove da barra de endereço (não fica no histórico nem em capturas de tela).
  const [token] = useState(() => params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.has('token')) setParams({}, { replace: true });
  }, [params, setParams]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: { token, password }, auth: false });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Shell title="Nova senha">
      {!token ? (
        <p className="error">Link inválido. Solicite um novo em “Esqueci minha senha”.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="password">Nova senha</label>
            <input id="password" className="input" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="muted mt-1">Mínimo de 10 caracteres, com letras e números.</p>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Salvando…' : 'Redefinir senha'}</button>
        </form>
      )}
      <Link className="text-sm text-brand-600 underline" to="/login">Voltar ao login</Link>
    </Shell>
  );
}
