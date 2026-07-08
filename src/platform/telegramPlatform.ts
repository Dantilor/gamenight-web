import type {
  PlatformRuntime,
  TelegramInitDataUnsafe,
  TelegramUser,
  TelegramWebAppLike,
} from './types'

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebAppLike
    }
  }
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

function getWebApp(): TelegramWebAppLike | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

function getInitDataUnsafe(webApp: TelegramWebAppLike | null): TelegramInitDataUnsafe | null {
  return webApp?.initDataUnsafe ?? null
}

function getUser(data: TelegramInitDataUnsafe | null): TelegramUser | null {
  return data?.user ?? null
}

export function createTelegramPlatform(): PlatformRuntime {
  const webApp = getWebApp()
  const initDataUnsafe = getInitDataUnsafe(webApp)

  return {
    mode: 'telegram',
    webApp,
    initData: webApp?.initData ?? null,
    initDataUnsafe,
    user: getUser(initDataUnsafe),
    ready: () => {
      safe(() => webApp?.ready?.(), undefined)
    },
    expand: () => {
      safe(() => webApp?.expand?.(), undefined)
    },
    close: () => {
      safe(() => webApp?.close?.(), undefined)
    },
    setHeaderColor: (color: string) => {
      safe(() => webApp?.setHeaderColor?.(color), undefined)
    },
    setBackgroundColor: (color: string) => {
      safe(() => webApp?.setBackgroundColor?.(color), undefined)
    },
    setBottomBarColor: (color: string) => {
      safe(() => webApp?.setBottomBarColor?.(color), undefined)
    },
    disableVerticalSwipes: () => {
      safe(() => webApp?.disableVerticalSwipes?.(), undefined)
    },
    requestFullscreen: () => {
      safe(() => webApp?.requestFullscreen?.(), undefined)
    },
    openLink: (url: string) => {
      safe(() => webApp?.openLink?.(url), undefined)
    },
    openTelegramLink: (url: string) => {
      safe(() => webApp?.openTelegramLink?.(url), undefined)
    },
    openInvoice: (url: string, cb?: (status: string) => void) => {
      safe(() => webApp?.openInvoice?.(url, cb), undefined)
    },
    hapticImpact: (style = 'light') => {
      safe(() => webApp?.HapticFeedback?.impactOccurred?.(style), undefined)
    },
    hapticSelection: () => {
      safe(() => webApp?.HapticFeedback?.selectionChanged?.(), undefined)
    },
    hapticNotification: (type: string) => {
      const hasNotification = typeof webApp?.HapticFeedback?.notificationOccurred === 'function'
      if (hasNotification) {
        safe(() => webApp?.HapticFeedback?.notificationOccurred?.(type), undefined)
        return
      }
      safe(() => webApp?.HapticFeedback?.impactOccurred?.('medium'), undefined)
    },
    backButtonShow: () => {
      safe(() => webApp?.BackButton?.show(), undefined)
    },
    backButtonHide: () => {
      safe(() => webApp?.BackButton?.hide(), undefined)
    },
    backButtonOnClick: (cb: () => void) => {
      safe(() => webApp?.BackButton?.onClick(cb), undefined)
    },
    mainButtonShow: () => {
      safe(() => webApp?.MainButton?.show(), undefined)
    },
    mainButtonHide: () => {
      safe(() => webApp?.MainButton?.hide(), undefined)
    },
    mainButtonSetText: (text: string) => {
      safe(() => webApp?.MainButton?.setText?.(text), undefined)
    },
    mainButtonOnClick: (cb: () => void) => {
      safe(() => webApp?.MainButton?.onClick?.(cb), undefined)
    },
    onViewportChanged: (cb: () => void) => {
      safe(() => webApp?.onEvent?.('viewportChanged', cb), undefined)
    },
    viewportHeight: () => {
      const value = (webApp as { viewportHeight?: number } | null)?.viewportHeight
      return typeof value === 'number' ? value : null
    },
    viewportStableHeight: () => {
      const value = (webApp as { viewportStableHeight?: number } | null)?.viewportStableHeight
      return typeof value === 'number' ? value : null
    },
    supportsVersionGte: (min: number) => {
      const version = parseFloat(webApp?.version ?? '0')
      return Number.isFinite(version) && version >= min
    },
  }
}
