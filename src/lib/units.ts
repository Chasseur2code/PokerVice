// Conversions € ↔ points ↔ BB, exactes grâce à la fraction centimes/point.
import { centsToInput, divFloor, divRound, formatCents, parseEuros, type FormatCentsOptions } from './money'
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
 * parseAmount, sauf si la saisie est restée la valeur préremplie de `presetCents` : on rend alors
 * ce montant exact. En points, l'aller-retour centimes → points → centimes arrondit quand le montant
 * ne fait pas un nombre entier de points (20 € à 0,03 €/pt → 667 pts → 20,01 €).
 */
export function parseAmountKeeping(
  input: string,
  unit: InputUnit,
  cfg: ChipConfig | undefined,
  presetCents: number | null,
): number | null {
  if (presetCents !== null && input === amountToInput(presetCents, unit, cfg)) return presetCents
  return parseAmount(input, unit, cfg)
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

/** Plus petit nombre de décimales (≤ 8) qui écrit `cents` (fraction de centimes) exactement en euros, ou `null`. */
function exactEuroDecimals({ num, den }: Fraction): number | null {
  for (let d = 0; d <= 8; d++) {
    const scaled = num * 10 ** d
    if (!Number.isSafeInteger(scaled)) return null
    if (scaled % (den * 100) === 0) return d
  }
  return null
}

const euroFractionFormatters = new Map<number, Intl.NumberFormat>()

/**
 * Montant en euros d'une fraction de centimes (valeur d'un point ou d'un jeton) :
 * « 0,002 € » si l'écriture est exacte, sinon « ≈ 0,00667 € » (3 chiffres significatifs au moins).
 */
export function formatEuroFraction(cents: Fraction): string {
  const exact = exactEuroDecimals(cents)
  let decimals = Math.max(2, exact ?? 2)
  let scaled: number
  if (exact !== null) {
    scaled = (cents.num * 10 ** decimals) / (cents.den * 100)
  } else {
    // On ajoute des décimales tant que le montant a moins de 3 chiffres significatifs.
    while (decimals < 8 && Math.abs(divRound(cents.num * 10 ** decimals, cents.den * 100)) < 100) decimals += 1
    scaled = divRound(cents.num * 10 ** decimals, cents.den * 100)
  }
  let f = euroFractionFormatters.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: decimals })
    euroFractionFormatters.set(decimals, f)
  }
  // Division pour l'affichage seulement.
  return `${exact === null ? '≈ ' : ''}${f.format(scaled / 10 ** decimals)}`
}

/** Valeur initiale du champ « 1 point = X € » (inverse de parseCentsPerPoint), ou `null` si non décimale. */
export function centsPerPointToInput(cents: Fraction): string | null {
  const d = exactEuroDecimals(cents)
  if (d === null) return null
  const scaled = (cents.num * 10 ** d) / (cents.den * 100)
  const s = String(scaled).padStart(d + 1, '0')
  return d === 0 ? s : `${s.slice(0, -d)},${s.slice(-d)}`
}

/** Points → dixièmes de BB arrondis, sans passer par les centimes (calculatrice du convertisseur). */
export function pointsToBBTenths(points: number, cfg: ChipConfig): number {
  return divRound(points * 10, cfg.bbPoints)
}

/** Nombre entier positif ou nul saisi en texte (« 2 350 ») ; `null` si invalide. */
export function parseCount(input: string): number | null {
  const s = input.replace(/[\s  ]/g, '')
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : null
}

// Bornes du convertisseur : avec elles, les produits des conversions (BB × numérateur, centimes × dénominateur × 10…)
// restent des entiers sûrs pour tout buy-in réaliste.
export const MAX_BB_POINTS = 1_000_000
export const MAX_DEPTH_BB = 10_000
const MAX_CENTS_PER_POINT_NUM = 1_000_000 // 1 point ≤ 10 000 €
const MAX_CENTS_PER_POINT_DEN = 10_000 // 1 point ≥ 0,000001 €

/** « 1 point = X € » du convertisseur : parseCentsPerPoint dans les bornes, sinon `null`. */
export function parseConverterPoint(euroInput: string): Fraction | null {
  const c = parseCentsPerPoint(euroInput)
  return c && c.num <= MAX_CENTS_PER_POINT_NUM && c.den <= MAX_CENTS_PER_POINT_DEN ? c : null
}

/** BB en points (1 à MAX_BB_POINTS), sinon `null`. */
export function parseBbPoints(input: string): number | null {
  const n = parseCount(input)
  return n && n <= MAX_BB_POINTS ? n : null
}

/** Profondeur en BB (1 à MAX_DEPTH_BB), sinon `null`. */
export function parseDepth(input: string): number | null {
  const n = parseCount(input)
  return n && n <= MAX_DEPTH_BB ? n : null
}

/**
 * Configuration du convertisseur simple (SPEC §6) : « 1 point = X € » et « BB = Y points ».
 * La SB vaut la moitié de la BB (au moins 1 point). `null` si une saisie est invalide ou hors bornes.
 */
export function converterConfig(euroPerPointInput: string, bbPointsInput: string): ChipConfig | null {
  const centsPerPoint = parseConverterPoint(euroPerPointInput)
  const bbPoints = parseBbPoints(bbPointsInput)
  if (!centsPerPoint || !bbPoints) return null
  return { mode: 'converter', centsPerPoint, bbPoints, sbPoints: Math.max(1, divFloor(bbPoints, 2)) }
}

/** a / b arrondi au plus proche, ou `null` si un opérande n'est pas un entier sûr (grands produits). */
function safeDivRound(a: number, b: number): number | null {
  return Number.isSafeInteger(a) && Number.isSafeInteger(b) && b !== 0 ? divRound(a, b) : null
}

/**
 * BB en points pour qu'un buy-in fasse `depthBB` big blinds (convertisseur) : buy-in ÷ profondeur ÷ valeur du point,
 * arrondie au point le plus proche. `null` si le calcul déborde ou si la profondeur dépasse le buy-in en points
 * (la BB ferait moins d'un point).
 */
export function bbPointsForDepth(buyInCents: number, centsPerPoint: Fraction, depthBB: number): number | null {
  const a = buyInCents * centsPerPoint.den
  const b = centsPerPoint.num * depthBB
  if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && a < b) return null
  return safeDivRound(a, b)
}

/** Profondeur (BB par buy-in, arrondie, peut valoir 0) pour une BB donnée : inverse de bbPointsForDepth. */
export function depthForBbPoints(buyInCents: number, centsPerPoint: Fraction, bbPoints: number): number | null {
  return safeDivRound(buyInCents * centsPerPoint.den, centsPerPoint.num * bbPoints)
}
