/**
 * @file The invite email and the test email (docs/16 D68, D69), in the project's language, as plain text.
 * @description When Hub is published on a tailnet (D43) the friend cannot open the link until the owner shares the machine with them in
 * Tailscale, so the invite says how, in three steps. Plain text keeps the link whole in every mail client.
 */
export interface Tailnet {
  /** The machine's name on the tailnet: the first label of `<machine>.<tailnet>.ts.net`. */
  readonly machine: string;
  readonly host: string;
}

/** Hub is on a tailnet when its public address is a `*.ts.net` name (`pnpm hub:tailscale serve`, D43). */
export function tailnetOf(publicUrl: string): Tailnet | null {
  try {
    const { hostname } = new URL(publicUrl);
    if (!hostname.endsWith('.ts.net')) return null;
    const machine = hostname.split('.')[0];
    return machine ? { machine, host: hostname } : null;
  } catch {
    return null;
  }
}

export interface InviteMailInput {
  readonly locale: string;
  readonly project: string;
  readonly inviter: string;
  readonly url: string;
  readonly expiresAt: Date;
  readonly tailnet: Tailnet | null;
}

const DOWNLOAD = 'https://tailscale.com/download';

function day(date: Date, locale: 'ar' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function inviteMail(input: InviteMailInput): { subject: string; text: string } {
  const arabic = input.locale === 'ar';
  const until = day(input.expiresAt, arabic ? 'ar' : 'en');
  const inviter = input.inviter || (arabic ? 'صاحب المشروع' : 'the project owner');
  if (arabic) {
    const lines = [
      `دعاك ${inviter} إلى مشروع ${input.project} في Hub.`,
      '',
      'افتح هذا الرابط وأنشئ حسابك:',
      input.url,
      '',
      `يعمل الرابط مرة واحدة، حتى ${until}.`,
    ];
    if (input.tailnet) {
      lines.push(
        '',
        'كيف تصل إلى Hub:',
        `يعمل Hub على جهاز ${inviter} داخل شبكة Tailscale خاصة، ولا يُفتح من الإنترنت العام. قبل أن تفتح الرابط:`,
        `1. ثبّت Tailscale من ${DOWNLOAD} وسجّل الدخول بحسابك أنت.`,
        `2. اقبل مشاركة الجهاز «${input.tailnet.machine}» التي يرسلها لك ${inviter} من Tailscale.`,
        '3. افتح رابط الدعوة أعلاه.',
      );
    }
    return { subject: `دعوة للانضمام إلى ${input.project} في Hub`, text: `${lines.join('\n')}\n` };
  }
  const lines = [
    `${inviter} invited you to ${input.project} on Hub.`,
    '',
    'Open this link and create your account:',
    input.url,
    '',
    `The link works once, until ${until}.`,
  ];
  if (input.tailnet) {
    lines.push(
      '',
      'How to reach Hub:',
      `Hub runs on ${inviter}'s machine inside a private Tailscale network, not on the public internet. Before you open the link:`,
      `1. Install Tailscale from ${DOWNLOAD} and sign in with your own account.`,
      `2. Accept the share of the machine "${input.tailnet.machine}" that ${inviter} sends you from Tailscale.`,
      '3. Open the invite link above.',
    );
  }
  return { subject: `Join ${input.project} on Hub`, text: `${lines.join('\n')}\n` };
}

export function testMail(locale: string, host: string): { subject: string; text: string } {
  return locale === 'ar'
    ? {
        subject: 'رسالة تجربة من Hub',
        text: `وصلت هذه الرسالة، إذن يستطيع Hub إرسال البريد عبر ${host}.\nلا حاجة للرد عليها.\n`,
      }
    : {
        subject: 'A test email from Hub',
        text: `This message arrived, so Hub can send email through ${host}.\nThere is no need to reply.\n`,
      };
}
