// Bascule d'unité € | Pts | BB de l'en-tête (SPEC §4.1) : n'existe que si une configuration jetons existe.
import type { Unit } from '../../lib/types'
import { gameStore, useGame } from '../../store/useGame'
import { Segmented, type SegmentedOption } from './Segmented'

const OPTIONS: readonly SegmentedOption<Unit>[] = [
  { value: 'eur', label: '€', ariaLabel: 'Euros' },
  { value: 'pts', label: 'Pts', ariaLabel: 'Points' },
  { value: 'bb', label: 'BB', ariaLabel: 'Big blinds' },
]

export function UnitToggle() {
  const hasConfig = useGame((s) => !!s.game.chipConfig)
  const unit = useGame((s) => s.unit)
  if (!hasConfig) return null
  return <Segmented label="Unité d'affichage" options={OPTIONS} value={unit} onChange={(u) => gameStore.getState().setUnit(u)} />
}
