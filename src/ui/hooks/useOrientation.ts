import { useEffect, useState } from 'preact/hooks'
import type { Orientation } from '../../lib/seats'

/**
 * Paysage = fenêtre nettement plus large que haute. On évite `(orientation: landscape)` :
 * sur Android, le clavier virtuel réduit la hauteur et ferait basculer la table pendant une saisie.
 */
const LANDSCAPE_QUERY = '(min-aspect-ratio: 5/4)'

export function useOrientation(): Orientation {
  const [landscape, setLandscape] = useState(() => window.matchMedia(LANDSCAPE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(LANDSCAPE_QUERY)
    const onChange = () => setLandscape(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return landscape ? 'landscape' : 'portrait'
}
