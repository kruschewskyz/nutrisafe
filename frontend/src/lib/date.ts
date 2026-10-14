/** Utilitários de datas no FUSO LOCAL do usuário (o servidor só recebe instantes ISO/UTC). */

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

export interface Range {
  from: string;
  to: string;
}

/** Limites [00:00, 24:00) do dia local, em ISO. */
export function dayRange(day: Date): Range {
  const from = startOfDay(day);
  return { from: from.toISOString(), to: addDays(from, 1).toISOString() };
}

/** Os últimos N dias, incluindo hoje. */
export function lastDaysRange(n: number): Range {
  const end = addDays(startOfDay(new Date()), 1);
  return { from: addDays(end, -n).toISOString(), to: end.toISOString() };
}

export const rangeQuery = (r: Range) => `from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`;

/** Igual ao que o backend espera em tzOffsetMinutes (BRT = 180). */
export const tzOffset = () => new Date().getTimezoneOffset();

export const formatDay = (d: Date) =>
  d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Valor para <input type="datetime-local"> (horário local). */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
