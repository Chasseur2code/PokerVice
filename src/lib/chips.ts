// Assistant de répartition des jetons (SPEC §5) : valeurs des couleurs et stack de départ.
//
// Recherche exhaustive sur un petit espace :
//   - couleurs triées par quantité décroissante ; avec k couleurs utilisées, on prend les k plus
//     nombreuses (leurs plafonds dominent ceux de tout autre choix de k couleurs) ;
//   - la plus nombreuse vaut la SB, les suivantes des valeurs croissantes de la série ronde,
//     chacune multiple de la précédente avec un rapport de 2 à 5 (la monnaie se fait toujours exactement) ;
//   - pour chaque suite, une programmation dynamique sur le montant cumulé trouve la composition
//     exacte du stack qui minimise une pénalité séparable couleur par couleur.
// Tout est calculé en « unités » = multiples de la SB, puis converti en points.
//
// Valeurs imposées (`fixedValue`, ex. jetons imprimés) : la couleur est forcément utilisée, à cette
// valeur ; les couleurs libres comblent les trous (la plus nombreuse sur la plus petite valeur libre).
// Entre deux valeurs libres, la règle reste « multiple, rapport 2 à 5 » ; à côté d'une valeur imposée,
// seulement « rapport 2 à 5 » (5-10-25 est courant), et deux valeurs imposées doivent juste croître.
// L'unité de calcul est alors le PGCD des valeurs.
import { divFloor, divRound } from './money'
import { fraction } from './units'
import type { ChipColor, ChipConfig, Fraction } from './types'

/** Une couleur de la mallette, avant répartition. */
export interface ChipStock {
  id: string
  name: string
  hex: string
  qty: number
  /** Valeur imposée en points ; absente = l'assistant la choisit. */
  fixedValue?: number
}

export interface ChipAssistantInput {
  buyInCents: number
  maxPlayers: number
  rebuysPerPlayer: number
  depthBB: number
  stock: readonly ChipStock[]
}

/** Recalcul d'une répartition (proposée ou modifiée à la main). */
export interface ChipSummary {
  sbPoints: number
  bbPoints: number
  stackPoints: number
  /** Profondeur réelle du stack, en dixièmes de BB (1000 = 100 BB). */
  stackBBTenths: number
  /** 1 point = buy-in ÷ stack ; `null` si le stack est vide. */
  centsPerPoint: Fraction | null
  chipsPerPlayer: number
  /** Une ligne par couleur, dans l'ordre reçu. `rebuys` = stacks complets que la réserve permet encore. */
  colors: { id: string; reserve: number; rebuys: number | null }[]
  /** Nombre de recaves (stacks complets) que la réserve permet pour toute la table. */
  rebuysPossible: number
  issues: ChipIssue[]
}

export type ChipIssue =
  | { kind: 'empty' }
  | { kind: 'invalid'; colorId: string }
  | { kind: 'stockExceeded'; colorId: string; needed: number; available: number }
  | { kind: 'duplicateValue'; valuePoints: number }
  /** Buy-in ou nombre de joueurs invalide. */
  | { kind: 'invalidSettings' }
  /** Stack trop grand pour un calcul entier exact. */
  | { kind: 'tooLarge' }

export type ChipBlocker =
  | { kind: 'tooFewColors' }
  | { kind: 'stock'; colorName: string; needed: number; available: number }
  | { kind: 'smallChips'; colorName: string; needed: number; available: number }
  /** Possible sans les valeurs imposées, mais pas avec. */
  | { kind: 'fixedValues'; values: number[] }
  | { kind: 'composition' }

export interface ChipFailure {
  blocker: ChipBlocker
  /** Assouplissements qui suffisent, chacun pris seul (absents si aucun ne marche). */
  suggestions: { maxPlayers?: number; rebuysPerPlayer?: number; depthBB?: number }
  message: string
}

export type ChipProposalResult =
  | { ok: true; colors: ChipColor[]; summary: ChipSummary }
  | { ok: false; failure: ChipFailure }

