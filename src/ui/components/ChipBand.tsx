// Bandeau jetons compact (SPEC §4.1, DESIGN §4.2) : pastilles et valeur en points de chaque couleur.
// Toujours visible en partie quand les couleurs sont connues ; un tap ouvre le détail (ChipInfoSheet).
import { ChevronDown } from 'lucide-preact'
import type { ChipColor } from '../../lib/types'
import { ChipDot } from './ChipDot'

const fr = new Intl.NumberFormat('fr-FR')

export function ChipBand({ colors, onClick }: { colors: readonly ChipColor[]; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Jetons : ${colors.map((c) => `${c.name} ${fr.format(c.valuePoints)}`).join(', ')} points. Détail`}
      class="flex h-11 w-full shrink-0 items-center gap-3 rounded-row bg-surface px-3.5 shadow-card active:bg-bg"
    >
      <span class="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
        {colors.map((c) => (
          <span key={c.id} class="flex shrink-0 items-center gap-1.5">
            <ChipDot hex={c.hex} />
            <span class="num text-body font-semibold">{fr.format(c.valuePoints)}</span>
          </span>
        ))}
      </span>
      <span class="text-[13px] text-text-muted">pts</span>
      <ChevronDown size={20} strokeWidth={2} class="shrink-0 text-text-muted" aria-hidden="true" />
    </button>
  )
}
