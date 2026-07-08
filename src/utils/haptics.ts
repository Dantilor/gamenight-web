/**
 * Safe haptic helpers through platform abstraction.
 * No-op outside Telegram or on old Telegram WebApp versions.
 */
import { getPlatform } from '../platform'

function hapticSupported(): boolean {
  return getPlatform().supportsVersionGte(6.1)
}

/** selectionChanged — use when user selects an item (e.g. mode, game tile). */
export function hapticSelection(): void {
  try {
    if (!hapticSupported()) return
    getPlatform().hapticSelection()
  } catch {
    // no-op
  }
}

/** impactOccurred — use on primary actions (e.g. "Начать раунд"). */
export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    if (!hapticSupported()) return
    getPlatform().hapticImpact(style)
  } catch {
    // no-op
  }
}

/** notificationOccurred('success') — use when user scores (e.g. "Угадали"). */
export function hapticSuccess(): void {
  try {
    if (!hapticSupported()) return
    getPlatform().hapticNotification('success')
  } catch {
    hapticImpact('medium')
  }
}
