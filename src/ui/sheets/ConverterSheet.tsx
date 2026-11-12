// Convertisseur simple (SPEC §6) : « 1 point = X € » et « BB = Y points », plus une calculatrice
// € ↔ points ↔ BB. Valider crée une configuration sans couleurs (donc sans bandeau jetons).
// Une fois la partie démarrée avec une configuration, elle est verrouillée : il reste la calculatrice.
import { useEffect, useId, useState } from 'preact/hooks'
import { divRound } from '../../lib/money'
import type { ChipConfig } from '../../lib/types'
import {
  centsPerPointToInput,
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

export function ConverterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cfg = useGame((s) => s.game.chipConfig)
  const running = useGame((s) => s.game.status === 'running')
  const buyIn = useGame((s) => s.game.defaultBuyInCents)
  const locked = running && !!cfg

  const formId = useId()
  const [euroPerPoint, setEuroPerPoint] = useState('')
  const [bbPoints, setBbPoints] = useState('')
  const [calcUnit, setCalcUnit] = useState<CalcUnit>('eur')
  const [calc, setCalc] = useState('')

  useEffect(() => {
    if (!open) return
    if (cfg?.mode === 'converter') {
      setEuroPerPoint(centsPerPointToInput(cfg.centsPerPoint) ?? '')
      setBbPoints(String(cfg.bbPoints))
    } else {
      // Proposition par défaut : 1 pt = 1 centime, BB = 1/100 du buy-in.
      setEuroPerPoint('0,01')
      setBbPoints(String(Math.max(1, divRound(buyIn, 100))))
    }
    setCalcUnit('eur')
    setCalc('')
  }, [open])

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
              1 point = <strong>{formatEuroFraction(cfg!.centsPerPoint)}</strong> · BB = <strong>{fr.format(cfg!.bbPoints)} pts</strong>
            </p>
            <p class="mt-1 text-[13px] text-text-muted">Verrouillé depuis le début de la partie.</p>
          </section>
        ) : (
          <>
            <div class="grid grid-cols-2 gap-3">
              <CompactField label="1 point =" value={euroPerPoint} onInput={setEuroPerPoint} suffix="€" invalid={euroPerPoint.trim() !== '' && !parseCentsPerPoint(euroPerPoint)} />
              <CompactField
                label="BB ="
                value={bbPoints}
                onInput={setBbPoints}
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
