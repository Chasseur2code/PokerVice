// Récap de la partie terminée (SPEC §8.3-8.4, DESIGN §5) : balances (partis compris), virements
// minimaux, « Arrondir à l'euro », partage du texte (WhatsApp, Snapchat…), stats et historique repliables.
// Tout est en euros : ce sont de vrais virements. La partie est close ; seul « Nouvelle partie » en sort.
import type { ComponentChildren } from 'preact'
import { ChevronDown } from 'lucide-preact'
import { useMemo, useState } from 'preact/hooks'
import { formatDurationShort } from '../../lib/derive'
import { discrepancyMessage, finalBalances } from '../../lib/discrepancy'
import { formatCents } from '../../lib/money'
import { recapRows, recapStats } from '../../lib/recap'
import { recapPeriod, recapText } from '../../lib/recapText'
import { roundTransfers } from '../../lib/settlement'
import { gameStore, useGame } from '../../store/useGame'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { Header } from '../components/Header'
import { PlayerDot, SignedAmount } from '../components/PlayerDot'
import { showToast } from '../components/Toast'
import { canShare, shareText } from '../share'
import { EventRow } from '../sheets/HistorySheet'
import { showUndoToast } from '../undo'

export function Recap() {
  const recap = useGame((s) => s.lastRecap)
  const [rounded, setRounded] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)

  const data = useMemo(() => {
    if (!recap) return null
    const rows = recapRows(recap.game)
    return {
      rows,
      stats: recapStats(recap.game, rows),
      discrepancy: recap.game.discrepancyResolution ? finalBalances(recap.game).discrepancyCents : 0,
      players: new Map(recap.game.players.map((p) => [p.id, p])),
    }
  }, [recap])

  // Garde le dernier rendu pendant la transition vers la nouvelle partie.
  if (!recap || !data) return null
  const { game } = recap
  const { rows, stats, discrepancy, players } = data
  const transfers = rounded ? roundTransfers(recap.transfers) : recap.transfers
  const eur = (c: number) => formatCents(c, { compact: true })

  const share = async () => {
    const result = await shareText(recapText(game, rows, transfers))
    if (result === 'copied') showToast('Récap copié : collez-le dans la conversation de votre choix.')
    if (result === 'failed') showToast('Partage impossible sur ce navigateur.')
  }

  const startNew = () => {
    setConfirmNew(false)
    gameStore.getState().newGame()
    showUndoToast('Récap effacé')
  }

  const resolution = game.discrepancyResolution
  const assignee = resolution?.type === 'assign' ? players.get(resolution.playerId ?? '')?.name : undefined

  return (
    <main class="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-md flex-col gap-3.5 px-4 pt-3 pb-5">
      <Header>
        <span class="text-[13px] text-text-muted">Partie terminée</span>
      </Header>
      <p class="num -mt-1 text-body text-text-muted">{recapPeriod(game)}</p>

      <Card title="Balances">
        <ul class="flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <li key={r.player.id} class="flex min-h-12 items-center gap-2.5 py-2">
              <PlayerDot color={r.player.color} />
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{r.player.name}</p>
                <p class="num text-[13px] text-text-muted">
                  investi {eur(r.investedCents)} · stack {eur(r.stackCents)}
                </p>
              </div>
              <SignedAmount cents={r.balanceCents} text={formatCents(r.balanceCents, { sign: true })} />
            </li>
          ))}
        </ul>
        {resolution && discrepancy !== 0 && (
          <p class="num pt-2 text-[13px] text-text-muted">
            Écart de comptage : {discrepancyMessage(discrepancy, game.chipConfig)?.replace(/^Il/, 'il')},{' '}
            {resolution.type === 'prorata' ? 'réparti au prorata des stacks' : `imputé à ${assignee ?? '?'}`}.
          </p>
        )}
      </Card>

      <Card title="Virements">
        {transfers.length === 0 ? (
          <p class="py-2 text-body text-text-muted">Personne ne doit rien à personne.</p>
        ) : (
          <ul class="flex flex-col gap-2">
            {transfers.map((t) => {
              const from = players.get(t.from)
              const to = players.get(t.to)
              return (
                <li key={`${t.from}-${t.to}`} class="flex min-h-12 items-center gap-2 rounded-row bg-bg px-3 py-2">
                  <span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5">
                    <PlayerDot color={from?.color ?? 'transparent'} />
                    <span class="truncate font-semibold">{from?.name ?? '?'}</span>
                    <span class="text-text-muted" aria-label="paie">
                      →
                    </span>
                    <PlayerDot color={to?.color ?? 'transparent'} />
                    <span class="truncate font-semibold">{to?.name ?? '?'}</span>
                  </span>
                  <span class="num shrink-0 font-display text-[22px] font-bold">{formatCents(t.amountCents)}</span>
                </li>
              )
            })}
          </ul>
        )}
        <label class="mt-2 flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span class="text-body">Arrondir à l'euro</span>
          <input
            type="checkbox"
            role="switch"
            checked={rounded}
            onChange={(e) => setRounded(e.currentTarget.checked)}
            class="switch"
          />
        </label>
      </Card>

      <PrimaryButton onClick={share}>{canShare ? 'Partager le récap' : 'Copier le récap'}</PrimaryButton>

      <Collapsible title="Statistiques">
        <dl class="flex flex-col gap-1.5 pb-3 text-body">
          <Stat label="Durée">{formatDurationShort(stats.durationMs)}</Stat>
          <Stat label="Total des buy-ins">{eur(stats.totalInvestedCents)}</Stat>
          <Stat label="Recaves">{stats.rebuyCount}</Stat>
          {stats.topWinner && (
            <Stat label="Plus gros gagnant">
              {stats.topWinner.player.name}{' '}
              <SignedAmount cents={stats.topWinner.balanceCents} text={formatCents(stats.topWinner.balanceCents, { sign: true })} />
            </Stat>
          )}
          {stats.topLoser && (
            <Stat label="Plus gros perdant">
              {stats.topLoser.player.name}{' '}
              <SignedAmount cents={stats.topLoser.balanceCents} text={formatCents(stats.topLoser.balanceCents, { sign: true })} />
            </Stat>
          )}
        </dl>
      </Collapsible>

      <Collapsible title="Historique">
        <ul class="flex flex-col divide-y divide-border pb-2">
          {game.events.map((e) => (
            <li key={e.id}>
              <EventRow ev={e} player={players.get(e.playerId)} amount={eur(e.amountCents)} />
            </li>
          ))}
        </ul>
      </Collapsible>

      <div class="mt-auto pt-2">
        <SecondaryButton onClick={() => setConfirmNew(true)}>Nouvelle partie</SecondaryButton>
      </div>

      <ConfirmSheet
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        title="Nouvelle partie ?"
        confirmLabel="Nouvelle partie"
        onConfirm={startNew}
      >
        Le récap précédent sera effacé.
      </ConfirmSheet>
    </main>
  )
}

function Card({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="rounded-card bg-surface px-4 pt-3 pb-2 shadow-card" aria-label={title}>
      <h2 class="text-caps font-semibold uppercase text-text-muted">{title}</h2>
      {children}
    </section>
  )
}

/** Section repliable native (`<details>`) : pas d'état à gérer, accessible au clavier. */
function Collapsible({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <details class="group rounded-card bg-surface px-4 shadow-card">
      <summary class="flex h-11 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown size={20} strokeWidth={2} class="text-text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      {children}
    </details>
  )
}

function Stat({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="flex items-baseline justify-between gap-3">
      <dt class="text-text-muted">{label}</dt>
      <dd class="num text-right font-semibold">{children}</dd>
    </div>
  )
}
