// Fin de partie (SPEC §8.1-8.2, DESIGN §5) : saisie du stack final de chaque joueur assis, un écran
// par joueur, avec « Reste à attribuer » ; puis, s'il y a un écart de comptage, Corriger, Répartir au
// prorata ou Imputer à un joueur. Les stacks saisis restent locaux : rien n'est écrit dans le store
// avant `finish`, qui clôt la partie et range le récap dans `lastRecap` (App bascule alors sur Recap).
import { useId, useMemo, useState } from 'preact/hooks'
import { computeStats, summarizePlayers } from '../../lib/derive'
import { discrepancyMessage, previewFinalBalances, type FinalStack } from '../../lib/discrepancy'
import { amountToInput, formatAmount, formatEquivalent, parseAmountKeeping, type InputUnit } from '../../lib/units'
import type { DiscrepancyResolution } from '../../lib/types'
import { gameStore, useGame } from '../../store/useGame'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { Header } from '../components/Header'
import { NumberField } from '../components/NumberField'
import { PlayerDot } from '../components/PlayerDot'
import { Segmented, type SegmentedOption } from '../components/Segmented'
import { showToast } from '../components/Toast'
import { showUndoToast } from '../undo'

const ENTRY_UNITS: readonly SegmentedOption<InputUnit>[] = [
  { value: 'eur', label: '€', ariaLabel: 'Euros' },
  { value: 'pts', label: 'Pts', ariaLabel: 'Points' },
]

const SCREEN = 'mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-md flex-col gap-3.5 px-4 pt-3 pb-5'

export function EndGame({ onCancel }: { onCancel: () => void }) {
  const game = useGame((s) => s.game)
  const unit = useGame((s) => s.unit)
  const cfg = game.chipConfig
  // Les stacks se comptent en jetons : saisie en points par défaut s'il y a une config jetons
  // (sinon, la valeur d'un point est inconnue : tout en €). Choix local à cet écran.
  const [inputUnit, setInputUnit] = useState<InputUnit>(cfg ? 'pts' : 'eur')
  const formId = useId()

  const { seated, moneyInPlayCents } = useMemo(() => {
    const summaries = summarizePlayers(game)
    return {
      seated: [...game.players].sort((a, b) => a.seatOrder - b.seatOrder).filter((p) => summaries.get(p.id)?.status === 'seated'),
      moneyInPlayCents: computeStats(game, summaries).moneyInPlayCents,
    }
  }, [game])
  const n = seated.length

  // Stack saisi par joueur assis (centimes), `null` tant qu'il n'est pas validé. `step === n` : vérification.
  const [stacks, setStacks] = useState<(number | null)[]>(() => seated.map(() => null))
  const [step, setStep] = useState(0)
  const [value, setValue] = useState('')
  const [assigning, setAssigning] = useState(false)

  const fmt = (cents: number) => formatAmount(cents, unit, cfg, { compact: true })
  const fmtInput = (cents: number) => formatAmount(cents, inputUnit, cfg, { compact: true })

  const goTo = (i: number, list = stacks) => {
    const known = list[i]
    setValue(i < n && known != null ? amountToInput(known, inputUnit, cfg) : '')
    setAssigning(false)
    setStep(i)
  }

  const finalsOf = (list: (number | null)[]): FinalStack[] => seated.map((p, i) => ({ playerId: p.id, cents: list[i] ?? 0 }))

  const complete = (finals: FinalStack[], resolution?: DiscrepancyResolution) => {
    if (!gameStore.getState().finish(finals, resolution)) return showToast('Impossible de terminer la partie.')
    showUndoToast('Partie terminée')
  }

  // ——— Saisie d'un stack ———
  if (step < n) {
    const player = seated[step]!
    const cents = parseAmountKeeping(value, inputUnit, cfg, stacks[step] ?? null)
    const valid = cents !== null && cents >= 0
    let remaining = moneyInPlayCents - (valid ? cents : 0)
    for (let i = 0; i < step; i++) remaining -= stacks[i] ?? 0
    const last = step === n - 1

    const submit = (e: Event) => {
      e.preventDefault()
      if (!valid) return
      const next = stacks.map((s, i) => (i === step ? cents : s))
      setStacks(next)
      if (!last) return goTo(step + 1, next)
      const finals = finalsOf(next)
      if (previewFinalBalances(game, finals).discrepancyCents === 0) complete(finals)
      else goTo(n, next)
    }

    // Changer d'unité convertit la saisie en cours (les stacks déjà validés sont en centimes).
    const switchUnit = (u: InputUnit) => {
      setValue(valid ? amountToInput(cents, u, cfg) : '')
      setInputUnit(u)
    }

    return (
      <main class={SCREEN}>
        <Header>
          {cfg ? (
            <Segmented label="Unité de saisie des stacks" options={ENTRY_UNITS} value={inputUnit} onChange={switchUnit} />
          ) : (
            <span class="text-[13px] text-text-muted">Fin de partie</span>
          )}
        </Header>

        <div class="flex flex-col gap-1.5" aria-label={`Joueur ${step + 1} sur ${n}`}>
          <div class="flex items-baseline justify-between text-[13px] text-text-muted">
            <span>Stacks finaux</span>
            <span class="num font-semibold text-text">
              {step + 1} / {n}
            </span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div class="h-full rounded-full bg-accent transition-[width]" style={{ width: `${((step + 1) / n) * 100}%` }} />
          </div>
        </div>

        <section class="rounded-card bg-surface px-4 py-3 text-center shadow-card">
          <p class="text-caps font-semibold uppercase text-text-muted">Reste à attribuer</p>
          <p
            class={`num font-display text-hero font-bold ${remaining === 0 ? 'text-gain' : remaining < 0 ? 'text-loss' : ''}`}
            aria-live="polite"
          >
            {fmtInput(remaining)}
          </p>
        </section>

        <form id={formId} onSubmit={submit} class="rounded-card bg-surface px-4 pt-3 pb-1 shadow-card">
          <p class="flex items-center justify-center gap-2 font-display text-[20px] font-semibold">
            <PlayerDot color={player.color} size={12} />
            <span class="min-w-0 truncate">{player.name}</span>
          </p>
          <NumberField
            key={step}
            label="Stack final"
            value={value}
            onInput={setValue}
            unit={inputUnit === 'pts' ? 'pts' : '€'}
            equivalent={valid ? formatEquivalent(cents, inputUnit, cfg) : undefined}
            error={value.trim() !== '' && !valid ? 'Montant invalide' : undefined}
          />
        </form>

        <div class="mt-auto flex gap-2.5">
          <SecondaryButton class="w-auto! shrink-0" onClick={() => (step === 0 ? onCancel() : goTo(step - 1))}>
            {step === 0 ? 'Annuler' : 'Précédent'}
          </SecondaryButton>
          <PrimaryButton type="submit" form={formId} disabled={!valid} class="min-w-0">
            {last ? 'Valider' : 'Suivant'}
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
  const back = () => (n === 0 ? onCancel() : goTo(n - 1))

  return (
    <main class={SCREEN}>
      <Header>
        <span class="text-[13px] text-text-muted">Fin de partie</span>
      </Header>

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
