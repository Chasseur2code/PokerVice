import { useEffect, useRef } from 'preact/hooks'

/** L'API Wake Lock n'existe qu'en contexte sécurisé (https ou localhost) et sur certains navigateurs. */
export const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

/**
 * Garde l'écran allumé tant que `enabled` est vrai (SPEC §4.5). Le navigateur relâche le verrou
 * dès que la page est masquée : on le redemande à chaque retour au premier plan.
 * `onError` est appelé si le navigateur refuse (économie d'énergie…).
 */
export function useWakeLock(enabled: boolean, onError: () => void): void {
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    if (!enabled || !wakeLockSupported) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false
    // Une seule demande à la fois : deux demandes en vol donneraient deux verrous, dont un jamais relâché.
    let requesting = false

    const acquire = async () => {
      if (requesting || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return
      requesting = true
      try {
        const s = await navigator.wakeLock.request('screen')
        if (cancelled) void s.release()
        else sentinel = s
      } catch {
        if (!cancelled) onErrorRef.current()
      } finally {
        requesting = false
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      void sentinel?.release()
    }
  }, [enabled])
}
