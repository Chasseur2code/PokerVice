import { describe, expect, it } from 'vitest'
import {
  MAX_PER_COLOR,
  duplicateFixedValues,
  MIN_SMALL_CHIPS,
  TARGET_SMALL_CHIPS,
  proposeChips,
  summarizeChips,
  toChipConfig,
  type ChipAssistantInput,
  type ChipStock,
} from './chips'
import type { ChipColor } from './types'

const NAMES = ['Blanc', 'Rouge', 'Vert', 'Bleu', 'Noir', 'Violet', 'Jaune']
const stock = (...qty: number[]): ChipStock[] =>
  qty.map((q, i) => ({ id: `c${i}`, name: NAMES[i]!, hex: '#000000', qty: q }))

const input = (qty: number[], patch: Partial<ChipAssistantInput> = {}): ChipAssistantInput => ({
  buyInCents: 2000,
  maxPlayers: 6,
  rebuysPerPlayer: 1,
  depthBB: 100,
  stock: stock(...qty),
  ...patch,
})

function proposal(inp: ChipAssistantInput) {
  const r = proposeChips(inp)
  if (!r.ok) throw new Error(r.failure.message)
  return r
}

/** Vérifie toutes les règles de SPEC §5.2-5.3 sur une proposition. */
function expectValid(inp: ChipAssistantInput) {
  const { colors, summary } = proposal(inp)
  const used = colors.filter((c) => c.perPlayer > 0)
  const values = used.map((c) => c.valuePoints)
  const stacks = inp.maxPlayers * (1 + inp.rebuysPerPlayer)

  expect(summary.issues).toEqual([])
  expect(used.length).toBeGreaterThanOrEqual(3)
  // Le plus petit jeton vaut la SB ; SB:BB = 1:2 ; stack = profondeur × BB.
  expect(values[0]).toBe(summary.sbPoints)
  expect(summary.bbPoints).toBe(2 * summary.sbPoints)
  expect(summary.stackPoints).toBe(inp.depthBB * summary.bbPoints)
  expect(summary.stackBBTenths).toBe(inp.depthBB * 10)
  // 1 point × stack = buy-in, exactement.
  expect(summary.centsPerPoint!.num * summary.stackPoints).toBe(inp.buyInCents * summary.centsPerPoint!.den)
  for (let i = 1; i < values.length; i++) {
    // Rapport de 2 à 5, chaque valeur multiple de la précédente.
    expect(values[i]! % values[i - 1]!).toBe(0)
    expect(values[i]! / values[i - 1]!).toBeGreaterThanOrEqual(2)
    expect(values[i]! / values[i - 1]!).toBeLessThanOrEqual(5)
    // Les jetons inférieurs suffisent à changer un jeton de cette valeur.
    const below = used.slice(0, i).reduce((s, c) => s + c.valuePoints * c.perPlayer, 0)
    expect(below).toBeGreaterThanOrEqual(values[i]!)
  }
  // Les plus nombreuses ont les plus petites valeurs.
  for (let i = 1; i < used.length; i++) expect(used[i]!.totalQty).toBeLessThanOrEqual(used[i - 1]!.totalQty)
  // Stock : nb par joueur × joueurs × (1 + recaves) ≤ quantité.
  for (const c of used) {
    expect(c.perPlayer * stacks).toBeLessThanOrEqual(c.totalQty)
    expect(c.perPlayer).toBeLessThanOrEqual(MAX_PER_COLOR)
  }
  expect(used[0]!.perPlayer).toBeGreaterThanOrEqual(MIN_SMALL_CHIPS)
  expect(summary.rebuysPossible).toBeGreaterThanOrEqual(inp.maxPlayers * inp.rebuysPerPlayer)
  return { colors, used, summary }
}

