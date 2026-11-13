// Assistant de répartition des jetons (SPEC §5), en sheet plein écran.
// Deux vues : le formulaire (buy-in, joueurs, recaves, profondeur, couleurs de la mallette),
// puis le résultat de lib/chips : la meilleure proposition, modifiable à la main avec les totaux
// recalculés en direct (summarizeChips), ou le message d'échec avec ce qu'on peut assouplir.
import { X } from 'lucide-preact'
import { useEffect, useId, useState } from 'preact/hooks'
import { CHIP_KITS, CHIP_PALETTE, DEFAULT_CHIP_COLORS, nextChipColor, paletteEntry, type ChipKit } from '../../lib/chipColors'
import { DEPTH_MAX, DEPTH_MIN, MAX_FIXED_VALUE, MAX_REBUYS_SHOWN, SMALL_CHIPS_ADVISED, duplicateFixedValues, isRebuyColor, proposeChips, summarizeChips, toChipConfig, type ChipFailure, type ChipIssue } from '../../lib/chips'
import { summarizePlayers } from '../../lib/derive'
import { centsToInput, formatCents, parseEuros } from '../../lib/money'
import { MAX_SEATED, MIN_PLAYERS_TO_START } from '../../lib/players'
import type { ChipColor } from '../../lib/types'
import { formatEuroFraction, fraction, parseCount } from '../../lib/units'
import { gameStore, useGame } from '../../store/useGame'
import { BottomSheet } from '../components/BottomSheet'
import { PrimaryButton, SecondaryButton } from '../components/Button'
import { ChipDot } from '../components/ChipDot'
import { CompactField } from '../components/CompactField'
import { Stepper } from '../components/Stepper'
import { showToast } from '../components/Toast'
import { showUndoToast } from '../undo'

const MIN_STOCK = 4
const MAX_STOCK = 7
const MAX_REBUYS = 5
/** Joueurs prévus par défaut quand la table en compte moins de 2. */
const DEFAULT_MAX_PLAYERS = 6

const fr = new Intl.NumberFormat('fr-FR')
const frTenths = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const plural = (n: number, word: string) => `${fr.format(n)} ${word}${n > 1 ? 's' : ''}`

/** Couleur de la mallette telle que saisie (quantité en texte). */
interface StockRow {
  id: string
  name: string
  hex: string
  qty: string
  /** Valeur imposée en points ; vide ou « auto » = PokerVice choisit. */
  value: string
}

/** Ligne de la proposition, modifiable (valeur et nombre par joueur en texte). */
interface EditRow {
  id: string
  name: string
  hex: string
  totalQty: number
  value: string
  perPlayer: string
}

let rowCounter = 0
const rowId = () => `c${++rowCounter}`

function stockRow(entry: { name: string; hex: string }, qty = ''): StockRow {
  return { id: rowId(), name: entry.name, hex: entry.hex, qty, value: '' }
}

