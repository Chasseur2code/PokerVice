// Invitation à installer l'app sur l'écran d'accueil (bandeau `InstallBanner`). Seulement sur smartphone,
// dans le navigateur (pas dans l'app installée), à chaque visite : la croix ne le cache que jusqu'au
// prochain chargement de la page, rien n'est enregistré.
//
// Trois cas selon le navigateur :
// - Chrome, Edge, Samsung Internet (Android) : ils émettent `beforeinstallprompt`, qu'on garde pour ouvrir
//   leur fenêtre d'installation au tap sur « Installer » ;
// - Safari et les navigateurs iOS : aucune API, on explique le geste (Partager → « Sur l'écran d'accueil ») ;
// - les autres (Firefox Android…) : on renvoie au menu du navigateur.
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** Événement non standard de Chromium (absent des types du DOM). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallMode = 'prompt' | 'ios' | 'menu'

function standalone(): boolean {
  return (
    matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Écran tactile sans survol : un téléphone ou une tablette, pas un ordinateur. */
const mobile = () => matchMedia('(pointer: coarse) and (hover: none)').matches

// iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const installStore = createStore<{ visible: boolean; deferred: BeforeInstallPromptEvent | null }>(() => ({
  visible: mobile() && !standalone(),
  deferred: null,
}))

// Écoutés dès le chargement du module : `beforeinstallprompt` peut arriver avant le premier rendu.
window.addEventListener('beforeinstallprompt', (e) => {
  // Sans preventDefault, Chrome afficherait aussi sa propre mini-barre en plus de notre bandeau.
  e.preventDefault()
  installStore.setState({ deferred: e as BeforeInstallPromptEvent })
})
window.addEventListener('appinstalled', () => dismissInstall())

/** Cache le bandeau jusqu'au prochain chargement de la page. */
export function dismissInstall(): void {
  installStore.setState({ visible: false, deferred: null })
}

/** Ouvre la fenêtre d'installation du navigateur (cas « prompt »). Elle ne sert qu'une fois. */
export async function promptInstall(): Promise<void> {
  const { deferred } = installStore.getState()
  if (!deferred) return
  installStore.setState({ deferred: null })
  await deferred.prompt()
  // Refusée : le bandeau reste, avec l'explication par le menu (le navigateur ne repropose pas tout de suite).
  if ((await deferred.userChoice).outcome === 'accepted') dismissInstall()
}

/** `null` si le bandeau ne doit pas s'afficher, sinon la façon d'installer. */
export function useInstall(): InstallMode | null {
  const visible = useStore(installStore, (s) => s.visible)
  const canPrompt = useStore(installStore, (s) => s.deferred !== null)
  if (!visible) return null
  return canPrompt ? 'prompt' : ios() ? 'ios' : 'menu'
}
