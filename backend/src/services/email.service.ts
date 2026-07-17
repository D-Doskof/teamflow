import nodemailer from 'nodemailer';
import { DEFAULT_LOCALE, SupportedLocale } from '../utils/locale.util';

// Callers only depend on this contract; a real SMTP sender vs. a console logger is
// decided once below based on whether SMTP env vars are present. The `= DEFAULT_LOCALE`
// default on each method is just a defensive fallback — callers always pass one explicitly.
export interface IEmailService {
  sendVerificationCode(
    to: string,
    name: string,
    code: string,
    locale?: SupportedLocale,
  ): Promise<void>;
  sendTwoFactorCode(
    to: string,
    name: string,
    code: string,
    locale?: SupportedLocale,
  ): Promise<void>;
  sendPasswordResetLink(
    to: string,
    name: string,
    link: string,
    locale?: SupportedLocale,
  ): Promise<void>;
  sendWorkspaceInvitation(
    to: string,
    inviterName: string,
    workspaceName: string,
    link: string,
    locale?: SupportedLocale,
  ): Promise<void>;
}

// ---- Copy: subject + body strings per locale, per email. Kept as plain data so adding a
// locale means editing one object, not hunting through per-language HTML builders.
interface VerificationCopy {
  subject: string;
  greeting: (name: string) => string;
  intro: string;
  expiry: string;
}
interface TwoFactorCopy {
  subject: string;
  greeting: (name: string) => string;
  intro: string;
  expiry: string;
}
interface PasswordResetCopy {
  subject: string;
  greeting: (name: string) => string;
  intro: string;
  button: string;
  expiry: string;
}
interface InvitationCopy {
  subject: (inviterName: string, workspaceName: string) => string;
  greeting: string;
  intro: (inviterName: string, workspaceName: string) => string;
  button: string;
  footer: string;
}

const VERIFICATION_COPY: Record<SupportedLocale, VerificationCopy> = {
  en: {
    subject: 'Verify your email — TeamFlow',
    greeting: (name) => `Hi, <strong>${name}</strong>!`,
    intro: 'Enter this code on the site to confirm your email:',
    expiry: "The code is valid for 15 minutes. If you didn't sign up, just ignore this email.",
  },
  ru: {
    subject: 'Подтверждение email — TeamFlow',
    greeting: (name) => `Привет, <strong>${name}</strong>!`,
    intro: 'Введи этот код на сайте, чтобы подтвердить свой email:',
    expiry: 'Код действителен 15 минут. Если ты не регистрировался — просто игнорируй это письмо.',
  },
  pl: {
    subject: 'Potwierdź swój adres e-mail — TeamFlow',
    greeting: (name) => `Cześć, <strong>${name}</strong>!`,
    intro: 'Wpisz ten kod na stronie, aby potwierdzić swój adres e-mail:',
    expiry:
      'Kod jest ważny przez 15 minut. Jeśli nie zakładałeś konta — po prostu zignoruj tę wiadomość.',
  },
};

const TWO_FACTOR_COPY: Record<SupportedLocale, TwoFactorCopy> = {
  en: {
    subject: 'Your sign-in code — TeamFlow',
    greeting: (name) => `Hi, <strong>${name}</strong>!`,
    intro:
      'Someone (hopefully you) is trying to sign in to your account. Enter this code to complete the sign-in:',
    expiry:
      "The code is valid for 10 minutes. If this wasn't you, change your password as soon as possible.",
  },
  ru: {
    subject: 'Код входа — TeamFlow',
    greeting: (name) => `Привет, <strong>${name}</strong>!`,
    intro:
      'Кто-то (надеемся, что ты) пытается войти в твой аккаунт. Введи этот код, чтобы завершить вход:',
    expiry: 'Код действителен 10 минут. Если это был не ты — смени пароль как можно скорее.',
  },
  pl: {
    subject: 'Kod logowania — TeamFlow',
    greeting: (name) => `Cześć, <strong>${name}</strong>!`,
    intro:
      'Ktoś (mamy nadzieję, że Ty) próbuje zalogować się na Twoje konto. Wpisz ten kod, aby dokończyć logowanie:',
    expiry: 'Kod jest ważny przez 10 minut. Jeśli to nie Ty — jak najszybciej zmień hasło.',
  },
};

