import { useCallback, useEffect, useState } from 'react'
import { getPlatform } from '../platform'
import type { AppUser } from './types'
import {
  createTelegramLinkCode as createTelegramLinkCodeClient,
  getCurrentUser as getCurrentUserClient,
  getMe as getMeClient,
  isAuthenticated as isAuthenticatedClient,
  requestCode as requestCodeClient,
  verifyCode as verifyCodeClient,
  logout as logoutClient,
} from './authClient'

type LoginResult = { ok: boolean; user: AppUser; error?: string }

export function useAuth(): {
  user: AppUser
  mode: 'telegram' | 'web'
  getCurrentUser: () => AppUser
  isAuthenticated: () => boolean
  requestCode: (phone: string) => Promise<{ ok: boolean; error?: string }>
  verifyCode: (phone: string, code: string) => Promise<LoginResult>
  loginWithPhoneDev: (phone: string, code: string) => Promise<LoginResult>
  getMe: () => Promise<{ ok: boolean; user: AppUser; error?: string }>
  createTelegramLinkCode: () => Promise<{ ok: boolean; code?: string; telegramStartUrl?: string; error?: string }>
  logout: () => Promise<void>
} {
  const [user, setUser] = useState<AppUser>(() => getCurrentUserClient())

  useEffect(() => {
    if (getPlatform().mode !== 'web') return
    getMeClient()
      .then((result) => {
        if (result.ok) setUser(result.user)
      })
      .catch(() => {
        // ignore
      })
  }, [])

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
    const result = await verifyCodeClient(phone, code)
    setUser(result.user)
    return result
  }, [])
  const loginWithPhoneDev = useCallback((phone: string, code: string) => verifyCode(phone, code), [verifyCode])
  const getMe = useCallback(async () => {
    const result = await getMeClient()
    if (result.ok) setUser(result.user)
    return result
  }, [])
  const createTelegramLinkCode = useCallback(() => createTelegramLinkCodeClient(), [])
  const logout = useCallback(async () => {
    await logoutClient()
    setUser(getCurrentUserClient())
  }, [])

  return {
    user,
    mode: getPlatform().mode,
    getCurrentUser,
    isAuthenticated,
    requestCode,
    verifyCode,
    loginWithPhoneDev,
    getMe,
    createTelegramLinkCode,
    logout,
  }
}