/** Couleurs utilisées au minimum (SPEC : 4 à 7 saisies, dont certaines peuvent rester en réserve). */
export const MIN_COLORS_USED = 3
/** Plancher dur de jetons de SB par joueur ; en dessous de TARGET_SMALL_CHIPS, la note baisse. */
export const MIN_SMALL_CHIPS = 8
export const TARGET_SMALL_CHIPS = 10
export const DEPTH_MIN = 50
export const DEPTH_MAX = 200
/** Plafond d'une valeur imposée (points) : garde les calculs entiers exacts. */
export const MAX_FIXED_VALUE = 1_000_000

/** Série ronde : 1, 2, 5, 10, 25, 50, 100, 250, 500, 1 000, 2 500… */
const SERIES: number[] = [1, 2, 5]
for (let m = 10; m <= 1e8; m *= 10) SERIES.push(m, (m * 5) / 2, m * 5)

/** Valeurs de SB essayées ; à suite équivalente (mêmes rapports), la plus petite est gardée. */
const SB_CANDIDATES = [1, 2, 5, 10, 25, 50, 100]

// Poids de la pénalité (plus bas = mieux). Valeurs réglées sur des mallettes de 300 et 500 jetons.
const W_CHIP = 1 // chaque jeton dans le stack (un stack énorme est peu pratique)
const W_SMALL_MISSING = 12 // par petit jeton manquant sous TARGET_SMALL_CHIPS
const W_SMALL_BONUS = 0.6 // par petit jeton jusqu'à SMALL_BONUS_CAP (liquidité)
const SMALL_BONUS_CAP = 20
const W_CHANGE = 4 // par « monnaie » manquante (on vise 2 jetons changés avec la couleur juste en dessous)
const W_BIG = 25 // part du stack × log2(valeur) : peu de valeur dans les gros jetons
/** Au-delà, une pile d'une seule couleur devient encombrante (même si le stock le permet). */
export const MAX_PER_COLOR = 20

type Sequence = { sb: number; units: number[] }
const sequenceCache = new Map<string, readonly Sequence[]>()

/** Suites de valeurs (en unités de SB) de longueur k, chacune multiple de la précédente, rapport 2 à 5. Mises en cache. */
function sequences(k: number, maxUnits: number): readonly Sequence[] {
  const key = `${k},${maxUnits}`
  let cached = sequenceCache.get(key)
  if (!cached) sequenceCache.set(key, (cached = buildSequences(k, maxUnits)))
  return cached
}

function buildSequences(k: number, maxUnits: number): Sequence[] {
  const out: Sequence[] = []
  const seen = new Set<string>()
  for (const sb of SB_CANDIDATES) {
    const walk = (seq: number[]) => {
      if (seq.length === k) {
        const units = seq.map((v) => v / sb)
        const key = units.join(',')
        if (!seen.has(key)) {
          seen.add(key)
          out.push({ sb, units })
        }
        return
      }
      const last = seq[seq.length - 1]!
      for (const v of SERIES) {
        if (v > 5 * last) break
        if (v >= 2 * last && v % last === 0 && v / sb <= maxUnits) walk([...seq, v])
      }
    }
    walk([sb])
  }
  return out
}

/** Suite de valeurs en points, avec les positions imposées. */
type FixedSequence = { values: number[]; fixed: boolean[] }

/**
 * Suites croissantes de `F.length + free` valeurs qui contiennent toutes les valeurs imposées `F`
 * (triées, distinctes) ; les valeurs libres sont prises dans la série ronde. Aucune valeur ne dépasse
 * le stack (profondeur × BB, la BB valant deux fois la première valeur).
 */
