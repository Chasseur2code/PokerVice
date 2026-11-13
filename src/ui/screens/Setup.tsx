// Écran de préparation, avant « Démarrer » (DESIGN §4.1, SPEC §4.0) : buy-in commun,
// joueurs installés autour de la table, lien vers l'aide jetons, bouton « Démarrer la partie ».
// Aucune stat ici : elles vaudraient toutes zéro.
import { Pencil } from 'lucide-preact'
import { useState } from 'preact/hooks'
import { formatCents } from '../../lib/money'
import { MIN_PLAYERS_TO_START } from '../../lib/players'
import { emptySeatCount, fromBottom } from '../../lib/seats'
import { gameStore, useGame } from '../../store/useGame'
import { PrimaryButton } from '../components/Button'
import { Header } from '../components/Header'
import { Table, type SeatSlot } from '../components/Table'
import { TableCenterAmount } from '../components/TableCenter'
import { UnitToggle } from '../components/UnitToggle'
import { useOrientation } from '../hooks/useOrientation'
import { BuyInSheet } from '../sheets/BuyInSheet'
import { ChipAssistantSheet } from '../sheets/ChipAssistantSheet'
import { ChipHelpSheet } from '../sheets/ChipHelpSheet'
import { ConverterSheet } from '../sheets/ConverterSheet'
import { PlayerSheet } from '../sheets/PlayerSheet'
import { openKeyboard } from '../keyboard'

type Sheet = 'buyIn' | 'player' | 'chipHelp' | 'assistant' | 'converter' | null

/**
 * Hauteur prise en portrait par tout ce qui n'est pas la table (en-tête, carte buy-in,
 * « Commencez ici », lien, bouton, marges) : la table rétrécit pour que le bouton reste visible.
 */
const PORTRAIT_CHROME = '330px'
const SAFE_Y = 'env(safe-area-inset-top) - env(safe-area-inset-bottom)'

