import { z } from 'zod';
import { text } from '../../lib/sanitize.js';

// Política de senha (NIST 800-63B): o que mais importa é o COMPRIMENTO. Exigimos 10+ caracteres,
// letras e números, e bloqueamos senhas triviais. Em produção, considere também checar a senha
// contra a API "Have I Been Pwned" (k-anonymity) no cadastro.
const COMMON_PASSWORDS = new Set([
  'password123', 'password1234', '1234567890', '12345678910', 'qwertyuiop',
  'senha12345', 'senha123456', 'abcdefghij', '1q2w3e4r5t', 'qwerty12345',
]);

export const passwordSchema = z
  .string()
  .min(10, 'A senha deve ter pelo menos 10 caracteres')
  .max(128, 'A senha deve ter no máximo 128 caracteres')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use letras e números')
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), 'Senha muito comum');

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const registerSchema = z.object({
  name: text(1, 80),
  email: emailSchema,
  password: passwordSchema,
  // Consentimento explícito (LGPD): sem aceite, não há cadastro.
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'É necessário aceitar os termos' }) }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
