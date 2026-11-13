// Thème clair / sombre. Préférence de l'appareil, gardée à part de la partie (clé `pokervice-theme`) ;
// sans choix, on suit le réglage du système. Le script en tête d'index.html applique déjà `data-theme`
// avant le premier affichage (pas de flash) : ici, on ne fait que lire et basculer.
import { useEffect, useState } from 'preact/hooks'

export type Theme = 'light' | 'dark'

const KEY = 'pokervice-theme'
// Couleur de la barre du navigateur / de la PWA : `--color-bg` de chaque thème.
const THEME_COLOR: Record<Theme, string> = { light: '#F5F1E9', dark: '#17120D' }

const system = window.matchMedia('(prefers-color-scheme: dark)')

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const current = (): Theme => stored() ?? (system.matches ? 'dark' : 'light')

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState(current)

  useEffect(() => {
    apply(theme)
  }, [theme])

  // Tant qu'aucun choix n'est enregistré, le thème suit le système en direct.
  useEffect(() => {
    const onChange = () => {
      if (!stored()) setTheme(current())
    }
    system.addEventListener('change', onChange)
    return () => system.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour la session.
    }
    setTheme(next)
  }

  return [theme, toggle]
}
