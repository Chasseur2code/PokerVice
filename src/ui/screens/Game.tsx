// Écran de partie (DESIGN §4.2, SPEC §4.1) : stats, table avec l'investi de chaque joueur,
// ligne « Partis », barre d'actions. Tout ce qui est affiché se dérive des événements (lib/derive) ;
// chaque geste appelle une action du store, suivie d'un toast « Annuler ».
import type { ComponentChildren } from 'preact'
import { ChevronDown, Clock, Coins, Sun, UserPlus } from 'lucide-preact'
import { useMemo, useState } from 'preact/hooks'
import { computeStats, summarizePlayers } from '../../lib/derive'
import { MAX_SEATED } from '../../lib/players'
import { fromBottom } from '../../lib/seats'
import { formatAmount } from '../../lib/units'
import { gameStore, useGame } from '../../store/useGame'
import { IconButton, PrimaryButton } from '../components/Button'
import { ChipBand } from '../components/ChipBand'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { Chrono } from '../components/Chrono'
import { Header } from '../components/Header'
import { SignedAmount } from '../components/PlayerDot'
import { Table, type SeatSlot } from '../components/Table'
import { TableCenterAmount } from '../components/TableCenter'
import { showToast } from '../components/Toast'
import { UnitToggle } from '../components/UnitToggle'
import { useOrientation } from '../hooks/useOrientation'
import { useWakeLock, wakeLockSupported } from '../hooks/useWakeLock'
import { EndGame } from './EndGame'
import { ChipAssistantSheet } from '../sheets/ChipAssistantSheet'
import { ChipHelpSheet } from '../sheets/ChipHelpSheet'
import { ChipInfoSheet } from '../sheets/ChipInfoSheet'
import { ConverterSheet } from '../sheets/ConverterSheet'
import { HistorySheet } from '../sheets/HistorySheet'
import { LeftPlayersSheet } from '../sheets/LeftPlayersSheet'
import { PlayerMenuSheet } from '../sheets/PlayerMenuSheet'
import { PlayerSheet } from '../sheets/PlayerSheet'
import { showUndoToast } from '../undo'

type Sheet = 'menu' | 'player' | 'left' | 'history' | 'chipHelp' | 'assistant' | 'converter' | 'chipInfo' | 'finish' | null

/**
 * Hauteur prise en portrait par tout ce qui n'est pas la table (en-tête, stats, barre d'actions,
 * marges), plus la ligne « Partis » et le bandeau jetons quand ils existent : la table rétrécit
 * pour que la barre reste visible.
 */
const PORTRAIT_CHROME = 290
const LEFT_ROW = 54
const CHIP_BAND = 54
const SAFE_Y = 'env(safe-area-inset-top) - env(safe-area-inset-bottom)'

