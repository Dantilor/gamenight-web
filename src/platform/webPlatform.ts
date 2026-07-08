import type { PlatformRuntime } from './types'

function openExternal(url: string): void {
  if (typeof window === 'undefined') return
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function createWebPlatform(): PlatformRuntime {
  return {
    mode: 'web',
    webApp: null,
    initData: null,
    initDataUnsafe: null,
    user: null,
    ready: () => {},
    expand: () => {},
    close: () => {},
    setHeaderColor: () => {},
    setBackgroundColor: () => {},
    setBottomBarColor: () => {},
    disableVerticalSwipes: () => {},
    requestFullscreen: () => {},
    openLink: (url: string) => {
      openExternal(url)
    },
    openTelegramLink: (url: string) => {
      openExternal(url)
    },
    openInvoice: () => {},
    hapticImpact: () => {},
    hapticSelection: () => {},
    hapticNotification: () => {},
    backButtonShow: () => {},
    backButtonHide: () => {},
    backButtonOnClick: () => {},
    mainButtonShow: () => {},
    mainButtonHide: () => {},
    mainButtonSetText: () => {},
    mainButtonOnClick: () => {},
    onViewportChanged: () => {},
    viewportHeight: () => null,
    viewportStableHeight: () => null,
    supportsVersionGte: () => false,
  }
}