export function ChipAssistantSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const game = useGame((s) => s.game)
  const cfg = game.chipConfig
  const running = game.status === 'running'

  const formId = useId()
  const [view, setView] = useState<'form' | 'result'>('form')
  const [buyIn, setBuyIn] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(DEFAULT_MAX_PLAYERS)
  const [rebuys, setRebuys] = useState(1)
  const [depth, setDepth] = useState(100)
  const [stock, setStock] = useState<StockRow[]>([])
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [rows, setRows] = useState<EditRow[]>([])
  const [failure, setFailure] = useState<ChipFailure | null>(null)

  useEffect(() => {
    if (!open) return
    const seated = running
      ? [...summarizePlayers(game).values()].filter((s) => s.status === 'seated').length
      : game.players.length
    setView('form')
    setBuyIn(centsToInput(game.defaultBuyInCents))
    setMaxPlayers(seated >= MIN_PLAYERS_TO_START ? Math.min(seated, MAX_SEATED) : DEFAULT_MAX_PLAYERS)
    setRebuys(1)
    setDepth(100)
    // Configuration existante : on repart de ses couleurs (les couleurs en réserve n'y sont pas gardées).
    const initial = cfg?.mode === 'assistant' && cfg.colors ? cfg.colors.map((c) => stockRow(c, String(c.totalQty))) : DEFAULT_CHIP_COLORS.map((c) => stockRow(c))
    while (initial.length < MIN_STOCK) initial.push(stockRow(nextChipColor(initial.map((r) => r.hex))))
    setStock(initial)
    setPickerFor(null)
    setFailure(null)
  }, [open])

  const buyInCents = parseEuros(buyIn)
  const buyInValid = buyInCents !== null && buyInCents > 0
  const stockValid = stock.length >= MIN_STOCK && stock.every((r) => r.name.trim() !== '' && (parseCount(r.qty) ?? 0) > 0)
  // Valeur imposée : vide ou « auto » (`undefined`) ou entier de 1 à MAX_FIXED_VALUE, sans doublon ; `null` = invalide.
  const fixedOf = (r: StockRow): number | undefined | null => {
    if (r.value.trim() === '' || r.value.trim().toLowerCase() === 'auto') return undefined
    const v = parseCount(r.value)
    return v !== null && v >= 1 && v <= MAX_FIXED_VALUE ? v : null
  }
  const duplicates = duplicateFixedValues(stock.map((r) => ({ fixedValue: fixedOf(r) ?? undefined })))
  const valueInvalid = (r: StockRow) => {
    const v = fixedOf(r)
    return v === null || (v !== undefined && duplicates.has(v))
  }
  const valuesValid = !stock.some(valueInvalid)
  const formValid = buyInValid && stockValid && valuesValid

  const updateStock = (id: string, patch: Partial<StockRow>) => setStock((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  // Mallette précomposée : remplace toutes les lignes (quantités et valeurs imprimées).
  const loadKit = (kit: ChipKit) => {
    setStock(kit.colors.map((c) => ({ ...stockRow(paletteEntry(c.color), String(c.qty)), value: c.value === undefined ? '' : String(c.value) })))
    setPickerFor(null)
  }

  const pickColor = (row: StockRow, hex: string) => {
    const entry = CHIP_PALETTE.find((c) => c.hex === hex)!
    const oldName = CHIP_PALETTE.find((c) => c.hex === row.hex)?.name
    // Le nom suit la couleur tant qu'il n'a pas été renommé à la main.
    const renamed = row.name.trim() !== '' && row.name !== oldName
    updateStock(row.id, { hex, name: renamed ? row.name : entry.name })
    setPickerFor(null)
  }

  const propose = (e: Event) => {
    e.preventDefault()
    if (view === 'result') return validate()
    if (!formValid) return
    const result = proposeChips({
      buyInCents: buyInCents!,
      maxPlayers,
      rebuysPerPlayer: rebuys,
      depthBB: depth,
      stock: stock.map((r) => ({ id: r.id, name: r.name.trim(), hex: r.hex, qty: parseCount(r.qty)!, fixedValue: fixedOf(r) ?? undefined })),
    })
    if (result.ok) {
      setRows(result.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, totalQty: c.totalQty, value: String(c.valuePoints), perPlayer: String(c.perPlayer) })))
      setFailure(null)
    } else {
      setFailure(result.failure)
    }
    setView('result')
  }

  // Résultat : recalcul en direct de la proposition modifiée.
  const colors: ChipColor[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    hex: r.hex,
    totalQty: r.totalQty,
    valuePoints: parseCount(r.value) ?? NaN,
    perPlayer: parseCount(r.perPlayer) ?? NaN,
  }))
  const summary = view === 'result' && !failure && buyInValid ? summarizeChips(colors, buyInCents!, maxPlayers) : null
  const proposalValid = !!summary && summary.issues.length === 0 && !!summary.centsPerPoint

  const validate = () => {
    if (!summary || !proposalValid) return
    const config = toChipConfig(colors, buyInCents!, maxPlayers)
    if (!gameStore.getState().setChipConfig(config, buyInCents!)) return showToast("Impossible d'enregistrer la répartition.")
    onClose()
    showUndoToast('Répartition des jetons enregistrée')
  }

  const remove = () => {
    if (!gameStore.getState().setChipConfig(undefined)) return
    onClose()
    showUndoToast('Répartition des jetons retirée')
  }

  const footer =
    view === 'form' ? (
      <PrimaryButton key="propose" type="submit" form={formId} disabled={!formValid}>
        Proposer une répartition
      </PrimaryButton>
    ) : failure ? (
      <PrimaryButton key="back" onClick={() => setView('form')}>
        Modifier les paramètres
      </PrimaryButton>
    ) : (
      <PrimaryButton key="validate" type="submit" form={formId} disabled={!proposalValid}>
        Valider la répartition
      </PrimaryButton>
    )

  return (
    <BottomSheet open={open} onClose={onClose} title="Répartition des jetons" full footer={footer}>
      <form id={formId} onSubmit={propose} class="flex flex-col gap-4 pb-4">
        {view === 'form' && (
          <>
            <section class="flex flex-col gap-2">
              <CompactField label="Buy-in" value={buyIn} onInput={setBuyIn} suffix="€" invalid={buyIn.trim() !== '' && !buyInValid} class="w-40" />
              <Stepper label="Joueurs au plus" value={maxPlayers} onChange={setMaxPlayers} min={MIN_PLAYERS_TO_START} max={MAX_SEATED} />
              <Stepper label="Recaves prévues par joueur" value={rebuys} onChange={setRebuys} min={0} max={MAX_REBUYS} />
              <Stepper label="Profondeur" value={depth} onChange={setDepth} min={DEPTH_MIN} max={DEPTH_MAX} step={10} format={(d) => `${d} BB`} />
            </section>

            <fieldset class="flex flex-col gap-2">
              <legend class="mb-1 font-semibold">
                Couleurs de la mallette <span class="font-normal text-text-muted">({MIN_STOCK} à {MAX_STOCK})</span>
              </legend>
              <div class="flex flex-wrap gap-2">
                {CHIP_KITS.map((kit) => (
                  <button
                    key={kit.name}
                    type="button"
                    onClick={() => loadKit(kit)}
                    class="h-11 rounded-full border border-border-strong bg-bg px-4 font-semibold active:bg-surface-muted"
                  >
                    {kit.name}
                  </button>
                ))}
              </div>
              <div class="flex gap-2 text-[12px] text-text-muted" aria-hidden="true">
                <span class="flex-1 pl-[52px]">Nom</span>
                <span class="w-20 text-right">Quantité</span>
                <span class={`w-20 text-right ${stock.length > MIN_STOCK ? 'mr-[52px]' : ''}`}>Valeur (pts)</span>
              </div>
              {stock.map((row) => (
                <div key={row.id} class="flex flex-col gap-1">
                  <div class="flex items-end gap-2">
                    <button
                      type="button"
                      aria-label={`Couleur : ${row.name || 'sans nom'}, changer`}
                      aria-expanded={pickerFor === row.id}
                      onClick={() => setPickerFor(pickerFor === row.id ? null : row.id)}
                      class="flex size-11 shrink-0 items-center justify-center rounded-full active:bg-surface-muted"
                    >
                      <ChipDot hex={row.hex} size={30} />
                    </button>
                    <CompactField
                      label="Nom"
                      hideLabel
                      value={row.name}
                      onInput={(name) => updateStock(row.id, { name })}
                      inputMode="text"
                      invalid={row.name.trim() === ''}
                      class="flex-1"
                    />
                    <CompactField
                      label={`Quantité de jetons ${row.name}`}
                      hideLabel
                      value={row.qty}
                      onInput={(qty) => updateStock(row.id, { qty })}
                      inputMode="numeric"
                      placeholder="Qté"
                      invalid={row.qty.trim() !== '' && !(parseCount(row.qty)! > 0)}
                      class="w-20"
                    />
                    <CompactField
                      label={`Valeur imposée d'un jeton ${row.name}, en points (vide : PokerVice choisit la meilleure)`}
                      hideLabel
                      value={row.value}
                      onInput={(value) => updateStock(row.id, { value })}
                      inputMode="numeric"
                      placeholder="auto"
                      invalid={valueInvalid(row)}
                      class="w-20"
                    />
                    {stock.length > MIN_STOCK && (
                      <button
                        type="button"
                        aria-label={`Retirer ${row.name}`}
                        onClick={() => setStock((rs) => rs.filter((r) => r.id !== row.id))}
                        class="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted active:bg-surface-muted"
                      >
                        <X size={20} strokeWidth={2} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {pickerFor === row.id && (
                    <div role="radiogroup" aria-label={`Couleur de ${row.name}`} class="grid grid-cols-5 justify-items-center rounded-row bg-bg py-1">
                      {CHIP_PALETTE.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          role="radio"
                          aria-checked={c.hex === row.hex}
                          aria-label={c.name}
                          onClick={() => pickColor(row, c.hex)}
                          class={`flex size-11 items-center justify-center rounded-full ${c.hex === row.hex ? 'bg-surface-muted' : ''}`}
                        >
                          <ChipDot hex={c.hex} size={28} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {stock.length < MAX_STOCK && (
                <button
                  type="button"
                  onClick={() => setStock((rs) => [...rs, stockRow(nextChipColor(rs.map((r) => r.hex)))])}
                  class="h-11 self-start text-body font-semibold text-accent-text"
                >
                  + Ajouter une couleur
                </button>
              )}
              {!stockValid && <p class="text-[13px] text-text-muted">Indiquez un nom et une quantité pour chaque couleur.</p>}
              {valuesValid ? (
                <p class="text-[13px] text-text-muted">
                  Valeur en points imprimée sur vos jetons, s'il y en a une. En « auto », PokerVice choisit la meilleure. Une
                  couleur qui n'entre pas dans le stack reste en réserve.
                </p>
              ) : (
                <p class="text-[13px] text-loss">
                  {duplicates.size > 0 ? 'Deux couleurs ne peuvent pas avoir la même valeur.' : 'Valeur invalide : un nombre entier de points.'}
                </p>
              )}
            </fieldset>

            {cfg?.mode === 'assistant' && !running && (
              <button type="button" onClick={remove} class="h-11 self-start text-body font-semibold text-loss">
                Retirer la répartition
              </button>
            )}
          </>
        )}

        {view === 'result' && failure && (
          <section class="rounded-card border-l-4 border-loss bg-bg px-4 py-3" role="alert">
            <p class="font-semibold">Aucune répartition possible</p>
            <p class="mt-1 text-body">{failure.message}</p>
          </section>
        )}

        {view === 'result' && summary && (
          <Proposal rows={rows} setRows={setRows} colors={colors} summary={summary} buyInCents={buyInCents!} running={running} onBack={() => setView('form')} />
        )}
      </form>
    </BottomSheet>
  )
}

interface ProposalProps {
  rows: EditRow[]
  setRows: (update: (rows: EditRow[]) => EditRow[]) => void
  colors: ChipColor[]
  summary: ReturnType<typeof summarizeChips>
  buyInCents: number
  running: boolean
  onBack: () => void
}

function Proposal({ rows, setRows, colors, summary, buyInCents, running, onBack }: ProposalProps) {
  const update = (id: string, patch: Partial<EditRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const byId = new Map(summary.colors.map((c) => [c.id, c]))
  const invalidIds = new Set(summary.issues.flatMap((i) => (i.kind === 'invalid' || i.kind === 'stockExceeded' ? [i.colorId] : [])))
  const cpp = summary.centsPerPoint

  return (
    <>
      <section class="flex overflow-hidden rounded-card bg-surface shadow-card">
        <div class="min-w-0 flex-1 border-l-4 border-accent px-3.5 py-3">
          <p class="text-caps font-semibold uppercase text-accent-text">Stack de départ</p>
          <p class="num font-display text-hero font-bold">{fr.format(summary.stackPoints)} pts</p>
          <p class="num text-[13px] text-text-muted">
            {formatCents(buyInCents, { compact: true })} · {frTenths.format(summary.stackBBTenths / 10)} BB · {plural(summary.chipsPerPlayer, 'jeton')}
          </p>
        </div>
        <dl class="flex w-[42%] flex-col justify-center gap-1 border-l border-border px-3.5 py-3 text-[13px]">
          <Stat label="SB">{fr.format(summary.sbPoints)}</Stat>
          <Stat label="BB">{fr.format(summary.bbPoints)}</Stat>
          <Stat label="1 pt">{cpp ? formatEuroFraction(cpp) : '—'}</Stat>
        </dl>
      </section>

      <section class="flex flex-col" aria-label="Valeur et nombre de jetons par couleur">
        <div class="flex gap-2 pb-1 text-[12px] text-text-muted">
          <span class="flex-1">Couleur</span>
          <span class="w-24 text-right">Valeur (pts)</span>
          <span class="w-20 text-right">Par joueur</span>
        </div>
        <ul class="flex flex-col divide-y divide-border">
          {rows.map((r, i) => {
            const c = colors[i]!
            const line = byId.get(r.id)
            const used = c.valuePoints > 0 && c.perPlayer > 0
            const euro = cpp && Number.isSafeInteger(c.valuePoints) && c.valuePoints > 0 ? formatEuroFraction(fraction(c.valuePoints * cpp.num, cpp.den)) : null
            const forRebuys = isRebuyColor(c) && Number.isSafeInteger(c.valuePoints)
            return (
              <li key={r.id} class="flex items-center gap-2 py-2">
                <ChipDot hex={r.hex} size={24} />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-semibold">{r.name}</p>
                  <p class="num truncate text-[12px] text-text-muted">
                    {used
                      ? `${euro ? `${euro} · ` : ''}réserve ${fr.format(line?.reserve ?? 0)}`
                      : forRebuys
                        ? `${euro ? `${euro} · ` : ''}recaves seulement : ${plural(r.totalQty, 'jeton')}`
                        : `en réserve : ${plural(r.totalQty, 'jeton')}`}
                  </p>
                </div>
                <CompactField
                  label={`Valeur d'un jeton ${r.name}, en points`}
                  hideLabel
                  value={r.value}
                  onInput={(value) => update(r.id, { value })}
                  inputMode="numeric"
                  invalid={invalidIds.has(r.id)}
                  class="w-24"
                />
                <CompactField
                  label={`Jetons ${r.name} par joueur`}
                  hideLabel
                  value={r.perPlayer}
                  onInput={(perPlayer) => update(r.id, { perPlayer })}
                  inputMode="numeric"
                  invalid={invalidIds.has(r.id)}
                  class="w-20"
                />
              </li>
            )
          })}
        </ul>
      </section>

      {summary.issues.length > 0 ? (
        <ul class="flex flex-col gap-1 text-body text-loss" role="alert">
          {summary.issues.map((issue, i) => (
            <li key={i}>{issueText(issue, rows)}</li>
          ))}
        </ul>
      ) : (
        <div class="flex flex-col gap-1">
          {summary.smallChipsPerPlayer < SMALL_CHIPS_ADVISED && (
            <p class="num text-body text-accent-text">
              Seulement {summary.smallChipsPerPlayer} petits jetons par joueur ({SMALL_CHIPS_ADVISED} conseillés) : la mallette n'en a pas
              assez pour mieux faire.
            </p>
          )}
          <p class="num text-body text-text-muted">
            La réserve permet {summary.rebuysPossible >= MAX_REBUYS_SHOWN ? `${MAX_REBUYS_SHOWN} recaves ou plus` : plural(summary.rebuysPossible, 'recave')}{' '}
            pour toute la table (gros jetons d'abord : on fait la monnaie à la table).
            {running && ' Une fois validée, la répartition ne pourra plus être modifiée.'}
          </p>
        </div>
      )}

      <SecondaryButton onClick={onBack}>Modifier les paramètres</SecondaryButton>
    </>
  )
}

function Stat({ label, children }: { label: string; children: string }) {
  return (
    <div class="flex items-baseline justify-between gap-2">
      <dt class="text-text-muted">{label}</dt>
      <dd class="num font-semibold">{children}</dd>
    </div>
  )
}

function issueText(issue: ChipIssue, rows: readonly EditRow[]): string {
  const name = (id: string) => rows.find((r) => r.id === id)?.name ?? ''
  switch (issue.kind) {
    case 'empty':
      return 'Aucune couleur utilisée : donnez une valeur et un nombre par joueur.'
    case 'invalid':
      return `${name(issue.colorId)} : valeur ou nombre invalide.`
    case 'stockExceeded':
      return `Pas assez de jetons ${name(issue.colorId)} : il en faut ${fr.format(issue.needed)}, il y en a ${fr.format(issue.available)}.`
    case 'duplicateValue':
      return `Deux couleurs valent ${fr.format(issue.valuePoints)} pts.`
    case 'invalidSettings':
      return 'Buy-in ou nombre de joueurs invalide.'
    case 'tooLarge':
      return 'Stack trop grand.'
  }
}
