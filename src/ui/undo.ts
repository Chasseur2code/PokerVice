// Toast « Annuler » après une action du store (SPEC §7, DESIGN §5).
import type { ComponentChildren } from 'preact'
import { gameStore } from '../store/useGame'
import { showToast } from './components/Toast'

/**
 * À appeler juste après une action réussie. On mémorise l'entrée d'annulation qu'elle a créée :
 * « Annuler » ne fait rien si une autre action a eu lieu depuis (on n'annulerait pas la bonne).
 */
export function showUndoToast(message: ComponentChildren): void {
  const entry = gameStore.getState().undoable
  showToast(message, {
    label: 'Annuler',
    onClick: () => {
      const { undoable, undo } = gameStore.getState()
      if (entry && undoable === entry) undo()
    },
  })
}