const PASSWORD_RESET_COPY: Record<SupportedLocale, PasswordResetCopy> = {
  en: {
    subject: 'Reset your password — TeamFlow',
    greeting: (name) => `Hi, <strong>${name}</strong>!`,
    intro:
      'Someone requested a password reset for this account. Click the link below to set a new password:',
    button: 'Reset password',
    expiry: "The link is valid for 30 minutes. If you didn't request this, just ignore this email.",
  },
  ru: {
    subject: 'Сброс пароля — TeamFlow',
    greeting: (name) => `Привет, <strong>${name}</strong>!`,
    intro:
      'Кто-то запросил сброс пароля для этого аккаунта. Перейди по ссылке ниже, чтобы задать новый пароль:',
    button: 'Сбросить пароль',
    expiry:
      'Ссылка действительна 30 минут. Если ты не запрашивал сброс пароля — просто игнорируй это письмо.',
  },
  pl: {
    subject: 'Reset hasła — TeamFlow',
    greeting: (name) => `Cześć, <strong>${name}</strong>!`,
    intro:
      'Ktoś poprosił o reset hasła dla tego konta. Kliknij poniższy link, aby ustawić nowe hasło:',
    button: 'Zresetuj hasło',
    expiry:
      'Link jest ważny przez 30 minut. Jeśli to nie Ty poprosiłeś o reset — po prostu zignoruj tę wiadomość.',
  },
};

const INVITATION_COPY: Record<SupportedLocale, InvitationCopy> = {
  en: {
    subject: (inviterName, workspaceName) =>
      `${inviterName} invited you to ${workspaceName} — TeamFlow`,
    greeting: 'Hi!',
    intro: (inviterName, workspaceName) =>
      `<strong>${inviterName}</strong> invited you to join the <strong>${workspaceName}</strong> workspace on TeamFlow.`,
    button: 'Open TeamFlow',
    footer: "If you weren't expecting this invitation, you can safely ignore this email.",
  },
  ru: {
    subject: (inviterName, workspaceName) =>
      `${inviterName} приглашает вас в «${workspaceName}» — TeamFlow`,
    greeting: 'Привет!',
    intro: (inviterName, workspaceName) =>
      `<strong>${inviterName}</strong> приглашает вас присоединиться к воркспейсу «<strong>${workspaceName}</strong>» в TeamFlow.`,
    button: 'Открыть TeamFlow',
    footer: 'Если вы не ожидали это приглашение — просто проигнорируйте письмо.',
  },
  pl: {
    subject: (inviterName, workspaceName) =>
      `${inviterName} zaprasza Cię do ${workspaceName} — TeamFlow`,
    greeting: 'Cześć!',
    intro: (inviterName, workspaceName) =>
      `<strong>${inviterName}</strong> zaprasza Cię do przestrzeni roboczej „<strong>${workspaceName}</strong>” w TeamFlow.`,
    button: 'Otwórz TeamFlow',
    footer:
      'Jeśli nie spodziewałeś się tego zaproszenia, możesz bezpiecznie zignorować tę wiadomość.',
  },
};

function wrapper(inner: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">${inner}</div>`;
}

function verificationCodeHtml(name: string, code: string, locale: SupportedLocale): string {
  const t = VERIFICATION_COPY[locale];
  return wrapper(`
      <h2 style="color:#4f46e5;margin-bottom:8px">TeamFlow</h2>
      <p style="color:#374151">${t.greeting(name)}</p>
      <p style="color:#374151">${t.intro}</p>
      <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111827">${code}</span>
      </div>
      <p style="color:#6b7280;font-size:14px">${t.expiry}</p>
  `);
}

function twoFactorCodeHtml(name: string, code: string, locale: SupportedLocale): string {
  const t = TWO_FACTOR_COPY[locale];
  return wrapper(`
      <h2 style="color:#4f46e5;margin-bottom:8px">TeamFlow</h2>
      <p style="color:#374151">${t.greeting(name)}</p>
      <p style="color:#374151">${t.intro}</p>
      <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111827">${code}</span>
      </div>
      <p style="color:#6b7280;font-size:14px">${t.expiry}</p>
  `);
}

