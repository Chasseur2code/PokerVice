// Historique de la partie (SPEC §7, DESIGN §5) : liste antichronologique en plein écran.
// Un tap sur une ligne propose « Modifier » (le montant) ou « Supprimer » (avec confirmation) ;
// balances et stats se recalculent seules, puisqu'elles sont dérivées des événements.
import { ArrowLeft } from 'lucide-preact'
import { useEffect, useId, useState } from 'preact/hooks'
import { MAX_SEATED } from '../../lib/players'
import { amountToInput, formatAmount, formatEquivalent, inputUnitFor, parseAmountKeeping } from '../../lib/units'
import type { GameEvent, GameEventType } from '../../lib/types'
import { gameStore, useGame } from '../../store/useGame'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { NumberField } from '../components/NumberField'
import { PlayerDot } from '../components/PlayerDot'
import { showToast } from '../components/Toast'
import { showUndoToast } from '../undo'

export const EVENT_LABELS: Record<GameEventType, string> = {
  buyin: 'Buy-in',
  rebuy: 'Recave',
  leave: 'Départ',
  return: 'Retour',
  final: 'Stack final',
}

/** « la recave », « le départ »… pour les phrases de confirmation. */
const EVENT_ARTICLES: Record<GameEventType, string> = {
  buyin: 'le buy-in',
  rebuy: 'la recave',
  leave: 'le départ',
  return: 'le retour',
  final: 'le stack final',
}

const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

type Mode = 'detail' | 'edit' | 'delete'

export function HistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const game = useGame((s) => s.game)
  const unit = useGame((s) => s.unit)
  const cfg = game.chipConfig
  const formId = useId()
  const [selected, setSelected] = useState<{ id: string; mode: Mode } | null>(null)
  const [value, setValue] = useState('')

  const inputUnit = inputUnitFor(unit, cfg)

  useEffect(() => {
    if (open) setSelected(null)
  }, [open])

  const players = new Map(game.players.map((p) => [p.id, p]))
  const fmt = (c: number) => formatAmount(c, unit, cfg, { compact: true })
  const ev = selected && game.events.find((e) => e.id === selected.id)

  // Liste
  if (!ev || !selected) {
    const events = [...game.events].reverse()
    return (
      <BottomSheet open={open} onClose={onClose} title="Historique" full>
        {events.length === 0 && <p class="text-body text-text-muted">Aucune action pour l'instant.</p>}
        <ul class="flex flex-col divide-y divide-border pb-2">
          {events.map((e) => (
            <li key={e.id}>
              <EventRow ev={e} player={players.get(e.playerId)} amount={fmt(e.amountCents)} onClick={() => setSelected({ id: e.id, mode: 'detail' })} />
            </li>
          ))}
        </ul>
      </BottomSheet>
    )
  }

  const player = players.get(ev.playerId)
  const name = player?.name ?? 'Joueur supprimé'
  const cents = parseAmountKeeping(value, inputUnit, cfg, ev.amountCents)
  const valid = cents !== null && (ev.type === 'leave' ? cents >= 0 : cents > 0)
  const toList = () => setSelected(null)

  const startEdit = () => {
    setValue(amountToInput(ev.amountCents, inputUnit, cfg))
    setSelected({ id: ev.id, mode: 'edit' })
  }

  const save = (e: Event) => {
    e.preventDefault()
    if (!valid) return
    if (cents !== ev.amountCents && !gameStore.getState().editEvent(ev.id, { amountCents: cents })) {
      return showToast('Modification impossible.')
    }
    toList()
    if (cents !== ev.amountCents) showUndoToast(`${EVENT_LABELS[ev.type]} de ${name} : ${fmt(cents)}`)
  }

  const remove = () => {
    if (!gameStore.getState().deleteEvent(ev.id)) {
      return showToast(`Suppression impossible : la table dépasserait ${MAX_SEATED} joueurs.`)
    }
    toList()
    showUndoToast(`${EVENT_LABELS[ev.type]} de ${name} supprimé${ev.type === 'rebuy' ? 'e' : ''}`)
  }

  const footer =
    selected.mode === 'edit' ? (
      <PrimaryButton type="submit" form={formId} disabled={!valid}>
        Enregistrer
      </PrimaryButton>
    ) : selected.mode === 'delete' ? (
      <button
        type="button"
        onClick={remove}
        class="flex h-14 w-full items-center justify-center rounded-btn bg-loss px-4 text-btn font-bold text-on-loss active:brightness-95"
      >
        Supprimer
      </button>
    ) : undefined

  return (
    <BottomSheet open={open} onClose={onClose} title="Historique" full footer={footer}>
      <button type="button" onClick={toList} class="-ml-1 mb-2 flex h-11 items-center gap-1.5 px-1 font-semibold text-text-muted">
        <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
        Retour à la liste
      </button>
      <div class="rounded-card bg-bg px-3">
        <EventRow ev={ev} player={player} amount={fmt(ev.amountCents)} />
      </div>

      {selected.mode === 'detail' && (
        <div class="flex flex-col gap-2.5 pt-4">
          <SecondaryButton onClick={startEdit}>Modifier le montant</SecondaryButton>
          <SecondaryButton onClick={() => setSelected({ id: ev.id, mode: 'delete' })} class="text-loss">
            Supprimer
          </SecondaryButton>
        </div>
      )}

      {selected.mode === 'edit' && (
        <form id={formId} onSubmit={save} class="pt-3">
          <NumberField
            label={ev.type === 'leave' ? 'Stack de sortie' : 'Montant'}
            value={value}
            onInput={setValue}
            unit={inputUnit === 'pts' ? 'pts' : '€'}
            equivalent={valid ? formatEquivalent(cents, inputUnit, cfg) : undefined}
            error={value.trim() !== '' && !valid ? 'Montant invalide' : undefined}
          />
        </form>
      )}

      {selected.mode === 'delete' && (
        <p class="pt-4 text-[15px]">
          Supprimer {EVENT_ARTICLES[ev.type]} de <strong>{name}</strong> ? Les balances seront recalculées.
          {ev.type === 'leave' && ' Le joueur reviendra à la table.'}
          {ev.type === 'return' && ' Le joueur repassera dans les partis.'}
        </p>
      )}
    </BottomSheet>
  )
}

export interface EventRowProps {
  ev: GameEvent
  player: { name: string; color: string } | undefined
  amount: string
  onClick?: () => void
}

export function EventRow({ ev, player, amount, onClick }: EventRowProps) {
  const content = (
    <>
      <span class="num w-11 shrink-0 text-[13px] text-text-muted">{timeFmt.format(ev.at)}</span>
      <PlayerDot color={player?.color ?? 'transparent'} />
      <span class="min-w-0 flex-1 truncate">
        <span class="font-semibold">{player?.name ?? 'Joueur supprimé'}</span>
        <span class="text-text-muted"> · {EVENT_LABELS[ev.type]}</span>
      </span>
      <span class="num shrink-0 font-bold">{amount}</span>
    </>
  )
  if (!onClick) return <div class="flex min-h-12 items-center gap-2.5 py-2">{content}</div>
  return (
    <button type="button" onClick={onClick} class="flex min-h-12 w-full items-center gap-2.5 py-2 text-left active:bg-bg">
      {content}
    </button>
  )
}
