import { z } from 'zod';

/**
 * Sanitização de texto livre (nomes, notas, marcas).
 * - normaliza Unicode (NFC) para evitar duplicatas "visualmente iguais"
 * - remove caracteres de controle (incluindo NUL, que o PostgreSQL rejeita)
 * - remove "<" e ">" (defesa extra contra HTML/script em campos de texto simples)
 * - faz trim
 * A defesa principal contra XSS continua sendo o React escapar toda saída
 * (o frontend nunca usa dangerouslySetInnerHTML) + CSP.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const clean = (s: string): string => s.normalize('NFC').replace(CONTROL_CHARS, '').replace(/[<>]/g, '').trim();

/** Texto obrigatório, já limpo, com limites de tamanho. */
export const text = (min: number, max: number) => z.string().transform(clean).pipe(z.string().min(min).max(max));

/** Texto opcional (string vazia vira undefined). */
export const optionalText = (max: number) =>
  z
    .string()
    .transform(clean)
    .pipe(z.string().max(max))
    .transform((s) => (s === '' ? undefined : s))
    .optional();
