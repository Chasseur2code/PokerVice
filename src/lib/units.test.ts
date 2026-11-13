import { describe, expect, it } from 'vitest'
import {
  amountToInput,
  bbPointsForDepth,
  centsPerPointToInput,
  converterConfig,
  depthForBbPoints,
  parseBbPoints,
  parseConverterPoint,
  parseDepth,
  formatEuroFraction,
  parseCount,
  pointsToBBTenths,
  centsToBB,
  centsToBBTenths,
  centsToPoints,
  formatAmount,
  formatEquivalent,
  fraction,
  inputUnitFor,
  parseAmount,
  parseAmountKeeping,
  parseCentsPerPoint,
  pointsToCents,
} from './units'
import type { ChipConfig } from './types'

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

// 20 € à 100 BB : BB = 0,20 € = 100 pts, donc 1 pt = 0,002 € = 1/5 centime.
const cfg: ChipConfig = { mode: 'converter', centsPerPoint: fraction(1, 5), bbPoints: 100, sbPoints: 50 }

describe('fraction', () => {
  it('réduit et normalise le signe', () => {
    expect(fraction(20, 100)).toEqual({ num: 1, den: 5 })
    expect(fraction(3, -6)).toEqual({ num: -1, den: 2 })
    expect(fraction(0, 7)).toEqual({ num: 0, den: 1 })
  })
  it('refuse un dénominateur nul ou un flottant', () => {
    expect(() => fraction(1, 0)).toThrow()
    expect(() => fraction(0.5, 1)).toThrow()
  })
})

describe('parseCentsPerPoint', () => {
  it('convertit « 1 point = X € » en fraction exacte de centimes', () => {
    expect(parseCentsPerPoint('0,002')).toEqual({ num: 1, den: 5 })
    expect(parseCentsPerPoint('0,01')).toEqual({ num: 1, den: 1 })
    expect(parseCentsPerPoint('0.25')).toEqual({ num: 25, den: 1 })
    expect(parseCentsPerPoint('1')).toEqual({ num: 100, den: 1 })
    expect(parseCentsPerPoint('0,0001')).toEqual({ num: 1, den: 100 })
  })
  it('refuse zéro et les saisies invalides', () => {
    expect(parseCentsPerPoint('0')).toBeNull()
    expect(parseCentsPerPoint('0,000')).toBeNull()
    expect(parseCentsPerPoint('-1')).toBeNull()
    expect(parseCentsPerPoint('abc')).toBeNull()
  })
})

describe('conversions € ↔ points ↔ BB', () => {
  it('buy-in de 20 € = 10 000 pts = 100 BB', () => {
    expect(centsToPoints(2000, cfg)).toBe(10000)
    expect(pointsToCents(10000, cfg)).toBe(2000)
    expect(centsToBB(2000, cfg)).toBe(100)
  })
  it('aller-retour exact sur des multiples de la conversion', () => {
    for (const cents of [0, 1, 20, 1999, 123456]) {
      expect(pointsToCents(centsToPoints(cents, cfg), cfg)).toBe(cents)
    }
  })
  it('arrondit explicitement les points non représentables au centime', () => {
    expect(pointsToCents(3, cfg)).toBe(1) // 0,6 c → 1 c
    expect(pointsToCents(2, cfg)).toBe(0) // 0,4 c → 0 c
  })
  it('BB au dixième', () => {
    expect(centsToBBTenths(2350, cfg)).toBe(1175) // 23,50 € = 117,5 BB
    expect(centsToBB(2350, cfg)).toBe(118)
  })
  it('conversion non décimale (1 pt = 1/3 c) restée exacte', () => {
    const third: ChipConfig = { ...cfg, centsPerPoint: fraction(1, 3), bbPoints: 60 }
    expect(centsToPoints(2000, third)).toBe(6000)
    expect(centsToBB(2000, third)).toBe(100)
  })
})

describe('formatAmount', () => {
  it('formate dans chaque unité', () => {
    expect(plain(formatAmount(2350, 'eur', cfg))).toBe('23,50 €')
    expect(plain(formatAmount(2350, 'pts', cfg))).toBe('11 750 pts')
    expect(plain(formatAmount(2350, 'bb', cfg))).toBe('117,5 BB')
    expect(plain(formatAmount(2000, 'bb', cfg))).toBe('100 BB')
  })
  it('signe pour les balances', () => {
    expect(plain(formatAmount(1240, 'pts', cfg, { sign: true }))).toBe('+6 200 pts')
    expect(plain(formatAmount(-440, 'bb', cfg, { sign: true }))).toBe('-22 BB')
  })
  it('retombe sur l’euro sans configuration jetons', () => {
    expect(plain(formatAmount(2000, 'pts', undefined, { compact: true }))).toBe('20 €')
    expect(plain(formatAmount(2000, 'bb', undefined))).toBe('20,00 €')
  })
})

describe('parseAmount', () => {
  it('saisie en € ou en points', () => {
    expect(parseAmount('12,5', 'eur', cfg)).toBe(1250)
    expect(parseAmount('2 350', 'pts', cfg)).toBe(470)
    expect(parseAmount('2350 pts', 'pts', cfg)).toBe(470)
  })
  it('en points sans configuration : saisie en €', () => {
    expect(parseAmount('12,5', 'pts', undefined)).toBe(1250)
  })
  it('refuse une saisie de points décimale ou vide', () => {
    expect(parseAmount('12,5', 'pts', cfg)).toBeNull()
    expect(parseAmount('', 'pts', cfg)).toBeNull()
  })
})

