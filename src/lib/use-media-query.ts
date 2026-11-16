import { useCallback, useSyncExternalStore } from 'react'

export const useMediaQuery = (query: string) => {
  const subscribe = useCallback((notify: () => void) => {
    const media = window.matchMedia(query)
    media.addEventListener('change', notify)
    return () => media.removeEventListener('change', notify)
  }, [query])
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

const subscribeVisibility = (notify: () => void) => {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}
export const usePageVisible = () => useSyncExternalStore(subscribeVisibility, () => !document.hidden)
