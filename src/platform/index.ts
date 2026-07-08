import { createTelegramPlatform } from './telegramPlatform'
import type { PlatformRuntime } from './types'
import { createWebPlatform } from './webPlatform'

function hasTelegramSession(platform: PlatformRuntime): boolean {
  if (!platform.webApp) return false
  if (platform.initData && platform.initData.trim().length > 0) return true
  return Boolean(platform.user?.id)
}

export function getPlatform(): PlatformRuntime {
  const tg = createTelegramPlatform()
  if (hasTelegramSession(tg)) return tg
  return createWebPlatform()
}

export type { PlatformRuntime, TelegramInitDataUnsafe, TelegramUser, TelegramWebAppLike } from './types'
