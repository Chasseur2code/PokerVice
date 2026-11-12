// Compteur − valeur + (assistant jetons) : entiers bornés, boutons de 44 px.
import { Minus, Plus } from 'lucide-preact'

export interface StepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  /** Texte affiché (ex. « 100 BB ») ; par défaut la valeur. */
  format?: (value: number) => string
}

export function Stepper({ label, value, onChange, min, max, step = 1, format = String }: StepperProps) {
  const btn = 'flex size-11 items-center justify-center rounded-full border border-border-strong bg-bg active:bg-surface-muted disabled:text-text-faint'
  return (
    <div class="flex items-center justify-between gap-3">
      <span class="text-body">{label}</span>
      <div class="flex items-center gap-1">
        <button type="button" class={btn} aria-label={`${label} : moins`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          <Minus size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <output class="num w-20 text-center text-[16px] font-semibold" aria-live="polite">
          {format(value)}
        </output>
        <button type="button" class={btn} aria-label={`${label} : plus`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
