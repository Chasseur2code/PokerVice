// Sheet « Nouveau joueur » (DESIGN §4.1) : prénom (focus automatique) et couleur proposée ;
// en cours de partie, s'y ajoute le buy-in du nouveau venu (par défaut le buy-in commun).
// Avec un `playerId`, la même sheet corrige le prénom ou la couleur, ou supprime le joueur
// (seulement s'il n'a aucune transaction : en préparation, c'est toujours le cas).
import type { RefObject } from 'preact'
import { useEffect, useId, useRef, useState } from 'preact/hooks'
import { nextPlayerColor } from '../../lib/players'
import { amountToInput, formatAmount, formatEquivalent, inputUnitFor, parseAmount } from '../../lib/units'
import { gameStore, useGame } from '../../store/useGame'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton } from '../components/Button'
import { ColorPicker } from '../components/ColorPicker'
import { NumberField } from '../components/NumberField'
import { showToast } from '../components/Toast'
import { showUndoToast } from '../undo'

const MAX_NAME = 24

export interface PlayerSheetProps {
  open: boolean
  onClose: () => void
  /** `null` : nouveau joueur. Garder la valeur pendant la fermeture (animation de sortie). */
  playerId: string | null
}

export function PlayerSheet({ open, onClose, playerId }: PlayerSheetProps) {
  const players = useGame((s) => s.game.players)
  const hasEvents = useGame((s) => playerId !== null && s.game.events.some((e) => e.playerId === playerId))
  const running = useGame((s) => s.game.status === 'running')
  const defaultBuyIn = useGame((s) => s.game.defaultBuyInCents)
  const cfg = useGame((s) => s.game.chipConfig)
  const unit = useGame((s) => s.unit)
  const player = playerId === null ? undefined : players.find((p) => p.id === playerId)
  const inputUnit = inputUnitFor(unit, cfg)
  // Buy-in demandé seulement pour un nouveau joueur qui arrive en cours de partie.
  const askBuyIn = running && playerId === null

  const formId = useId()
  const nameInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [color, setColorValue] = useState('')
  const [buyIn, setBuyIn] = useState('')

  useEffect(() => {
    if (!open) return
    setName(player?.name ?? '')
    setColorValue(player?.color ?? nextPlayerColor(players))
    setBuyIn(amountToInput(defaultBuyIn, inputUnit, cfg))
  }, [open])

  const taken = new Set(players.filter((p) => p.id !== playerId).map((p) => p.color.toUpperCase()))
  const trimmed = name.trim()
  const buyInCents = parseAmount(buyIn, inputUnit, cfg)
  const buyInValid = !askBuyIn || (buyInCents !== null && buyInCents > 0)

  const submit = (e: Event) => {
    e.preventDefault()
    if (!trimmed || !buyInValid) return
    const { addPlayer, updatePlayer } = gameStore.getState()
    const changed = !!player && (trimmed !== player.name || color !== player.color)
    const ok =
      playerId === null
        ? addPlayer(trimmed, { color, buyInCents: askBuyIn ? buyInCents! : undefined }) !== null
        : !!player && updatePlayer(player.id, { name: trimmed, color })
    if (!ok) {
      showToast(playerId === null ? "Impossible d'ajouter ce joueur : la table est complète." : 'Impossible de modifier ce joueur.')
      return
    }
    onClose()
    // En partie, chaque action peut s'annuler (SPEC §7) ; en préparation, la table suffit comme retour.
    if (running && playerId === null) showUndoToast(`${trimmed} rejoint la table (${formatAmount(buyInCents!, unit, cfg, { compact: true })})`)
    else if (running && changed) showUndoToast(`${trimmed} modifié`)
  }

  const remove = () => {
    if (!player || !gameStore.getState().deletePlayer(player.id)) return
    onClose()
    showUndoToast(`${player.name} retiré de la table`)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={playerId === null ? 'Nouveau joueur' : 'Modifier le joueur'}
      initialFocus={nameInput}
      footer={
        <PrimaryButton type="submit" form={formId} disabled={!trimmed || !buyInValid}>
          {playerId === null ? 'Ajouter' : 'Enregistrer'}
        </PrimaryButton>
      }
    >
      <form id={formId} onSubmit={submit} class="flex flex-col gap-5 pb-1">
        <NameField inputRef={nameInput} value={name} onInput={setName} />
        <ColorPicker value={color} onChange={setColorValue} taken={taken} />
        {askBuyIn && (
          <NumberField
            label="Buy-in"
            value={buyIn}
            onInput={setBuyIn}
            unit={inputUnit === 'pts' ? 'pts' : '€'}
            autoFocus={false}
            equivalent={buyInCents !== null && buyInCents > 0 ? formatEquivalent(buyInCents, inputUnit, cfg) : undefined}
            error={buyIn.trim() !== '' && !buyInValid ? 'Montant invalide' : undefined}
          />
        )}
        {player && !hasEvents && (
          <button type="button" onClick={remove} class="h-11 self-start font-semibold text-loss">
            Supprimer le joueur
          </button>
        )}
      </form>
    </BottomSheet>
  )
}

/** Champ prénom ; la sheet le focalise à l'ouverture via `initialFocus`. */
function NameField({ inputRef, value, onInput }: { inputRef: RefObject<HTMLInputElement | null>; value: string; onInput: (v: string) => void }) {
  const id = useId()

  return (
    <div class="flex flex-col gap-1.5">
      <label for={id} class="text-[13px] text-text-muted">
        Prénom
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onInput={(e) => onInput(e.currentTarget.value)}
        maxLength={MAX_NAME}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="done"
        class="h-12 rounded-btn border border-border-strong bg-bg px-3 text-[16px] outline-none focus:border-accent"
      />
    </div>
  )
}
