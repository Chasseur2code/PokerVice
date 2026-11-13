import { describe, expect, it } from 'vitest'
import {
  MAX_PER_COLOR,
  duplicateFixedValues,
  MIN_SMALL_CHIPS,
  SMALL_CHIPS_ADVISED,
  TARGET_SMALL_CHIPS,
  rebuysFromReserve,
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
  // Stock : nb par joueur × joueurs ≤ quantité (stacks de départ) ; la réserve couvre les recaves prévues.
  for (const c of used) {
    expect(c.perPlayer * inp.maxPlayers).toBeLessThanOrEqual(c.totalQty)
    expect(c.perPlayer).toBeLessThanOrEqual(MAX_PER_COLOR)
  }
  // Mallettes réalistes : la contrainte souple des petits jetons est respectée.
  expect(used[0]!.perPlayer).toBeGreaterThanOrEqual(SMALL_CHIPS_ADVISED)
  expect(summary.smallChipsPerPlayer).toBe(used[0]!.perPlayer)
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

  it.each([4, 6, 8, 10])('mallette 300/200/100/100/50, %i joueurs : aucune pile au-delà de 3r, 30 jetons au plus', (players) => {
    // Avant les zones 2r / 3r : 20×1 + 20×5 + 8×10 (48 jetons).
    const { used, summary } = expectValid(input([300, 200, 100, 100, 50], { maxPlayers: players }))
    used.forEach((c, i) => {
      const next = used[i + 1]
      const bound = !next ? 15 : i === 0 ? Math.max(15, (3 * next.valuePoints) / c.valuePoints) : (3 * next.valuePoints) / c.valuePoints
      expect(c.perPlayer).toBeLessThanOrEqual(bound)
    })
    expect(summary.chipsPerPlayer).toBeLessThanOrEqual(30)
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
  it('trop peu de petits jetons, même sous le plancher dur de 5 : explique et propose ce qui marche', () => {
    const inp = input([40, 40, 40, 40], { maxPlayers: 10 })
    const r = proposeChips(inp)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.failure.blocker).toEqual({ kind: 'smallChips', colorName: 'Blanc', needed: 50, available: 40 })
    expect(r.failure.suggestions).toEqual({ maxPlayers: 8 })
    expect(r.failure.message).toBe(
      'Pas assez de petits jetons Blanc : pour en donner au moins 5 à chacun, il en faut 50 (10 joueurs), il y en a 40. ' +
        'Pour y arriver : prévoir 8 joueurs au plus.',
    )
    // La suggestion donne une répartition, avec moins de petits jetons que conseillé (contrainte souple).
    const ok = proposal({ ...inp, maxPlayers: 8 })
    expect(ok.summary.issues).toEqual([])
    expect(ok.summary.smallChipsPerPlayer).toBe(5)
  })

  it('contrainte souple : sous 8 petits jetons seulement si la mallette ne permet pas mieux', () => {
    // Couleur la plus nombreuse = petits jetons. 94 pour 10 joueurs : 8 ou 9 chacun ; 70 : 7 au plus (avertissement, pas d'erreur).
    const { summary } = proposal(input([94, 90, 90, 90], { maxPlayers: 10, rebuysPerPlayer: 0 }))
    expect(summary.smallChipsPerPlayer).toBeGreaterThanOrEqual(SMALL_CHIPS_ADVISED)
    const scarce = proposal(input([70, 60, 60, 60], { maxPlayers: 10, rebuysPerPlayer: 0 }))
    // Proposée quand même (plus d'échec), entre le plancher dur et le conseillé ; le résultat l'affiche.
    expect(scarce.summary.smallChipsPerPlayer).toBeGreaterThanOrEqual(MIN_SMALL_CHIPS)
    expect(scarce.summary.smallChipsPerPlayer).toBeLessThan(SMALL_CHIPS_ADVISED)
    expect(scarce.summary.issues).toEqual([])
  })

  it('recaves à part : la réserve doit les couvrir, sinon le blocage le dit', () => {
    const inp = input([100, 100, 100], { depthBB: 200 })
    const r = proposeChips(inp)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.failure.blocker).toEqual({ kind: 'rebuyReserve', rebuys: 6 })
    expect(r.failure.message).toContain('il ne resterait pas assez de jetons pour 6 recaves')
    expect(r.failure.suggestions.rebuysPerPlayer).toBe(0)
    expectValid({ ...inp, rebuysPerPlayer: 0 })
  })

  it('stack trop profond pour le stock : propose moins de BB', () => {
    const inp = input([40, 20, 20], { maxPlayers: 4, rebuysPerPlayer: 0, depthBB: 200 })
    const r = proposeChips(inp)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.failure.blocker.kind).toBe('composition')
    const d = r.failure.suggestions.depthBB!
    expect(d).toBeLessThan(200)
    expectValid({ ...inp, depthBB: d })
    expect(r.failure.message).toContain(`descendre à ${d} BB`)
  })

  it('une couleur sans assez de jetons pour un par joueur', () => {
    const r = proposeChips(input([200, 200, 3, 3], { maxPlayers: 4 }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.failure.blocker).toEqual({ kind: 'stock', colorName: 'Vert', needed: 4, available: 3 })
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
    expect(r.failure.message).toContain('(un par joueur, 10 joueurs)')
    expect(r.failure.suggestions.depthBB).toBeUndefined()
    const big = proposeChips(input([1500, 1000, 1000], { maxPlayers: 10, rebuysPerPlayer: 19 }))
    if (big.ok) throw new Error('attendu impossible')
    expect(big.failure.message).toContain('pas assez de jetons pour 190 recaves')
  })

  it('reste rapide (10 joueurs, 3 recaves, 200 BB ; 7 couleurs dont 6 imposées)', () => {
    let t = performance.now()
    proposeChips(input([400, 400, 400, 39, 39], { maxPlayers: 10, rebuysPerPlayer: 3, depthBB: 200 }))
    expect(performance.now() - t).toBeLessThan(500)
    // Échec avec diagnostic complet : 2^6 sous-ensembles de couleurs imposées à chaque essai.
    t = performance.now()
    const qty = [94, 40, 46, 24, 22, 23, 23]
    const printed = [undefined, 5, 10, 25, 100, 1000, 500]
    proposeChips(input(qty, { maxPlayers: 10, rebuysPerPlayer: 2, stock: stock(...qty).map((s, i) => ({ ...s, fixedValue: printed[i] })) }))
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
      { id: 'w', reserve: 90 },
      { id: 'r', reserve: 78 },
      { id: 'g', reserve: 58 },
      { id: 'b', reserve: 32 },
      { id: 'k', reserve: 50 },
    ])
    // Recaves de 1 000 pts, gros jetons d'abord : 3 en bleu, puis bleu + vert, vert, ... (8 en tout).
    expect(s.rebuysPossible).toBe(8)
    expect(s.smallChipsPerPlayer).toBe(10)
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

describe('rebuysFromReserve', () => {
  it('compose les recaves avec les gros jetons d’abord', () => {
    // Mallette de Félix après 6 stacks (1×15, 5×5, 10×6, 100×1) : 2 noirs par recave de 200.
    expect(rebuysFromReserve([1, 5, 10, 100], [4, 10, 10, 16], 200, 99)).toBe(8)
    expect(rebuysFromReserve([1, 5, 10, 100], [4, 10, 10, 16], 200, 3)).toBe(3)
  })

  it('reste prudent : peut sous-estimer avec des valeurs non multiples, jamais surestimer', () => {
    // 30 = 3 × 10, mais le glouton prend 25 et bloque sur 5.
    expect(rebuysFromReserve([10, 25], [3, 10], 30, 99)).toBe(0)
    expect(rebuysFromReserve([10, 25], [0, 0], 30, 99)).toBe(0)
  })
})

describe('valeurs imposées', () => {
  /** Mallette de 500 jetons ; `fixed[i]` impose la valeur de la couleur i. */
  const withFixed = (qty: number[], fixed: (number | undefined)[], patch: Partial<ChipAssistantInput> = {}) =>
    input(qty, { stock: stock(...qty).map((s, i) => (fixed[i] === undefined ? s : { ...s, fixedValue: fixed[i] })), ...patch })

  it('une couleur imposée utilisée l’est à sa valeur ; aucune couleur libre ne prend une valeur imposée', () => {
    const imposed = [5, 25, 100]
    const inp = withFixed([150, 150, 100, 50, 50], imposed)
    const { colors, summary } = proposal(inp)
    for (const c of colors.filter((x) => x.perPlayer > 0)) {
      const i = Number(c.id.slice(1))
      if (i < imposed.length) expect(c.valuePoints).toBe(imposed[i])
      else expect(imposed).not.toContain(c.valuePoints)
    }
    expect(summary.issues).toEqual([])
    expect(summary.sbPoints).toBe(5)
    expect(summary.stackPoints).toBe(100 * summary.bbPoints)
  })

  it('accepte des valeurs imprimées non multiples (10 puis 25)', () => {
    const { colors, summary } = proposal(withFixed([200, 200, 100], [10, 25, 100], { rebuysPerPlayer: 0 }))
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

  it('une couleur imposée trop rare (moins d’un jeton par stack) reste en réserve', () => {
    const { colors, summary } = proposal(withFixed([150, 150, 100, 50, 10], [undefined, undefined, undefined, undefined, 500]))
    expect(colors.find((c) => c.id === 'c4')!.perPlayer).toBe(0)
    expect(summary.issues).toEqual([])
  })

  it('une valeur imposée trop grosse pour le stack reste en réserve (mallette de Félix)', () => {
    // Gris auto, rouge 5, bleu 10, vert 25, noir 100, jaune 1 000, violet 500 ; 6 joueurs sans recave, 100 BB.
    const printed = [undefined, 5, 10, 25, 100, 1000, 500]
    const { colors, summary } = proposal(withFixed([94, 40, 46, 24, 22, 23, 23], printed, { maxPlayers: 6, rebuysPerPlayer: 0 }))
    const used = colors.filter((c) => c.perPlayer > 0)
    expect(used.some((c) => c.valuePoints === 1000)).toBe(false)
    for (const c of used) if (c.id !== 'c0') expect(c.valuePoints).toBe(printed[Number(c.id.slice(1))])
    expect(summary.issues).toEqual([])
    expect(summary.stackPoints).toBe(100 * summary.bbPoints)
  })

  it('valeurs imposées incompatibles : le message propose de les libérer', () => {
    // Seules les couleurs imposées peuvent servir : 1-2-4 ne remplit pas 100 BB, 1 000 dépasse le stack.
    const r = proposeChips(withFixed([150, 150, 100, 100], [1, 2, 4, 1000]))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.failure.blocker).toEqual({ kind: 'fixedValues', values: [1, 2, 4, 1000] })
    expect(r.failure.message).toMatch(/valeurs imposées \(1, 2, 4, 1\s000 pts\)/)
    expect(r.failure.message).toContain('remettre une valeur en « auto »')
  })

  it('refuse deux valeurs imposées identiques', () => {
    expect(() => proposeChips(withFixed([150, 150, 100, 100], [25, 25]))).toThrow(RangeError)
    expect(duplicateFixedValues([{ fixedValue: 25 }, {}, { fixedValue: 25 }, { fixedValue: 5 }])).toEqual(new Set([25]))
  })
})
