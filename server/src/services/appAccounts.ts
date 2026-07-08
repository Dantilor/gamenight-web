import { createHash, randomBytes } from 'node:crypto'
import { query } from '../db.js'
import { getPremiumByTelegramId } from './subscriptions.js'

const SESSION_TTL_DAYS = 30
const LINK_CODE_TTL_MINUTES = 15
const LINK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type AppAccountUser = {
  id: string
  phone: string | null
  source: 'web'
  premium: boolean
  activeUntil: string | null
  telegramLinked: boolean
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

function buildAppAccountUser(account: AccountRow, premium: boolean, activeUntil: string | null, telegramLinked: boolean): AppAccountUser {
  return {
    id: account.id,
    phone: account.phone_e164,
    source: 'web',
    premium,
    activeUntil,
    telegramLinked,
  }
}

type TelegramIdentityRow = {
  provider_user_id: string
}

async function getTelegramIdentityByAccountId(accountId: string): Promise<TelegramIdentityRow | null> {
  const res = await query<TelegramIdentityRow>(
    `SELECT provider_user_id
     FROM app_account_identities
     WHERE account_id = $1
       AND provider = 'telegram'
     LIMIT 1`,
    [accountId],
  )
  return res.rows[0] ?? null
}

export async function getPremiumByAppAccountId(accountId: string): Promise<{
  premium: boolean
  activeUntil: string | null
  source: 'app_entitlement' | 'legacy_telegram_subscription' | null
  telegramLinked: boolean
}> {
  // NOTE: Telegram /api/me still reads legacy subscriptions only.
  // To reflect web entitlements inside Telegram client, a next step is:
  // 1) add app_entitlements as additional source in /api/me via telegram identity, or
  // 2) mirror web entitlements into legacy subscriptions for linked telegram_id.
  const entitlementPremium = await getPremiumByAppEntitlement(accountId)
  const telegramIdentity = await getTelegramIdentityByAccountId(accountId)
  const telegramLinked = Boolean(telegramIdentity)
  const legacyPremium: { premium: boolean; activeUntil: string | null; source: 'legacy_telegram_subscription' | null } = telegramIdentity
    ? await getPremiumByTelegramId(telegramIdentity.provider_user_id)
    : { premium: false, activeUntil: null, source: null }

  const entitlementDate = entitlementPremium.activeUntil ? new Date(entitlementPremium.activeUntil) : null
  const legacyDate = legacyPremium.activeUntil ? new Date(legacyPremium.activeUntil) : null

  if (entitlementDate && legacyDate) {
    if (entitlementDate >= legacyDate) {
      return {
        premium: true,
        activeUntil: entitlementPremium.activeUntil,
        source: 'app_entitlement',
        telegramLinked,
      }
    }
    return {
      premium: true,
      activeUntil: legacyPremium.activeUntil,
      source: 'legacy_telegram_subscription',
      telegramLinked,
    }
  }

  if (entitlementDate) {
    return {
      premium: true,
      activeUntil: entitlementPremium.activeUntil,
      source: 'app_entitlement',
      telegramLinked,
    }
  }

  if (legacyDate) {
    return {
      premium: true,
      activeUntil: legacyPremium.activeUntil,
      source: 'legacy_telegram_subscription',
      telegramLinked,
    }
  }

  return { premium: false, activeUntil: null, source: null, telegramLinked }
}

export async function getAppAccountIdByTelegramId(telegramId: string | number): Promise<string | null> {
  const telegramIdStr = String(telegramId).trim()
  if (!telegramIdStr) return null
  const res = await query<{ account_id: string }>(
    `SELECT account_id
     FROM app_account_identities
     WHERE provider = 'telegram'
       AND provider_user_id = $1
     LIMIT 1`,
    [telegramIdStr],
  )
  return res.rows[0]?.account_id ?? null
}

export async function getPremiumForTelegramUser(telegramId: string | number): Promise<{
  premium: boolean
  activeUntil: string | null
  source: 'app_entitlement' | 'legacy_telegram_subscription' | null
}> {
  const legacyPremium = await getPremiumByTelegramId(telegramId)
  const accountId = await getAppAccountIdByTelegramId(telegramId)
  const entitlementPremium = accountId
    ? await getPremiumByAppEntitlement(accountId)
    : { premium: false, activeUntil: null, source: null as 'app_entitlement' | null }

  const legacyDate = legacyPremium.activeUntil ? new Date(legacyPremium.activeUntil) : null
  const entitlementDate = entitlementPremium.activeUntil ? new Date(entitlementPremium.activeUntil) : null

  if (legacyDate && entitlementDate) {
    if (entitlementDate >= legacyDate) {
      return {
        premium: true,
        activeUntil: entitlementPremium.activeUntil,
        source: 'app_entitlement',
      }
    }
    return {
      premium: true,
      activeUntil: legacyPremium.activeUntil,
      source: 'legacy_telegram_subscription',
    }
  }

  if (legacyDate) {
    return {
      premium: true,
      activeUntil: legacyPremium.activeUntil,
      source: 'legacy_telegram_subscription',
    }
  }

  if (entitlementDate) {
    return {
      premium: true,
      activeUntil: entitlementPremium.activeUntil,
      source: 'app_entitlement',
    }
  }

  return { premium: false, activeUntil: null, source: null }
}

async function getAccountById(accountId: string): Promise<AccountRow | null> {
  const res = await query<AccountRow>(
    `SELECT id, phone_e164
     FROM app_accounts
     WHERE id = $1
     LIMIT 1`,
    [accountId],
  )
  return res.rows[0] ?? null
}

export async function getWebUserByAccountId(accountId: string): Promise<AppAccountUser | null> {
  const account = await getAccountById(accountId)
  if (!account) return null
  const premium = await getPremiumByAppAccountId(account.id)
  return buildAppAccountUser(account, premium.premium, premium.activeUntil, premium.telegramLinked)
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
  if (!row) return null
  return getWebUserByAccountId(row.id)
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
  return { token, user: buildAppAccountUser(account, false, null, false) }
}

export async function getPremiumByAppEntitlement(accountId: string): Promise<{
  premium: boolean
  activeUntil: string | null
  source: 'app_entitlement' | null
}> {
  const res = await query<{ active_until: Date }>(
    `SELECT active_until
     FROM app_entitlements
     WHERE account_id = $1
       AND product = 'premium'
       AND active_until > now()
     ORDER BY active_until DESC
     LIMIT 1`,
    [accountId],
  )
  const row = res.rows[0]
  if (!row) return { premium: false, activeUntil: null, source: null }
  return {
    premium: true,
    activeUntil: new Date(row.active_until).toISOString(),
    source: 'app_entitlement',
  }
}

export async function grantPremiumToAppAccount(
  accountId: string,
  activeUntil: Date,
  source: 'web_manual' | 'web_payment' | 'legacy_mirror' | 'admin',
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await query(
    `INSERT INTO app_entitlements (account_id, product, source, active_until, metadata)
     VALUES ($1, 'premium', $2, $3, $4::jsonb)`,
    [accountId, source, activeUntil, JSON.stringify(metadata)],
  )
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
