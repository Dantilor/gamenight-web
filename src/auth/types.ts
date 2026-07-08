export type AppUser = {
  id: string | null
  telegramId?: string | null
  phone?: string | null
  username?: string | null
  firstName?: string | null
  source: 'telegram' | 'web' | 'guest'
  premium: boolean
  activeUntil?: string | null
}
