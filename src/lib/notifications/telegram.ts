/**
 * Telegram Bot API directa (sin OpenClaw).
 * Variables: VENDOR_TELEGRAM_BOT_TOKEN, VENDOR_TELEGRAM_CHAT_ID
 */
import { logger } from '@/lib/logger';

const BOT_TOKEN = process.env.VENDOR_TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.VENDOR_TELEGRAM_CHAT_ID || '';

function baseUrl() {
  return `https://api.telegram.org/bot${BOT_TOKEN}`;
}

export function isTelegramConfigured(): boolean {
  return Boolean(BOT_TOKEN && CHAT_ID);
}

export async function telegramSendMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
  if (!isTelegramConfigured()) {
    logger.warn('telegram.skipped', { reason: 'missing_token_or_chat_id' });
    return false;
  }

  try {
    const res = await fetch(`${baseUrl()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error('telegram.sendMessage_failed', { status: res.status, body: body.slice(0, 300) });
      return false;
    }

    logger.info('telegram.message_sent', { chatId: CHAT_ID });
    return true;
  } catch (e) {
    logger.error('telegram.sendMessage_error', { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

export async function telegramSendDocument(documentUrl: string, caption?: string): Promise<boolean> {
  if (!isTelegramConfigured()) {
    logger.warn('telegram.skipped', { reason: 'missing_token_or_chat_id' });
    return false;
  }

  try {
    const res = await fetch(`${baseUrl()}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        document: documentUrl,
        caption: caption || undefined,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error('telegram.sendDocument_failed', { status: res.status, body: body.slice(0, 300) });
      return false;
    }

    logger.info('telegram.document_sent', { chatId: CHAT_ID });
    return true;
  } catch (e) {
    logger.error('telegram.sendDocument_error', { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}
