// Sheet « Nouveau joueur » (DESIGN §4.1) : prénom (focus automatique) et couleur proposée.
// Avec un `playerId`, la même sheet corrige le prénom ou la couleur, ou supprime le joueur
// (seulement s'il n'a aucune transaction : en préparation, c'est toujours le cas).
import { useEffect, useId, useRef, useState } from 'preact/hooks'
import { nextPlayerColor } from '../../lib/players'
import { gameStore, useGame } from '../../store/useGame'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton } from '../components/Button'
import { ColorPicker } from '../components/ColorPicker'
import { showToast } from '../components/Toast'

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
  const player = playerId === null ? undefined : players.find((p) => p.id === playerId)

  const formId = useId()
  const [name, setName] = useState('')
  const [color, setColorValue] = useState('')

  useEffect(() => {
    if (!open) return
    setName(player?.name ?? '')
    setColorValue(player?.color ?? nextPlayerColor(players))
  }, [open])

  const taken = new Set(players.filter((p) => p.id !== playerId).map((p) => p.color.toUpperCase()))
  const trimmed = name.trim()

  const { addPlayer, renamePlayer, setColor, deletePlayer, undo } = gameStore.getState()

  const submit = (e: Event) => {
    e.preventDefault()
    if (!trimmed) return
    if (playerId === null) {
      if (addPlayer(trimmed, { color }) === null) return
    } else if (player) {
      if (trimmed !== player.name) renamePlayer(player.id, trimmed)
      if (color !== player.color) setColor(player.id, color)
    }
    onClose()
  }

  const remove = () => {
    if (!player || !deletePlayer(player.id)) return
    onClose()
    showToast(`${player.name} retiré de la table`, { label: 'Annuler', onClick: undo })
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={playerId === null ? 'Nouveau joueur' : 'Modifier le joueur'}
      footer={
        <PrimaryButton type="submit" form={formId} disabled={!trimmed}>
          {playerId === null ? 'Ajouter' : 'Enregistrer'}
        </PrimaryButton>
      }
    >
      <form id={formId} onSubmit={submit} class="flex flex-col gap-5 pb-1">
        <NameField value={name} onInput={setName} />
        <ColorPicker value={color} onChange={setColorValue} taken={taken} />
        {player && !hasEvents && (
          <button type="button" onClick={remove} class="h-11 self-start font-semibold text-loss">
            Supprimer le joueur
          </button>
        )}
      </form>
    </BottomSheet>
  )
}

/** Champ prénom, focalisé dès qu'il est monté (donc à chaque ouverture de la sheet). */
function NameField({ value, onInput }: { value: string; onInput: (v: string) => void }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus({ preventScroll: true }), [])

  return (
    <div class="flex flex-col gap-1.5">
      <label for={id} class="text-[13px] text-text-muted">
        Prénom
      </label>
      <input
        ref={input}
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
