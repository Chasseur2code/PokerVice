// Sélectionne tout le contenu d'un champ quand il prend le focus : taper « 10 » remplace la valeur
// préremplie au lieu de donner « 1010 ».
// Différé d'une tâche : au tap, le navigateur place le curseur (et efface la sélection) après le focus.
export function selectOnFocus(e: FocusEvent): void {
  const input = e.currentTarget as HTMLInputElement
  setTimeout(() => {
    if (document.activeElement === input) input.select()
  }, 0)
}