function passwordResetHtml(name: string, link: string, locale: SupportedLocale): string {
  const t = PASSWORD_RESET_COPY[locale];
  return wrapper(`
      <h2 style="color:#4f46e5;margin-bottom:8px">TeamFlow</h2>
      <p style="color:#374151">${t.greeting(name)}</p>
      <p style="color:#374151">${t.intro}</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">${t.button}</a>
      </div>
      <p style="color:#6b7280;font-size:14px">${t.expiry}</p>
  `);
}

function workspaceInvitationHtml(
  inviterName: string,
  workspaceName: string,
  link: string,
  locale: SupportedLocale,
): string {
  const t = INVITATION_COPY[locale];
  return wrapper(`
      <h2 style="color:#4f46e5;margin-bottom:8px">TeamFlow</h2>
      <p style="color:#374151">${t.greeting}</p>
      <p style="color:#374151">${t.intro(inviterName, workspaceName)}</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">${t.button}</a>
      </div>
      <p style="color:#6b7280;font-size:14px">${t.footer}</p>
  `);
}

export class SmtpEmailService implements IEmailService {
  constructor(
    private readonly transport: nodemailer.Transporter,
    private readonly from: string,
  ) {}

  async sendVerificationCode(
    to: string,
    name: string,
    code: string,
    locale: SupportedLocale = DEFAULT_LOCALE,
  ): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to,
      subject: VERIFICATION_COPY[locale].subject,
      html: verificationCodeHtml(name, code, locale),
    });
  }

  async sendTwoFactorCode(
    to: string,
    name: string,
    code: string,
    locale: SupportedLocale = DEFAULT_LOCALE,
  ): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to,
      subject: TWO_FACTOR_COPY[locale].subject,
      html: twoFactorCodeHtml(name, code, locale),
    });
  }

  async sendPasswordResetLink(
    to: string,
    name: string,
    link: string,
    locale: SupportedLocale = DEFAULT_LOCALE,
  ): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to,
      subject: PASSWORD_RESET_COPY[locale].subject,
      html: passwordResetHtml(name, link, locale),
    });
  }

  async sendWorkspaceInvitation(
    to: string,
    inviterName: string,
    workspaceName: string,
    link: string,
    locale: SupportedLocale = DEFAULT_LOCALE,
  ): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to,
      subject: INVITATION_COPY[locale].subject(inviterName, workspaceName),
      html: workspaceInvitationHtml(inviterName, workspaceName, link, locale),
    });
  }
}

// Used when SMTP isn't configured (local/dev) — same interface, no real send, just logs
// what would have gone out so the flow (verification/2FA/reset/invitation) is still exercisable.
export class ConsoleEmailService implements IEmailService {
  async sendVerificationCode(
    to: string,
    _name: string,
    code: string,
    locale: SupportedLocale = DEFAULT_LOCALE,
  ): Promise<void> {
    console.log(`[Email] SMTP not configured — verification code for ${to} [${locale}]: ${code}`);
  }

  async sendTwoFactorCode(
    to: string,
    _name: string,
    code: string,
    locale: SupportedLocale = DEFAULT_LOCALE,
  ): Promise<void> {
    console.log(`[Email] SMTP not configured — two-factor code for ${to} [${locale}]: ${code}`);
  }

  async sendPasswordResetLink(
    to: string,
    _name: string,
    link: string,
    locale: SupportedLocale = DEFAULT_LOCALE,
  ): Promise<void> {
    console.log(`[Email] SMTP not configured — password reset link for ${to} [${locale}]: ${link}`);
  }

  async sendWorkspaceInvitation(
    to: string,
    inviterName: string,
    workspaceName: string,
    link: string,
    locale: SupportedLocale = DEFAULT_LOCALE,
  ): Promise<void> {
    console.log(
      `[Email] SMTP not configured — workspace invitation for ${to} [${locale}]: ${inviterName} -> ${workspaceName} (${link})`,
    );
  }
}

function createEmailService(): IEmailService {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return new ConsoleEmailService();

  const transport = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: { user, pass },
  });
  const from = process.env.SMTP_FROM ?? 'TeamFlow <noreply@teamflow.app>';

  return new SmtpEmailService(transport, from);
}

export const emailService: IEmailService = createEmailService();