describe('saisie dans l’unité courante', () => {
  it('saisit en points seulement avec une configuration et hors €', () => {
    expect(inputUnitFor('eur', cfg)).toBe('eur')
    expect(inputUnitFor('pts', cfg)).toBe('pts')
    expect(inputUnitFor('bb', cfg)).toBe('pts')
    expect(inputUnitFor('pts', undefined)).toBe('eur')
  })
  it('valeur initiale relisible par parseAmount', () => {
    expect(amountToInput(1250, 'eur', cfg)).toBe('12,50')
    expect(amountToInput(2000, 'pts', cfg)).toBe('10000')
    expect(parseAmount(amountToInput(2000, 'pts', cfg), 'pts', cfg)).toBe(2000)
    expect(amountToInput(2000, 'pts', undefined)).toBe('20')
  })
  it('garde le montant exact d’une valeur préremplie non entière en points', () => {
    const odd: ChipConfig = { ...cfg, centsPerPoint: { num: 3, den: 1 } } // 1 pt = 0,03 €
    expect(amountToInput(2000, 'pts', odd)).toBe('667')
    expect(parseAmount('667', 'pts', odd)).toBe(2001)
    expect(parseAmountKeeping('667', 'pts', odd, 2000)).toBe(2000)
    expect(parseAmountKeeping('668', 'pts', odd, 2000)).toBe(2004)
    expect(parseAmountKeeping('667', 'pts', odd, null)).toBe(2001)
  })
  it('équivalence dans l’autre unité', () => {
    expect(plain(formatEquivalent(2000, 'eur', cfg)!)).toBe('= 10 000 pts · 100 BB')
    expect(plain(formatEquivalent(2000, 'pts', cfg)!)).toBe('= 20 € · 100 BB')
    expect(formatEquivalent(2000, 'eur', undefined)).toBeUndefined()
  })
})

describe('convertisseur simple', () => {
  it('formate la valeur d’un point, exacte ou approchée', () => {
    expect(plain(formatEuroFraction({ num: 1, den: 5 }))).toBe('0,002 €')
    expect(plain(formatEuroFraction({ num: 1, den: 1 }))).toBe('0,01 €')
    expect(plain(formatEuroFraction({ num: 2500, den: 1 }))).toBe('25,00 €')
    // 20 € pour 3 000 pts : 2/3 de centime par point.
    expect(plain(formatEuroFraction({ num: 2, den: 3 }))).toBe('≈ 0,00667 €')
    expect(plain(formatEuroFraction({ num: 50, den: 3 }))).toBe('≈ 0,167 €')
  })
  it('préremplit « 1 point = X € » de façon relisible', () => {
    for (const s of ['0,002', '0,01', '0,25', '1', '0,0001', '12,5']) {
      expect(centsPerPointToInput(parseCentsPerPoint(s)!)).toBe(s)
    }
    expect(centsPerPointToInput({ num: 2, den: 3 })).toBeNull()
  })
  it('crée la configuration : SB = BB / 2, au moins 1 point', () => {
    expect(converterConfig('0,002', '100')).toEqual(cfg)
    expect(converterConfig('0,01', '1')?.sbPoints).toBe(1)
    expect(converterConfig('0,01', '25')?.sbPoints).toBe(12)
    expect(converterConfig('0', '100')).toBeNull()
    expect(converterConfig('0,01', '0')).toBeNull()
    expect(converterConfig('0,01', '1,5')).toBeNull()
  })
  it('déduit la BB de la profondeur voulue', () => {
    // 20 € à 1 pt = 0,01 € : 2 000 pts.
    expect(bbPointsForDepth(2000, { num: 1, den: 1 }, 100)).toBe(20)
    expect(bbPointsForDepth(2000, { num: 1, den: 1 }, 50)).toBe(40)
    expect(bbPointsForDepth(2000, { num: 1, den: 1 }, 150)).toBe(13) // 13,33 arrondi
    expect(bbPointsForDepth(2000, { num: 1, den: 5 }, 100)).toBe(100) // 1 pt = 0,002 €
    expect(bbPointsForDepth(100, { num: 100, den: 1 }, 200)).toBe(1) // jamais 0
  })
  it('déduit la profondeur de la BB (inverse)', () => {
    expect(depthForBbPoints(2000, { num: 1, den: 1 }, 20)).toBe(100)
    expect(depthForBbPoints(2000, { num: 1, den: 1 }, 5000)).toBe(0) // BB plus grosse que le demi-buy-in
  })
  it('renvoie null au lieu de lever si le calcul déborde', () => {
    expect(bbPointsForDepth(2000, { num: 100_000, den: 1 }, 100_000_000_000)).toBeNull()
    expect(depthForBbPoints(2000, { num: 100, den: 1 }, 999_999_999_999_999)).toBeNull()
  })
  it('borne les saisies du convertisseur', () => {
    expect(parseConverterPoint('10000')).toEqual({ num: 1_000_000, den: 1 })
    expect(parseConverterPoint('10000,01')).toBeNull()
    expect(parseConverterPoint('0,000001')).toEqual({ num: 1, den: 10_000 })
    expect(parseConverterPoint('0,0000001')).toBeNull()
    expect(parseBbPoints('1000000')).toBe(1_000_000)
    expect(parseBbPoints('1000001')).toBeNull()
    expect(parseBbPoints('0')).toBeNull()
    expect(parseDepth('10000')).toBe(10_000)
    expect(parseDepth('10001')).toBeNull()
    expect(parseDepth('0')).toBeNull()
    expect(converterConfig('0,01', '999999999999999')).toBeNull()
  })
  it('lit un entier et convertit des points en BB', () => {
    expect(parseCount('2 350')).toBe(2350)
    expect(parseCount('-1')).toBeNull()
    expect(parseCount('')).toBeNull()
    expect(pointsToBBTenths(2350, cfg)).toBe(235)
    expect(pointsToBBTenths(55, cfg)).toBe(6)
  })
})
