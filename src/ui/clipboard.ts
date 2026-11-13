// Copie de texte dans le presse-papiers. `navigator.clipboard` n'existe qu'en contexte sécurisé
// (https ou localhost) : en http sur le wifi (`npm run dev:lan`), on repasse par execCommand.
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Refusé (permission, page en arrière-plan) : on tente l'ancienne méthode.
    }
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  return ok
}