export function Setup() {
  const orientation = useOrientation()
  const players = useGame((s) => s.game.players)
  const buyIn = useGame((s) => s.game.defaultBuyInCents)
  const cfg = useGame((s) => s.game.chipConfig)
  const unit = useGame((s) => s.unit)

  const [sheet, setSheet] = useState<Sheet>(null)
  // Gardé après la fermeture pour que la sheet ne change pas de titre pendant son animation de sortie.
  const [playerId, setPlayerId] = useState<string | null>(null)
  // « Non, juste convertir » : le lien devient « Convertisseur jetons ↔ € » (non persisté, simple préférence d'affichage).
  const [converterChosen, setConverterChosen] = useState(false)

  const close = () => setSheet(null)
  const openPlayer = (id: string | null) => {
    // Pendant le tap : le clavier s'ouvre tout de suite pour le prénom.
    openKeyboard()
    setPlayerId(id)
    setSheet('player')
  }

  const openAssistant = () => setSheet('assistant')
  const openConverter = () => {
    setConverterChosen(true)
    setSheet('converter')
  }

  const seated = [...players].sort((a, b) => a.seatOrder - b.seatOrder)
  const slots: SeatSlot[] = [
    ...seated.map((p): SeatSlot => ({
      kind: 'player',
      key: p.id,
      name: p.name,
      color: p.color,
      ariaLabel: `${p.name}, modifier`,
      onClick: () => openPlayer(p.id),
    })),
    ...Array.from({ length: emptySeatCount(seated.length) }, (_, j): SeatSlot => ({
      kind: 'empty',
      key: `empty-${j}`,
      // Mis en avant tant qu'il manque des joueurs : le siège du bas, puis le suivant.
      highlighted: j === 0 && seated.length < MIN_PLAYERS_TO_START,
      onClick: () => openPlayer(null),
    })),
  ]

  const center =
    seated.length === 0 ? (
      <>
        <p class="font-display text-felt-title font-semibold">Installez vos joueurs</p>
        <p class="text-body text-white/86">Touchez un siège + pour ajouter quelqu'un. 2 joueurs minimum.</p>
      </>
    ) : seated.length < MIN_PLAYERS_TO_START ? (
      <p class="font-display text-felt-title font-semibold">
        Encore {MIN_PLAYERS_TO_START - seated.length} joueur{MIN_PLAYERS_TO_START - seated.length > 1 ? 's' : ''}
      </p>
    ) : (
      <TableCenterAmount buyInCents={buyIn} cfg={cfg} unit={unit} />
    )

  const chipLabel =
    cfg?.mode === 'assistant'
      ? 'Répartition des jetons'
      : converterChosen || cfg?.mode === 'converter'
        ? 'Convertisseur jetons ↔ €'
        : "Besoin d'aide pour les jetons ?"
  const onChipLink =
    cfg?.mode === 'assistant'
      ? openAssistant
      : converterChosen || cfg?.mode === 'converter'
        ? openConverter
        : () => setSheet('chipHelp')

  const landscape = orientation === 'landscape'

  const buyInCard = (
    <section class="flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3.5 shadow-card">
      <div>
        <p class="text-[13px] text-text-muted">Buy-in par joueur</p>
        <p class="num font-display text-buyin font-bold">{formatCents(buyIn, { compact: true })}</p>
      </div>
      <button
        type="button"
        onClick={() => setSheet('buyIn')}
        class="flex h-11 items-center gap-1.5 rounded-full border border-border-strong bg-bg px-4 font-semibold active:bg-surface-muted"
      >
        <Pencil size={16} strokeWidth={2} aria-hidden="true" />
        Modifier
      </button>
    </section>
  )

  const table = (
    <div
      class="mx-auto w-full"
      style={{
        maxWidth: landscape
          ? `min(100%, calc((100dvh - 64px - ${SAFE_Y}) * 460 / 358))`
          : `min(100%, max(240px, calc((100dvh - ${PORTRAIT_CHROME} - ${SAFE_Y}) * 358 / 460)))`,
      }}
    >
      <Table seats={fromBottom(slots)} orientation={orientation} center={center} onSwap={(a, b) => gameStore.getState().reorderSeats([b, a])} />
    </div>
  )

  const startHere = seated.length === 0 && (
    <p class="text-center text-body font-semibold text-accent-text">Commencez ici</p>
  )

  const actions = (
    <div class="mt-auto flex flex-col items-center gap-2.5 pt-1">
      <button type="button" onClick={onChipLink} class="h-11 px-2 text-body text-text-muted underline underline-offset-2">
        {chipLabel}
      </button>
      <PrimaryButton disabled={seated.length < MIN_PLAYERS_TO_START} onClick={() => gameStore.getState().start()}>
        Démarrer la partie
      </PrimaryButton>
    </div>
  )

  return (
    <main
      class={`mx-auto min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] px-4 pt-3 pb-5 ${
        landscape ? 'grid max-w-5xl grid-cols-[280px_1fr] gap-x-6' : 'flex max-w-md flex-col gap-3.5'
      }`}
    >
      {landscape ? (
        <>
          <div class="flex flex-col gap-3.5">
            <Header>{cfg && <UnitToggle />}</Header>
            {buyInCard}
            {actions}
          </div>
          <div class="flex flex-col justify-center gap-3.5">
            {table}
            {startHere}
          </div>
        </>
      ) : (
        <>
          <Header>{cfg && <UnitToggle />}</Header>
          {buyInCard}
          {table}
          {startHere}
          {actions}
        </>
      )}

      <BuyInSheet open={sheet === 'buyIn'} onClose={close} />
      <PlayerSheet open={sheet === 'player'} onClose={close} playerId={playerId} />
      <ChipHelpSheet open={sheet === 'chipHelp'} onClose={close} onAssistant={openAssistant} onConverter={openConverter} />
      <ChipAssistantSheet open={sheet === 'assistant'} onClose={close} />
      <ConverterSheet open={sheet === 'converter'} onClose={close} />
    </main>
  )
}
