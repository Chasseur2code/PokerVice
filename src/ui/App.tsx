// Aiguillage des écrans selon l'état du store : préparation, partie en cours, récap.
import { useGame } from '../store/useGame'
import { ToastHost } from './components/Toast'
import { Game } from './screens/Game'
import { RecapPlaceholder } from './screens/RecapPlaceholder'
import { Setup } from './screens/Setup'

export function App() {
  const screen = useGame((s) => (s.lastRecap ? 'recap' : s.game.status === 'setup' ? 'setup' : 'game'))
  return (
    <>
      {/* Récap : écran provisoire jusqu'à l'étape 9. */}
      {screen === 'setup' ? <Setup /> : screen === 'game' ? <Game /> : <RecapPlaceholder />}
      <ToastHost />
    </>
  )
}
