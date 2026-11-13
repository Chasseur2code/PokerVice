// En-tête commun (DESIGN §4.1 et §4.2) : logo à gauche, 40 px de haut. À droite, seulement des commandes
// (bascule d'unité, boutons), jamais un libellé d'état (« Partie terminée »…) : rien d'inutile à l'écran.
import type { ComponentChildren } from 'preact'

export function Header({ children }: { children?: ComponentChildren }) {
  return (
    <header class="flex h-10 shrink-0 items-center justify-between gap-3">
      <h1 class="font-display text-logo font-bold">
        Poker<span class="text-brand-green">Vice</span>
      </h1>
      {children}
    </header>
  )
}
