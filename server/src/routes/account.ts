import { Router, type Request, type Response } from 'express'
import {
  confirmTelegramLink,
  createTelegramLinkCode,
  getWebSessionFromAuthHeader,
} from '../services/appAccounts.js'

const router = Router()

function getBotUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME || process.env.BOT_USERNAME || 'GameNightHostBot'
}

router.post('/account/link-telegram-code', async (req: Request, res: Response) => {
  try {
    const session = await getWebSessionFromAuthHeader(req.headers.authorization)
    if (!session) {
      res.status(401).json({ ok: false, error: 'unauthorized' })
      return
    }

    const code = await createTelegramLinkCode(session.user.id)
    const botUsername = getBotUsername()
    const telegramStartUrl = `https://t.me/${botUsername}?start=link_${code}`

    res.status(200).json({ code, telegramStartUrl })
  } catch (e) {
    const err = e as Error
    res.status(500).json({ ok: false, error: err.message || 'internal error' })
  }
})

router.post('/account/link-telegram/confirm', async (req: Request, res: Response) => {
  const code = String(req.body?.code ?? '')
  const telegramId = String(req.body?.telegramId ?? '')
  const telegramUsername = typeof req.body?.telegramUsername === 'string' ? req.body.telegramUsername : null
  const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName : null

  try {
    const result = await confirmTelegramLink({
      code,
      telegramId,
      telegramUsername,
      firstName,
    })
    res.status(200).json({ ok: true, accountId: result.accountId })
  } catch (e) {
    const err = e as Error & { status?: number }
    const status = err.status ?? 500
    res.status(status).json({ ok: false, error: err.message || 'internal error' })
  }
})

export default router
