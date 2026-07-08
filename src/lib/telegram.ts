/**
 * Safe access to Telegram WebApp SDK.
 * Requires script: https://telegram.org/js/telegram-web-app.js
 */

import { getCachedInitData } from '../utils/telegramInitCache'
import { getPlatform, type TelegramWebAppLike } from '../platform'

export function getTelegramWebApp(): {
  initData?: string
  ready?: () => void
  expand?: () => void
  openInvoice?: (url: string, cb?: (status: string) => void) => void
  openTelegramLink?: (url: string) => void
  openLink?: (url: string) => void
} | null {
  return getPlatform().webApp as TelegramWebAppLike | null
}

/** Raw initData для API. При обновлении страницы WebApp.initData может быть пуст — берём из кэша. */
export function getInitData(): string {
  const fromTg = getPlatform().initData ?? ''
  if (fromTg) return fromTg
  const cached = getCachedInitData()
  return cached?.initDataRaw ?? ''
}

let readyCalled = false

export function initTelegram(): void {
  if (readyCalled) return
  readyCalled = true
  const platform = getPlatform()
  platform.ready()
  platform.expand()
}
