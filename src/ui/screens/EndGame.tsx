// Fin de partie (SPEC §8.1-8.2, DESIGN §5) : saisie des stacks finaux de tous les joueurs assis sur une
// seule page, avec « Reste à attribuer » ; puis, s'il y a un écart de comptage, Corriger, Répartir au
// prorata ou Imputer à un joueur. Les stacks saisis restent locaux : rien n'est écrit dans le store
// avant `finish`, qui clôt la partie et range le récap dans `lastRecap` (App bascule alors sur Recap).
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks'
import { computeStats, summarizePlayers } from '../../lib/derive'
import { discrepancyMessage, previewFinalBalances, type FinalStack } from '../../lib/discrepancy'
import { amountToInput, formatAmount, formatEquivalent, parseAmountKeeping, type InputUnit } from '../../lib/units'
import type { DiscrepancyResolution } from '../../lib/types'
import { gameStore, useGame } from '../../store/useGame'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { CompactField } from '../components/CompactField'
import { Header } from '../components/Header'
import { PlayerDot } from '../components/PlayerDot'
import { Segmented, type SegmentedOption } from '../components/Segmented'
import { showToast } from '../components/Toast'
import { showUndoToast } from '../undo'

const ENTRY_UNITS: readonly SegmentedOption<InputUnit>[] = [
  { value: 'eur', label: '€', ariaLabel: 'Euros' },
  { value: 'pts', label: 'Pts', ariaLabel: 'Points' },
]

const SCREEN = 'mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-md flex-col gap-3.5 px-4 pt-3 pb-5'

/** Saisie d'un joueur : le texte du champ, et le montant exact dont il vient (après une bascule d'unité). */
interface Entry {
  value: string
  preset: number | null
}

