import { useCallback, useEffect, useState } from 'react'
import { getPlatform } from '../platform'
import type { AppUser } from './types'
import {
  getCurrentUser as getCurrentUserClient,
  isAuthenticated as isAuthenticatedClient,
  loginWithPhoneDev as loginWithPhoneDevClient,
  logout as logoutClient,
} from './authClient'

type LoginResult = { ok: boolean; user: AppUser; error?: string }

export function useAuth(): {
  user: AppUser
  mode: 'telegram' | 'web'
  getCurrentUser: () => AppUser
  isAuthenticated: () => boolean
  loginWithPhoneDev: (phone: string, code: string) => LoginResult
  logout: () => void
} {
  const [user, setUser] = useState<AppUser>(() => getCurrentUserClient())

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
  const loginWithPhoneDev = useCallback((phone: string, code: string): LoginResult => {
    const result = loginWithPhoneDevClient(phone, code)
    setUser(result.user)
    return result
  }, [])
  const logout = useCallback(() => {
    logoutClient()
    setUser(getCurrentUserClient())
  }, [])

  return {
    user,
    mode: getPlatform().mode,
    getCurrentUser,
    isAuthenticated,
    loginWithPhoneDev,
    logout,
  }
}
