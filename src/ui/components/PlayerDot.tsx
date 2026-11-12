// Pastille de couleur d'un joueur (sièges, menus, listes). Décorative : le nom est toujours écrit à côté.
export function PlayerDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span class="shrink-0 rounded-full" style={{ background: color, width: size, height: size }} aria-hidden="true" />
}

/** Montant signé coloré en gain ou perte (le signe reste affiché : la couleur n'est pas seule porteuse). */
export function SignedAmount({ cents, text, onDark = false }: { cents: number; text: string; onDark?: boolean }) {
  const tone = cents > 0 ? (onDark ? 'text-gain-on-dark' : 'text-gain') : cents < 0 ? (onDark ? 'text-loss-on-dark' : 'text-loss') : ''
  return <span class={`num font-bold ${tone}`}>{text}</span>
}
