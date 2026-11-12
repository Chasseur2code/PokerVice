// Menu joueur en partie (SPEC §4.3, DESIGN §5) : tap sur un siège occupé.
// Une seule sheet, trois vues : le menu, la recave (pilule « +1 buy-in » présélectionnée)
// et le départ (stack de sortie, avec la balance qui en résulte).
import { useEffect, useId, useState } from 'preact/hooks'
import { summarizePlayers } from '../../lib/derive'
import { amountToInput, formatAmount, formatEquivalent, inputUnitFor, parseAmount } from '../../lib/units'
import { gameStore, useGame } from '../../store/useGame'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { NumberField } from '../components/NumberField'
import { PlayerDot, SignedAmount } from '../components/PlayerDot'
import { showToast } from '../components/Toast'
import { showUndoToast } from '../undo'

type View = 'menu' | 'rebuy' | 'leave'

export interface PlayerMenuSheetProps {
  open: boolean
  onClose: () => void
  /** Garder la valeur pendant la fermeture (animation de sortie). */
  playerId: string | null
  /** « Renommer » / « Changer de couleur » : ouvre la sheet de modification du joueur. */
  onEdit: (playerId: string) => void
}

export function PlayerMenuSheet({ open, onClose, playerId, onEdit }: PlayerMenuSheetProps) {
  const game = useGame((s) => s.game)
  const unit = useGame((s) => s.unit)
  const cfg = game.chipConfig
  const player = game.players.find((p) => p.id === playerId)
  const summary = player ? summarizePlayers(game).get(player.id) : undefined
  const hasEvents = !!player && game.events.some((e) => e.playerId === player.id)

  const formId = useId()
  const [view, setView] = useState<View>('menu')
  const [value, setValue] = useState('')

  const inputUnit = inputUnitFor(unit, cfg)
  const unitLabel = inputUnit === 'pts' ? 'pts' : '€'
  const buyIn = game.defaultBuyInCents

  useEffect(() => {
    if (open) setView('menu')
  }, [open])

  const go = (next: View) => {
    setValue(next === 'rebuy' ? amountToInput(buyIn, inputUnit, cfg) : '')
    setView(next)
  }

  if (!player || !summary) return <BottomSheet open={open} onClose={onClose} title="" />

  const cents = parseAmount(value, inputUnit, cfg)
  const valid = cents !== null && (view === 'leave' ? cents >= 0 : cents > 0)
  const fmt = (c: number, sign = false) => formatAmount(c, unit, cfg, { compact: !sign, sign })

  const submit = (e: Event) => {
    e.preventDefault()
    if (!valid) return
    const store = gameStore.getState()
    if (view === 'rebuy') {
      if (!store.rebuy(player.id, cents)) return showToast('Recave impossible.')
      onClose()
      showUndoToast(`Recave de ${player.name} : ${fmt(cents)}`)
    } else if (view === 'leave') {
      if (!store.leave(player.id, cents)) return showToast('Départ impossible.')
      const balance = cents - summary.investedCents
      onClose()
      showUndoToast(
        <>
          {player.name} : <SignedAmount cents={balance} text={fmt(balance, true)} onDark />
        </>,
      )
    }
  }

  const remove = () => {
    if (!gameStore.getState().deletePlayer(player.id)) return
    onClose()
    showUndoToast(`${player.name} retiré de la table`)
  }

  const title = (
    <span class="flex min-w-0 items-center gap-2">
      <PlayerDot color={player.color} size={14} />
      <span class="truncate">
        {view === 'rebuy' ? `Recave · ${player.name}` : view === 'leave' ? `${player.name} quitte la table` : player.name}
      </span>
    </span>
  )

  const footer =
    view === 'menu' ? (
      <PrimaryButton onClick={() => go('rebuy')}>Recave</PrimaryButton>
    ) : (
      <PrimaryButton type="submit" form={formId} disabled={!valid}>
        {view === 'rebuy' ? 'Valider la recave' : 'Quitter la table'}
      </PrimaryButton>
    )

  const error = value.trim() !== '' && !valid ? 'Montant invalide' : undefined
  const rebuys = summary.rebuys

  return (
    <BottomSheet open={open} onClose={onClose} title={title} footer={footer}>
      {view === 'menu' && (
        <div class="flex flex-col pb-1">
          <p class="num pb-3 text-body text-text-muted">
            Investi : <span class="font-semibold text-text">{fmt(summary.investedCents)}</span>
            {rebuys > 0 && ` · ${rebuys} recave${rebuys > 1 ? 's' : ''}`}
          </p>
          <SecondaryButton onClick={() => go('leave')}>Quitter la table</SecondaryButton>
          <div class="mt-2 flex flex-col divide-y divide-border">
            <MenuRow onClick={() => onEdit(player.id)}>Renommer</MenuRow>
            <MenuRow onClick={() => onEdit(player.id)}>Changer de couleur</MenuRow>
            {!hasEvents && (
              <MenuRow onClick={remove} danger>
                Supprimer le joueur
              </MenuRow>
            )}
          </div>
        </div>
      )}

      {view === 'rebuy' && (
        <form id={formId} onSubmit={submit} class="flex flex-col items-center gap-2">
          <button
            type="button"
            aria-pressed={cents === buyIn}
            onClick={() => setValue(amountToInput(buyIn, inputUnit, cfg))}
            class={`num h-11 rounded-full border px-4 font-semibold ${
              cents === buyIn ? 'border-accent bg-accent text-on-accent' : 'border-border-strong bg-bg text-text'
            }`}
          >
            +1 buy-in ({fmt(buyIn)})
          </button>
          <NumberField
            label="Montant de la recave"
            hideLabel
            value={value}
            onInput={setValue}
            unit={unitLabel}
            equivalent={valid ? formatEquivalent(cents, inputUnit, cfg) : undefined}
            error={error}
          />
        </form>
      )}

      {view === 'leave' && (
        <form id={formId} onSubmit={submit} class="flex flex-col">
          <NumberField
            label="Stack de sortie"
            value={value}
            onInput={setValue}
            unit={unitLabel}
            equivalent={valid ? formatEquivalent(cents, inputUnit, cfg) : undefined}
            error={error}
          />
          <p class="num text-center text-body text-text-muted">
            Investi {fmt(summary.investedCents)}
            {valid && (
              <>
                {' · Balance '}
                <SignedAmount cents={cents - summary.investedCents} text={fmt(cents - summary.investedCents, true)} />
              </>
            )}
          </p>
        </form>
      )}
    </BottomSheet>
  )
}

function MenuRow({ onClick, danger = false, children }: { onClick: () => void; danger?: boolean; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      class={`flex h-12 items-center text-left text-[15px] font-semibold active:bg-bg ${danger ? 'text-loss' : 'text-text'}`}
    >
      {children}
    </button>
  )
}
