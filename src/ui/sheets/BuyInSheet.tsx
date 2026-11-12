// Sheet « Buy-in par joueur » (DESIGN §4.1) : saisie en euros du buy-in commun.
import { useEffect, useId, useState } from 'preact/hooks'
import { centsToInput, parseEuros } from '../../lib/money'
import { centsToBB, centsToPoints } from '../../lib/units'
import { gameStore, useGame } from '../../store/useGame'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton } from '../components/Button'
import { NumberField } from '../components/NumberField'

const fr = new Intl.NumberFormat('fr-FR')

export function BuyInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const buyIn = useGame((s) => s.game.defaultBuyInCents)
  const cfg = useGame((s) => s.game.chipConfig)
  const formId = useId()
  const [value, setValue] = useState('')

  // Réinitialisé à chaque ouverture (la sheet n'est pas montée tant qu'elle est fermée).
  useEffect(() => {
    if (open) setValue(centsToInput(buyIn))
  }, [open])

  const cents = parseEuros(value)
  const valid = cents !== null && cents > 0
  const equivalent = cfg && valid ? `= ${fr.format(centsToPoints(cents, cfg))} pts · ${fr.format(centsToBB(cents, cfg))} BB` : undefined

  const submit = (e: Event) => {
    e.preventDefault()
    if (valid && (cents === buyIn || gameStore.getState().setBuyIn(cents))) onClose()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Buy-in par joueur"
      footer={
        <PrimaryButton type="submit" form={formId} disabled={!valid}>
          Valider
        </PrimaryButton>
      }
    >
      <form id={formId} onSubmit={submit}>
        <NumberField
          label="Buy-in par joueur"
          hideLabel
          value={value}
          onInput={setValue}
          unit="€"
          equivalent={equivalent}
          error={value.trim() !== '' && !valid ? 'Montant invalide' : undefined}
        />
      </form>
    </BottomSheet>
  )
}
