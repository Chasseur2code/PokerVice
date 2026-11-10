// Aiguillage des écrans selon l'état du store : préparation, partie en cours, récap.
import { useGame } from '../store/useGame'
import { ToastHost } from './components/Toast'
import { GamePlaceholder } from './screens/GamePlaceholder'
import { Setup } from './screens/Setup'

export function App() {
  const screen = useGame((s) => (s.lastRecap ? 'recap' : s.game.status === 'setup' ? 'setup' : 'game'))
  return (
    <>
      {/* Partie et récap : écrans provisoires jusqu'aux étapes 7 et 9. */}
      {screen === 'setup' ? <Setup /> : <GamePlaceholder />}
      <ToastHost />
    </>
  )
}
