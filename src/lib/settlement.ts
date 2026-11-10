// Règlement final : nombre minimal exact de virements (SPEC §8.3).
//
// Principe : si les n balances non nulles se partitionnent en k sous-groupes disjoints de somme
// nulle, chaque groupe de taille m se règle en m − 1 virements, soit n − k au total ; et on ne
// peut pas faire mieux. Minimiser les virements revient donc à maximiser k, ce qu'on fait par
// programmation dynamique sur les masques de bits (n ≤ 20 → au plus 2^20 états).
import { roundToEuro } from './money'

export interface Balance {
  playerId: string
  balanceCents: number
}

export interface Transfer {
  from: string
  to: string
  amountCents: number
}

/** Au-delà, 2^n états deviennent trop coûteux : repli sur le glouton (valide mais pas forcément minimal). */
export const MAX_EXACT_PARTICIPANTS = 20

/** Ordre canonique : montant décroissant, puis id. Rend tout le calcul déterministe. */
function byAmountThenId(a: Balance, b: Balance): number {
  return b.balanceCents - a.balanceCents || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0)
}

/**
 * Partition en un nombre maximal de sous-groupes de somme nulle.
 * `dp[mask]` = nombre maximal de groupes de somme nulle « fermés » en retirant les éléments de
 * `mask` un par un ; `dp[mask] = max_i dp[mask \ i] + (somme(mask) = 0)`. En redescendant le
 * chemin optimal depuis le masque plein, les masques de somme nulle rencontrés délimitent les groupes.
 */
function zeroSumGroups(items: Balance[]): Balance[][] {
  const n = items.length
  const full = (1 << n) - 1
  // Float64Array : sommes d'entiers exactes jusqu'à 2^53, largement suffisant.
  const sum = new Float64Array(1 << n)
  const dp = new Uint8Array(1 << n)
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask
    sum[mask] = sum[mask ^ low]! + items[31 - Math.clz32(low)]!.balanceCents
    let best = 0
    for (let rest = mask; rest; rest &= rest - 1) {
      const v = dp[mask ^ (rest & -rest)]!
      if (v > best) best = v
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0)
  }

  const groups: Balance[][] = []
  let mask = full
  let current: Balance[] = []
  while (mask) {
    // Le premier élément (dans l'ordre canonique) qui conserve l'optimum : choix déterministe.
    const target = dp[mask]! - (sum[mask] === 0 ? 1 : 0)
    let i = 0
    while (!((mask >> i) & 1) || dp[mask ^ (1 << i)] !== target) i++
    current.push(items[i]!)
    mask ^= 1 << i
    if (sum[mask] === 0) {
      groups.push(current)
      current = []
    }
  }
  return groups
}

/** Le plus gros débiteur paie le plus gros créancier, jusqu'à extinction. Au plus m − 1 virements. */
function settleGreedy(group: Balance[]): Transfer[] {
  const left = group.map((b) => ({ ...b }))
  const out: Transfer[] = []
  for (;;) {
    left.sort(byAmountThenId)
    const creditor = left[0]
    const debtor = left[left.length - 1]!
    if (!creditor || creditor.balanceCents <= 0) return out
    const amountCents = Math.min(creditor.balanceCents, -debtor.balanceCents)
    out.push({ from: debtor.playerId, to: creditor.playerId, amountCents })
    creditor.balanceCents -= amountCents
    debtor.balanceCents += amountCents
  }
}

/**
 * Virements qui soldent toutes les balances, en nombre minimal exact.
 * Les balances doivent être des centimes entiers de somme nulle ; les balances nulles sont ignorées.
 * Résultat trié par montant décroissant, puis payeur, puis receveur.
 */
export function settle(balances: readonly Balance[]): Transfer[] {
  let total = 0
  for (const b of balances) {
    if (!Number.isSafeInteger(b.balanceCents)) throw new RangeError(`balance non entière pour ${b.playerId}`)
    total += b.balanceCents
  }
  if (total !== 0) throw new RangeError(`la somme des balances doit être nulle (reçu ${total} centimes)`)

  const items = balances.filter((b) => b.balanceCents !== 0).sort(byAmountThenId)
  const groups = items.length <= MAX_EXACT_PARTICIPANTS ? zeroSumGroups(items) : [items]
  const transfers = groups.flatMap(settleGreedy)
  return transfers.sort(
    (a, b) =>
      b.amountCents - a.amountCents ||
      (a.from < b.from ? -1 : a.from > b.from ? 1 : 0) ||
      (a.to < b.to ? -1 : a.to > b.to ? 1 : 0),
  )
}

/**
 * Option « Arrondir à l'euro » : chaque virement est arrondi à l'euro le plus proche et ceux qui
 * tombent à 0 disparaissent. Chaque virement débite exactement ce qu'il crédite, donc la somme
 * des soldes reste nulle par construction ; les paires payeur → receveur ne changent pas.
 * Écart par joueur : au plus 0,50 € par virement qui le concerne.
 */
export function roundTransfers(transfers: readonly Transfer[]): Transfer[] {
  return transfers
    .map((t) => ({ ...t, amountCents: roundToEuro(t.amountCents) }))
    .filter((t) => t.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents)
}
