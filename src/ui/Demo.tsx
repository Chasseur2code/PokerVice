// Page de démo TEMPORAIRE (étape 5) : montre la table et les composants de base.
// Sera remplacée par les vrais écrans à l'étape 6.
import { useState } from 'preact/hooks'
import { Clock, UserPlus } from 'lucide-preact'
import { formatCents, parseEuros } from '../lib/money'
import { PLAYER_COLORS } from '../lib/players'
import type { Orientation } from '../lib/seats'
import { BottomSheet } from './components/BottomSheet'
import { IconButton, PrimaryButton, SecondaryButton } from './components/Button'
import { NumberField } from './components/NumberField'
import { Table, type SeatSlot } from './components/Table'
import { showToast, ToastHost } from './components/Toast'
import { useOrientation } from './hooks/useOrientation'

const NAMES = ['Hugo', 'Julie', 'Thomas', 'Maximilien', 'Léa', 'Sarah', 'Karim', 'Inès', 'Paul', 'Chloé']
const INVESTED = [2000, 4000, 2000, 6000, 2000, 2000, 4000, 2000, 2000, 8000]

type Mode = 'setup' | 2 | 6 | 10

function demoSeats(mode: Mode, onSeat: (name: string) => void): SeatSlot[] {
  if (mode === 'setup') {
    // 6 sièges vides, celui du bas (index 3) mis en avant.
    return Array.from({ length: 6 }, (_, i) => ({
      kind: 'empty' as const,
      key: `empty-${i}`,
      highlighted: i === 3,
      onClick: () => onSeat('Nouveau joueur'),
    }))
  }
  return Array.from({ length: mode }, (_, i) => {
    const amount = formatCents(INVESTED[i]!, { compact: true })
    return {
      kind: 'player' as const,
      key: `p-${i}`,
      name: NAMES[i]!,
      color: PLAYER_COLORS[i]!,
      amount,
      ariaLabel: `${NAMES[i]}, ${amount} investis`,
      onClick: () => onSeat(NAMES[i]!),
    }
  })
}

export function Demo() {
  const auto = useOrientation()
  const [forced, setForced] = useState<Orientation | null>(null)
  const orientation = forced ?? auto
  const [mode, setMode] = useState<Mode>(6)
  const [sheet, setSheet] = useState<string | null>(null)
  const [full, setFull] = useState(false)
  const [value, setValue] = useState('20')

  const cents = parseEuros(value)
  // Démo d'équivalence avec 1 pt = 0,01 € et BB = 20 pts.
  const equivalent = cents === null ? undefined : `= ${cents.toLocaleString('fr-FR')} pts · ${cents / 20} BB`

  const center =
    mode === 'setup' ? (
      <>
        <p class="font-display text-felt-title font-semibold">Installez vos joueurs</p>
        <p class="text-body text-white/86">Touchez un siège + pour ajouter quelqu'un. 2 joueurs minimum.</p>
      </>
    ) : (
      <>
        <p class="text-caps font-semibold uppercase text-on-felt-muted">Big blind</p>
        <p class="num font-display text-felt-big font-bold">0,20 €</p>
      </>
    )

  const segment = (active: boolean) =>
    `h-[34px] flex-1 rounded-seg-item px-2 text-[13px] ${active ? 'bg-surface font-bold shadow-card' : 'text-text-muted'}`

  return (
    <main
      class={`mx-auto flex min-h-dvh flex-col gap-2.5 px-4 pt-3 pb-5 ${
        orientation === 'landscape' ? 'max-w-5xl' : 'max-w-md'
      }`}
    >
      <header class="flex h-10 items-center justify-between">
        <h1 class="font-display text-logo font-bold">
          Poker<span class="text-brand-green">Vice</span>
        </h1>
        <span class="text-[13px] text-text-muted">Démo étape 5</span>
      </header>

      <div class="flex gap-1 rounded-seg bg-surface-muted p-[5px]">
        {(['setup', 2, 6, 10] as const).map((m) => (
          <button type="button" key={m} class={segment(mode === m)} onClick={() => setMode(m)}>
            {m === 'setup' ? 'Vide' : `${m} joueurs`}
          </button>
        ))}
      </div>
      <div class="flex gap-1 rounded-seg bg-surface-muted p-[5px]">
        {([null, 'portrait', 'landscape'] as const).map((o) => (
          <button type="button" key={String(o)} class={segment(forced === o)} onClick={() => setForced(o)}>
            {o === null ? `Auto (${auto === 'portrait' ? 'portrait' : 'paysage'})` : o === 'portrait' ? 'Portrait' : 'Paysage'}
          </button>
        ))}
      </div>

      <div
        class="mx-auto w-full"
        style={orientation === 'landscape' ? { maxWidth: 'min(100%, calc((100dvh - 230px) * 460 / 358))' } : undefined}
      >
        <Table seats={demoSeats(mode, setSheet)} orientation={orientation} center={center} />
      </div>
      {mode === 'setup' && <p class="text-center text-body font-semibold text-accent-text">Commencez ici</p>}

      <div class="mt-auto flex flex-col gap-2.5 pt-2">
        <SecondaryButton
          onClick={() => {
            setFull(true)
            setSheet('Historique')
          }}
        >
          Sheet plein écran
        </SecondaryButton>
        <div class="flex gap-2.5">
          <IconButton label="Ajouter un joueur" onClick={() => setSheet('Nouveau joueur')}>
            <UserPlus size={22} aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Historique"
            onClick={() =>
              showToast(
                <>
                  Recave de Hugo : <strong class="num">+20 €</strong>
                </>,
                { label: 'Annuler', onClick: () => showToast('Recave annulée') },
              )
            }
          >
            <Clock size={22} aria-hidden="true" />
          </IconButton>
          <PrimaryButton class="flex-1" onClick={() => setSheet('Recave')}>
            Terminer la partie
          </PrimaryButton>
        </div>
      </div>

      <BottomSheet
        open={sheet !== null}
        onClose={() => {
          setSheet(null)
          setFull(false)
        }}
        title={sheet ?? ''}
        full={full}
        footer={
          <PrimaryButton
            disabled={cents === null || cents <= 0}
            onClick={() => {
              setSheet(null)
              setFull(false)
              if (cents !== null) showToast(`${formatCents(cents)} enregistrés`, { label: 'Annuler', onClick: () => {} })
            }}
          >
            Valider
          </PrimaryButton>
        }
      >
        <NumberField
          label="Montant"
          hideLabel
          value={value}
          onInput={setValue}
          unit="€"
          equivalent={equivalent}
          error={value !== '' && cents === null ? 'Montant invalide' : undefined}
        />
      </BottomSheet>

      <ToastHost />
    </main>
  )
}
