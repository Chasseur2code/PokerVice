import { describe, expect, it } from 'vitest'
import { apportion, discrepancyCents, discrepancyMessage, finalBalances, resolveDiscrepancy } from './discrepancy'
import { settle } from './settlement'
import { fraction } from './units'
import type { ChipConfig, Game, GameEvent, GameEventType } from './types'

const cfg: ChipConfig = { mode: 'converter', centsPerPoint: fraction(1, 100), bbPoints: 100, sbPoints: 50 }

let seq = 0
const ev = (type: GameEventType, playerId: string, amountCents: number, at = 0): GameEvent => ({
  id: `e${++seq}`,
  at,
  type,
  playerId,
  amountCents,
})

function makeGame(events: GameEvent[], extra: Partial<Game> = {}): Game {
  return {
    version: 1,
    status: 'finished',
    createdAt: 0,
    startedAt: 0,
    defaultBuyInCents: 2000,
    players: ['hugo', 'julie', 'leo', 'sarah'].map((id, i) => ({ id, name: id, color: '#000', seatOrder: i })),
    events,
    wakeLock: false,
    ...extra,
  }
}

const plain = (s: string | null) => s?.replace(/[  ]/g, ' ')
const sum = (m: Map<string, number>) => [...m.values()].reduce((s, x) => s + x, 0)

describe('discrepancyMessage', () => {
  it('affiche points et euros avec une configuration jetons', () => {
    // 1 point = 1 centime : 140 points = 1,40 €.
    const c: ChipConfig = { ...cfg, centsPerPoint: fraction(1, 1) }
    expect(plain(discrepancyMessage(-140, c))).toBe('Il manque 140 points (1,40 €)')
    expect(plain(discrepancyMessage(140, c))).toBe('140 points (1,40 €) en trop')
    expect(plain(discrepancyMessage(-1, c))).toBe('Il manque 1 point (0,01 €)')
  })

  it("reste en euros sans aucune mention de jeton s'il n'y a pas de configuration", () => {
    expect(plain(discrepancyMessage(-140, undefined))).toBe('Il manque 1,40 €')
    expect(plain(discrepancyMessage(250, undefined))).toBe('2,50 € en trop')
    expect(discrepancyMessage(-140, undefined)).not.toMatch(/point|jeton/)
  })

  it("renvoie null sans écart", () => {
    expect(discrepancyMessage(0, cfg)).toBeNull()
  })
})

describe('apportion (plus fort reste)', () => {
  it('somme exacte et attribution au plus fort reste', () => {
    // 100 en 3 parts égales : 33,33… → 34, 33, 33 (à égalité, le premier).
    expect(apportion(100, [1, 1, 1])).toEqual([34, 33, 33])
    // 10 au prorata de 1, 2, 7 : exact.
    expect(apportion(10, [1, 2, 7])).toEqual([1, 2, 7])
    // 1000 au prorata de 3, 3, 1 : 428,57 / 428,57 / 142,86 → 429, 428, 143.
    expect(apportion(1000, [3, 3, 1])).toEqual([429, 428, 143])
  })

  it('poids nul → part nulle', () => {
    expect(apportion(500, [0, 1, 1])).toEqual([0, 250, 250])
  })

  it('refuse des poids tous nuls ou invalides', () => {
    expect(() => apportion(100, [0, 0])).toThrow(RangeError)
    expect(() => apportion(100, [1, -1])).toThrow(RangeError)
  })

  it('somme toujours exacte sur des cas variés', () => {
    for (let total = 0; total < 300; total += 7) {
      const w = [total % 5, 3, (total * 13) % 11, 1]
      expect(apportion(total, w).reduce((s, x) => s + x, 0)).toBe(total)
    }
  })
})

