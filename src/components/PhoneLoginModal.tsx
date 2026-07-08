import { useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../utils/telegram'
import './PhoneLoginModal.css'

type Props = {
  isOpen: boolean
  onClose: () => void
  onRequestCode: (phone: string) => Promise<{ ok: boolean; error?: string }>
  onSubmit: (phone: string, code: string) => Promise<{ ok: boolean; error?: string }>
}

export default function PhoneLoginModal({ isOpen, onClose, onRequestCode, onSubmit }: Props) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleRequestCode = async () => {
    haptic('light')
    if (!phone.trim()) {
      setError('Введите номер телефона')
      return
    }
    setLoading(true)
    const result = await onRequestCode(phone)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'Не удалось отправить код')
      return
    }
    setError(null)
    setStep('code')
  }

  const handleLogin = async () => {
    haptic('medium')
    setLoading(true)
    const result = await onSubmit(phone, code)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'Не удалось войти')
      return
    }
    setError(null)
    setPhone('')
    setCode('')
    setStep('phone')
    onClose()
  }

  return createPortal(
    <div className="phone-login-modal" role="dialog" aria-modal="true" aria-labelledby="phone-login-title">
      <div className="phone-login-modal__backdrop" onClick={onClose} />
      <div className="phone-login-modal__card">
        <button
          type="button"
          className="phone-login-modal__close"
          aria-label="Закрыть"
          onClick={onClose}
        >
          ✕
        </button>
        <h2 id="phone-login-title" className="phone-login-modal__title">Вход по номеру</h2>
        <p className="phone-login-modal__hint">Dev-режим: используйте код 0000</p>

        <label className="phone-login-modal__label">
          Номер телефона
          <input
            className="phone-login-modal__input"
            type="tel"
            placeholder="+7 (999) 000-00-00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>

        {step === 'code' && (
          <label className="phone-login-modal__label">
            Код из SMS
            <input
              className="phone-login-modal__input"
              type="text"
              inputMode="numeric"
              placeholder="0000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}

        {error && <p className="phone-login-modal__error">{error}</p>}

        {step === 'phone' ? (
          <button type="button" className="phone-login-modal__btn" onClick={handleRequestCode} disabled={loading}>
            {loading ? 'Отправка…' : 'Получить код'}
          </button>
        ) : (
          <button type="button" className="phone-login-modal__btn" onClick={handleLogin} disabled={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
