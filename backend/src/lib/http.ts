import { z } from 'zod';

/** Erro "esperado" (4xx). A mensagem é segura para enviar ao cliente. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Valida QUALQUER entrada externa (body, query, params) com Zod.
 * - rejeita tipos inesperados (ex.: objetos no lugar de strings => evita injection de operadores)
 * - remove campos desconhecidos (schemas são "strip" por padrão)
 * - o erro devolve só caminho + mensagem, nunca o valor enviado
 */
export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      400,
      'Dados inválidos',
      'VALIDATION_ERROR',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

export const idSchema = z.string().uuid();

/** Intervalo de datas (ISO 8601) usado em dashboard/refeições/progresso. Máx. 366 dias. */
export const rangeSchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  })
  .transform((r) => ({ from: new Date(r.from), to: new Date(r.to) }))
  .refine((r) => r.to > r.from, { message: 'to deve ser maior que from' })
  .refine((r) => r.to.getTime() - r.from.getTime() <= 366 * 24 * 3600 * 1000, {
    message: 'intervalo máximo de 366 dias',
  });
