import { createHash, randomBytes } from 'node:crypto'
import { query } from '../db.js'

const SESSION_TTL_DAYS = 30
const LINK_CODE_TTL_MINUTES = 15
const LINK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type AppAccountUser = {
  id: string
  phone: string | null
  source: 'web'
  premium: false
  activeUntil: null
}

type AccountRow = {
  id: string
  phone_e164: string | null
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function normalizePhoneE164(phoneRaw: string): string | null {
  const trimmed = String(phoneRaw || '').trim()
  if (!trimmed) return null
  const plusPrefixed = trimmed.startsWith('+') ? trimmed : `+${trimmed}`
  const normalized = plusPrefixed.replace(/[^\d+]/g, '')
  if (!/^\+\d{10,15}$/.test(normalized)) return null
  return normalized
}

function buildAppAccountUser(account: AccountRow): AppAccountUser {
  return {
    id: account.id,
    phone: account.phone_e164,
    source: 'web',
    premium: false,
    activeUntil: null,
  }
}

async function getAccountByPhone(phone: string): Promise<AccountRow | null> {
  const res = await query<AccountRow>(
    `SELECT id, phone_e164
     FROM app_accounts
     WHERE phone_e164 = $1
     LIMIT 1`,
    [phone],
  )
  return res.rows[0] ?? null
}

async function createAccountWithPhone(phone: string): Promise<AccountRow> {
  const res = await query<AccountRow>(
    `INSERT INTO app_accounts (phone_e164)
     VALUES ($1)
     RETURNING id, phone_e164`,
    [phone],
  )
  return res.rows[0]
}

export async function findOrCreateAccountByPhone(phone: string): Promise<AccountRow> {
  const found = await getAccountByPhone(phone)
  if (found) return found
  return createAccountWithPhone(phone)
}

export async function upsertPhoneIdentity(accountId: string, phone: string): Promise<void> {
  await query(
    `INSERT INTO app_account_identities (account_id, provider, provider_user_id, metadata)
     VALUES ($1, 'phone', $2, '{}'::jsonb)
     ON CONFLICT (provider, provider_user_id)
     DO UPDATE SET account_id = EXCLUDED.account_id`,
    [accountId, phone],
  )
}

export async function createWebSessionToken(accountId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  await query(
    `INSERT INTO web_auth_sessions (account_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3::int || ' days')::interval)`,
    [accountId, tokenHash, SESSION_TTL_DAYS],
  )
  return token
}

export async function findAccountBySessionToken(token: string): Promise<AppAccountUser | null> {
  const tokenHash = hashToken(token)
  const res = await query<AccountRow>(
    `SELECT a.id, a.phone_e164
     FROM web_auth_sessions s
     JOIN app_accounts a ON a.id = s.account_id
     WHERE s.token_hash = $1
       AND s.expires_at > now()
     LIMIT 1`,
    [tokenHash],
  )
  const row = res.rows[0]
  return row ? buildAppAccountUser(row) : null
}

export async function deleteSessionToken(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  await query(`DELETE FROM web_auth_sessions WHERE token_hash = $1`, [tokenHash])
}

export async function ensurePhoneLogin(phoneRaw: string): Promise<{ token: string; user: AppAccountUser }> {
  const phone = normalizePhoneE164(phoneRaw)
  if (!phone) {
    throw Object.assign(new Error('invalid phone'), { status: 400 })
  }
  const account = await findOrCreateAccountByPhone(phone)
  await upsertPhoneIdentity(account.id, phone)
  const token = await createWebSessionToken(account.id)
  return { token, user: buildAppAccountUser(account) }
}

function randomLinkCode(length = 6): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * LINK_CODE_ALPHABET.length)
    out += LINK_CODE_ALPHABET[idx]
  }
  return out
}

export async function createTelegramLinkCode(accountId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomLinkCode(6)
    try {
      await query(
        `INSERT INTO telegram_link_codes (account_id, code, status, expires_at)
         VALUES ($1, $2, 'active', now() + ($3::int || ' minutes')::interval)`,
        [accountId, code, LINK_CODE_TTL_MINUTES],
      )
      return code
    } catch (e) {
      const err = e as { code?: string }
      if (err.code === '23505') continue
      throw e
    }
  }
  throw new Error('failed to generate unique link code')
}

type LinkCodeRow = {
  id: string
  account_id: string
  status: string
  expires_at: Date
}

async function getActiveLinkCode(code: string): Promise<LinkCodeRow | null> {
  const res = await query<LinkCodeRow>(
    `SELECT id, account_id, status, expires_at
     FROM telegram_link_codes
     WHERE code = $1
     LIMIT 1`,
    [code],
  )
  return res.rows[0] ?? null
}

export async function confirmTelegramLink(input: {
  code: string
  telegramId: string
  telegramUsername?: string | null
  firstName?: string | null
}): Promise<{ ok: true; accountId: string }> {
  const code = String(input.code || '').trim().toUpperCase()
  const telegramId = String(input.telegramId || '').trim()
  if (!code || !telegramId) {
    throw Object.assign(new Error('code and telegramId are required'), { status: 400 })
  }

  const linkCode = await getActiveLinkCode(code)
  if (!linkCode || linkCode.status !== 'active') {
    throw Object.assign(new Error('link code not found or inactive'), { status: 404 })
  }
  if (new Date(linkCode.expires_at).getTime() <= Date.now()) {
    await query(
      `UPDATE telegram_link_codes
       SET status = 'expired'
       WHERE id = $1`,
      [linkCode.id],
    )
    throw Object.assign(new Error('link code expired'), { status: 410 })
  }

  const existingTelegramIdentity = await query<{ account_id: string }>(
    `SELECT account_id
     FROM app_account_identities
     WHERE provider = 'telegram'
       AND provider_user_id = $1
     LIMIT 1`,
    [telegramId],
  )

  const existing = existingTelegramIdentity.rows[0]
  if (existing && existing.account_id !== linkCode.account_id) {
    throw Object.assign(new Error('telegram id already linked to another account'), { status: 409 })
  }

  const metadata = {
    username: input.telegramUsername ?? null,
    firstName: input.firstName ?? null,
  }

  await query(
    `INSERT INTO app_account_identities (account_id, provider, provider_user_id, metadata)
     VALUES ($1, 'telegram', $2, $3::jsonb)
     ON CONFLICT (provider, provider_user_id)
     DO UPDATE SET
       account_id = EXCLUDED.account_id,
       metadata = EXCLUDED.metadata`,
    [linkCode.account_id, telegramId, JSON.stringify(metadata)],
  )

  await query(
    `UPDATE telegram_link_codes
     SET status = 'used',
         used_at = now()
     WHERE id = $1`,
    [linkCode.id],
  )

  return { ok: true, accountId: linkCode.account_id }
}

export async function getWebSessionFromAuthHeader(authHeader: string | undefined): Promise<{
  token: string
  user: AppAccountUser
} | null> {
  const raw = String(authHeader || '').trim()
  if (!raw.toLowerCase().startsWith('bearer ')) return null
  const token = raw.slice(7).trim()
  if (!token) return null
  const user = await findAccountBySessionToken(token)
  if (!user) return null
  return { token, user }
}
