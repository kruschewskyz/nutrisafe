import 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** ID da requisição (correlação de logs, sem dados pessoais). */
      id?: string;
      /** Preenchido por requireAuth. */
      user?: { id: string; role: 'USER' | 'ADMIN' };
    }
  }
}

export {};
