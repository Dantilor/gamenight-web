import { useCallback, useEffect, useState } from 'react'
import { getPlatform } from '../platform'
import type { AppUser } from './types'
import {
  createTelegramLinkCode as createTelegramLinkCodeClient,
  getCurrentUser as getCurrentUserClient,
  getMe as getMeClient,
  grantPremiumDev as grantPremiumDevClient,
  isAuthenticated as isAuthenticatedClient,
  requestCode as requestCodeClient,
  verifyCode as verifyCodeClient,
  logout as logoutClient,
} from './authClient'

type LoginResult = { ok: boolean; user: AppUser; error?: string }

export function useAuth(): {
  user: AppUser
  mode: 'telegram' | 'web'
  isLoading: boolean
  getCurrentUser: () => AppUser
  isAuthenticated: () => boolean
  refreshAuth: () => Promise<{ ok: boolean; user: AppUser; error?: string }>
  requestCode: (phone: string) => Promise<{ ok: boolean; error?: string }>
  verifyCode: (phone: string, code: string) => Promise<LoginResult>
  loginWithPhoneDev: (phone: string, code: string) => Promise<LoginResult>
  getMe: () => Promise<{ ok: boolean; user: AppUser; error?: string }>
  createTelegramLinkCode: () => Promise<{ ok: boolean; code?: string; telegramStartUrl?: string; error?: string }>
  grantPremiumDev: (accountId: string, days?: number) => Promise<{ ok: boolean; premium?: boolean; activeUntil?: string | null; source?: string | null; error?: string }>
  logout: () => Promise<void>
} {
  const mode = getPlatform().mode
  const [user, setUser] = useState<AppUser>(() => getCurrentUserClient())
  const [isLoading, setIsLoading] = useState<boolean>(mode === 'web')

  useEffect(() => {
    if (mode !== 'web') return
    getMeClient()
      .then((result) => {
        if (result.ok) setUser(result.user)
      })
      .catch(() => {
        // ignore
      })
      .finally(() => setIsLoading(false))
  }, [mode])

  useEffect(() => {
    const sync = () => setUser(getCurrentUserClient())
    window.addEventListener('gnh_auth_changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('gnh_auth_changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const getCurrentUser = useCallback(() => getCurrentUserClient(), [])
  const isAuthenticated = useCallback(() => isAuthenticatedClient(), [])
  const requestCode = useCallback((phone: string) => requestCodeClient(phone), [])
  const verifyCode = useCallback(async (phone: string, code: string): Promise<LoginResult> => {
    setIsLoading(true)
    const result = await verifyCodeClient(phone, code)
    setUser(result.user)
    setIsLoading(false)
    return result
  }, [])
  const loginWithPhoneDev = useCallback((phone: string, code: string) => verifyCode(phone, code), [verifyCode])
  const getMe = useCallback(async (): Promise<{ ok: boolean; user: AppUser; error?: string }> => {
    if (mode !== 'web') return { ok: true, user: getCurrentUserClient() }
    setIsLoading(true)
    const result = await getMeClient()
    if (result.ok) setUser(result.user)
    setIsLoading(false)
    return result
  }, [mode])
  const refreshAuth = useCallback(() => getMe(), [getMe])
  const createTelegramLinkCode = useCallback(() => createTelegramLinkCodeClient(), [])
  const grantPremiumDev = useCallback((accountId: string, days = 30) => grantPremiumDevClient(accountId, days), [])
  const logout = useCallback(async () => {
    setIsLoading(true)
    await logoutClient()
    setUser(getCurrentUserClient())
    setIsLoading(false)
  }, [])

  return {
    user,
    mode,
    isLoading,
    getCurrentUser,
    isAuthenticated,
    refreshAuth,
    requestCode,
    verifyCode,
    loginWithPhoneDev,
    getMe,
    createTelegramLinkCode,
    grantPremiumDev,
    logout,
  }
}
