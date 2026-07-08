import { getCachedInitData, parseAndCacheFromHash } from './telegramInitCache'
import { getPlatform, type TelegramWebAppLike } from '../platform'

export type InitData = {
  userId?: number
  user?: { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string }
  chatInstance?: string
  chatType?: string
  source: 'telegram' | 'hash' | 'none'
  initDataRaw?: string
  themeParams?: Record<string, string>
}

export function getInitData(): InitData {
  try {
    const platform = getPlatform()
    if (platform.initDataUnsafe) {
      const u = platform.initDataUnsafe.user
      const c = platform.initDataUnsafe.chat
      const userId = u != null && typeof (u as { id?: number }).id === 'number' ? (u as { id: number }).id : undefined
      return {
        userId: userId ?? (c != null && typeof c.id === 'number' ? c.id : undefined),
        user: u ?? undefined,
        chatInstance: c?.id != null ? String(c.id) : undefined,
        chatType: c?.type,
        source: 'telegram',
        initDataRaw: platform.initData || undefined,
      }
    }
    const cached = getCachedInitData()
    if (cached) return cached
    const fromHash = parseAndCacheFromHash()
    if (fromHash) return fromHash
  } catch {
    // ignore
  }
  return { source: 'none' }
}

export function getTgUser() {
  const init = getInitData()
  return init.user ?? null
}

/** Safe chat/user id for API; never throws. Prefer user id, fallback to chat id. */
export function getChatId(): number | null {
  const init = getInitData()
  if (init.userId != null) return init.userId
  return null
}

export function readyAndExpand() {
  const platform = getPlatform()
  platform.ready()
  platform.expand()
}

export function haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  const platform = getPlatform()
  if (platform.supportsVersionGte(6.1)) {
    platform.hapticImpact(type)
  }
}

export function setHeaderColor(color: string) {
  getPlatform().setHeaderColor(color)
}

export function getTg(): TelegramWebAppLike | null {
  return getPlatform().webApp
}
