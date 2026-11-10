// Tout ce qu'on affiche se dérive des événements de la partie (SPEC §2.3) : rien n'est stocké.
import { divRound } from './money'
import type { ChipConfig, Game, GameEvent } from './types'

export type PlayerStatus = 'seated' | 'left'

export interface PlayerSummary {
  playerId: string
  /** Buy-ins + recaves + buy-ins de retour. */
  investedCents: number
  /** Stacks de sortie (`leave`) + stack final (`final`). */
  cashedOutCents: number
  /** Encaissé − investi. N'a de sens que pour un joueur parti ou une partie terminée. */
  balanceCents: number
  rebuys: number
  status: PlayerStatus
  /** Heure du dernier départ, si le joueur est parti. */
  leftAt?: number
}

/** Un seul passage sur les événements : O(joueurs + événements). */
export function summarizePlayers(game: Pick<Game, 'players' | 'events'>): Map<string, PlayerSummary> {
  const out = new Map<string, PlayerSummary>()
  for (const p of game.players) {
    out.set(p.id, { playerId: p.id, investedCents: 0, cashedOutCents: 0, balanceCents: 0, rebuys: 0, status: 'seated' })
  }
  // Dernier mouvement (départ ou retour) de chaque joueur, par heure puis par ordre d'insertion.
  const lastMove = new Map<string, GameEvent>()
  for (const ev of game.events) {
    const s = out.get(ev.playerId)
    if (!s) continue
    switch (ev.type) {
      case 'rebuy':
        s.rebuys += 1
        s.investedCents += ev.amountCents
        break
      case 'buyin':
      case 'return':
        s.investedCents += ev.amountCents
        break
      case 'leave':
      case 'final':
        s.cashedOutCents += ev.amountCents
        break
    }
    if (ev.type === 'leave' || ev.type === 'return') {
      const prev = lastMove.get(ev.playerId)
      if (!prev || ev.at >= prev.at) lastMove.set(ev.playerId, ev)
    }
  }
  for (const s of out.values()) {
    s.balanceCents = s.cashedOutCents - s.investedCents
    const move = lastMove.get(s.playerId)
    if (move?.type === 'leave') {
      s.status = 'left'
      s.leftAt = move.at
    }
  }
  return out
}

export interface GameStats {
  /** Somme des investis − stacks de sortie des départs. */
  moneyInPlayCents: number
  seatedCount: number
  /** Argent en jeu ÷ joueurs assis, arrondi au centime ; `null` si personne n'est assis. */
  avgStackCents: number | null
  /** Tapis moyen en BB arrondi à l'entier ; `null` sans configuration jetons ou sans joueur assis. */
  avgStackBB: number | null
  /** Nombre d'événements `rebuy` (ni buy-ins initiaux ni retours). */
  rebuyCount: number
  totalInvestedCents: number
}

/** argent ÷ (assis × BB) en un seul arrondi, sur la valeur exacte. */
function avgInBB(cents: number, seated: number, cfg: ChipConfig): number {
  const { num, den } = cfg.centsPerPoint
  return divRound(cents * den, cfg.bbPoints * num * seated)
}

export function computeStats(
  game: Pick<Game, 'players' | 'events' | 'chipConfig'>,
  summaries: Map<string, PlayerSummary> = summarizePlayers(game),
): GameStats {
  let totalInvestedCents = 0
  let leftStacksCents = 0
  let rebuyCount = 0
  let seatedCount = 0
  for (const ev of game.events) {
    if (!summaries.has(ev.playerId)) continue
    if (ev.type === 'buyin' || ev.type === 'rebuy' || ev.type === 'return') totalInvestedCents += ev.amountCents
    if (ev.type === 'leave') leftStacksCents += ev.amountCents
    if (ev.type === 'rebuy') rebuyCount += 1
  }
  for (const s of summaries.values()) if (s.status === 'seated') seatedCount += 1

  const moneyInPlayCents = totalInvestedCents - leftStacksCents
  const hasSeated = seatedCount > 0
  return {
    moneyInPlayCents,
    seatedCount,
    avgStackCents: hasSeated ? divRound(moneyInPlayCents, seatedCount) : null,
    avgStackBB: hasSeated && game.chipConfig ? avgInBB(moneyInPlayCents, seatedCount, game.chipConfig) : null,
    rebuyCount,
    totalInvestedCents,
  }
}

/** Durée écoulée en ms depuis `startedAt` (jamais par incrément), figée à `endedAt` si la partie est finie. */
export function elapsedMs(game: Pick<Game, 'startedAt' | 'endedAt'>, now: number): number {
  if (game.startedAt === undefined) return 0
  return Math.max(0, (game.endedAt ?? now) - game.startedAt)
}

/** Chrono « h:mm:ss » (DESIGN §4.2). */
export function formatChrono(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Durée courte « 5h35 » (récap, SPEC §8.3). */
export function formatDurationShort(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}
