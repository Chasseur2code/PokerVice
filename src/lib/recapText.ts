// Texte brut du récap à partager (SPEC §8.3, « Copier pour WhatsApp »), au format exact :
//
//   PokerVice — 05/11/2026 · 20:12 → 01:47 (5h35)
//
//   Balances
//   +42,30 € Hugo
//    -4,40 € Léo
//
//   Virements
//   Léo → Hugo : 4,40 €
//
// Les montants des balances sont alignés à droite (espaces en tête) : lisible en police à chasse fixe.
import { formatDurationShort } from './derive'
import { formatCents } from './money'
import type { RecapRow } from './recap'
import type { Transfer } from './settlement'
import type { Game } from './types'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** « 05/11/2026 · 20:12 → 01:47 (5h35) » : en-tête du texte et du récap. */
export function recapPeriod(game: Pick<Game, 'createdAt' | 'startedAt' | 'endedAt'>): string {
  const start = game.startedAt ?? game.createdAt
  const end = game.endedAt ?? start
  return `${dateFmt.format(start)} · ${timeFmt.format(start)} → ${timeFmt.format(end)} (${formatDurationShort(end - start)})`
}

export function recapText(
  game: Pick<Game, 'createdAt' | 'startedAt' | 'endedAt' | 'players'>,
  rows: readonly RecapRow[],
  transfers: readonly Transfer[],
): string {
  const amounts = rows.map((r) => formatCents(r.balanceCents, { sign: true }))
  const width = Math.max(0, ...amounts.map((a) => a.length))
  const names = new Map(game.players.map((p) => [p.id, p.name]))
  const name = (id: string) => names.get(id) ?? '?'

  return [
    `PokerVice — ${recapPeriod(game)}`,
    '',
    'Balances',
    ...rows.map((r, i) => `${amounts[i]!.padStart(width)} ${r.player.name}`),
    '',
    'Virements',
    ...(transfers.length
      ? transfers.map((t) => `${name(t.from)} → ${name(t.to)} : ${formatCents(t.amountCents)}`)
      : ['Aucun virement']),
  ].join('\n')
}