function fixedSequences(F: readonly number[], free: number, depthBB: number): FixedSequence[] {
  const out: FixedSequence[] = []
  const k = F.length + free
  const walk = (values: number[], fixed: boolean[], fi: number) => {
    if (values.length === k) {
      if (fi === F.length) out.push({ values, fixed })
      return
    }
    const last = values[values.length - 1]!
    const lastFixed = fixed[fixed.length - 1]!
    const maxValue = 2 * depthBB * values[0]!
    const nextF = F[fi]
    const ratioOk = (v: number) => v >= 2 * last && v <= 5 * last
    if (nextF !== undefined && nextF <= maxValue && (lastFixed || ratioOk(nextF))) walk([...values, nextF], [...fixed, true], fi + 1)
    if (values.length - fi >= free) return
    for (const v of SERIES) {
      if (v > 5 * last || v > maxValue || (nextF !== undefined && v >= nextF)) break
      if (ratioOk(v) && (lastFixed || v % last === 0)) walk([...values, v], [...fixed, false], fi)
    }
  }
  if (F.length === 0) return out
  walk([F[0]!], [true], 1)
  if (free > 0) for (const v of SERIES) {
    if (v >= F[0]!) break
    walk([v], [false], 0)
  }
  return out
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b]
  return a
}

interface Solution {
  penalty: number
  /** Couleur de chaque valeur, par valeur croissante. */
  colors: ChipStock[]
  values: number[]
  counts: number[]
}

/**
 * Meilleure composition pour une suite donnée : DP sur le montant cumulé (en unités).
 * `caps[i]` = plafond par joueur de la couleur i. `null` si aucune composition ne respecte les contraintes dures.
 */
function bestComposition(units: number[], caps: number[], target: number): { penalty: number; counts: number[] } | null {
  const k = units.length
  const logs = units.map((u) => Math.log2(u))
  let dp = new Float64Array(target + 1).fill(Infinity)
  dp[0] = 0
  const choice: Int32Array[] = []
  for (let i = 0; i < k; i++) {
    const w = units[i]!
    const next = new Float64Array(target + 1).fill(Infinity)
    const pick = new Int32Array(target + 1)
    const maxC = Math.min(caps[i]!, MAX_PER_COLOR, Math.floor(target / w))
    const minC = i === 0 ? MIN_SMALL_CHIPS : 1
    // Coût de c jetons de cette couleur, indépendant du montant cumulé.
    const cost = new Float64Array(maxC + 1)
    for (let c = minC; c <= maxC; c++) {
      let p = W_CHIP * c + (W_BIG * c * w * logs[i]!) / target
      if (i === 0) p += W_SMALL_MISSING * Math.max(0, TARGET_SMALL_CHIPS - c) - W_SMALL_BONUS * Math.min(c, SMALL_BONUS_CAP)
      if (i + 1 < k) p += W_CHANGE * Math.max(0, 2 - (c * w) / units[i + 1]!)
      cost[c] = p
    }
    for (let a = 0; a <= target; a++) {
      const base = dp[a]!
      if (base === Infinity) continue
      // Monnaie : les jetons inférieurs doivent pouvoir changer au moins un jeton de cette valeur.
      if (i > 0 && a < w) continue
      for (let c = minC; c <= maxC; c++) {
        const na = a + c * w
        if (na > target) break
        const v = base + cost[c]!
        if (v < next[na]!) {
          next[na] = v
          pick[na] = c
        }
      }
    }
    choice.push(pick)
    dp = next
  }
  if (dp[target] === Infinity) return null
  const counts = new Array<number>(k)
  let a = target
  for (let i = k - 1; i >= 0; i--) {
    counts[i] = choice[i]![a]!
    a -= counts[i]! * units[i]!
  }
  return { penalty: dp[target]!, counts }
}

function assertInt(n: number, label: string, min: number, max = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new RangeError(`${label} invalide (reçu ${n})`)
}

/** Couleurs non vides triées par quantité décroissante (à égalité, ordre de saisie). */
function sortedStock(stock: readonly ChipStock[]): ChipStock[] {
  return stock.filter((s) => s.qty > 0).sort((a, b) => b.qty - a.qty)
}

