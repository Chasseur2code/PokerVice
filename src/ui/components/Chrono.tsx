// Chrono de partie « h:mm:ss » : recalculé depuis `startedAt` à chaque seconde (jamais par incrément),
// donc juste après une mise en veille ou un rechargement. Composant à part : son tic ne re-rend que lui.
import { useEffect, useState } from 'preact/hooks'
import { elapsedMs, formatChrono } from '../../lib/derive'

export function Chrono({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return <>{formatChrono(elapsedMs({ startedAt }, now))}</>
}
