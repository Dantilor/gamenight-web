import { useEffect, useRef } from 'react'
import { getPlatform } from '../platform'

/** Throttled: at most once per frame via RAF */
function useThrottledAppHeight() {
  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef(false)

  const update = () => {
    if (typeof document === 'undefined') return
    const platform = getPlatform()
    const stableHeight = platform.viewportStableHeight()
    const height = platform.viewportHeight()
    const h =
      (typeof stableHeight === 'number' && stableHeight > 0
        ? stableHeight
        : typeof height === 'number' && height > 0
          ? height
          : window.innerHeight)
    document.documentElement.style.setProperty('--app-height', `${h}px`)
    if (platform.webApp) {
      document.documentElement.dataset.tgMobile = '1'
    } else {
      delete document.documentElement.dataset.tgMobile
    }
  }

  const schedule = () => {
    if (pendingRef.current) return
    pendingRef.current = true
    rafRef.current = requestAnimationFrame(() => {
      pendingRef.current = false
      rafRef.current = null
      update()
    })
  }

  useEffect(() => {
    update()
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    getPlatform().onViewportChanged(schedule)
    return () => {
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])
}

export function useAppHeight() {
  useThrottledAppHeight()
}
