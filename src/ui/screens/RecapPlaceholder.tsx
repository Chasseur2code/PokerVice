// Récap PROVISOIRE : remplacé par le vrai récap (DESIGN §5, SPEC §8.3) à l'étape 9.
// Seul `finish` du store y mène, et l'UI ne l'appelle pas encore.
import { gameStore } from '../../store/useGame'
import { SecondaryButton } from '../components/Button'
import { Header } from '../components/Header'

export function RecapPlaceholder() {
  const restart = () => {
    if (window.confirm('Le récap précédent sera effacé. Commencer une nouvelle partie ?')) gameStore.getState().newGame()
  }

  return (
    <main class="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-md flex-col gap-2.5 px-4 pt-3 pb-5">
      <Header />
      <p class="text-body text-text-muted">Le récap de fin de partie arrive à l'étape 9.</p>
      <div class="mt-auto">
        <SecondaryButton onClick={restart}>Nouvelle partie</SecondaryButton>
      </div>
    </main>
  )
}
