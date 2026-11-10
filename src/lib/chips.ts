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
import { divFloor } from './money'
import { fraction } from './units'
import type { ChipColor, ChipConfig, Fraction } from './types'

/** Une couleur de la mallette, avant répartition. */
export interface ChipStock {
  id: string
  name: string
  hex: string
  qty: number
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

export type ChipBlocker =
  | { kind: 'tooFewColors' }
  | { kind: 'stock'; colorName: string; needed: number; available: number }
  | { kind: 'smallChips'; colorName: string; needed: number; available: number }
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

/** Suites de valeurs (en unités de SB) de longueur k, chacune multiple de la précédente, rapport 2 à 5. */
function sequences(k: number, maxUnits: number): { sb: number; units: number[] }[] {
  const out: { sb: number; units: number[] }[] = []
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

interface Solution {
  penalty: number
  sb: number
  units: number[]
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

function assertInt(n: number, label: string, min: number): void {
  if (!Number.isSafeInteger(n) || n < min) throw new RangeError(`${label} invalide (reçu ${n})`)
}

/** Couleurs non vides triées par quantité décroissante (à égalité, ordre de saisie). */
function sortedStock(stock: readonly ChipStock[]): ChipStock[] {
  return stock.filter((s) => s.qty > 0).sort((a, b) => b.qty - a.qty)
}

/** Recherche de la meilleure répartition ; `firstOnly` s'arrête à la première trouvée (test de faisabilité). */
function search(input: ChipAssistantInput, firstOnly: boolean): Solution | null {
  const sorted = sortedStock(input.stock)
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
        best = { penalty: r.penalty, sb, units, counts: r.counts }
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
  assertInt(input.depthBB, 'profondeur', 1)
  for (const s of input.stock) assertInt(s.qty, `quantité ${s.name}`, 0)
}

/** Meilleure répartition (SPEC §5.3), ou explication de l'échec (SPEC §5.4). */
export function proposeChips(input: ChipAssistantInput): ChipProposalResult {
  validateInput(input)
  const sol = search(input, false)
  if (!sol) return { ok: false, failure: diagnose(input) }
  const sorted = sortedStock(input.stock)
  const used = new Map<string, ChipColor>()
  sol.units.forEach((u, i) => {
    const s = sorted[i]!
    used.set(s.id, { id: s.id, name: s.name, hex: s.hex, valuePoints: u * sol.sb, perPlayer: sol.counts[i]!, totalQty: s.qty })
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
  } else {
    blocker = { kind: 'composition' }
  }

  const suggestions: ChipFailure['suggestions'] = {}
  if (blocker.kind !== 'tooFewColors') {
    const feasible = (patch: Partial<ChipAssistantInput>) => search({ ...input, ...patch }, true) !== null
    for (let p = input.maxPlayers - 1; p >= 2; p--) {
      if (feasible({ maxPlayers: p })) {
        suggestions.maxPlayers = p
        break
      }
    }
    for (let r = input.rebuysPerPlayer - 1; r >= 0; r--) {
      if (feasible({ rebuysPerPlayer: r })) {
        suggestions.rebuysPerPlayer = r
        break
      }
    }
    for (let d = Math.ceil(input.depthBB / 10) * 10 - 10; d >= DEPTH_MIN; d -= 10) {
      if (feasible({ depthBB: d })) {
        suggestions.depthBB = d
        break
      }
    }
  }
  return { blocker, suggestions, message: failureMessage(input, blocker, suggestions) }
}

const intFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const plural = (n: number, word: string) => `${intFormatter.format(n)} ${word}${n > 1 ? 's' : ''}`

function failureMessage(input: ChipAssistantInput, b: ChipBlocker, s: ChipFailure['suggestions']): string {
  const stacks = `${plural(input.maxPlayers, 'joueur')} × ${1 + input.rebuysPerPlayer} stacks`
  let why: string
  switch (b.kind) {
    case 'tooFewColors':
      return `Il faut au moins ${MIN_COLORS_USED} couleurs de jetons pour composer un stack.`
    case 'stock':
      why = `Pas assez de jetons ${b.colorName} : il en faut au moins ${b.needed} (${stacks}), il y en a ${b.available}.`
      break
    case 'smallChips':
      why = `Pas assez de petits jetons ${b.colorName} : pour en donner ${MIN_SMALL_CHIPS} à chacun, il en faut ${b.needed} (${stacks}), il y en a ${b.available}.`
      break
    case 'composition':
      why = `Impossible de composer un stack de ${input.depthBB} BB avec ces quantités tout en gardant de quoi faire la monnaie.`
      break
  }
  const fixes: string[] = []
  if (s.maxPlayers !== undefined) fixes.push(`prévoir ${s.maxPlayers} joueurs au plus`)
  if (s.rebuysPerPlayer !== undefined) fixes.push(`prévoir ${plural(s.rebuysPerPlayer, 'recave')} par joueur`)
  if (s.depthBB !== undefined) fixes.push(`descendre à ${s.depthBB} BB`)
  if (fixes.length === 0) return `${why} Ajouter des jetons ou des couleurs.`
  return `${why} Pour y arriver : ${fixes.join(', ou ')}.`
}

/**
 * Totaux d'une répartition, recalculés à chaque modification manuelle (SPEC §5.4).
 * Une couleur est utilisée si sa valeur et son nombre par joueur sont > 0 ; la SB est la plus petite valeur utilisée.
 */
export function summarizeChips(colors: readonly ChipColor[], buyInCents: number, maxPlayers: number): ChipSummary {
  const issues: ChipIssue[] = []
  const valid = (c: ChipColor) =>
    [c.valuePoints, c.perPlayer, c.totalQty].every((n) => Number.isSafeInteger(n) && n >= 0)
  for (const c of colors) if (!valid(c)) issues.push({ kind: 'invalid', colorId: c.id })
  const used = colors.filter((c) => valid(c) && c.valuePoints > 0 && c.perPlayer > 0)
  if (used.length === 0) issues.push({ kind: 'empty' })

  const seen = new Set<number>()
  for (const c of used) {
    if (seen.has(c.valuePoints)) issues.push({ kind: 'duplicateValue', valuePoints: c.valuePoints })
    seen.add(c.valuePoints)
  }

  let rebuysPossible = Infinity
  const rows = colors.map((c) => {
    if (!valid(c)) return { id: c.id, reserve: 0, rebuys: null }
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
  return {
    sbPoints,
    bbPoints,
    stackPoints,
    stackBBTenths: bbPoints ? divFloor(stackPoints * 10, bbPoints) : 0,
    centsPerPoint: stackPoints > 0 ? fraction(buyInCents, stackPoints) : null,
    chipsPerPlayer: used.reduce((s, c) => s + c.perPlayer, 0),
    colors: rows,
    rebuysPossible: rebuysPossible === Infinity ? 0 : rebuysPossible,
    issues,
  }
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
      .filter((c) => c.valuePoints > 0 && c.perPlayer > 0)
      .slice()
      .sort((a, b) => a.valuePoints - b.valuePoints),
  }
}
