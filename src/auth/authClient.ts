import { getPlatform } from '../platform'
import { getBaseUrl } from '../lib/api'
import type { AppUser } from './types'

const WEB_AUTH_KEY = 'gnh_web_auth_v2'

type StoredWebAuth = {
  token: string
  user: AppUser
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

function readWebAuthStorage(): StoredWebAuth | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(WEB_AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredWebAuth
    if (!parsed?.token || !parsed?.user || parsed.source !== 'web') return null
    return parsed
  } catch {
    return null
  }
}

function writeWebAuthStorage(data: StoredWebAuth): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(WEB_AUTH_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

function clearWebAuthStorage(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(WEB_AUTH_KEY)
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
    telegramLinked: true,
    source: 'telegram',
    premium: false,
    activeUntil: null,
  }
}

function buildWebUser(): AppUser | null {
  const platform = getPlatform()
  if (platform.mode !== 'web') return null
  const auth = readWebAuthStorage()
  if (!auth) return null
  return auth.user
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

function getStoredToken(): string | null {
  const auth = readWebAuthStorage()
  if (!auth) return null
  return auth.token
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function toErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message
  return fallback
}

function toAppUser(payload: unknown): AppUser {
  const obj = (payload && typeof payload === 'object' ? payload : {}) as Partial<AppUser>
  return {
    id: typeof obj.id === 'string' ? obj.id : null,
    telegramId: obj.telegramId ?? null,
    phone: obj.phone ?? null,
    username: obj.username ?? null,
    firstName: obj.firstName ?? null,
    telegramLinked: obj.telegramLinked ?? null,
    source: obj.source === 'telegram' || obj.source === 'web' ? obj.source : 'guest',
    premium: Boolean(obj.premium),
    activeUntil: obj.activeUntil ?? null,
  }
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const base = getBaseUrl()
  const url = path.startsWith('http') ? path : `${base}${path}`
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `API ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function requestCode(phone: string): Promise<{ ok: boolean; error?: string }> {
  const platform = getPlatform()
  if (platform.mode !== 'web') {
    return { ok: false, error: 'Вход по телефону доступен только в web-режиме' }
  }
  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) {
    return { ok: false, error: 'Введите номер телефона' }
  }
  try {
    await requestJson('/api/web-auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone }),
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: toErrorMessage(e, 'Не удалось запросить код') }
  }
}

export async function verifyCode(phone: string, code: string): Promise<{ ok: boolean; user: AppUser; error?: string }> {
  const platform = getPlatform()
  if (platform.mode !== 'web') {
    return { ok: false, user: getCurrentUser(), error: 'Вход по телефону доступен только в web-режиме' }
  }
  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) {
    return { ok: false, user: getCurrentUser(), error: 'Введите номер телефона' }
  }
  try {
    const data = await requestJson<{ token: string; user: unknown }>('/api/web-auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone, code }),
    })
    const user = toAppUser(data.user)
    const stored: StoredWebAuth = {
      token: data.token,
      user,
      source: 'web',
    }
    writeWebAuthStorage(stored)
    emitAuthChanged()
    return { ok: true, user }
  } catch (e) {
    return { ok: false, user: getCurrentUser(), error: toErrorMessage(e, 'Неверный код') }
  }
}

export async function getMe(): Promise<{ ok: boolean; user: AppUser; error?: string }> {
  const platform = getPlatform()
  if (platform.mode !== 'web') {
    return { ok: false, user: getCurrentUser(), error: 'Метод доступен только в web-режиме' }
  }
  try {
    const data = await requestJson<{ user: unknown }>('/api/web-auth/me', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
    })
    const user = toAppUser(data.user)
    const auth = readWebAuthStorage()
    if (auth?.token) {
      writeWebAuthStorage({ token: auth.token, user, source: 'web' })
    }
    emitAuthChanged()
    return { ok: true, user }
  } catch (e) {
    return { ok: false, user: getCurrentUser(), error: toErrorMessage(e, 'Не удалось получить профиль') }
  }
}

export async function createTelegramLinkCode(): Promise<{
  ok: boolean
  code?: string
  telegramStartUrl?: string
  error?: string
}> {
  try {
    const data = await requestJson<{ code: string; telegramStartUrl: string }>('/api/account/link-telegram-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
    })
    return { ok: true, code: data.code, telegramStartUrl: data.telegramStartUrl }
  } catch (e) {
    return { ok: false, error: toErrorMessage(e, 'Не удалось создать код привязки') }
  }
}

export async function loginWithPhoneDev(phone: string, code: string): Promise<{ ok: boolean; user: AppUser; error?: string }> {
  return verifyCode(phone, code)
}

export async function logout(): Promise<void> {
  const token = getStoredToken()
  if (token) {
    try {
      await requestJson('/api/web-auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
    } catch {
      // ignore logout backend failures
    }
  }
  clearWebAuthStorage()
  emitAuthChanged()
}
