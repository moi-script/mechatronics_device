import nodemailer from 'nodemailer';
import { env } from './env';

const transport = env.smtp
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    })
  : null;

/** Whether a reset code can actually reach someone. Locally the console stands in. */
export const canSendMail = (): boolean => transport !== null || !env.isProd;

export async function sendResetCode(to: string, code: string): Promise<void> {
  if (!transport) {
    console.log(`[mail] reset code for ${to}: ${code}`);
    return;
  }
  await transport.sendMail({
    from: env.smtp!.from,
    to,
    subject: 'Your Mechatronic Trainer reset code',
    text:
      `Your password reset code is ${code}\n\n` +
      'It works for 15 minutes. If you did not ask for it, ignore this email and your password stays as it is.',
  });
}
