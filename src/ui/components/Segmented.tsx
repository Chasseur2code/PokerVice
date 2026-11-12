// Bascule segmentée (DESIGN §4.2) : conteneur `--surface-muted`, segment actif `--surface` en gras.
// Segments de 34 px ; le padding du conteneur porte la zone tactile à 44 px.

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Nom lu par les lecteurs d'écran, si le libellé visible est une abréviation. */
  ariaLabel?: string
}

export interface SegmentedProps<T extends string> {
  /** Nom du groupe pour les lecteurs d'écran. */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} class="flex shrink-0 rounded-seg bg-surface-muted p-[5px]">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            class={`h-[34px] min-w-10 rounded-seg-item px-2.5 text-body ${
              active ? 'bg-surface font-bold text-text shadow-[0_1px_3px_rgba(60,40,20,0.18)]' : 'font-medium text-text-muted'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
