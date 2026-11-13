// Clavier virtuel ouvert dès le tap qui ouvre une sheet de saisie (prénom).
// iOS et Android n'affichent le clavier que si le focus est donné pendant le geste lui-même ; or la
// sheet focalise son champ plus tard, dans un effet. On focalise donc tout de suite un champ invisible
// (le clavier s'ouvre), puis la sheet passe le focus à son vrai champ : le clavier reste ouvert.

let proxy: HTMLInputElement | null = null
/** Élément qui avait le focus avant le champ relais : la sheet lui rendra le focus à la fermeture. */
let opener: HTMLElement | null = null

/** À appeler de façon synchrone dans le gestionnaire du tap, juste avant d'ouvrir la sheet. */
export function openKeyboard() {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const input = document.createElement('input')
  input.type = 'text'
  input.setAttribute('aria-hidden', 'true')
  input.tabIndex = -1
  // 16 px : sinon iOS zoome sur le champ. Hors de la vue mais pas `display: none` (non focalisable).
  input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0'
  document.body.appendChild(input)
  input.focus({ preventScroll: true })
  // Dès que le vrai champ prend le relais, le champ relais disparaît.
  input.addEventListener('blur', () => input.remove(), { once: true })
  proxy = input
  // Filet : si aucune sheet ne prend le focus, on referme le clavier.
  setTimeout(() => {
    if (document.activeElement === input) input.blur()
  }, 1000)
}

/** Élément d'origine à mémoriser par la sheet : celui d'avant le champ relais, s'il y en a un. */
export function focusOrigin(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null
  if (proxy && active === proxy) return opener
  return active
}