export function EndGame({ onCancel }: { onCancel: () => void }) {
  const game = useGame((s) => s.game)
  const unit = useGame((s) => s.unit)
  const cfg = game.chipConfig
  // Les stacks se comptent en jetons : saisie en points par défaut s'il y a une config jetons
  // (sinon, la valeur d'un point est inconnue : tout en €). Choix local à cet écran.
  const [inputUnit, setInputUnit] = useState<InputUnit>(cfg ? 'pts' : 'eur')
  const formId = useId()
  const form = useRef<HTMLFormElement>(null)

  const { seated, moneyInPlayCents } = useMemo(() => {
    const summaries = summarizePlayers(game)
    return {
      seated: [...game.players].sort((a, b) => a.seatOrder - b.seatOrder).filter((p) => summaries.get(p.id)?.status === 'seated'),
      moneyInPlayCents: computeStats(game, summaries).moneyInPlayCents,
    }
  }, [game])
  const n = seated.length

  const [entries, setEntries] = useState<Entry[]>(() => seated.map(() => ({ value: '', preset: null })))
  // Personne d'assis (tous partis) : directement la vérification.
  const [checking, setChecking] = useState(n === 0)
  const [assigning, setAssigning] = useState(false)

  const fmt = (cents: number) => formatAmount(cents, unit, cfg, { compact: true })
  const fmtInput = (cents: number) => formatAmount(cents, inputUnit, cfg, { compact: true })

  // Stack de chaque joueur assis (centimes), `null` si le champ est vide ou invalide.
  const stacks = entries.map((e) => {
    const cents = parseAmountKeeping(e.value, inputUnit, cfg, e.preset)
    return cents !== null && cents >= 0 ? cents : null
  })

  const finalsOf = (list: (number | null)[]): FinalStack[] => seated.map((p, i) => ({ playerId: p.id, cents: list[i] ?? 0 }))

  const complete = (finals: FinalStack[], resolution?: DiscrepancyResolution) => {
    if (!gameStore.getState().finish(finals, resolution)) return showToast('Impossible de terminer la partie.')
    showUndoToast('Partie terminée')
  }

  const fields = () => [...(form.current?.querySelectorAll('input') ?? [])]

  // Focus sur le premier champ vide (clavier physique ; sur téléphone, le clavier attend un tap).
  useEffect(() => {
    if (!checking) fields()[stacks.findIndex((s) => s === null)]?.focus({ preventScroll: true })
  }, [checking])

  // ——— Saisie des stacks ———
  if (!checking) {
    const remaining = stacks.reduce<number>((r, s) => r - (s ?? 0), moneyInPlayCents)
    const allValid = stacks.every((s) => s !== null)

    // Entrée valide s'il ne manque rien ; sinon elle passe au prochain champ à remplir. Gérée à la main :
    // le bouton par défaut du formulaire (Valider) est désactivé, ce qui bloque la soumission implicite.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || allValid) return
      e.preventDefault()
      const current = fields().indexOf(e.target as HTMLInputElement)
      const next = stacks.findIndex((s, i) => i > current && s === null)
      fields()[next >= 0 ? next : stacks.indexOf(null)]?.focus()
    }

    const submit = (e: Event) => {
      e.preventDefault()
      if (!allValid) return
      const finals = finalsOf(stacks)
      if (previewFinalBalances(game, finals).discrepancyCents === 0) return complete(finals)
      setAssigning(false)
      setChecking(true)
    }

    const update = (i: number, value: string) => setEntries((es) => es.map((e, j) => (j === i ? { ...e, value } : e)))

    // Changer d'unité convertit toutes les saisies (le montant exact reste dans `preset`).
    const switchUnit = (u: InputUnit) => {
      setEntries(stacks.map((cents) => (cents === null ? { value: '', preset: null } : { value: amountToInput(cents, u, cfg), preset: cents })))
      setInputUnit(u)
    }

    return (
      <main class={SCREEN}>
        <Header>
          {cfg && (
            <Segmented label="Unité de saisie des stacks" options={ENTRY_UNITS} value={inputUnit} onChange={switchUnit} />
          )}
        </Header>

        <section class="sticky top-0 z-10 rounded-card bg-surface px-4 py-3 text-center shadow-card">
          <p class="text-caps font-semibold uppercase text-text-muted">Reste à attribuer</p>
          <p
            class={`num font-display text-hero font-bold ${remaining === 0 ? 'text-gain' : remaining < 0 ? 'text-loss' : ''}`}
            aria-live="polite"
          >
            {fmtInput(remaining)}
          </p>
        </section>

        <form ref={form} id={formId} onSubmit={submit} onKeyDown={onKeyDown} class="rounded-card bg-surface px-4 py-1 shadow-card">
          <ul class="flex flex-col divide-y divide-border" aria-label="Stacks finaux">
            {seated.map((player, i) => {
              const { value } = entries[i]!
              const cents = stacks[i] ?? null
              const invalid = value.trim() !== '' && cents === null
              const hint = invalid ? 'Montant invalide' : cents !== null ? formatEquivalent(cents, inputUnit, cfg) : undefined
              return (
                <li key={player.id} class="flex min-h-14 items-center gap-2.5 py-2">
                  <PlayerDot color={player.color} />
                  <div class="flex min-w-0 flex-1 flex-col">
                    <span class="truncate font-semibold">{player.name}</span>
                    {hint && <span class={`num truncate text-[13px] ${invalid ? 'text-loss' : 'text-text-muted'}`}>{hint}</span>}
                  </div>
                  <CompactField
                    label={`Stack final de ${player.name}`}
                    hideLabel
                    value={value}
                    onInput={(v) => update(i, v)}
                    suffix={inputUnit === 'pts' ? 'pts' : '€'}
                    placeholder="0"
                    invalid={invalid}
                    enterKeyHint={i === n - 1 ? 'done' : 'next'}
                    class="w-32 shrink-0"
                  />
                </li>
              )
            })}
          </ul>
        </form>

        <div class="mt-auto flex gap-2.5">
          <SecondaryButton class="w-auto! shrink-0" onClick={onCancel}>
            Annuler
          </SecondaryButton>
          <PrimaryButton type="submit" form={formId} disabled={!allValid} class="min-w-0">
            Valider
          </PrimaryButton>
        </div>
      </main>
    )
  }

  // ——— Vérification : écart de comptage ———
  const finals = finalsOf(stacks)
  const diff = previewFinalBalances(game, finals).discrepancyCents
  const prorataOk = diff !== 0 && previewFinalBalances(game, finals, { type: 'prorata' }).resolved
  // Joueurs à qui imputer l'écart : ceux dont le stack compte (les partis si personne n'est assis).
  const candidates = game.players.flatMap((p) => {
    const r = previewFinalBalances(game, finals, { type: 'assign', playerId: p.id })
    const stack = r.stacks.find((s) => s.playerId === p.id)
    return r.resolved && stack ? [{ player: p, stackCents: stack.cents, ok: stack.cents >= 0 }] : []
  })
  const back = () => (n === 0 ? onCancel() : setChecking(false))

  return (
    <main class={SCREEN}>
      <Header />

      {diff === 0 ? (
        <section class="rounded-card bg-surface px-4 py-4 shadow-card">
          <p class="text-[15px]">Les comptes sont justes : aucun écart.</p>
        </section>
      ) : (
        <section class="flex flex-col gap-3 rounded-card bg-surface px-4 py-4 shadow-card">
          <p class="text-caps font-semibold uppercase text-text-muted">Écart de comptage</p>
          <p class="num font-display text-[22px] font-semibold text-loss">{discrepancyMessage(diff, cfg)}</p>
          <p class="num text-[13px] text-text-muted">
            Compté {fmt(moneyInPlayCents + diff)} pour {fmt(moneyInPlayCents)} en jeu.
          </p>

          {!assigning ? (
            <div class="flex flex-col gap-2.5 pt-1">
              <SecondaryButton onClick={back}>Corriger</SecondaryButton>
              <SecondaryButton disabled={!prorataOk} onClick={() => complete(finals, { type: 'prorata' })}>
                Répartir au prorata
              </SecondaryButton>
              <SecondaryButton onClick={() => setAssigning(true)}>Imputer à…</SecondaryButton>
            </div>
          ) : (
            <div class="flex flex-col gap-1 pt-1">
              <p class="text-body text-text-muted">Tout l'écart sera reporté sur le stack de :</p>
              <ul class="flex flex-col divide-y divide-border">
                {candidates.map(({ player, stackCents, ok }) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      disabled={!ok}
                      onClick={() => complete(finals, { type: 'assign', playerId: player.id })}
                      class="flex min-h-12 w-full items-center gap-2.5 py-2 text-left active:bg-bg disabled:text-text-faint"
                    >
                      <PlayerDot color={player.color} />
                      <span class="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
                      <span class="num shrink-0 text-[13px]">{ok ? `stack → ${fmt(stackCents)}` : 'stack insuffisant'}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setAssigning(false)} class="h-11 self-start font-semibold text-text-muted">
                Retour
              </button>
            </div>
          )}
        </section>
      )}

      <div class="mt-auto flex flex-col gap-2.5">
        {diff === 0 && <PrimaryButton onClick={() => complete(finals)}>Voir le récap</PrimaryButton>}
        {diff === 0 && <SecondaryButton onClick={back}>{n === 0 ? 'Annuler' : 'Précédent'}</SecondaryButton>}
      </div>
    </main>
  )
}
