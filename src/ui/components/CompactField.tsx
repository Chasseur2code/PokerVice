// Petit champ de saisie (convertisseur, assistant jetons) : libellé, texte brut, suffixe d'unité.
// Comme NumberField, il reste textuel : l'appelant analyse la saisie (parseCount, parseEuros…).
import { useId } from 'preact/hooks'
import { selectOnFocus } from '../selectOnFocus'

export interface CompactFieldProps {
  label: string
  /** Libellé seulement pour les lecteurs d'écran (lignes de tableau). */
  hideLabel?: boolean
  value: string
  onInput: (value: string) => void
  suffix?: string
  /** `numeric` pour un entier (pas de virgule sur le clavier). */
  inputMode?: 'decimal' | 'numeric' | 'text'
  invalid?: boolean
  placeholder?: string
  class?: string
}

export function CompactField({
  label,
  hideLabel = false,
  value,
  onInput,
  suffix,
  inputMode = 'decimal',
  invalid = false,
  placeholder,
  class: cls = '',
}: CompactFieldProps) {
  const id = useId()
  return (
    <div class={`flex min-w-0 flex-col gap-1 ${cls}`}>
      <label for={id} class={hideLabel ? 'sr-only' : 'text-[13px] text-text-muted'}>
        {label}
      </label>
      <div
        class={`flex h-11 items-center gap-1.5 rounded-btn border bg-bg px-3 focus-within:border-accent ${
          invalid ? 'border-loss' : 'border-border-strong'
        }`}
      >
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          enterKeyHint="done"
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onInput={(e) => onInput(e.currentTarget.value)}
          onFocus={inputMode === 'text' ? undefined : selectOnFocus}
          class={`num w-full min-w-0 bg-transparent text-[16px] outline-none placeholder:text-text-faint ${inputMode === 'text' ? '' : 'text-right'}`}
        />
        {suffix && <span class="shrink-0 text-body text-text-muted">{suffix}</span>}
      </div>
    </div>
  )
}
