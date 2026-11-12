// Montant au centre du feutre (DESIGN §4.2) : la BB si une configuration jetons existe, sinon le buy-in commun.
import { formatCents } from '../../lib/money'
import { pointsToCents } from '../../lib/units'
import type { ChipConfig, Unit } from '../../lib/types'

const fr = new Intl.NumberFormat('fr-FR')

export function TableCenterAmount({ buyInCents, cfg, unit }: { buyInCents: number; cfg: ChipConfig | undefined; unit: Unit }) {
  return cfg ? (
    <>
      <p class="text-caps font-semibold uppercase text-on-felt-muted">Big blind</p>
      <p class="num font-display text-felt-big font-bold">
        {/* En pts/BB, la BB s'affiche telle quelle : un aller-retour par les centimes l'arrondirait. */}
        {unit === 'eur' ? formatCents(pointsToCents(cfg.bbPoints, cfg), { compact: true }) : `${fr.format(cfg.bbPoints)} pts`}
      </p>
    </>
  ) : (
    <>
      <p class="text-caps font-semibold uppercase text-on-felt-muted">Buy-in</p>
      <p class="num font-display text-felt-big font-bold">{formatCents(buyInCents, { compact: true })}</p>
    </>
  )
}
