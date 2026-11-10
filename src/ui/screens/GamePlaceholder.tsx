// Écran de partie PROVISOIRE (étape 6) : montre la table après « Démarrer » et permet de repartir
// de zéro. Remplacé par le vrai écran de partie (DESIGN §4.2) à l'étape 7.
import { summarizePlayers } from '../../lib/derive'
import { fromBottom } from '../../lib/seats'
import { formatAmount } from '../../lib/units'
import { gameStore, useGame } from '../../store/useGame'
import { SecondaryButton } from '../components/Button'
import { Header } from '../components/Header'
import { Table, type SeatSlot } from '../components/Table'
import { useOrientation } from '../hooks/useOrientation'

export function GamePlaceholder() {
  const orientation = useOrientation()
  const game = useGame((s) => s.lastRecap?.game ?? s.game)
  const unit = useGame((s) => s.unit)
  const summaries = summarizePlayers(game)

  const slots = [...game.players]
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .filter((p) => summaries.get(p.id)?.status === 'seated')
    .map((p): SeatSlot => {
      const amount = formatAmount(summaries.get(p.id)!.investedCents, unit, game.chipConfig, { compact: true })
      return { kind: 'player', key: p.id, name: p.name, color: p.color, amount, ariaLabel: `${p.name}, ${amount} investis` }
    })

  const abandon = () => {
    if (window.confirm('Abandonner la partie et repartir d’une table vide ?')) gameStore.getState().newGame()
  }

  return (
    <main class="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-md flex-col gap-2.5 px-4 pt-3 pb-5">
      <Header>
        <span class="text-[13px] text-text-muted">Partie en cours</span>
      </Header>
      <div class="mx-auto w-full" style={{ maxWidth: 'min(100%, max(240px, calc((100dvh - 200px) * 358 / 460)))' }}>
        <Table
          seats={fromBottom(slots)}
          orientation={orientation === 'landscape' ? 'landscape' : 'portrait'}
          center={<p class="font-display text-felt-title font-semibold">Écran de partie : étape 7</p>}
        />
      </div>
      <div class="mt-auto">
        <SecondaryButton onClick={abandon}>Abandonner la partie</SecondaryButton>
      </div>
    </main>
  )
}
