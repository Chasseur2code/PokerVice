// Joueurs : palette de couleurs (DESIGN §2.3) et limites de la table (SPEC §4.2).
import type { Player } from './types'

/** Palette de 10 couleurs (hexadécimal en majuscules), dans l'ordre d'attribution, avec leur nom lu par les lecteurs d'écran. */
export const PLAYER_PALETTE = [
  { color: '#E5484D', name: 'Rouge' },
  { color: '#3E63DD', name: 'Bleu' },
  { color: '#F59E0B', name: 'Ambre' },
  { color: '#8E4EC6', name: 'Violet' },
  { color: '#12A594', name: 'Sarcelle' },
  { color: '#E93D82', name: 'Rose' },
  { color: '#F76B15', name: 'Orange' },
  { color: '#05A2C2', name: 'Cyan' },
  { color: '#A18072', name: 'Brun' },
  { color: '#6B7280', name: 'Gris' },
] as const

export const PLAYER_COLORS: readonly string[] = PLAYER_PALETTE.map((p) => p.color)

export const MIN_PLAYERS_TO_START = 2
export const MAX_SEATED = 10

/** Première couleur de la palette qu'aucun joueur n'utilise ; si toutes sont prises, on recommence au début. */
export function nextPlayerColor(players: readonly Pick<Player, 'color'>[]): string {
  const used = new Set(players.map((p) => p.color.toUpperCase()))
  return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[players.length % PLAYER_COLORS.length]!
}