/** Recherche de la meilleure répartition ; `firstOnly` s'arrête à la première trouvée (test de faisabilité). */
function search(input: ChipAssistantInput, firstOnly: boolean): Solution | null {
  const sorted = sortedStock(input.stock)
  if (sorted.some((s) => s.fixedValue !== undefined)) return searchFixed(input, sorted, firstOnly)
  const stacks = input.maxPlayers * (1 + input.rebuysPerPlayer)
  const caps = sorted.map((s) => divFloor(s.qty, stacks))
  const target = 2 * input.depthBB // stack en unités de SB
  let best: Solution | null = null
  for (let k = MIN_COLORS_USED; k <= sorted.length; k++) {
    if (caps[k - 1]! < 1) break
    for (const { sb, units } of sequences(k, target)) {
      if (units.reduce((s, u) => s + u, 0) > target) continue
      const r = bestComposition(units, caps.slice(0, k), target)
      if (!r) continue
      if (!best || r.penalty < best.penalty - 1e-9) {
        best = { penalty: r.penalty, colors: sorted.slice(0, k), values: units.map((u) => u * sb), counts: r.counts }
        if (firstOnly) return best
      }
    }
  }
  return best
}

/**
 * Variante avec valeurs imposées. Une valeur imposée veut dire « si cette couleur sert, c'est à cette
 * valeur » : on essaie chaque sous-ensemble des couleurs imposées (au plus 2^7), complété par les j
 * couleurs libres les plus nombreuses ; les couleurs imposées écartées restent en réserve (un jeton à
 * 1 000 n'entre pas dans un stack de 1 000 pts). La pénalité habituelle départage.
 */
function searchFixed(input: ChipAssistantInput, sorted: ChipStock[], firstOnly: boolean): Solution | null {
  const stacks = input.maxPlayers * (1 + input.rebuysPerPlayer)
  const cap = (s: ChipStock) => divFloor(s.qty, stacks)
  // Une couleur dont il n'y a pas un jeton par stack ne peut pas servir.
  const allFixed = sorted.filter((s) => s.fixedValue !== undefined && cap(s) >= 1).sort((a, b) => a.fixedValue! - b.fixedValue!)
  const free = sorted.filter((s) => s.fixedValue === undefined)
  let best: Solution | null = null
  const consider = (sol: Solution | null): boolean => {
    if (sol && (!best || sol.penalty < best.penalty - 1e-9)) best = sol
    return firstOnly && best !== null
  }
  // Aucune couleur imposée utilisée : recherche ordinaire sur les couleurs libres.
  if (consider(search({ ...input, stock: free }, firstOnly))) return best
  for (let mask = 1; mask < 1 << allFixed.length; mask++) {
    const fixed = allFixed.filter((_, i) => mask & (1 << i))
    if (consider(searchWithFixed(input, fixed, free, cap, firstOnly))) return best
  }
  return best
}

/** Meilleure répartition qui utilise toutes les couleurs `fixed` (à leur valeur) et des couleurs libres. */
function searchWithFixed(
  input: ChipAssistantInput,
  fixed: ChipStock[],
  free: ChipStock[],
  cap: (s: ChipStock) => number,
  firstOnly: boolean,
): Solution | null {
  const F = fixed.map((s) => s.fixedValue!)
  let best: Solution | null = null
  for (let j = 0; j <= free.length; j++) {
    if (j > 0 && cap(free[j - 1]!) < 1) break
    if (fixed.length + j < MIN_COLORS_USED) continue
    for (const { values, fixed: isFixed } of fixedSequences(F, j, input.depthBB)) {
      let fi = 0
      let gi = 0
      const colors = isFixed.map((f) => (f ? fixed[fi++]! : free[gi++]!))
      const unit = values.reduce(gcd)
      const units = values.map((v) => v / unit)
      const target = (2 * input.depthBB * values[0]!) / unit
      if (units.reduce((s, u) => s + u, 0) > target) continue
      const r = bestComposition(units, colors.map(cap), target)
      if (!r) continue
      if (!best || r.penalty < best.penalty - 1e-9) {
        best = { penalty: r.penalty, colors, values, counts: r.counts }
        if (firstOnly) return best
      }
    }
  }
  return best
}