describe('proposeChips — cas réalistes à 100 BB (critère 6)', () => {
  it.each([
    ['300 jetons, 4 couleurs, 4 joueurs', [100, 100, 50, 50], 4, 1],
    ['300 jetons, 5 couleurs, 5 joueurs sans recave', [60, 60, 60, 60, 60], 5, 0],
    ['500 jetons, 5 couleurs, 6 joueurs', [150, 150, 100, 50, 50], 6, 1],
    ['500 jetons, 5 couleurs, 8 joueurs', [150, 150, 100, 50, 50], 8, 1],
    ['500 jetons, 6 couleurs, 6 joueurs', [100, 100, 100, 100, 50, 50], 6, 1],
    ['1 000 jetons, 7 couleurs, 10 joueurs', [200, 200, 200, 150, 100, 100, 50], 10, 1],
  ])('%s', (_, qty, players, rebuys) => {
    expectValid(input(qty, { maxPlayers: players, rebuysPerPlayer: rebuys }))
  })

  it('mallette de 500 : une répartition liquide (≥ 10 petits jetons, plus grosse valeur ≤ 10 BB)', () => {
    const { used, summary } = expectValid(input([150, 150, 100, 50, 50]))
    expect(used[0]!.perPlayer).toBeGreaterThanOrEqual(TARGET_SMALL_CHIPS)
    expect(used[used.length - 1]!.valuePoints).toBeLessThanOrEqual(10 * summary.bbPoints)
  })

  it('autres profondeurs et buy-in non rond', () => {
    expectValid(input([150, 150, 100, 50, 50], { depthBB: 50 }))
    expectValid(input([150, 150, 100, 50, 50], { depthBB: 200 }))
    const { summary } = expectValid(input([150, 150, 100, 50, 50], { buyInCents: 1500, depthBB: 80 }))
    // BB en € = buy-in ÷ profondeur, pas forcément rond : 15 € / 80 = 18,75 centimes.
    expect((summary.bbPoints * summary.centsPerPoint!.num) / summary.centsPerPoint!.den).toBe(18.75)
  })

  it("l'ordre de saisie n'influe pas, sauf à quantité égale ; le résultat est déterministe", () => {
    const a = proposal(input([150, 150, 100, 50, 50]))
    const b = proposal(input([150, 150, 100, 50, 50]))
    expect(a).toEqual(b)
    const shuffled = stock(150, 150, 100, 50, 50).reverse()
    const c = proposal({ ...input([]), stock: shuffled })
    const pick = (r: typeof a) => r.colors.filter((x) => x.perPlayer).map((x) => [x.totalQty, x.valuePoints, x.perPlayer])
    expect(pick(c)).toEqual(pick(a))
  })

  it('les couleurs en réserve restent listées, sans valeur', () => {
    const { colors } = proposal(input([150, 150, 100, 50, 50, 50, 50]))
    expect(colors).toHaveLength(7)
    for (const c of colors.filter((x) => x.perPlayer === 0)) expect(c.valuePoints).toBe(0)
  })

  it('reste rapide dans le pire cas (7 couleurs abondantes, 200 BB, 2 joueurs)', () => {
    const t = performance.now()
    expectValid(input([1000, 1000, 1000, 1000, 1000, 1000, 1000], { maxPlayers: 2, rebuysPerPlayer: 0, depthBB: 200 }))
    expect(performance.now() - t).toBeLessThan(500)
  })
})

