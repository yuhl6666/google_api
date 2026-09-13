/** Raw email fields the SES classifier needs (spec section 6). */
export interface SesEmailInput {
  subject: string;
  body: string;
  sender: string;
  /** e.g. ["スキルシート.pdf", "案件概要.docx"] — filenames only, never attachment contents. */
  attachmentNames?: string[];
}

/** SES classification categories (spec section 6). */
export const SES_CATEGORIES = ['project', 'engineer', 'sales', 'other'] as const;
export type SesCategory = (typeof SES_CATEGORIES)[number];

/** Turns the structured email fields into the single text blob providers classify. */
export function formatSesEmailInput(email: SesEmailInput): string {
  const lines = [
    `件名: ${email.subject}`,
    `送信者: ${email.sender}`,
    email.attachmentNames && email.attachmentNames.length > 0
      ? `添付ファイル: ${email.attachmentNames.join(', ')}`
      : '添付ファイル: なし',
    '',
    '本文:',
    email.body,
  ];
  return lines.join('\n');
}
