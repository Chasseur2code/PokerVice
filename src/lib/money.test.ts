import { describe, expect, it } from 'vitest'
import { divFloor, divRound, formatCents, parseEuros, roundToEuro } from './money'

// Intl fr-FR utilise des espaces insécables : on les normalise pour comparer.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

describe('divFloor / divRound', () => {
  it('arrondit vers −∞', () => {
    expect(divFloor(7, 2)).toBe(3)
    expect(divFloor(-7, 2)).toBe(-4)
    expect(divFloor(7, -2)).toBe(-4)
  })
  it('arrondit au plus proche, demi vers l’extérieur', () => {
    expect(divRound(5, 2)).toBe(3)
    expect(divRound(-5, 2)).toBe(-3)
    expect(divRound(4, 3)).toBe(1)
    expect(divRound(-1, 3)).toBe(0)
    expect(Object.is(divRound(-1, 3), -0)).toBe(false)
  })
  it('reste exact pour de grands entiers', () => {
    const big = Number.MAX_SAFE_INTEGER // 2^53 − 1
    expect(divFloor(big, 1)).toBe(big)
    // big / 3 en flottant arrondit vers le haut ; le reste corrige le quotient.
    expect(divFloor(big - 1, 3)).toBe((big - 1 - ((big - 1) % 3)) / 3)
    expect(divRound(big, 2)).toBe(2 ** 52)
    expect(() => divRound(big + 2, 2)).toThrow()
  })
  it('refuse les flottants et la division par zéro', () => {
    expect(() => divRound(1.5, 2)).toThrow()
    expect(() => divRound(1, 0)).toThrow()
  })
})

describe('roundToEuro', () => {
  it('arrondit au plus proche euro', () => {
    expect(roundToEuro(1249)).toBe(1200)
    expect(roundToEuro(1250)).toBe(1300)
    expect(roundToEuro(-1250)).toBe(-1300)
    expect(roundToEuro(-1249)).toBe(-1200)
  })
})

describe('formatCents', () => {
  it('formate à la française', () => {
    expect(plain(formatCents(123450))).toBe('1 234,50 €')
    expect(plain(formatCents(5))).toBe('0,05 €')
    expect(plain(formatCents(-5000))).toBe('-50,00 €')
  })
  it('signe optionnel pour les balances', () => {
    expect(plain(formatCents(1240, { sign: true }))).toBe('+12,40 €')
    expect(plain(formatCents(-440, { sign: true }))).toBe('-4,40 €')
    expect(plain(formatCents(0, { sign: true }))).toBe('0,00 €')
  })
  it('mode compact pour les montants ronds', () => {
    expect(plain(formatCents(2000, { compact: true }))).toBe('20 €')
    expect(plain(formatCents(2050, { compact: true }))).toBe('20,50 €')
  })
})

describe('parseEuros', () => {
  it.each([
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.5', 1250],
    ['12', 1200],
    ['12,', 1200],
    [',5', 50],
    ['0,05', 5],
    ['1 234,56 €', 123456],
    ['1\u202f234,56\u00a0€', 123456],
    ['-3', -300],
    ['+3', 300],
    ['0,1', 10],
  ])('« %s » → %i', (input, cents) => {
    expect(parseEuros(input)).toBe(cents)
  })
  it.each(['', ',', 'abc', '12,345', '1,2,3', '--1', '12e3'])('refuse « %s »', (input) => {
    expect(parseEuros(input)).toBeNull()
  })
  it('évite les erreurs de flottant', () => {
    // 0,1 + 0,2 en flottant ≠ 0,3 ; ici tout est entier.
    expect(parseEuros('0,1')! + parseEuros('0,2')!).toBe(parseEuros('0,3'))
    expect(parseEuros('19,99')).toBe(1999)
  })
})
