export type TelegramUser = {
  id?: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

export type TelegramChat = {
  id?: number
  type?: string
  title?: string
}

export type TelegramInitDataUnsafe = {
  user?: TelegramUser
  chat?: TelegramChat
}

export type TelegramThemeParams = Record<string, string>

export type TelegramWebAppLike = {
  initData?: string
  initDataUnsafe?: TelegramInitDataUnsafe
  version?: string
  ready?: () => void
  expand?: () => void
  close?: () => void
  requestFullscreen?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  disableVerticalSwipes?: () => void
  openInvoice?: (url: string, cb?: (status: string) => void) => void
  openTelegramLink?: (url: string) => void
  openLink?: (url: string) => void
  onEvent?: (event: string, cb: () => void) => void
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
  }
  MainButton?: {
    show: () => void
    hide: () => void
    setText?: (text: string) => void
    onClick?: (cb: () => void) => void
  }
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void
    selectionChanged?: () => void
    notificationOccurred?: (type: string) => void
  }
}

export type PlatformRuntime = {
  mode: 'telegram' | 'web'
  webApp: TelegramWebAppLike | null
  initData: string | null
  initDataUnsafe: TelegramInitDataUnsafe | null
  user: TelegramUser | null
  ready: () => void
  expand: () => void
  close: () => void
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  setBottomBarColor: (color: string) => void
  disableVerticalSwipes: () => void
  requestFullscreen: () => void
  openLink: (url: string) => void
  openTelegramLink: (url: string) => void
  openInvoice: (url: string, cb?: (status: string) => void) => void
  hapticImpact: (style?: 'light' | 'medium' | 'heavy') => void
  hapticSelection: () => void
  hapticNotification: (type: string) => void
  backButtonShow: () => void
  backButtonHide: () => void
  backButtonOnClick: (cb: () => void) => void
  mainButtonShow: () => void
  mainButtonHide: () => void
  mainButtonSetText: (text: string) => void
  mainButtonOnClick: (cb: () => void) => void
  onViewportChanged: (cb: () => void) => void
  viewportHeight: () => number | null
  viewportStableHeight: () => number | null
  supportsVersionGte: (min: number) => boolean
}