describe('proposeChips — cas impossibles', () => {
  it('trop peu de petits jetons : explique et propose des assouplissements qui marchent', () => {
    const inp = input([150, 150, 100, 50, 50], { maxPlayers: 10 })
    const r = proposeChips(inp)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.failure.blocker).toEqual({ kind: 'smallChips', colorName: 'Blanc', needed: 160, available: 150 })
    expect(r.failure.suggestions).toEqual({ maxPlayers: 9, rebuysPerPlayer: 0 })
    expect(r.failure.message).toBe(
      'Pas assez de petits jetons Blanc : pour en donner 8 à chacun, il en faut 160 (10 joueurs × 2 stacks), il y en a 150. ' +
        'Pour y arriver : prévoir 9 joueurs au plus, ou prévoir 0 recave par joueur.',
    )
    // Chaque suggestion, appliquée seule, donne bien une répartition.
    expectValid({ ...inp, maxPlayers: 9 })
    expectValid({ ...inp, rebuysPerPlayer: 0 })
  })

  it('stack trop profond pour le stock : propose moins de BB', () => {
    const inp = input([100, 100, 100], { depthBB: 200 })
    const r = proposeChips(inp)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.failure.blocker.kind).toBe('composition')
    const d = r.failure.suggestions.depthBB!
    expect(d).toBeLessThan(200)
    expectValid({ ...inp, depthBB: d })
    expect(r.failure.message).toContain(`descendre à ${d} BB`)
  })

  it('une couleur sans assez de jetons pour un par stack', () => {
    const r = proposeChips(input([200, 200, 5, 5], { maxPlayers: 4 }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.failure.blocker).toEqual({ kind: 'stock', colorName: 'Vert', needed: 8, available: 5 })
  })

  it('moins de 3 couleurs', () => {
    const r = proposeChips(input([300, 200, 0, 0]))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.failure.blocker.kind).toBe('tooFewColors')
    expect(r.failure.suggestions).toEqual({})
  })

  it('message : accords et nombres au format français ; pas de suggestion de profondeur inutile', () => {
    const r = proposeChips(input([100, 100, 5], { maxPlayers: 10, rebuysPerPlayer: 0 }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.failure.message).toContain('(10 joueurs × 1 stack)')
    expect(r.failure.suggestions.depthBB).toBeUndefined()
    const big = proposeChips(input([1500, 1000, 1000], { maxPlayers: 10, rebuysPerPlayer: 19 }))
    if (big.ok) throw new Error('attendu impossible')
    expect(big.failure.message).toContain(`il en faut ${new Intl.NumberFormat('fr-FR').format(1600)}`)
  })

  it("l'échec reste rapide (10 joueurs, 3 recaves, 200 BB, une couleur en manque)", () => {
    const t = performance.now()
    const r = proposeChips(input([400, 400, 400, 39, 39], { maxPlayers: 10, rebuysPerPlayer: 3, depthBB: 200 }))
    expect(r.ok).toBe(false)
    expect(performance.now() - t).toBeLessThan(500)
  })

  it('rejette une saisie non entière, hors bornes ou des couleurs en double', () => {
    expect(() => proposeChips(input([100, 100, 100], { depthBB: 99.5 }))).toThrow(RangeError)
    expect(() => proposeChips(input([100, 100, 100], { maxPlayers: 1 }))).toThrow(RangeError)
    expect(() => proposeChips(input([100, 100, 100], { depthBB: 40 }))).toThrow(RangeError)
    expect(() => proposeChips(input([100, 100, 100], { depthBB: 210 }))).toThrow(RangeError)
    const dup = stock(150, 150, 100, 50)
    dup[3]!.id = dup[0]!.id
    expect(() => proposeChips({ ...input([]), stock: dup })).toThrow(RangeError)
  })
})