function validateInput(input: ChipAssistantInput): void {
  assertInt(input.buyInCents, 'buy-in', 1)
  assertInt(input.maxPlayers, 'nombre de joueurs', 2)
  assertInt(input.rebuysPerPlayer, 'recaves', 0)
  assertInt(input.depthBB, 'profondeur', DEPTH_MIN, DEPTH_MAX)
  const ids = new Set<string>()
  for (const s of input.stock) {
    assertInt(s.qty, `quantité ${s.name}`, 0)
    if (ids.has(s.id)) throw new RangeError(`couleur en double (id ${s.id})`)
    ids.add(s.id)
  }
  const fixed = input.stock.flatMap((s) => (s.fixedValue === undefined ? [] : [s.fixedValue]))
  for (const v of fixed) assertInt(v, 'valeur imposée', 1, MAX_FIXED_VALUE)
  if (new Set(fixed).size !== fixed.length) throw new RangeError('deux couleurs ont la même valeur imposée')
}

/** Valeurs imposées en double (à signaler dans le formulaire avant d'appeler proposeChips). */
export function duplicateFixedValues(stock: readonly Pick<ChipStock, 'fixedValue'>[]): Set<number> {
  const seen = new Set<number>()
  const dup = new Set<number>()
  for (const { fixedValue: v } of stock) {
    if (v === undefined) continue
    if (seen.has(v)) dup.add(v)
    seen.add(v)
  }
  return dup
}

/** Meilleure répartition (SPEC §5.3), ou explication de l'échec (SPEC §5.4). */
export function proposeChips(input: ChipAssistantInput): ChipProposalResult {
  validateInput(input)
  const sol = search(input, false)
  if (!sol) return { ok: false, failure: diagnose(input) }
  const used = new Map<string, ChipColor>()
  sol.colors.forEach((s, i) => {
    used.set(s.id, { id: s.id, name: s.name, hex: s.hex, valuePoints: sol.values[i]!, perPlayer: sol.counts[i]!, totalQty: s.qty })
  })
  // Couleurs utilisées par valeur croissante, puis la réserve dans l'ordre de saisie.
  const colors = [
    ...used.values(),
    ...input.stock
      .filter((s) => !used.has(s.id))
      .map((s): ChipColor => ({ id: s.id, name: s.name, hex: s.hex, valuePoints: 0, perPlayer: 0, totalQty: s.qty })),
  ]
  return { ok: true, colors, summary: summarizeChips(colors, input.buyInCents, input.maxPlayers) }
}

function diagnose(input: ChipAssistantInput): ChipFailure {
  const sorted = sortedStock(input.stock)
  const stacks = input.maxPlayers * (1 + input.rebuysPerPlayer)
  let blocker: ChipBlocker
  if (sorted.length < MIN_COLORS_USED) {
    blocker = { kind: 'tooFewColors' }
  } else if (sorted[MIN_COLORS_USED - 1]!.qty < stacks) {
    const s = sorted[MIN_COLORS_USED - 1]!
    blocker = { kind: 'stock', colorName: s.name, needed: stacks, available: s.qty }
  } else if (sorted[0]!.qty < MIN_SMALL_CHIPS * stacks) {
    blocker = { kind: 'smallChips', colorName: sorted[0]!.name, needed: MIN_SMALL_CHIPS * stacks, available: sorted[0]!.qty }
  } else if (
    sorted.some((s) => s.fixedValue !== undefined) &&
    search({ ...input, stock: input.stock.map(({ fixedValue: _, ...s }) => s) }, true)
  ) {
    const values = sorted.flatMap((s) => (s.fixedValue === undefined ? [] : [s.fixedValue])).sort((a, b) => a - b)
    blocker = { kind: 'fixedValues', values }
  } else {
    blocker = { kind: 'composition' }
  }

  const suggestions: ChipFailure['suggestions'] = {}
  if (blocker.kind !== 'tooFewColors') {
    const feasible = (patch: Partial<ChipAssistantInput>) => search({ ...input, ...patch }, true) !== null
    // Moins de stacks = plafonds plus hauts : la faisabilité est monotone en joueurs et en recaves.
    const p = largestFeasible(2, input.maxPlayers - 1, (p) => feasible({ maxPlayers: p }))
    if (p !== null) suggestions.maxPlayers = p
    const r = largestFeasible(0, input.rebuysPerPlayer - 1, (r) => feasible({ rebuysPerPlayer: r }))
    if (r !== null) suggestions.rebuysPerPlayer = r
    // Les plafonds ne dépendent pas de la profondeur : la baisser ne lève qu'un blocage de composition
    // (non monotone, d'où le parcours linéaire).
    if (blocker.kind === 'composition' || blocker.kind === 'fixedValues') {
      for (let d = Math.ceil(input.depthBB / 10) * 10 - 10; d >= DEPTH_MIN; d -= 10) {
        if (feasible({ depthBB: d })) {
          suggestions.depthBB = d
          break
        }
      }
    }
  }
  return { blocker, suggestions, message: failureMessage(input, blocker, suggestions) }
}

