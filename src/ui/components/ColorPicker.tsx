// Choix de la couleur d'un joueur parmi la palette (DESIGN §2.3) : un groupe de boutons radio.
import { Check } from 'lucide-preact'
import { PLAYER_PALETTE } from '../../lib/players'

export interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  /** Couleurs déjà prises par d'autres joueurs (en majuscules) : choisissables, mais signalées par une pastille creuse. */
  taken?: ReadonlySet<string>
}

export function ColorPicker({ value, onChange, taken }: ColorPickerProps) {
  return (
    <fieldset class="flex flex-col gap-2">
      <legend class="mb-2 text-[13px] text-text-muted">Couleur</legend>
      <div class="grid grid-cols-5 justify-items-center gap-y-1">
        {PLAYER_PALETTE.map(({ color: c, name }) => {
          const selected = c === value.toUpperCase()
          const used = !selected && taken?.has(c)
          return (
            <label key={c} class="flex size-11 cursor-pointer items-center justify-center">
              <input
                type="radio"
                name="player-color"
                value={c}
                checked={selected}
                onChange={() => onChange(c)}
                aria-label={used ? `${name} (déjà prise)` : name}
                class="peer sr-only"
              />
              <span
                class={`flex size-9 items-center justify-center rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text ${
                  selected ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : ''
                }`}
                style={used ? { boxShadow: `inset 0 0 0 4px ${c}` } : { background: c }}
              >
                {selected && <Check size={18} strokeWidth={3} color="#fff" aria-hidden="true" />}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
