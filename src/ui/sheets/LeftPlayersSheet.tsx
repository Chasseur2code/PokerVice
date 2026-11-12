// Joueurs partis (SPEC §4.4, DESIGN §4.2) : investi, stack de sortie, balance et heure de départ,
// puis « Revenir à la table » avec un nouveau buy-in (par défaut le buy-in commun).
import { useEffect, useId, useState } from 'preact/hooks'
import { summarizePlayers } from '../../lib/derive'
import { MAX_SEATED } from '../../lib/players'
import { amountToInput, formatAmount, formatEquivalent, inputUnitFor, parseAmount } from '../../lib/units'
import { gameStore, useGame } from '../../store/useGame'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton } from '../components/Button'
import { NumberField } from '../components/NumberField'
import { PlayerDot, SignedAmount } from '../components/PlayerDot'
import { showToast } from '../components/Toast'
import { showUndoToast } from '../undo'

const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function LeftPlayersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const game = useGame((s) => s.game)
  const unit = useGame((s) => s.unit)
  const cfg = game.chipConfig
  const formId = useId()
  // Joueur en train de revenir, ou `null` : la liste.
  const [returning, setReturning] = useState<string | null>(null)
  const [value, setValue] = useState('')

  const inputUnit = inputUnitFor(unit, cfg)

  useEffect(() => {
    if (open) setReturning(null)
  }, [open])

  const summaries = summarizePlayers(game)
  let seated = 0
  for (const s of summaries.values()) if (s.status === 'seated') seated += 1
  const left = game.players
    .map((p) => ({ player: p, summary: summaries.get(p.id)! }))
    .filter((x) => x.summary.status === 'left')
    .sort((a, b) => b.summary.leftAt! - a.summary.leftAt!)
  const tableFull = seated >= MAX_SEATED

  const fmt = (c: number, sign = false) => formatAmount(c, unit, cfg, { compact: !sign, sign })
  const back = left.find((x) => x.player.id === returning)

  const startReturn = (id: string) => {
    setValue(amountToInput(game.defaultBuyInCents, inputUnit, cfg))
    setReturning(id)
  }

  const cents = parseAmount(value, inputUnit, cfg)
  const valid = cents !== null && cents > 0

  const submit = (e: Event) => {
    e.preventDefault()
    if (!back || !valid) return
    if (!gameStore.getState().return(back.player.id, cents)) return showToast('Retour impossible : la table est complète.')
    onClose()
    showUndoToast(`${back.player.name} revient à la table (${fmt(cents)})`)
  }

  if (back) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={`${back.player.name} revient`}
        footer={
          <PrimaryButton type="submit" form={formId} disabled={!valid || tableFull}>
            Revenir à la table
          </PrimaryButton>
        }
      >
        <form id={formId} onSubmit={submit}>
          <NumberField
            label="Nouveau buy-in"
            value={value}
            onInput={setValue}
            unit={inputUnit === 'pts' ? 'pts' : '€'}
            equivalent={valid ? formatEquivalent(cents, inputUnit, cfg) : undefined}
            error={tableFull ? `La table est complète (${MAX_SEATED} joueurs).` : value.trim() !== '' && !valid ? 'Montant invalide' : undefined}
          />
        </form>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`${left.length} parti${left.length > 1 ? 's' : ''}`}>
      {left.length === 0 && <p class="pb-4 text-body text-text-muted">Aucun joueur parti.</p>}
      <ul class="flex flex-col divide-y divide-border pb-2">
        {left.map(({ player, summary }) => (
          <li key={player.id} class="flex flex-col gap-2 py-3">
            <div class="flex items-center gap-2">
              <PlayerDot color={player.color} />
              <span class="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
              <SignedAmount cents={summary.balanceCents} text={fmt(summary.balanceCents, true)} />
            </div>
            <p class="num text-[13px] text-text-muted">
              Parti à {timeFmt.format(summary.leftAt!)} · investi {fmt(summary.investedCents)} · sorti avec {fmt(summary.cashedOutCents)}
            </p>
            <button
              type="button"
              disabled={tableFull}
              onClick={() => startReturn(player.id)}
              class="h-11 self-start rounded-full border border-border-strong bg-bg px-4 font-semibold active:bg-surface-muted disabled:text-text-faint"
            >
              Revenir à la table
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