/** Plus grande valeur de [lo, hi] qui vérifie `ok`, supposé vrai jusqu'à un seuil puis faux ; `null` si aucune. */
function largestFeasible(lo: number, hi: number, ok: (n: number) => boolean): number | null {
  let best: number | null = null
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2)
    if (ok(mid)) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

const intFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const plural = (n: number, word: string) => `${intFormatter.format(n)} ${word}${n > 1 ? 's' : ''}`

function failureMessage(input: ChipAssistantInput, b: ChipBlocker, s: ChipFailure['suggestions']): string {
  const stacks = `${plural(input.maxPlayers, 'joueur')} × ${plural(1 + input.rebuysPerPlayer, 'stack')}`
  const n = (x: number) => intFormatter.format(x)
  let why: string
  switch (b.kind) {
    case 'tooFewColors':
      return `Il faut au moins ${MIN_COLORS_USED} couleurs de jetons pour composer un stack.`
    case 'stock':
      why = `Pas assez de jetons ${b.colorName} : il en faut au moins ${n(b.needed)} (${stacks}), il y en a ${n(b.available)}.`
      break
    case 'smallChips':
      why = `Pas assez de petits jetons ${b.colorName} : pour en donner ${MIN_SMALL_CHIPS} à chacun, il en faut ${n(b.needed)} (${stacks}), il y en a ${n(b.available)}.`
      break
    case 'fixedValues':
      why = `Aucune répartition ne respecte les valeurs imposées (${b.values.map(n).join(', ')} pts) : entre deux jetons voisins, il faut un rapport de 2 à 5, et assez de petits jetons pour faire la monnaie.`
      break
    case 'composition':
      why = `Impossible de composer un stack de ${input.depthBB} BB avec ces quantités tout en gardant de quoi faire la monnaie.`
      break
  }
  const fixes: string[] = []
  if (s.maxPlayers !== undefined) fixes.push(`prévoir ${n(s.maxPlayers)} joueurs au plus`)
  if (s.rebuysPerPlayer !== undefined) fixes.push(`prévoir ${plural(s.rebuysPerPlayer, 'recave')} par joueur`)
  if (s.depthBB !== undefined) fixes.push(`descendre à ${s.depthBB} BB`)
  if (b.kind === 'fixedValues') fixes.push('remettre une valeur en « auto » ou en changer une')
  if (fixes.length === 0) return `${why} Ajouter des jetons ou des couleurs.`
  return `${why} Pour y arriver : ${fixes.join(', ou ')}.`
}

/**
 * Totaux d'une répartition, recalculés à chaque modification manuelle (SPEC §5.4).
 * Une couleur est utilisée si sa valeur et son nombre par joueur sont > 0 ; la SB est la plus petite valeur utilisée.
 */
