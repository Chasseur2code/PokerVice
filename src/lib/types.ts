// Modèle de données de PokerVice (SPEC §10).
// Argent en centimes entiers, points en entiers, dates en millisecondes epoch.

/** Fraction exacte num/den (entiers, den > 0), toujours réduite. */
export interface Fraction {
  num: number
  den: number
}

/** Unité d'affichage courante (SPEC §2.1). */
export type Unit = 'eur' | 'pts' | 'bb'

export interface ChipColor {
  id: string
  name: string
  hex: string
  valuePoints: number
  perPlayer: number
  totalQty: number
}

export interface ChipConfig {
  mode: 'assistant' | 'converter'
  /** Valeur d'un point en centimes, exacte (ex. 1 pt = 0,002 € → 1/5). */
  centsPerPoint: Fraction
  bbPoints: number
  sbPoints: number
  /** Présent seulement en mode assistant (couleurs connues). */
  colors?: ChipColor[]
}

/**
 * Le statut assis / parti n'est pas stocké : il se dérive des événements
 * `leave` / `return` (voir derive.ts), pour rester juste quand on modifie l'historique.
 */
export interface Player {
  id: string
  name: string
  color: string
  seatOrder: number
}

export type GameEventType = 'buyin' | 'rebuy' | 'leave' | 'return' | 'final'

/**
 * - `buyin`, `rebuy`, `return` : montant investi.
 * - `leave`, `final` : stack de sortie (ce que le joueur récupère).
 */
export interface GameEvent {
  id: string
  at: number
  type: GameEventType
  playerId: string
  amountCents: number
}

export type GameStatus = 'setup' | 'running' | 'finished'

export interface DiscrepancyResolution {
  type: 'prorata' | 'assign'
  playerId?: string
}

export interface Game {
  version: number
  status: GameStatus
  createdAt: number
  startedAt?: number
  endedAt?: number
  defaultBuyInCents: number
  chipConfig?: ChipConfig
  players: Player[]
  events: GameEvent[]
  discrepancyResolution?: DiscrepancyResolution
  wakeLock: boolean
}
