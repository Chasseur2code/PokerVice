// Partage du récap : feuille de partage du système, ou copie dans le presse-papiers.
// `navigator.share` et `navigator.clipboard` n'existent qu'en contexte sécurisé (https ou localhost) :
// en http sur le wifi (`npm run dev:lan`), on copie en repassant par execCommand.
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

/** Feuille de partage du système (WhatsApp, Snapchat, SMS…) : https seulement, surtout sur mobile. */
export const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/** Partage le texte si possible, sinon le copie dans le presse-papiers. */
export async function shareText(text: string): Promise<ShareResult> {
  if (canShare) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (e) {
      // Feuille fermée sans choisir d'appli : rien à signaler. Autre refus : on copie.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}
