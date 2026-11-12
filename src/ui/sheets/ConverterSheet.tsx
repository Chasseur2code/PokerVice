// Convertisseur simple (SPEC §6) : « 1 point = X € » et « BB = Y points », plus une calculatrice
// € ↔ points ↔ BB. Valider crée une configuration sans couleurs (donc sans bandeau jetons).
// Une fois la partie démarrée avec une configuration, elle est verrouillée : il reste la calculatrice.
import { useEffect, useId, useState } from 'preact/hooks'
import type { ChipConfig } from '../../lib/types'
import {
  bbPointsForDepth,
  centsPerPointToInput,
  centsToBB,
  centsToBBTenths,
  centsToPoints,
  converterConfig,
  formatEuroFraction,
  fraction,
  parseAmount,
  parseCentsPerPoint,
  parseCount,
  pointsToBBTenths,
} from '../../lib/units'
import { gameStore, useGame } from '../../store/useGame'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { CompactField } from '../components/CompactField'
import { NumberField } from '../components/NumberField'
import { Segmented } from '../components/Segmented'
import { showUndoToast } from '../undo'

const fr = new Intl.NumberFormat('fr-FR')
const frTenths = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

type CalcUnit = 'eur' | 'pts'

const DEFAULT_DEPTH = 100

export function ConverterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cfg = useGame((s) => s.game.chipConfig)
  const running = useGame((s) => s.game.status === 'running')
  const buyIn = useGame((s) => s.game.defaultBuyInCents)
  const locked = running && !!cfg

  const formId = useId()
  const [euroPerPoint, setEuroPerPoint] = useState('')
  const [bbPoints, setBbPoints] = useState('')
  const [depth, setDepth] = useState('')
  const [calcUnit, setCalcUnit] = useState<CalcUnit>('eur')
  const [calc, setCalc] = useState('')

  useEffect(() => {
    if (!open) return
    if (cfg?.mode === 'converter') {
      setEuroPerPoint(centsPerPointToInput(cfg.centsPerPoint) ?? '')
      setBbPoints(String(cfg.bbPoints))
      setDepth(String(centsToBB(buyIn, cfg)))
    } else {
      // Proposition par défaut : 1 pt = 1 centime, 100 BB par buy-in.
      setEuroPerPoint('0,01')
      setDepth(String(DEFAULT_DEPTH))
      setBbPoints(String(bbPointsForDepth(buyIn, { num: 1, den: 1 }, DEFAULT_DEPTH)))
    }
    setCalcUnit('eur')
    setCalc('')
  }, [open])

  // Buy-in = profondeur × BB × valeur du point : la profondeur est l'intention, la BB s'en déduit.
  // Changer la profondeur ou la valeur du point recalcule la BB ; changer la BB à la main recalcule la profondeur.
  const syncBB = (eur: string, d: string) => {
    const cpp = parseCentsPerPoint(eur)
    const n = parseCount(d)
    if (cpp && n) setBbPoints(String(bbPointsForDepth(buyIn, cpp, n)))
  }
  const onEuroPerPoint = (v: string) => {
    setEuroPerPoint(v)
    syncBB(v, depth)
  }
  const onDepth = (v: string) => {
    setDepth(v)
    syncBB(euroPerPoint, v)
  }
  const onBbPoints = (v: string) => {
    setBbPoints(v)
    const c = converterConfig(euroPerPoint, v)
    if (c) setDepth(String(centsToBB(buyIn, c)))
  }

  const draft: ChipConfig | null = locked ? cfg! : converterConfig(euroPerPoint, bbPoints)
  const result = draft ? calcResult(calc, calcUnit, draft) : undefined

  const submit = (e: Event) => {
    e.preventDefault()
    if (locked || !draft) return onClose()
    if (!gameStore.getState().setChipConfig(draft)) return
    onClose()
    showUndoToast('Convertisseur enregistré')
  }

  const remove = () => {
    if (!gameStore.getState().setChipConfig(undefined)) return
    onClose()
    showUndoToast('Convertisseur retiré')
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Convertisseur jetons ↔ €"
      full
      footer={
        locked ? (
          <SecondaryButton onClick={onClose}>Fermer</SecondaryButton>
        ) : (
          <PrimaryButton type="submit" form={formId} disabled={!draft}>
            Valider
          </PrimaryButton>
        )
      }
    >
      <form id={formId} onSubmit={submit} class="flex flex-col gap-4 pb-4">
        {locked ? (
          <section class="rounded-card bg-bg px-4 py-3 text-body">
            <p class="num">
              1 point = <strong>{formatEuroFraction(cfg!.centsPerPoint)}</strong> · BB = <strong>{fr.format(cfg!.bbPoints)} pts</strong> · buy-in de{' '}
              <strong>{frTenths.format(centsToBBTenths(buyIn, cfg!) / 10)} BB</strong>
            </p>
            <p class="mt-1 text-[13px] text-text-muted">Verrouillé depuis le début de la partie.</p>
          </section>
        ) : (
          <>
            <div class="grid grid-cols-2 gap-3">
              <CompactField label="1 point =" value={euroPerPoint} onInput={onEuroPerPoint} suffix="€" invalid={euroPerPoint.trim() !== '' && !parseCentsPerPoint(euroPerPoint)} />
              <CompactField
                label="Profondeur (buy-in)"
                value={depth}
                onInput={onDepth}
                suffix="BB"
                inputMode="numeric"
                invalid={depth.trim() !== '' && !parseCount(depth)}
              />
              <CompactField
                label="BB ="
                value={bbPoints}
                onInput={onBbPoints}
                suffix="pts"
                inputMode="numeric"
                invalid={bbPoints.trim() !== '' && !parseCount(bbPoints)}
              />
            </div>
            {draft && (
              <p class="num -mt-1 text-[13px] text-text-muted">
                Buy-in de {fr.format(centsToPoints(buyIn, draft))} pts, soit {frTenths.format(centsToBBTenths(buyIn, draft) / 10)} BB.
                {running && ' Une fois validé, ce réglage ne pourra plus être modifié.'}
              </p>
            )}
            {cfg?.mode === 'converter' && (
              <button type="button" onClick={remove} class="h-11 self-start text-body font-semibold text-loss">
                Retirer le convertisseur
              </button>
            )}
          </>
        )}

        <section class="flex flex-col gap-2 border-t border-border pt-4" aria-label="Calculatrice">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold">Calculatrice</h3>
            <Segmented
              label="Unité de saisie"
              options={[
                { value: 'eur', label: '€', ariaLabel: 'Euros' },
                { value: 'pts', label: 'Pts', ariaLabel: 'Points' },
              ]}
              value={calcUnit}
              onChange={(u) => {
                setCalcUnit(u)
                setCalc('')
              }}
            />
          </div>
          <NumberField
            label="Montant à convertir"
            hideLabel
            value={calc}
            onInput={setCalc}
            unit={calcUnit === 'pts' ? 'pts' : '€'}
            autoFocus={false}
            equivalent={result ?? undefined}
            error={!draft ? 'Renseignez la valeur du point et la BB.' : result === null ? 'Montant invalide' : undefined}
          />
        </section>
      </form>
    </BottomSheet>
  )
}

/**
 * « = 2 000 pts · 100 BB » pour une saisie en €, « = 20,00 € · 100 BB » pour une saisie en points ;
 * `null` si la saisie est invalide, `undefined` si elle est vide.
 */
function calcResult(input: string, unit: CalcUnit, cfg: ChipConfig): string | null | undefined {
  if (input.trim() === '') return undefined
  if (unit === 'eur') {
    const cents = parseAmount(input, 'eur', cfg)
    if (cents === null || cents < 0) return null
    return `= ${fr.format(centsToPoints(cents, cfg))} pts · ${frTenths.format(centsToBBTenths(cents, cfg) / 10)} BB`
  }
  const points = parseCount(input)
  if (points === null) return null
  const { num, den } = cfg.centsPerPoint
  return `= ${formatEuroFraction(fraction(points * num, den))} · ${frTenths.format(pointsToBBTenths(points, cfg) / 10)} BB`
}
