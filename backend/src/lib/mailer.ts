import { env, isProd } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Envio de e-mail (stub). Em produção, troque por um provedor (Resend, SES, SendGrid...).
 * Em desenvolvimento o link de redefinição é impresso no console para facilitar os testes;
 * em produção NADA é impresso (o link é um segredo de curta duração).
 */
export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const link = `${env.APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.log(`[DEV] Link de redefinição de senha para ${to}: ${link}`);
    return;
  }
  // TODO: integrar provedor de e-mail transacional aqui.
  logger.warn('Provedor de e-mail não configurado: e-mail de redefinição NÃO enviado.');
}
