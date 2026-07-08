import { useState, useCallback, useRef } from 'react'
import { useBack } from '../hooks/useBack'
import { usePremium } from '../contexts/PremiumContext'
import { getTelegramWebApp } from '../lib/telegram'
import { getPlatform } from '../platform'
import type { DocumentType } from '../data/documents'
import { haptic, getTgUser, getInitData } from '../utils/telegram'
import { useAuth } from '../auth/useAuth'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import PremiumOverlay from '../components/PremiumOverlay'
import DocumentModal from '../components/DocumentModal'
import PhoneLoginModal from '../components/PhoneLoginModal'
import './Profile.css'

const SUPPORT_BOT_URL = 'https://t.me/GameNightHelp'

const DOCUMENT_LINKS: { type: DocumentType; label: string; icon: string }[] = [
  { type: 'privacy', label: 'Политика конфиденциальности', icon: '🛡️' },
  { type: 'terms', label: 'Условия использования', icon: '📄' },
  { type: 'premium', label: 'Условия Premium', icon: '💎' },
  { type: 'adultPolicy', label: 'Политика доступа к категориям 18+', icon: '🔞' },
]

const PREMIUM_PERKS = ['8 игр', 'Избранное', '18+ режимы', 'Без автосписаний']

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.trim()[0] ?? ''
  const last = lastName?.trim()[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

function Profile() {
  const handleBack = useBack('/')
  const platform = getPlatform()
  const telegramUser = getTgUser()
  const {
    user: appUser,
    isLoading,
    requestCode,
    loginWithPhoneDev,
    getMe,
    refreshAuth,
    createTelegramLinkCode,
    grantPremiumDev,
    logout,
    isAuthenticated,
  } = useAuth()
  const user = telegramUser ?? (appUser.source === 'web'
    ? {
        first_name: appUser.firstName ?? 'Web User',
        username: appUser.username ?? undefined,
        photo_url: undefined,
      }
    : null)
  const isWebMode = platform.mode === 'web'
  const isWebGuest = isWebMode && appUser.source === 'guest'
  const { isPremium, activeUntil, authError, authError401, serverError503, refreshPremium } = usePremium()
  const initData = getInitData()
  const userId = initData.userId ?? initData.user?.id
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false)
  const [documentModalType, setDocumentModalType] = useState<DocumentType | null>(null)
  const [phoneLoginOpen, setPhoneLoginOpen] = useState(false)
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [devGrantLoading, setDevGrantLoading] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRestorePurchase = useCallback(async () => {
    haptic('medium')
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current)
    setRestoreStatus(null)
    setRestoreLoading(true)
    try {
      const result = await refreshPremium()
      const toast = result?.isPremium ? '✅ Покупки восстановлены' : 'Покупок не найдено'
      setRestoreStatus(toast)
    } catch {
      setRestoreStatus('Ошибка синхронизации')
    } finally {
      setRestoreLoading(false)
      restoreTimerRef.current = setTimeout(() => {
        setRestoreStatus(null)
        restoreTimerRef.current = null
      }, 2500)
    }
  }, [refreshPremium])

  const handleSupport = useCallback(() => {
    haptic('light')
    const tg = getTelegramWebApp()
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(SUPPORT_BOT_URL)
    } else {
      window.open(SUPPORT_BOT_URL, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const getErrorMessage = () => {
    if (isWebMode && !isAuthenticated()) return null
    if (authError401) return 'Откройте внутри Telegram'
    if (serverError503) return 'Сервис временно недоступен, попробуйте позже'
    if (authError) return 'Откройте внутри Telegram'
    return null
  }

  const handleCreateTelegramLink = useCallback(async () => {
    haptic('medium')
    setLinkLoading(true)
    setLinkError(null)
    const result = await createTelegramLinkCode()
    setLinkLoading(false)
    if (!result.ok) {
      setLinkError(result.error ?? 'Не удалось создать код привязки')
      return
    }
    setLinkCode(result.code ?? null)
    setLinkUrl(result.telegramStartUrl ?? null)
  }, [createTelegramLinkCode])

  const handleRefreshWebPremium = useCallback(async () => {
    haptic('light')
    setStatusLoading(true)
    setLinkError(null)
    await refreshAuth()
    await refreshPremium()
    setStatusLoading(false)
  }, [refreshAuth, refreshPremium])

  const handleDevGrantPremium = useCallback(async () => {
    if (!import.meta.env.DEV || !appUser.id) return
    haptic('medium')
    setDevGrantLoading(true)
    setLinkError(null)
    const result = await grantPremiumDev(appUser.id, 30)
    if (!result.ok) {
      setLinkError(result.error ?? 'Не удалось выдать Premium')
    }
    await getMe()
    await refreshPremium()
    setDevGrantLoading(false)
  }, [appUser.id, getMe, grantPremiumDev, refreshPremium])

  const errorMessage = getErrorMessage()
  const activeUntilLabel = activeUntil
    ? new Date(activeUntil).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="profile-page" aria-label="Профиль">
      <div className="profile-page__header">
        <HomeButton className="profile-page__nav-btn" />
        <BackButton onClick={handleBack} className="profile-page__nav-btn profile-page__back" />
      </div>

      <div className="profile-shell">
        <section className="profile-identity">
          <div className="profile-identity__glow" aria-hidden />
          <div className="profile-identity__avatar-wrap">
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt=""
                className="profile-identity__photo"
                decoding="async"
                loading="lazy"
              />
            ) : (
              <div className="profile-identity__initials" aria-hidden>
                {user ? getInitials(user.first_name, user.last_name) : 'GN'}
              </div>
            )}
            {isPremium && <span className="profile-identity__crown" aria-hidden>✦</span>}
          </div>

          {user ? (
            <>
              <p className="profile-identity__name">
                {user.first_name}
                {user.last_name ? ` ${user.last_name}` : ''}
              </p>
              {user.username && (
                <p className="profile-identity__username">@{user.username}</p>
              )}
              {appUser.source === 'web' && appUser.phone && (
                <p className="profile-identity__username">{appUser.phone}</p>
              )}
            </>
          ) : (
            <p className="profile-identity__guest">
              {isLoading && isWebMode
                ? 'Загружаем аккаунт...'
                : isWebMode
                ? 'Войдите по номеру телефона, чтобы сохранить аккаунт и управлять подпиской.'
                : 'Откройте приложение внутри Telegram, чтобы увидеть профиль и статус Premium'}
            </p>
          )}

          <span className={`profile-identity__badge${isPremium ? ' profile-identity__badge--pro' : ''}`}>
            {isPremium ? 'Premium активен' : 'Free'}
          </span>
        </section>

        {errorMessage && (
          <p className="profile-alert profile-alert--error">{errorMessage}</p>
        )}

        {isWebMode && (
          <section className="profile-menu">
            <h2 className="profile-menu__title">Аккаунт GameNight Host</h2>
            <div className="profile-menu__panel">
              {isWebGuest ? (
                <>
                  <p className="profile-pass__desc">
                    Войдите по номеру телефона, чтобы сохранить Premium, привязать Telegram и играть с любого устройства.
                  </p>
                  <button
                    type="button"
                    className="profile-menu__row profile-menu__row--cta"
                    onClick={() => {
                      haptic('light')
                      setPhoneLoginOpen(true)
                    }}
                  >
                    <span className="profile-menu__icon" aria-hidden>📱</span>
                    <span className="profile-menu__label">Войти по телефону</span>
                    <span className="profile-menu__chev" aria-hidden>›</span>
                  </button>
                </>
              ) : (
                <>
                  {appUser.phone && <p className="profile-pass__desc">Телефон: {appUser.phone}</p>}
                  <p className="profile-pass__desc">
                    Статус Premium: {isPremium ? 'активен' : 'не активен'}
                    {activeUntilLabel ? ` до ${activeUntilLabel}` : ''}
                  </p>
                  <p className="profile-pass__desc">
                    Telegram: {appUser.telegramLinked ? 'привязан' : 'не привязан'}
                  </p>
                  <button
                    type="button"
                    className="profile-menu__row"
                    onClick={() => {
                      haptic('light')
                      void logout()
                    }}
                  >
                    <span className="profile-menu__icon" aria-hidden>🚪</span>
                    <span className="profile-menu__label">Выйти</span>
                    <span className="profile-menu__chev" aria-hidden>›</span>
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {isWebMode && appUser.source === 'web' && (
          <section className="profile-menu">
            <h2 className="profile-menu__title">Привязка Telegram</h2>
            <div className="profile-menu__panel">
              <p className="profile-pass__desc">
                {appUser.telegramLinked ? 'Telegram привязан' : 'Telegram пока не привязан'}
              </p>
              <button
                type="button"
                className="profile-menu__row"
                onClick={handleCreateTelegramLink}
                disabled={linkLoading}
              >
                <span className="profile-menu__icon" aria-hidden>🔗</span>
                <span className="profile-menu__label">
                  {linkLoading ? 'Генерируем код…' : 'Привязать Telegram'}
                </span>
                <span className="profile-menu__chev" aria-hidden>›</span>
              </button>
              <button
                type="button"
                className="profile-menu__row"
                onClick={handleRefreshWebPremium}
                disabled={statusLoading}
              >
                <span className="profile-menu__icon" aria-hidden>🔄</span>
                <span className="profile-menu__label">
                  {statusLoading ? 'Проверяем…' : 'Проверить статус подписки'}
                </span>
                <span className="profile-menu__chev" aria-hidden>›</span>
              </button>
              {import.meta.env.DEV && (
                <button
                  type="button"
                  className="profile-menu__row"
                  onClick={handleDevGrantPremium}
                  disabled={devGrantLoading}
                >
                  <span className="profile-menu__icon" aria-hidden>🧪</span>
                  <span className="profile-menu__label">
                    {devGrantLoading ? 'Выдаем…' : 'Выдать Premium на 30 дней'}
                  </span>
                  <span className="profile-menu__chev" aria-hidden>›</span>
                </button>
              )}
              {linkError && <p className="profile-alert profile-alert--error">{linkError}</p>}
              {isPremium && (
                <p className="profile-pass__desc">
                  Premium активен{activeUntilLabel ? ` до ${activeUntilLabel}` : ''}.
                </p>
              )}
              {!isPremium && (
                <p className="profile-pass__desc">
                  Premium пока не активен. Оформление подписки на сайте добавим на следующем этапе.
                </p>
              )}
              {linkCode && (
                <div className="profile-pass__inactive">
                  <p className="profile-pass__title">Код привязки: {linkCode}</p>
                  <p className="profile-pass__desc">Откройте бота по ссылке, чтобы привязать Telegram к этому аккаунту.</p>
                  {linkUrl && (
                    <a className="profile-pass__cta" href={linkUrl} target="_blank" rel="noreferrer">
                      Открыть Telegram
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        <section className={`profile-pass${isPremium ? ' profile-pass--active' : ''}`}>
          {isPremium ? (
            <div className="profile-pass__active">
              <div className="profile-pass__active-head">
                <span className="profile-pass__gem" aria-hidden>💎</span>
                <div>
                  <p className="profile-pass__active-label">Premium</p>
                  <p className="profile-pass__active-date">
                    {activeUntilLabel ? `до ${activeUntilLabel}` : 'активен'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="profile-pass__restore"
                onClick={handleRestorePurchase}
                disabled={restoreLoading}
              >
                {restoreLoading ? 'Загрузка…' : 'Восстановить покупки'}
              </button>
              {restoreStatus && (
                <span className="profile-pass__toast">{restoreStatus}</span>
              )}
            </div>
          ) : (
            <div className="profile-pass__inactive">
              <div className="profile-pass__head">
                <span className="profile-pass__gem" aria-hidden>💎</span>
                <div>
                  <p className="profile-pass__eyebrow">Premium-доступ</p>
                  <p className="profile-pass__title">Полный доступ к играм</p>
                </div>
              </div>
              <p className="profile-pass__desc">
                Все игры, колоды, избранное и 18+ режимы — без автосписаний.
              </p>
              <div className="profile-pass__perks">
                {PREMIUM_PERKS.map((perk) => (
                  <span key={perk} className="profile-pass__perk">{perk}</span>
                ))}
              </div>
              <button
                type="button"
                className="profile-pass__cta"
                onClick={() => {
                  haptic('medium')
                  setPremiumOverlayOpen(true)
                }}
              >
                <span className="profile-pass__cta-shine" aria-hidden />
                Оформить Premium
              </button>
              <button
                type="button"
                className="profile-pass__restore"
                onClick={handleRestorePurchase}
                disabled={restoreLoading}
              >
                {restoreLoading ? 'Загрузка…' : 'Восстановить покупки'}
              </button>
              {restoreStatus && (
                <span className="profile-pass__toast">{restoreStatus}</span>
              )}
            </div>
          )}
        </section>

        <section className="profile-menu">
          <h2 className="profile-menu__title">Документы</h2>
          <div className="profile-menu__panel">
            {DOCUMENT_LINKS.map(({ type, label, icon }) => (
              <button
                key={type}
                type="button"
                className="profile-menu__row"
                onClick={() => { haptic('light'); setDocumentModalType(type) }}
              >
                <span className="profile-menu__icon" aria-hidden>{icon}</span>
                <span className="profile-menu__label">{label}</span>
                <span className="profile-menu__chev" aria-hidden>›</span>
              </button>
            ))}
          </div>
        </section>

        <section className="profile-menu profile-menu--support">
          <h2 className="profile-menu__title">Поддержка</h2>
          <div className="profile-menu__panel">
            <button
              type="button"
              className="profile-menu__row profile-menu__row--support"
              onClick={handleSupport}
            >
              <span className="profile-menu__icon" aria-hidden>💬</span>
              <span className="profile-menu__label">
                <span className="profile-menu__label-main">Написать в поддержку</span>
                <span className="profile-menu__label-sub">Подписка, восстановление, вопросы</span>
              </span>
              <span className="profile-menu__chev" aria-hidden>›</span>
            </button>
          </div>
        </section>

        {import.meta.env.DEV && userId != null && (
          <p className="profile-dev-id">id {userId}</p>
        )}
      </div>

      <PremiumOverlay
        isOpen={premiumOverlayOpen}
        onClose={() => setPremiumOverlayOpen(false)}
        onRequireLogin={() => setPhoneLoginOpen(true)}
      />
      <PhoneLoginModal
        isOpen={phoneLoginOpen}
        onClose={() => setPhoneLoginOpen(false)}
        onRequestCode={(phone) => requestCode(phone)}
        onSubmit={(phone, code) => loginWithPhoneDev(phone, code)}
      />
      <DocumentModal
        isOpen={documentModalType !== null}
        onClose={() => setDocumentModalType(null)}
        documentType={documentModalType ?? 'privacy'}
      />
    </div>
  )
}

export default Profile
