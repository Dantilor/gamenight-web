import { createTelegramPlatform } from './telegramPlatform'
import type { PlatformRuntime } from './types'
import { createWebPlatform } from './webPlatform'

export function getPlatform(): PlatformRuntime {
  const tg = createTelegramPlatform()
  if (tg.webApp) return tg
  return createWebPlatform()
}

export type { PlatformRuntime, TelegramInitDataUnsafe, TelegramUser, TelegramWebAppLike } from './types'