export function summarizeChips(colors: readonly ChipColor[], buyInCents: number, maxPlayers: number): ChipSummary {
  const issues: ChipIssue[] = []
  const settingsOk = [buyInCents, maxPlayers].every((n) => Number.isSafeInteger(n) && n >= 1)
  if (!settingsOk) {
    issues.push({ kind: 'invalidSettings' })
    maxPlayers = 0
  }
  for (const c of colors) if (!isValidColor(c)) issues.push({ kind: 'invalid', colorId: c.id })
  const used = colors.filter(isUsedColor)
  if (used.length === 0) issues.push({ kind: 'empty' })

  const seen = new Set<number>()
  const reported = new Set<number>()
  for (const c of used) {
    if (seen.has(c.valuePoints) && !reported.has(c.valuePoints)) {
      issues.push({ kind: 'duplicateValue', valuePoints: c.valuePoints })
      reported.add(c.valuePoints)
    }
    seen.add(c.valuePoints)
  }

  let rebuysPossible = Infinity
  const rows = colors.map((c) => {
    if (!isValidColor(c)) return { id: c.id, reserve: 0, rebuys: null }
    const inPlay = used.includes(c) ? c.perPlayer * maxPlayers : 0
    const reserve = c.totalQty - inPlay
    if (reserve < 0) issues.push({ kind: 'stockExceeded', colorId: c.id, needed: inPlay, available: c.totalQty })
    if (!used.includes(c)) return { id: c.id, reserve, rebuys: null }
    const rebuys = Math.max(0, divFloor(reserve, c.perPlayer))
    rebuysPossible = Math.min(rebuysPossible, rebuys)
    return { id: c.id, reserve, rebuys }
  })

  const sbPoints = used.length ? Math.min(...used.map((c) => c.valuePoints)) : 0
  const bbPoints = 2 * sbPoints
  const stackPoints = used.reduce((s, c) => s + c.valuePoints * c.perPlayer, 0)
  // stackPoints × 10 entier sûr ⇒ stackPoints aussi.
  const sizeOk = Number.isSafeInteger(stackPoints * 10)
  if (!sizeOk) issues.push({ kind: 'tooLarge' })
  return {
    sbPoints,
    bbPoints,
    stackPoints,
    // Arrondi au plus proche, comme centsToBBTenths, pour afficher la même profondeur partout.
    stackBBTenths: bbPoints && sizeOk ? divRound(stackPoints * 10, bbPoints) : 0,
    centsPerPoint: stackPoints > 0 && sizeOk && settingsOk ? fraction(buyInCents, stackPoints) : null,
    chipsPerPlayer: used.reduce((s, c) => s + c.perPlayer, 0),
    colors: rows,
    rebuysPossible: rebuysPossible === Infinity ? 0 : rebuysPossible,
    issues,
  }
}

/** Plafond des champs d'une couleur : valeur × nombre et nombre × joueurs restent des entiers sûrs. */
const MAX_COLOR_FIELD = 1e9

function isValidColor(c: ChipColor): boolean {
  return [c.valuePoints, c.perPlayer, c.totalQty].every((n) => Number.isSafeInteger(n) && n >= 0 && n <= MAX_COLOR_FIELD)
}

/** Une couleur est utilisée si elle est valide, avec une valeur et un nombre par joueur > 0. */
function isUsedColor(c: ChipColor): boolean {
  return isValidColor(c) && c.valuePoints > 0 && c.perPlayer > 0
}

/** Configuration jetons issue de l'assistant (après validation) ; seules les couleurs utilisées sont gardées. */
export function toChipConfig(colors: readonly ChipColor[], buyInCents: number, maxPlayers: number): ChipConfig {
  const s = summarizeChips(colors, buyInCents, maxPlayers)
  if (s.issues.length > 0 || !s.centsPerPoint) throw new RangeError('répartition invalide')
  return {
    mode: 'assistant',
    centsPerPoint: s.centsPerPoint,
    bbPoints: s.bbPoints,
    sbPoints: s.sbPoints,
    colors: colors
      .filter(isUsedColor)
      .sort((a, b) => a.valuePoints - b.valuePoints),
  }
}
