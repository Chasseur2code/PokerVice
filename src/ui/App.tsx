const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

// Page temporaire de l'étape 0 : vérifie polices, tokens et déploiement.
export function App() {
  return (
    <main class="mx-auto flex max-w-md flex-col gap-3.5 px-4 pt-4 pb-5">
      <header class="flex h-10 items-center justify-between">
        <h1 class="font-display text-logo font-bold">
          Poker<span class="text-brand-green">Vice</span>
        </h1>
      </header>

      <section class="rounded-card bg-surface px-4 py-3.5 shadow-card">
        <p class="text-[13px] text-text-muted">Buy-in par joueur</p>
        <p class="num font-display text-buyin font-bold">{eur.format(20)}</p>
      </section>

      <p class="text-body text-text-muted">Hello PokerVice. Le squelette est en place.</p>

      <button
        type="button"
        class="h-14 rounded-btn bg-accent text-btn font-bold text-on-accent"
      >
        Démarrer
      </button>
    </main>
  )
}
