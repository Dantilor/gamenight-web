import { getPlatform } from '../platform'
import type { AppUser } from './types'

const WEB_AUTH_KEY = 'gnh_web_auth_v1'

type StoredWebAuth = {
  id: string
  phone: string
  source: 'web'
}

function guestUser(): AppUser {
  return {
    id: null,
    source: 'guest',
    premium: false,
    activeUntil: null,
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '').trim()
}

function readWebAuth(): StoredWebAuth | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(WEB_AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredWebAuth
    if (!parsed?.id || !parsed?.phone || parsed.source !== 'web') return null
    return parsed
  } catch {
    return null
  }
}

function writeWebAuth(data: StoredWebAuth): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(WEB_AUTH_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

function emitAuthChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('gnh_auth_changed'))
}

function buildTelegramUser(): AppUser | null {
  const platform = getPlatform()
  if (platform.mode !== 'telegram' || !platform.user) return null
  return {
    id: platform.user.id != null ? String(platform.user.id) : null,
    telegramId: platform.user.id != null ? String(platform.user.id) : null,
    username: platform.user.username ?? null,
    firstName: platform.user.first_name ?? null,
    source: 'telegram',
    premium: false,
    activeUntil: null,
  }
}

function buildWebUser(): AppUser | null {
  const platform = getPlatform()
  if (platform.mode !== 'web') return null
  const auth = readWebAuth()
  if (!auth) return null
  return {
    id: auth.id,
    phone: auth.phone,
    source: 'web',
    premium: false,
    activeUntil: null,
  }
}

export function getCurrentUser(): AppUser {
  const telegramUser = buildTelegramUser()
  if (telegramUser) return telegramUser
  const webUser = buildWebUser()
  if (webUser) return webUser
  return guestUser()
}

export function isAuthenticated(): boolean {
  const user = getCurrentUser()
  return user.source === 'telegram' || user.source === 'web'
}

export function loginWithPhoneDev(phone: string, code: string): { ok: boolean; user: AppUser; error?: string } {
  const platform = getPlatform()
  if (platform.mode !== 'web') {
    return { ok: false, user: getCurrentUser(), error: 'Вход по телефону доступен только в web-режиме' }
  }
  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) {
    return { ok: false, user: getCurrentUser(), error: 'Введите номер телефона' }
  }
  if (code !== '0000') {
    return { ok: false, user: getCurrentUser(), error: 'Неверный код (в dev используйте 0000)' }
  }
  const stored: StoredWebAuth = {
    id: `web_${Date.now()}`,
    phone: normalizedPhone,
    source: 'web',
  }
  writeWebAuth(stored)
  emitAuthChanged()
  return { ok: true, user: getCurrentUser() }
}

export function logout(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(WEB_AUTH_KEY)
  } catch {
    // ignore
  }
  emitAuthChanged()
}