describe('resolveDiscrepancy', () => {
  const finals = [
    { playerId: 'a', cents: 3000 },
    { playerId: 'b', cents: 1000 },
    { playerId: 'c', cents: 0 },
  ]

  it("mesure l'écart", () => {
    expect(discrepancyCents(finals, 4140)).toBe(-140)
    expect(discrepancyCents(finals, 4000)).toBe(0)
  })

  it('prorata des stacks finaux : la somme retombe sur l\'argent en jeu', () => {
    const r = resolveDiscrepancy(finals, 4141, { type: 'prorata' })!
    // 4141 × 3/4 = 3105,75 ; 4141 × 1/4 = 1035,25 → 3106, 1035 ; le joueur à 0 reste à 0.
    expect(r).toEqual([
      { playerId: 'a', cents: 3106 },
      { playerId: 'b', cents: 1035 },
      { playerId: 'c', cents: 0 },
    ])
  })

  it('prorata impossible si tous les stacks sont nuls', () => {
    expect(resolveDiscrepancy([{ playerId: 'a', cents: 0 }], 100, { type: 'prorata' })).toBeNull()
  })

  it("imputer à un joueur reporte tout l'écart sur lui", () => {
    expect(resolveDiscrepancy(finals, 4140, { type: 'assign', playerId: 'b' })).toEqual([
      { playerId: 'a', cents: 3000 },
      { playerId: 'b', cents: 1140 },
      { playerId: 'c', cents: 0 },
    ])
    expect(resolveDiscrepancy(finals, 3900, { type: 'assign', playerId: 'a' })?.[0]?.cents).toBe(2900)
    expect(resolveDiscrepancy(finals, 3900, { type: 'assign', playerId: 'inconnu' })).toBeNull()
  })
})

describe('finalBalances', () => {
  // 4 × 20 € ; Julie recave 20 € ; Léo part avec 15,60 € puis revient à 20 €.
  // Argent en jeu à la fin : 120 − 15,60 = 104,40 €.
  const base = [
    ev('buyin', 'hugo', 2000),
    ev('buyin', 'julie', 2000),
    ev('buyin', 'leo', 2000),
    ev('buyin', 'sarah', 2000),
    ev('rebuy', 'julie', 2000, 10),
    ev('leave', 'leo', 1560, 20),
    ev('return', 'leo', 2000, 30),
  ]

  it('sans écart : balances directes, somme nulle', () => {
    const g = makeGame([
      ...base,
      ev('final', 'hugo', 6230, 99),
      ev('final', 'julie', 0, 99),
      ev('final', 'leo', 2000, 99),
      ev('final', 'sarah', 2210, 99),
    ])
    const r = finalBalances(g)
    expect(r.resolved).toBe(true)
    expect(r.discrepancyCents).toBe(0)
    expect(Object.fromEntries(r.balances)).toEqual({ hugo: 4230, julie: -4000, leo: -440, sarah: 210 })
    expect(sum(r.balances)).toBe(0)
  })

  const withGap = [
    ...base,
    ev('final', 'hugo', 6200, 99),
    ev('final', 'julie', 0, 99),
    ev('final', 'leo', 2001, 99),
    ev('final', 'sarah', 2100, 99),
  ] // somme 10 301 pour 10 440 en jeu : il manque 1,39 €.

  it('écart non résolu : pas de balances', () => {
    const r = finalBalances(makeGame(withGap))
    expect(r.resolved).toBe(false)
    expect(r.discrepancyCents).toBe(-139)
    expect(r.balances.size).toBe(0)
  })

  it('écart au prorata : somme des balances exactement nulle (critère 5)', () => {
    const r = finalBalances(makeGame(withGap, { discrepancyResolution: { type: 'prorata' } }))
    expect(r.resolved).toBe(true)
    expect(sum(r.balances)).toBe(0)
    // Julie (stack 0) ne prend rien de l'écart.
    expect(r.balances.get('julie')).toBe(-4000)
    // Le joueur parti avant la fin garde sa balance de sortie dans le calcul.
    expect(r.balances.has('leo')).toBe(true)
  })

  it("écart imputé : tout sur le joueur choisi", () => {
    const r = finalBalances(makeGame(withGap, { discrepancyResolution: { type: 'assign', playerId: 'hugo' } }))
    expect(sum(r.balances)).toBe(0)
    expect(r.balances.get('hugo')).toBe(6200 + 139 - 2000)
  })

  it('enchaîne avec le règlement minimal', () => {
    const r = finalBalances(makeGame(withGap, { discrepancyResolution: { type: 'prorata' } }))
    const t = settle([...r.balances].map(([playerId, balanceCents]) => ({ playerId, balanceCents })))
    expect(t.length).toBeLessThanOrEqual(3)
    expect(t.some((x) => x.from === 'leo' || x.to === 'leo')).toBe(true)
  })

  it('somme nulle au centime sur des parties aléatoires avec écart', () => {
    let seed = 3
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let k = 0; k < 100; k++) {
      const events = [...base, ...['hugo', 'julie', 'leo', 'sarah'].map((p) => ev('final', p, Math.floor(rnd() * 8000), 99))]
      for (const res of [{ type: 'prorata' as const }, { type: 'assign' as const, playerId: 'sarah' }]) {
        const r = finalBalances(makeGame(events, { discrepancyResolution: res }))
        if (r.resolved) expect(sum(r.balances)).toBe(0)
      }
    }
  })
})
