// Conversions € ↔ points ↔ BB, exactes grâce à la fraction centimes/point.
import { centsToInput, divRound, formatCents, parseEuros, type FormatCentsOptions } from './money'
import type { ChipConfig, Fraction, Unit } from './types'

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

/** Fraction réduite, dénominateur positif. */
export function fraction(num: number, den: number): Fraction {
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || den === 0) {
    throw new RangeError(`fraction invalide ${num}/${den}`)
  }
  const g = gcd(num, den) || 1
  const s = den < 0 ? -1 : 1
  return { num: (s * num) / g || 0, den: (s * den) / g }
}

/**
 * « 1 point = X € » saisi en texte (« 0,002 ») → centimes par point exacts (1/5).
 * Renvoie `null` si la saisie est invalide ou non strictement positive.
 */
export function parseCentsPerPoint(euroInput: string): Fraction | null {
  const s = euroInput.replace(/[\s  €]/g, '')
  const m = /^(\d*)(?:[.,](\d{0,8}))?$/.exec(s)
  if (!m) return null
  const [, intPart = '', decPart = ''] = m
  if (intPart === '' && decPart === '') return null
  // X € = digits / 10^k €  =  digits × 100 / 10^k centimes.
  const digits = Number(intPart + decPart)
  if (!Number.isSafeInteger(digits * 100) || digits === 0) return null
  return fraction(digits * 100, 10 ** decPart.length)
}

/** Centimes → points entiers (arrondi au plus proche). */
export function centsToPoints(cents: number, cfg: ChipConfig): number {
  const { num, den } = cfg.centsPerPoint
  return divRound(cents * den, num)
}

/** Points → centimes entiers (arrondi au plus proche). */
export function pointsToCents(points: number, cfg: ChipConfig): number {
  const { num, den } = cfg.centsPerPoint
  return divRound(points * num, den)
}

/** Centimes → nombre de BB arrondi à l'entier (« soit 156 BB »). */
export function centsToBB(cents: number, cfg: ChipConfig): number {
  const { num, den } = cfg.centsPerPoint
  return divRound(cents * den, cfg.bbPoints * num)
}

/** Centimes → dixièmes de BB arrondis (affichage « 117,5 BB »). */
export function centsToBBTenths(cents: number, cfg: ChipConfig): number {
  const { num, den } = cfg.centsPerPoint
  return divRound(cents * den * 10, cfg.bbPoints * num)
}

const numberFormatters = new Map<string, Intl.NumberFormat>()

function numberFormatter(maxDecimals: number, sign: boolean): Intl.NumberFormat {
  const key = `${maxDecimals}${sign}`
  let f = numberFormatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: maxDecimals,
      signDisplay: sign ? 'exceptZero' : 'auto',
    })
    numberFormatters.set(key, f)
  }
  return f
}

/**
 * Formate un montant (en centimes) dans l'unité courante : « 12,40 € », « 2 350 pts », « 117,5 BB ».
 * Sans configuration jetons, retombe toujours sur l'euro.
 */
export function formatAmount(
  cents: number,
  unit: Unit,
  cfg: ChipConfig | undefined,
  opts: FormatCentsOptions = {},
): string {
  const sign = opts.sign ?? false
  if (!cfg || unit === 'eur') return formatCents(cents, opts)
  if (unit === 'pts') return `${numberFormatter(0, sign).format(centsToPoints(cents, cfg))} pts`
  return `${numberFormatter(1, sign).format(centsToBBTenths(cents, cfg) / 10)} BB`
}

/** Unité de saisie : on saisit en € ou en points, jamais en BB. */
export type InputUnit = 'eur' | 'pts'

/** Analyse une saisie (« 12,5 » € ou « 2 350 » pts) et renvoie des centimes, ou `null`. */
export function parseAmount(input: string, unit: InputUnit, cfg: ChipConfig | undefined): number | null {
  if (unit === 'eur' || !cfg) return parseEuros(input)
  const s = input.replace(/[\s  ]|pts?$/gi, '')
  if (!/^-?\d+$/.test(s)) return null
  const points = Number(s)
  if (!Number.isSafeInteger(points)) return null
  return pointsToCents(points, cfg)
}

/** Unité de saisie des sheets : les points si une configuration existe et que l'affichage n'est pas en €. */
export function inputUnitFor(unit: Unit, cfg: ChipConfig | undefined): InputUnit {
  return cfg && unit !== 'eur' ? 'pts' : 'eur'
}

/** Valeur initiale d'un champ de saisie : « 20 » (€) ou « 10000 » (pts), relisible par parseAmount. */
export function amountToInput(cents: number, unit: InputUnit, cfg: ChipConfig | undefined): string {
  return unit === 'pts' && cfg ? String(centsToPoints(cents, cfg)) : centsToInput(cents)
}

/**
 * Équivalence affichée sous un champ (DESIGN §5) : « = 2 000 pts · 100 BB » pour une saisie en €,
 * « = 20 € · 100 BB » pour une saisie en points. Rien sans configuration jetons.
 */
export function formatEquivalent(cents: number, unit: InputUnit, cfg: ChipConfig | undefined): string | undefined {
  if (!cfg) return undefined
  const other = unit === 'eur' ? formatAmount(cents, 'pts', cfg) : formatCents(cents, { compact: true })
  return `= ${other} · ${formatAmount(cents, 'bb', cfg)}`
}
