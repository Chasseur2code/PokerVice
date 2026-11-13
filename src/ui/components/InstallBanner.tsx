// Bandeau « Installez PokerVice » en haut de l'écran de préparation (logique dans `ui/install.ts`).
// Une carte comme celle du buy-in : texte à gauche, « Installer » si le navigateur le permet, croix pour fermer.
import { Share, X } from 'lucide-preact'
import { promptInstall, dismissInstall, type InstallMode } from '../install'

// Espace insécable : un guillemet ou un deux-points ne se retrouve jamais seul en bout de ligne.
const NBSP = ' '

export function InstallBanner({ mode }: { mode: InstallMode }) {
  return (
    <aside
      aria-label="Installer l'application"
      class="flex items-center gap-2 rounded-card bg-surface py-2.5 pr-1.5 pl-4 shadow-card"
    >
      <div class="min-w-0 flex-1">
        <p class="text-body font-semibold">Installez l'app{NBSP}: plein écran, hors connexion</p>
        <p class="text-[13px] text-text-muted">
          {mode === 'ios' ? (
            <>
              Touchez{NBSP}
              <Share size={14} strokeWidth={2} class="inline align-[-2px]" aria-label="Partager" />, puis «{NBSP}Sur
              l'écran d'accueil{NBSP}».
            </>
          ) : mode === 'menu' ? (
            `Dans le menu du navigateur${NBSP}: «${NBSP}Installer${NBSP}» ou «${NBSP}Ajouter à l'écran d'accueil${NBSP}».`
          ) : (
            "Sur l'écran d'accueil, comme une vraie app."
          )}
        </p>
      </div>
      {mode === 'prompt' && (
        <button
          type="button"
          onClick={promptInstall}
          class="h-11 shrink-0 rounded-full bg-accent px-4 font-semibold text-on-accent active:brightness-95"
        >
          Installer
        </button>
      )}
      <button
        type="button"
        aria-label="Fermer"
        title="Fermer"
        onClick={dismissInstall}
        class="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted active:bg-surface-muted"
      >
        <X size={20} strokeWidth={2} aria-hidden="true" />
      </button>
    </aside>
  )
}
