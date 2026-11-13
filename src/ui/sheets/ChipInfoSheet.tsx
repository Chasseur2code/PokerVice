// Détail du bandeau jetons (DESIGN §4.2) : SB, BB, valeur en € de chaque couleur, conversion du point,
// stack de départ. En lecture seule : la configuration est verrouillée depuis « Démarrer ».
import { formatEuroFraction, fraction, pointsToBBTenths } from '../../lib/units'
import { useGame } from '../../store/useGame'
import { BottomSheet } from '../components/BottomSheet'
import { ChipDot } from '../components/ChipDot'

const fr = new Intl.NumberFormat('fr-FR')
const frTenths = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

export function ChipInfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cfg = useGame((s) => s.game.chipConfig)
  if (!cfg) return <BottomSheet open={open} onClose={onClose} title="" />

  const { num, den } = cfg.centsPerPoint
  const euros = (points: number) => formatEuroFraction(fraction(points * num, den))
  const colors = cfg.colors ?? []
  const stack = colors.reduce((s, c) => s + c.valuePoints * c.perPlayer, 0)

  return (
    <BottomSheet open={open} onClose={onClose} title="Jetons">
      <div class="flex flex-col gap-4 pb-4">
        <dl class="grid grid-cols-2 gap-3">
          <Blind label="Small blind" points={cfg.sbPoints} euros={euros(cfg.sbPoints)} />
          <Blind label="Big blind" points={cfg.bbPoints} euros={euros(cfg.bbPoints)} />
        </dl>

        <ul class="flex flex-col divide-y divide-border">
          {colors.map((c) => (
            <li key={c.id} class="flex items-center gap-3 py-2.5">
              <ChipDot hex={c.hex} size={24} />
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{c.name}</p>
                <p class="num text-[13px] text-text-muted">{c.perPlayer > 0 ? `${c.perPlayer} par joueur au départ` : 'pour les recaves seulement'}</p>
              </div>
              <div class="text-right">
                <p class="num font-semibold">{fr.format(c.valuePoints)} pts</p>
                <p class="num text-[13px] text-text-muted">{euros(c.valuePoints)}</p>
              </div>
            </li>
          ))}
        </ul>

        <p class="num text-body text-text-muted">
          1 pt = <span class="font-semibold text-text">{formatEuroFraction(cfg.centsPerPoint)}</span>
          {stack > 0 && (
            <>
              {' · '}stack de départ {fr.format(stack)} pts ({euros(stack)}, {frTenths.format(pointsToBBTenths(stack, cfg) / 10)} BB)
            </>
          )}
        </p>
      </div>
    </BottomSheet>
  )
}

function Blind({ label, points, euros }: { label: string; points: number; euros: string }) {
  return (
    <div class="rounded-card bg-bg px-3.5 py-2.5">
      <dt class="text-caps font-semibold uppercase text-text-muted">{label}</dt>
      <dd class="num font-display text-[24px] font-bold">{fr.format(points)} pts</dd>
      <dd class="num text-[13px] text-text-muted">{euros}</dd>
    </div>
  )
}
