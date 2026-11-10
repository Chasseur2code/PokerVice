// Écart de comptage en fin de partie (SPEC §8.2) et balances finales de somme nulle.
import { computeStats, summarizePlayers } from './derive'
import { divFloor, formatCents } from './money'
import { centsToPoints } from './units'
import type { ChipConfig, DiscrepancyResolution, Game } from './types'

export interface FinalStack {
  playerId: string
  cents: number
}

/** Somme des stacks finaux − argent en jeu : > 0 = en trop, < 0 = il manque. */
export function discrepancyCents(finals: readonly FinalStack[], moneyInPlayCents: number): number {
  return finals.reduce((s, f) => s + f.cents, 0) - moneyInPlayCents
}

const pointsFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/**
 * « Il manque 140 points (1,40 €) » / « 140 points (1,40 €) en trop ».
 * Sans configuration jetons, le message reste en euros seuls. `null` si aucun écart.
 */
export function discrepancyMessage(diffCents: number, cfg: ChipConfig | undefined): string | null {
  if (diffCents === 0) return null
  const abs = Math.abs(diffCents)
  const euros = formatCents(abs)
  let amount = euros
  if (cfg) {
    const pts = centsToPoints(abs, cfg)
    amount = `${pointsFormatter.format(pts)} point${pts > 1 ? 's' : ''} (${euros})`
  }
  return diffCents < 0 ? `Il manque ${amount}` : `${amount} en trop`
}

/**
 * Répartit `totalCents` proportionnellement à `weights` (entiers ≥ 0, somme > 0), en centimes
 * entiers, par la méthode du plus fort reste : la somme du résultat vaut exactement `totalCents`.
 * À reste égal, le plus gros poids puis le premier dans la liste reçoit le centime.
 */
export function apportion(totalCents: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((s, w) => s + w, 0)
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0) || weightSum <= 0) {
    throw new RangeError('poids invalides pour la répartition')
  }
  const parts = weights.map((w, i) => {
    const share = divFloor(totalCents * w, weightSum)
    return { i, w, share, rest: totalCents * w - share * weightSum }
  })
  // Moins de n centimes manquent après les parts entières : un centime de plus aux n premiers restes.
  let missing = totalCents - parts.reduce((s, p) => s + p.share, 0)
  const byRest = parts.slice().sort((a, b) => b.rest - a.rest || b.w - a.w || a.i - b.i)
  for (const p of byRest) {
    if (missing-- <= 0) break
    p.share += 1
  }
  return parts.map((p) => p.share)
}

/**
 * Corrige les stacks finaux pour que leur somme égale l'argent en jeu.
 * - `prorata` : l'argent en jeu est réparti au prorata des stacks comptés (plus fort reste).
 *   Impossible si tous les stacks sont nuls : on renvoie alors `null`.
 * - `assign` : tout l'écart est reporté sur un joueur (son stack peut devenir négatif s'il
 *   manque plus que ce qu'il a ; c'est à l'UI de le signaler).
 */
export function resolveDiscrepancy(
  finals: readonly FinalStack[],
  moneyInPlayCents: number,
  resolution: DiscrepancyResolution,
): FinalStack[] | null {
  const diff = discrepancyCents(finals, moneyInPlayCents)
  if (diff === 0) return finals.map((f) => ({ ...f }))
  if (resolution.type === 'assign') {
    if (!finals.some((f) => f.playerId === resolution.playerId)) return null
    return finals.map((f) => (f.playerId === resolution.playerId ? { ...f, cents: f.cents - diff } : { ...f }))
  }
  if (finals.every((f) => f.cents === 0)) return null
  const adjusted = apportion(
    moneyInPlayCents,
    finals.map((f) => f.cents),
  )
  return finals.map((f, i) => ({ ...f, cents: adjusted[i]! }))
}

export interface FinalBalances {
  /** Balance par joueur (partis compris), écart résolu. Vide si l'écart n'est pas résolu. */
  balances: Map<string, number>
  /** Écart brut, avant résolution. */
  discrepancyCents: number
  /** `false` tant qu'un écart existe sans résolution valable. */
  resolved: boolean
}

/**
 * Balances finales d'une partie : investi, sorties (`leave`) et stacks finaux (`final`), écart
 * résolu selon `game.discrepancyResolution`. Une fois résolues, leur somme vaut exactement 0.
 */
export function finalBalances(game: Pick<Game, 'players' | 'events' | 'chipConfig' | 'discrepancyResolution'>): FinalBalances {
  const summaries = summarizePlayers(game)
  const { moneyInPlayCents } = computeStats(game, summaries)

  const finalsById = new Map<string, number>()
  for (const ev of game.events) {
    if (ev.type === 'final' && summaries.has(ev.playerId)) {
      finalsById.set(ev.playerId, (finalsById.get(ev.playerId) ?? 0) + ev.amountCents)
    }
  }
  const finals = [...finalsById].map(([playerId, cents]) => ({ playerId, cents }))
  const diff = discrepancyCents(finals, moneyInPlayCents)

  let resolved: FinalStack[] | null = finals
  if (diff !== 0) {
    resolved = game.discrepancyResolution
      ? resolveDiscrepancy(finals, moneyInPlayCents, game.discrepancyResolution)
      : null
  }
  if (!resolved) return { balances: new Map(), discrepancyCents: diff, resolved: false }

  const correction = new Map(resolved.map((f) => [f.playerId, f.cents - (finalsById.get(f.playerId) ?? 0)]))
  const balances = new Map<string, number>()
  for (const s of summaries.values()) {
    balances.set(s.playerId, s.balanceCents + (correction.get(s.playerId) ?? 0))
  }
  return { balances, discrepancyCents: diff, resolved: true }
}
