// Aiguillage des écrans selon l'état du store : préparation, partie en cours (fin de partie comprise), récap.
import { useGame } from '../store/useGame'
import { ToastHost } from './components/Toast'
import { Game } from './screens/Game'
import { Recap } from './screens/Recap'
import { Setup } from './screens/Setup'

export function App() {
  const screen = useGame((s) => (s.lastRecap ? 'recap' : s.game.status === 'setup' ? 'setup' : 'game'))
  return (
    <>
      {screen === 'setup' ? <Setup /> : screen === 'game' ? <Game /> : <Recap />}
      <ToastHost />
    </>
  )
}
