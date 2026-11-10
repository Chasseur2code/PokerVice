import { describe, expect, it } from 'vitest'
import { roundTransfers, settle, type Balance, type Transfer } from './settlement'

const bal = (...amounts: number[]): Balance[] => amounts.map((balanceCents, i) => ({ playerId: `p${i}`, balanceCents }))

/** Applique les virements : chaque solde doit retomber à 0. */
function residuals(balances: Balance[], transfers: Transfer[]): number[] {
  const left = new Map(balances.map((b) => [b.playerId, b.balanceCents]))
  for (const t of transfers) {
    left.set(t.from, left.get(t.from)! + t.amountCents)
    left.set(t.to, left.get(t.to)! - t.amountCents)
  }
  return [...left.values()]
}

/** Glouton classique (plus gros créancier ↔ plus gros débiteur sur tout le groupe), pour comparaison. */
function greedyCount(amounts: number[]): number {
  const b = amounts.slice()
  let n = 0
  for (;;) {
    const c = b.indexOf(Math.max(...b))
    const d = b.indexOf(Math.min(...b))
    if (b[c]! === 0) return n
    const x = Math.min(b[c]!, -b[d]!)
    b[c]! -= x
    b[d]! += x
    n++
  }
}

/** Minimum exact par recherche exhaustive (backtracking classique), indépendante de la DP. */
function bruteForceMin(amounts: number[]): number {
  const b = amounts.filter((x) => x !== 0)
  const dfs = (start: number): number => {
    while (start < b.length && b[start] === 0) start++
    if (start === b.length) return 0
    let best = Infinity
    for (let j = start + 1; j < b.length; j++) {
      if (b[j]! * b[start]! < 0) {
        b[j]! += b[start]!
        best = Math.min(best, 1 + dfs(start + 1))
        b[j]! -= b[start]!
      }
    }
    return best
  }
  return dfs(0)
}

/** Générateur pseudo-aléatoire reproductible. */
function lcg(seed: number) {
  return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
}

describe('settle', () => {
  it('ne renvoie rien sans balance non nulle', () => {
    expect(settle([])).toEqual([])
    expect(settle(bal(0, 0, 0))).toEqual([])
  })

  it('règle un cas simple', () => {
    expect(settle(bal(500, -500))).toEqual([{ from: 'p1', to: 'p0', amountCents: 500 }])
  })

  it('refuse des balances de somme non nulle ou non entières', () => {
    expect(() => settle(bal(500, -400))).toThrow(RangeError)
    expect(() => settle(bal(0.5, -0.5))).toThrow(RangeError)
  })

  it('bat le glouton quand celui-ci échoue (+8, +7, −4, −4, −7)', () => {
    const amounts = [800, 700, -400, -400, -700]
    expect(greedyCount(amounts)).toBe(4)
    const t = settle(bal(...amounts))
    expect(t).toHaveLength(3)
    expect(residuals(bal(...amounts), t).every((x) => x === 0)).toBe(true)
    // Les deux sous-groupes : {+7, −7} et {+8, −4, −4}.
    expect(t).toContainEqual({ from: 'p4', to: 'p1', amountCents: 700 })
  })

  it('isole les paires même dans un ordre piège', () => {
    // Glouton : 5 contre 5 puis… mais ici l'ordre mêle 3 et 5 ; on attend 3 virements.
    const amounts = [300, 500, -500, 500, -300, -500]
    expect(settle(bal(...amounts))).toHaveLength(3)
  })

  it('bat le glouton sur un cas plus large', () => {
    // {+12, −5, −7} et {+9, −4, −5} et {+6, −6} : 4 + 1 = 5 virements.
    const amounts = [1200, 900, 600, -700, -600, -500, -500, -400]
    expect(greedyCount(amounts)).toBeGreaterThan(5)
    expect(settle(bal(...amounts))).toHaveLength(5)
  })

  it('atteint le minimum exact sur 300 cas aléatoires', () => {
    const rnd = lcg(42)
    for (let k = 0; k < 300; k++) {
      const n = 2 + Math.floor(rnd() * 7)
      const amounts = Array.from({ length: n - 1 }, () => Math.round((rnd() - 0.5) * 20) * 100)
      amounts.push(-amounts.reduce((s, x) => s + x, 0))
      const balances = bal(...amounts)
      const t = settle(balances)
      expect(t.length).toBe(bruteForceMin(amounts))
      expect(residuals(balances, t).every((x) => x === 0)).toBe(true)
      expect(t.every((x) => x.amountCents > 0 && Number.isInteger(x.amountCents))).toBe(true)
    }
  })

  it('est déterministe, quel que soit l\'ordre d\'entrée', () => {
    const balances = bal(500, 500, -500, -500, 300, -300)
    const ref = settle(balances)
    const rnd = lcg(7)
    for (let k = 0; k < 20; k++) {
      const shuffled = balances.slice().sort(() => rnd() - 0.5)
      expect(settle(shuffled)).toEqual(ref)
    }
  })

  it('tient 20 participants en un temps raisonnable', () => {
    const amounts = Array.from({ length: 19 }, (_, i) => (i % 2 ? -1 : 1) * (137 * (i + 1)))
    amounts.push(-amounts.reduce((s, x) => s + x, 0))
    const t0 = performance.now()
    const t = settle(bal(...amounts))
    expect(performance.now() - t0).toBeLessThan(3000)
    expect(residuals(bal(...amounts), t).every((x) => x === 0)).toBe(true)
  })

  it('reste valide au-delà de 20 participants (repli glouton)', () => {
    const amounts = Array.from({ length: 24 }, (_, i) => (i % 2 ? -100 : 100) * (i + 1))
    amounts.push(-amounts.reduce((s, x) => s + x, 0))
    const t = settle(bal(...amounts))
    expect(residuals(bal(...amounts), t).every((x) => x === 0)).toBe(true)
  })
})

describe('roundTransfers', () => {
  it("arrondit chaque virement à l'euro et supprime ceux qui tombent à 0", () => {
    const t: Transfer[] = [
      { from: 'a', to: 'b', amountCents: 2350 },
      { from: 'c', to: 'b', amountCents: 1249 },
      { from: 'd', to: 'e', amountCents: 40 },
    ]
    expect(roundTransfers(t)).toEqual([
      { from: 'a', to: 'b', amountCents: 2400 },
      { from: 'c', to: 'b', amountCents: 1200 },
    ])
  })

  it('garde des soldes de somme nulle et un écart par joueur borné', () => {
    const balances = bal(4230, 1210, -440, -5000)
    const rounded = roundTransfers(settle(balances))
    const left = residuals(balances, rounded)
    expect(left.reduce((s, x) => s + x, 0)).toBe(0)
    expect(rounded.every((t) => t.amountCents % 100 === 0)).toBe(true)
    expect(left.every((x) => Math.abs(x) <= 100)).toBe(true)
  })
})
