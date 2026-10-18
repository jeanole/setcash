// ============================================================================
// Telegram Client Facade
// ============================================================================
// Thin wrapper around the node-telegram-bot-api v2 `Api` that exposes only what
// the message handlers need. It keeps the bot token in a closure so handlers
// never touch it directly (v2 does not expose the token on the Bot/Api).
// ============================================================================

import type { Api, GetFileResult } from 'node-telegram-bot-api';

const FILE_BASE_URL = 'https://api.telegram.org/file';

export interface TelegramClient {
  /** Send a plain text message to a chat. */
  sendMessage(chatId: number, text: string): Promise<unknown>;
  /** Resolve a file_id to its Telegram file info (including file_path). */
  getFile(fileId: string): Promise<GetFileResult>;
  /** Build the download URL for a file_path. Contains the token — never log it. */
  getFileUrl(filePath: string): string;
}

/**
 * Create a handler-facing client bound to a bot's Api instance and token.
 */
export function createTelegramClient(api: Api, token: string): TelegramClient {
  return {
    sendMessage: (chatId, text) => api.sendMessage({ chat_id: chatId, text }),
    getFile: (fileId) => api.getFile({ file_id: fileId }),
    getFileUrl: (filePath) => `${FILE_BASE_URL}/bot${token}/${filePath}`,
  };
}