describe('summarizeChips — édition manuelle', () => {
  const colors = (): ChipColor[] => [
    { id: 'w', name: 'Blanc', hex: '#fff', valuePoints: 5, perPlayer: 10, totalQty: 150 },
    { id: 'r', name: 'Rouge', hex: '#f00', valuePoints: 25, perPlayer: 12, totalQty: 150 },
    { id: 'g', name: 'Vert', hex: '#0f0', valuePoints: 50, perPlayer: 7, totalQty: 100 },
    { id: 'b', name: 'Bleu', hex: '#00f', valuePoints: 100, perPlayer: 3, totalQty: 50 },
    { id: 'k', name: 'Noir', hex: '#000', valuePoints: 0, perPlayer: 0, totalQty: 50 },
  ]

  it('totaux, réserve et recaves possibles', () => {
    const s = summarizeChips(colors(), 2000, 6)
    expect(s).toMatchObject({ sbPoints: 5, bbPoints: 10, stackPoints: 1000, stackBBTenths: 1000, chipsPerPlayer: 32 })
    expect(s.centsPerPoint).toEqual({ num: 2, den: 1 })
    expect(s.colors).toEqual([
      { id: 'w', reserve: 90, rebuys: 9 },
      { id: 'r', reserve: 78, rebuys: 6 },
      { id: 'g', reserve: 58, rebuys: 8 },
      { id: 'b', reserve: 32, rebuys: 10 },
      { id: 'k', reserve: 50, rebuys: null },
    ])
    expect(s.rebuysPossible).toBe(6)
    expect(s.issues).toEqual([])
  })

  it('recalcule après modification et signale les anomalies', () => {
    const c = colors()
    c[1]!.perPlayer = 30 // 30 × 6 = 180 > 150
    c[3]!.valuePoints = 50 // doublon avec le vert
    const s = summarizeChips(c, 2000, 6)
    expect(s.stackPoints).toBe(5 * 10 + 25 * 30 + 50 * 7 + 50 * 3)
    expect(s.stackBBTenths).toBe(1300)
    expect(s.issues).toEqual([
      { kind: 'duplicateValue', valuePoints: 50 },
      { kind: 'stockExceeded', colorId: 'r', needed: 180, available: 150 },
    ])
    expect(s.rebuysPossible).toBe(0)
    expect(() => toChipConfig(c, 2000, 6)).toThrow(RangeError)
  })

  it('stack vide ou saisie invalide', () => {
    const empty = colors().map((c) => ({ ...c, perPlayer: 0 }))
    expect(summarizeChips(empty, 2000, 6)).toMatchObject({ stackPoints: 0, centsPerPoint: null, issues: [{ kind: 'empty' }] })
    const bad = colors()
    bad[0]!.perPlayer = -1
    expect(summarizeChips(bad, 2000, 6).issues).toContainEqual({ kind: 'invalid', colorId: 'w' })
  })

  it('un doublon de valeur est signalé une seule fois', () => {
    const c = colors()
    c[1]!.valuePoints = 50
    c[3]!.valuePoints = 50
    expect(summarizeChips(c, 2000, 6).issues.filter((i) => i.kind === 'duplicateValue')).toEqual([
      { kind: 'duplicateValue', valuePoints: 50 },
    ])
  })

  it('profondeur arrondie au plus proche, comme le reste de l’app', () => {
    // Stack 1 999 pts, BB 20 : 99,95 BB → 100 BB (et non 99,9).
    const s = summarizeChips(
      [
        { id: 'a', name: 'A', hex: '#fff', valuePoints: 10, perPlayer: 10, totalQty: 200 },
        { id: 'b', name: 'B', hex: '#fff', valuePoints: 1899, perPlayer: 1, totalQty: 200 },
      ],
      2000,
      6,
    )
    expect(s.stackPoints).toBe(1999)
    expect(s.stackBBTenths).toBe(1000)
  })

  it('saisies extrêmes : signalées, sans exception', () => {
    const huge = colors()
    huge[0]!.valuePoints = 1e15
    expect(summarizeChips(huge, 2000, 6).issues).toContainEqual({ kind: 'invalid', colorId: 'w' })
    const big = colors().map((c) => (c.perPlayer ? { ...c, valuePoints: 1e9, perPlayer: 1e9 } : c))
    const s = summarizeChips(big, 2000, 1)
    expect(s.issues).toContainEqual({ kind: 'tooLarge' })
    expect(s.centsPerPoint).toBeNull()
    expect(() => toChipConfig(big, 2000, 1)).toThrow(RangeError)
  })

  it('buy-in nul ou nombre de joueurs invalide : signalé, et pas de configuration', () => {
    expect(summarizeChips(colors(), 0, 6)).toMatchObject({ centsPerPoint: null })
    expect(summarizeChips(colors(), 0, 6).issues).toContainEqual({ kind: 'invalidSettings' })
    expect(summarizeChips(colors(), 2000, 1.5).issues).toContainEqual({ kind: 'invalidSettings' })
    expect(() => toChipConfig(colors(), 0, 6)).toThrow(RangeError)
  })

  it('toChipConfig garde les couleurs utilisées, triées par valeur, avec une conversion exacte', () => {
    const c = colors()
    const cfg = toChipConfig([c[2]!, c[0]!, c[4]!, c[3]!, c[1]!], 2000, 6)
    expect(cfg.mode).toBe('assistant')
    expect(cfg.sbPoints).toBe(5)
    expect(cfg.bbPoints).toBe(10)
    expect(cfg.centsPerPoint).toEqual({ num: 2, den: 1 })
    expect(cfg.colors!.map((x) => x.id)).toEqual(['w', 'r', 'g', 'b'])
  })

  it('une proposition se convertit directement en configuration', () => {
    const inp = input([150, 150, 100, 50, 50], { buyInCents: 1000, depthBB: 100 })
    const { colors: proposed } = proposal(inp)
    const cfg = toChipConfig(proposed, inp.buyInCents, inp.maxPlayers)
    // 10 € pour 100 BB : la BB vaut 10 centimes.
    expect(cfg.bbPoints * cfg.centsPerPoint.num).toBe(10 * cfg.centsPerPoint.den)
  })
})

