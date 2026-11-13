// Récap d'une partie terminée (SPEC §8.3) : balances par joueur et stats, dérivées des événements.
import { computeStats, elapsedMs, summarizePlayers } from './derive'
import { finalBalances } from './discrepancy'
import type { Game, Player } from './types'

export interface RecapRow {
  player: Player
  investedCents: number
  /** Ce que le joueur récupère au total (sorties + stack final), écart de comptage compris. */
  stackCents: number
  /** stack − investi, écart compris : la somme sur toutes les lignes vaut 0. */
  balanceCents: number
}

/**
 * Tous les joueurs qui ont joué (partis compris), du plus gros gagnant au plus gros perdant ;
 * à balance égale, par nom puis par id (ordre stable).
 */
export function recapRows(game: Pick<Game, 'players' | 'events' | 'chipConfig' | 'discrepancyResolution'>): RecapRow[] {
  const summaries = summarizePlayers(game)
  const { balances } = finalBalances(game)
  const played = new Set(game.events.map((e) => e.playerId))
  return game.players
    .filter((p) => played.has(p.id))
    .map((player) => {
      const s = summaries.get(player.id)!
      const balanceCents = balances.get(player.id) ?? s.balanceCents
      return { player, investedCents: s.investedCents, stackCents: s.investedCents + balanceCents, balanceCents }
    })
    .sort(
      (a, b) =>
        b.balanceCents - a.balanceCents ||
        a.player.name.localeCompare(b.player.name, 'fr') ||
        (a.player.id < b.player.id ? -1 : a.player.id > b.player.id ? 1 : 0),
    )
}

export interface RecapStats {
  durationMs: number
  /** Buy-ins initiaux, recaves et buy-ins de retour. */
  totalInvestedCents: number
  rebuyCount: number
  /** Absent si personne n'a gagné (ou perdu). */
  topWinner?: RecapRow
  topLoser?: RecapRow
}

/** `rows` : le résultat de recapRows (trié). */
export function recapStats(game: Pick<Game, 'players' | 'events' | 'chipConfig' | 'startedAt' | 'endedAt'>, rows: readonly RecapRow[]): RecapStats {
  const { totalInvestedCents, rebuyCount } = computeStats(game)
  const first = rows[0]
  const last = rows[rows.length - 1]
  return {
    durationMs: elapsedMs(game, game.endedAt ?? game.startedAt ?? 0),
    totalInvestedCents,
    rebuyCount,
    topWinner: first && first.balanceCents > 0 ? first : undefined,
    topLoser: last && last.balanceCents < 0 ? last : undefined,
  }
}
