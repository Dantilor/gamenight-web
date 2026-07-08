import { Router, type Request, type Response } from 'express'
import {
  deleteSessionToken,
  ensurePhoneLogin,
  getWebSessionFromAuthHeader,
  normalizePhoneE164,
} from '../services/appAccounts.js'

const router = Router()

router.post('/web-auth/request-code', async (req: Request, res: Response) => {
  const phoneRaw = String(req.body?.phone ?? '')
  const phone = normalizePhoneE164(phoneRaw)
  if (!phone) {
    res.status(400).json({ ok: false, error: 'invalid phone' })
    return
  }

  // Dev stub only: no real SMS yet.
  res.status(200).json({ ok: true, phone, codeHint: '0000' })
})

router.post('/web-auth/verify-code', async (req: Request, res: Response) => {
  const phoneRaw = String(req.body?.phone ?? '')
  const code = String(req.body?.code ?? '').trim()
  const phone = normalizePhoneE164(phoneRaw)
  if (!phone) {
    res.status(400).json({ ok: false, error: 'invalid phone' })
    return
  }
  if (code !== '0000') {
    res.status(401).json({ ok: false, error: 'invalid code' })
    return
  }

  try {
    const { token, user } = await ensurePhoneLogin(phone)
    res.status(200).json({ token, user })
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status ?? 500).json({ ok: false, error: err.message || 'internal error' })
  }
})

router.get('/web-auth/me', async (req: Request, res: Response) => {
  try {
    const session = await getWebSessionFromAuthHeader(req.headers.authorization)
    if (!session) {
      res.status(401).json({ ok: false, error: 'unauthorized' })
      return
    }
    res.status(200).json({ user: session.user })
  } catch (e) {
    const err = e as Error
    res.status(500).json({ ok: false, error: err.message || 'internal error' })
  }
})

router.post('/web-auth/logout', async (req: Request, res: Response) => {
  try {
    const raw = String(req.headers.authorization || '')
    const token = raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : ''
    if (token) await deleteSessionToken(token)
    res.status(200).json({ ok: true })
  } catch (e) {
    const err = e as Error
    res.status(500).json({ ok: false, error: err.message || 'internal error' })
  }
})

export default router
