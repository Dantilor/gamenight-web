import { Router, type Request, type Response } from 'express'
import {
  getPremiumByAppAccountId,
  getWebSessionFromAuthHeader,
  grantPremiumToAppAccount,
} from '../services/appAccounts.js'

const router = Router()
const isDev = process.env.NODE_ENV !== 'production'
const adminSecret = String(process.env.ADMIN_SECRET ?? '').trim()

function hasAdminAccess(req: Request): boolean {
  if (isDev) return true
  if (!adminSecret) return false
  const secret = String(req.headers['x-admin-secret'] ?? '').trim()
  return Boolean(secret) && secret === adminSecret
}

router.post('/dev/grant-premium', async (req: Request, res: Response) => {
  try {
    if (!hasAdminAccess(req)) {
      res.status(401).json({ ok: false, error: 'unauthorized' })
      return
    }

    const session = await getWebSessionFromAuthHeader(req.headers.authorization)
    if (!session) {
      res.status(401).json({ ok: false, error: 'web auth required' })
      return
    }

    const accountId = String(req.body?.accountId ?? '').trim()
    const daysNum = Number(req.body?.days)
    const days = Number.isFinite(daysNum) && daysNum > 0 ? Math.floor(daysNum) : 30

    const targetAccountId = accountId || session.user.id
    if (!targetAccountId) {
      res.status(400).json({ ok: false, error: 'accountId required' })
      return
    }

    if (isDev && targetAccountId !== session.user.id) {
      res.status(403).json({ ok: false, error: 'dev mode can grant only to current account' })
      return
    }

    const activeUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    await grantPremiumToAppAccount(
      targetAccountId,
      activeUntil,
      'web_manual',
      { days, grantedBy: isDev ? 'dev' : 'admin_secret' },
    )

    const status = await getPremiumByAppAccountId(targetAccountId)
    res.status(200).json({
      ok: true,
      accountId: targetAccountId,
      premium: status.premium,
      activeUntil: status.activeUntil,
      source: status.source,
    })
  } catch (e) {
    const err = e as Error
    res.status(500).json({ ok: false, error: err.message || 'internal error' })
  }
})

export default router
