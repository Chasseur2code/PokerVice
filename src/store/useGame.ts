// Instance du store pour l'app (persistée dans localStorage) et hook Preact pour la lire.
// Séparé de game.ts pour que les tests du store n'importent ni Preact ni localStorage.
import { useStore } from 'zustand'
import { createGameStore, type GameState } from './game'

export const gameStore = createGameStore(localStorage)

/** Lit une tranche du store ; le composant ne se re-rend que si cette tranche change. */
export function useGame<T>(selector: (s: GameState) => T): T {
  return useStore(gameStore, selector)
}
