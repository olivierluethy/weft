import nodemailer, { type Transporter } from 'nodemailer';
import { appendFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '../env.js';

let transporter: Transporter | null = null;
const outboxDir = resolve(process.cwd(), 'data/outbox');
const outboxFile = resolve(outboxDir, 'outbox.log');

function getTransport(): Transporter | null {
  if (!env.smtpHost) return null; // dev fallback mode
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });
  }
  return transporter;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Send an email. With no SMTP configured, prints to the console and appends to
 * apps/server/data/outbox/outbox.log so reset/invite links are always visible. */
export async function sendMail(mail: Mail): Promise<void> {
  const tx = getTransport();
  if (tx) {
    await tx.sendMail({ from: env.mailFrom, ...mail });
    return;
  }

  const record =
    `\n──────────────── ${new Date().toISOString()} ────────────────\n` +
    `To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`;

  // Loud console banner so the link is obvious during local dev.
  // eslint-disable-next-line no-console
  console.log(
    `\n\x1b[35m📬 [Weft dev mail]\x1b[0m ${mail.subject} → ${mail.to}\n${mail.text}\n`,
  );

  try {
    await mkdir(outboxDir, { recursive: true });
    await appendFile(outboxFile, record, 'utf8');
  } catch {
    /* best-effort */
  }
}
