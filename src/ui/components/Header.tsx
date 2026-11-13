// En-tête commun (DESIGN §4.1 et §4.2) : logo à gauche, 40 px de haut. À droite, seulement des commandes
// (thème, bascule d'unité, boutons), jamais un libellé d'état (« Partie terminée »…) : rien d'inutile à l'écran.
import type { ComponentChildren } from 'preact'
import { Moon } from 'lucide-preact'
import { useTheme } from '../theme'

export function Header({ children }: { children?: ComponentChildren }) {
  const [theme, toggleTheme] = useTheme()
  const dark = theme === 'dark'
  return (
    <header class="flex h-10 shrink-0 items-center justify-between gap-3">
      <h1 class="font-display text-logo font-bold">
        Poker<span class="text-brand-green">Vice</span>
      </h1>
      <div class="flex items-center gap-1">
        {/* Lune pleine en mode sombre : distincte du soleil « Écran allumé » et de son fond ambre. */}
        <button
          type="button"
          aria-label="Mode sombre"
          title="Mode sombre"
          aria-pressed={dark}
          onClick={toggleTheme}
          class="flex size-11 items-center justify-center rounded-full text-text-muted active:bg-surface-muted"
        >
          <Moon size={22} strokeWidth={2} fill={dark ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
        {children}
      </div>
    </header>
  )
}
