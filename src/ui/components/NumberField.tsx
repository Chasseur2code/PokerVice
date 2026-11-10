// Grand champ numérique des sheets (DESIGN §5) : Fraunces 34 centré, unité à droite,
// équivalence dans l'autre unité en dessous. Le champ reste textuel : l'appelant analyse
// la saisie avec parseAmount (lib/units), sans jamais passer par un flottant.
import { useEffect, useId, useRef } from 'preact/hooks'

export interface NumberFieldProps {
  label: string
  /** Libellé visible au-dessus du champ, ou seulement pour les lecteurs d'écran. */
  hideLabel?: boolean
  value: string
  onInput: (value: string) => void
  /** « € » ou « pts ». */
  unit: string
  /** Ex. « = 2 000 pts · 100 BB » ; rien si aucune configuration jetons. */
  equivalent?: string
  /** Message d'erreur (saisie invalide). */
  error?: string
  autoFocus?: boolean
  placeholder?: string
}

export function NumberField({
  label,
  hideLabel = false,
  value,
  onInput,
  unit,
  equivalent,
  error,
  autoFocus = true,
  placeholder = '0',
}: NumberFieldProps) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true })
  }, [autoFocus])

  return (
    <div class="flex flex-col items-center gap-1 py-2">
      <label for={id} class={hideLabel ? 'sr-only' : 'text-[13px] text-text-muted'}>
        {label}
      </label>
      <div class="flex w-full items-baseline justify-center gap-2 border-b-2 border-border-strong px-2 focus-within:border-accent">
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder={placeholder}
          value={value}
          onInput={(e) => onInput(e.currentTarget.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
          class="num min-w-0 flex-1 bg-transparent py-1 text-center font-display text-hero font-bold outline-none placeholder:text-text-faint"
        />
        <span class="font-display text-[22px] font-semibold text-text-muted">{unit}</span>
      </div>
      <p id={`${id}-hint`} class={`num min-h-5 text-[13px] ${error ? 'text-loss' : 'text-text-muted'}`}>
        {error ?? equivalent ?? ''}
      </p>
    </div>
  )
}