describe('valeurs imposées', () => {
  /** Mallette de 500 jetons ; `fixed[i]` impose la valeur de la couleur i. */
  const withFixed = (qty: number[], fixed: (number | undefined)[], patch: Partial<ChipAssistantInput> = {}) =>
    input(qty, { stock: stock(...qty).map((s, i) => (fixed[i] === undefined ? s : { ...s, fixedValue: fixed[i] })), ...patch })

  it('chaque couleur imposée est utilisée à sa valeur, les autres restent libres', () => {
    const inp = withFixed([150, 150, 100, 50, 50], [5, 25, 100])
    const { colors, summary } = proposal(inp)
    const byId = new Map(colors.map((c) => [c.id, c]))
    expect([byId.get('c0')!.valuePoints, byId.get('c1')!.valuePoints, byId.get('c2')!.valuePoints]).toEqual([5, 25, 100])
    for (const id of ['c0', 'c1', 'c2']) expect(byId.get(id)!.perPlayer).toBeGreaterThan(0)
    expect(summary.issues).toEqual([])
    expect(summary.sbPoints).toBe(5)
    expect(summary.stackPoints).toBe(100 * summary.bbPoints)
  })

  it('accepte des valeurs imprimées non multiples (10 puis 25)', () => {
    const { colors, summary } = proposal(withFixed([200, 200, 100, 100], [10, 25]))
    const values = colors.filter((c) => c.perPlayer > 0).map((c) => c.valuePoints)
    expect(values.indexOf(25) - values.indexOf(10)).toBe(1)
    expect(summary.issues).toEqual([])
    expect(summary.stackPoints).toBe(100 * summary.bbPoints)
  })

  it('une couleur libre peut prendre une valeur sous la plus petite valeur imposée', () => {
    const { summary } = proposal(withFixed([300, 100, 100, 50], [undefined, 50, 100]))
    expect(summary.sbPoints).toBeLessThan(50)
    expect(summary.issues).toEqual([])
  })

  it('stock insuffisant pour une couleur imposée : elle est nommée', () => {
    const r = proposeChips(withFixed([150, 150, 100, 50, 10], [undefined, undefined, undefined, undefined, 500]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.failure.blocker).toEqual({ kind: 'stock', colorName: 'Noir', needed: 12, available: 10 })
  })

  it('valeurs imposées incompatibles : le message propose de les libérer', () => {
    const r = proposeChips(withFixed([150, 150, 100, 100], [1, 1000]))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.failure.blocker).toEqual({ kind: 'fixedValues', values: [1, 1000] })
    expect(r.failure.message).toMatch(/valeurs imposées \(1, 1\s000 pts\)/)
    expect(r.failure.message).toContain('remettre une valeur en « auto »')
  })

  it('refuse deux valeurs imposées identiques', () => {
    expect(() => proposeChips(withFixed([150, 150, 100, 100], [25, 25]))).toThrow(RangeError)
    expect(duplicateFixedValues([{ fixedValue: 25 }, {}, { fixedValue: 25 }, { fixedValue: 5 }])).toEqual(new Set([25]))
  })
})