export function Game() {
  const orientation = useOrientation()
  const game = useGame((s) => s.game)
  const unit = useGame((s) => s.unit)
  const cfg = game.chipConfig

  const [sheet, setSheet] = useState<Sheet>(null)
  // Gardé après la fermeture pour que la sheet ne change pas de contenu pendant son animation de sortie.
  const [playerId, setPlayerId] = useState<string | null>(null)
  // Saisie des stacks finaux en cours (écran EndGame, état local jusqu'à `finish`).
  const [ending, setEnding] = useState(false)
  const close = () => setSheet(null)

  useWakeLock(game.wakeLock, () => {
    gameStore.getState().setWakeLock(false)
    showToast("Impossible de garder l'écran allumé.")
  })

  // Le chrono a son propre composant : ce calcul ne tourne qu'à chaque action, pas à chaque seconde.
  const { summaries, stats } = useMemo(() => {
    const summaries = summarizePlayers(game)
    return { summaries, stats: computeStats(game, summaries) }
  }, [game])

  if (ending) return <EndGame onCancel={() => setEnding(false)} />

  const fmt = (cents: number, sign = false) => formatAmount(cents, unit, cfg, { compact: !sign, sign })

  const slots = [...game.players]
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .filter((p) => summaries.get(p.id)?.status === 'seated')
    .map((p): SeatSlot => {
      const amount = fmt(summaries.get(p.id)!.investedCents)
      return {
        kind: 'player',
        key: p.id,
        name: p.name,
        color: p.color,
        amount,
        ariaLabel: `${p.name}, ${amount} investis`,
        onClick: () => {
          setPlayerId(p.id)
          setSheet('menu')
        },
      }
    })

  const left = game.players
    .filter((p) => summaries.get(p.id)?.status === 'left')
    .map((p) => ({ player: p, summary: summaries.get(p.id)! }))
  const lastLeft = left.reduce<(typeof left)[number] | undefined>((a, b) => (!a || b.summary.leftAt! >= a.summary.leftAt! ? b : a), undefined)

  const addPlayer = () => {
    if (stats.seatedCount >= MAX_SEATED) return showToast(`La table est complète (${MAX_SEATED} joueurs).`)
    setPlayerId(null)
    setSheet('player')
  }

  const startEnding = () => {
    close()
    setEnding(true)
  }

  const swap = (a: string, b: string) => {
    if (gameStore.getState().reorderSeats([b, a])) showUndoToast('Places échangées')
  }

  const landscape = orientation === 'landscape'

  const header = (
    <Header>
      <div class="flex items-center gap-1">
        {wakeLockSupported && (
          <button
            type="button"
            aria-label="Garder l'écran allumé"
            title="Garder l'écran allumé"
            aria-pressed={game.wakeLock}
            onClick={() => gameStore.getState().setWakeLock(!game.wakeLock)}
            class={`flex size-11 items-center justify-center rounded-full ${
              game.wakeLock ? 'bg-accent text-on-accent' : 'text-text-muted active:bg-surface-muted'
            }`}
          >
            <Sun size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        <UnitToggle />
      </div>
    </Header>
  )

  const statsCard = (
    <section class="flex overflow-hidden rounded-card bg-surface shadow-card" aria-label="Statistiques de la partie">
      <div class="min-w-0 flex-1 border-l-4 border-accent px-3.5 py-3">
        <p class="text-caps font-semibold uppercase text-accent-text">Tapis moyen</p>
        <p class="num font-display text-hero font-bold">{stats.avgStackCents === null ? '—' : fmt(stats.avgStackCents)}</p>
        {stats.avgStackBB !== null && <p class="num text-[13px] text-text-muted">soit {stats.avgStackBB} BB</p>}
      </div>
      <dl class="flex w-[46%] max-w-44 flex-col justify-center gap-1 border-l border-border px-3.5 py-3 text-[13px]">
        <StatRow label="Durée">{game.startedAt !== undefined && <Chrono startedAt={game.startedAt} />}</StatRow>
        <StatRow label="En jeu">{fmt(stats.moneyInPlayCents)}</StatRow>
        <StatRow label="Recaves">{stats.rebuyCount}</StatRow>
      </dl>
    </section>
  )

  // Bandeau seulement si les couleurs sont connues (assistant) ; sinon, un bouton « Jetons » dans la barre.
  const chipColors = cfg?.colors?.length ? [...cfg.colors].sort((a, b) => a.valuePoints - b.valuePoints) : null
  const chipBand = chipColors && <ChipBand colors={chipColors} onClick={() => setSheet('chipInfo')} />

  const chrome = PORTRAIT_CHROME + (lastLeft ? LEFT_ROW : 0) + (chipBand ? CHIP_BAND : 0)
  const table = (
    <div
      class="mx-auto w-full"
      style={{
        maxWidth: landscape
          ? `min(100%, calc((100dvh - 64px - ${SAFE_Y}) * 460 / 358))`
          : `min(100%, max(240px, calc((100dvh - ${chrome}px - ${SAFE_Y}) * 358 / 460)))`,
      }}
    >
      <Table
        seats={fromBottom(slots)}
        orientation={orientation}
        center={<TableCenterAmount buyInCents={game.defaultBuyInCents} cfg={cfg} unit={unit} />}
        onSwap={swap}
      />
    </div>
  )

  const leftRow = lastLeft && (
    <button
      type="button"
      onClick={() => setSheet('left')}
      class="flex h-11 w-full shrink-0 items-center gap-1.5 rounded-row border border-[#E2D8C8] px-3.5 text-left text-body active:bg-surface-muted"
    >
      <span class="min-w-0 flex-1 truncate">
        {left.length} parti{left.length > 1 ? 's' : ''} · <strong class="font-semibold">{lastLeft.player.name}</strong>{' '}
        <SignedAmount cents={lastLeft.summary.balanceCents} text={fmt(lastLeft.summary.balanceCents, true)} />
      </span>
      <ChevronDown size={20} strokeWidth={2} class="shrink-0 text-text-muted" aria-hidden="true" />
    </button>
  )

  const actions = (
    <div class="mt-auto flex gap-2.5 pt-1">
      <IconButton label="Ajouter un joueur" onClick={addPlayer}>
        <UserPlus size={22} strokeWidth={2} aria-hidden="true" />
      </IconButton>
      <IconButton label="Historique" onClick={() => setSheet('history')}>
        <Clock size={22} strokeWidth={2} aria-hidden="true" />
      </IconButton>
      {!chipBand && (
        <IconButton label="Jetons" onClick={() => setSheet(cfg ? 'converter' : 'chipHelp')}>
          <Coins size={22} strokeWidth={2} aria-hidden="true" />
        </IconButton>
      )}
      <PrimaryButton class="h-[52px]! min-w-0" onClick={() => setSheet('finish')}>
        Terminer la partie
      </PrimaryButton>
    </div>
  )

  return (
    <main
      class={`mx-auto min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] px-4 pt-3 pb-5 ${
        landscape ? 'grid max-w-5xl grid-cols-[280px_1fr] gap-x-6' : 'flex max-w-md flex-col gap-2.5'
      }`}
    >
      {landscape ? (
        <>
          <div class="flex flex-col gap-2.5">
            {header}
            {statsCard}
            {leftRow}
            {chipBand}
            {actions}
          </div>
          <div class="flex flex-col justify-center">{table}</div>
        </>
      ) : (
        <>
          {header}
          {statsCard}
          {table}
          {leftRow}
          {chipBand}
          {actions}
        </>
      )}

      <PlayerMenuSheet
        open={sheet === 'menu'}
        onClose={close}
        playerId={playerId}
        onEdit={(id) => {
          setPlayerId(id)
          setSheet('player')
        }}
      />
      <PlayerSheet open={sheet === 'player'} onClose={close} playerId={playerId} />
      <LeftPlayersSheet open={sheet === 'left'} onClose={close} />
      <HistorySheet open={sheet === 'history'} onClose={close} />
      <ChipHelpSheet
        open={sheet === 'chipHelp'}
        onClose={close}
        onAssistant={() => setSheet('assistant')}
        onConverter={() => setSheet('converter')}
      />
      <ChipAssistantSheet open={sheet === 'assistant'} onClose={close} />
      <ConverterSheet open={sheet === 'converter'} onClose={close} />
      <ChipInfoSheet open={sheet === 'chipInfo'} onClose={close} />
      <ConfirmSheet open={sheet === 'finish'} onClose={close} title="Terminer la partie ?" confirmLabel="Compter les stacks" onConfirm={startEnding}>
        {stats.seatedCount === 0
          ? 'Tous les joueurs sont partis : on vérifie les comptes, puis la partie est close.'
          : `On saisit le stack final de chaque joueur assis (${stats.seatedCount}). Une fois validée, la partie est close et ne pourra plus être modifiée.`}
      </ConfirmSheet>
    </main>
  )
}

function StatRow({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="flex items-baseline justify-between gap-3">
      <dt class="text-text-muted">{label}</dt>
      <dd class="num font-semibold">{children}</dd>
    </div>
  )
}
