// Joueurs : palette de couleurs (DESIGN §2.3) et limites de la table (SPEC §4.2).
import type { Player } from './types'

/** Palette de 10 couleurs, dans l'ordre d'attribution. */
export const PLAYER_COLORS = [
  '#E5484D',
  '#3E63DD',
  '#F59E0B',
  '#8E4EC6',
  '#12A594',
  '#E93D82',
  '#F76B15',
  '#05A2C2',
  '#A18072',
  '#6B7280',
] as const

export const MIN_PLAYERS_TO_START = 2
export const MAX_SEATED = 10

/** Première couleur de la palette qu'aucun joueur n'utilise ; si toutes sont prises, on recommence au début. */
export function nextPlayerColor(players: readonly Pick<Player, 'color'>[]): string {
  const used = new Set(players.map((p) => p.color.toUpperCase()))
  return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[players.length % PLAYER_COLORS.length]!
}
