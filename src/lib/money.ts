// Montants en centimes entiers : arithmétique entière exacte, saisie et affichage fr-FR.

function assertInt(n: number, label: string): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${label} doit être un entier sûr (reçu ${n})`)
}

/** Division entière exacte arrondie vers −∞ (b ≠ 0). */
export function divFloor(a: number, b: number): number {
  assertInt(a, 'a')
  assertInt(b, 'b')
  if (b === 0) throw new RangeError('division par zéro')
  if (b < 0) {
    a = -a
    b = -b
  }
  // Le quotient flottant peut être faux d'une unité pour de grands entiers : on corrige par le reste.
  let q = Math.floor(a / b)
  let r = a - q * b
  while (r < 0) {
    q -= 1
    r += b
  }
  while (r >= b) {
    q += 1
    r -= b
  }
  return q
}

/** Division entière exacte arrondie au plus proche, demi vers l'extérieur (2,5 → 3 ; −2,5 → −3). */
export function divRound(a: number, b: number): number {
  assertInt(a, 'a')
  assertInt(b, 'b')
  if (b === 0) throw new RangeError('division par zéro')
  if (b < 0) {
    a = -a
    b = -b
  }
  const sign = a < 0 ? -1 : 1
  const abs = Math.abs(a)
  let q = divFloor(abs, b)
  if (2 * (abs - q * b) >= b) q += 1
  return q === 0 ? 0 : sign * q
}

/** Arrondit au plus proche euro entier (demi vers l'extérieur). */
export function roundToEuro(cents: number): number {
  return divRound(cents, 100) * 100
}

const formatters = new Map<string, Intl.NumberFormat>()

function euroFormatter(decimals: 0 | 2, sign: boolean): Intl.NumberFormat {
  const key = `${decimals}${sign}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: sign ? 'exceptZero' : 'auto',
    })
    formatters.set(key, f)
  }
  return f
}

export interface FormatCentsOptions {
  /** Affiche « + » devant les montants positifs (balances). */
  sign?: boolean
  /** Omet « ,00 » pour un montant rond (« 20 € »). */
  compact?: boolean
}

/** « 1 234,50 € » avec les espaces insécables d'Intl fr-FR. */
export function formatCents(cents: number, opts: FormatCentsOptions = {}): string {
  assertInt(cents, 'cents')
  const decimals = opts.compact && cents % 100 === 0 ? 0 : 2
  // Division par 100 pour l'affichage seulement : exacte au centime pour tout entier sûr.
  return euroFormatter(decimals, opts.sign ?? false).format(cents / 100)
}

/**
 * Analyse une saisie en euros à la française, sans passer par un flottant.
 * « 12,5 » → 1250 ; « 1 234,56 € » → 123456 ; « 12.5 » accepté.
 * Renvoie `null` si la saisie est invalide ou a plus de 2 décimales.
 */
export function parseEuros(input: string): number | null {
  const s = input.replace(/[\s  €]/g, '')
  const m = /^([+-]?)(\d*)(?:[.,](\d{0,2}))?$/.exec(s)
  if (!m) return null
  const [, sign, intPart = '', decPart = ''] = m
  if (intPart === '' && decPart === '') return null
  const cents = Number(intPart || '0') * 100 + Number(decPart.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return null
  return sign === '-' && cents !== 0 ? -cents : cents
}

/** Valeur initiale d'un champ de saisie en euros : 2000 → « 20 », 1250 → « 12,50 » (inverse de parseEuros). */
export function centsToInput(cents: number): string {
  assertInt(cents, 'cents')
  const abs = Math.abs(cents)
  const euros = `${cents < 0 ? '-' : ''}${divFloor(abs, 100)}`
  return abs % 100 === 0 ? euros : `${euros},${String(abs % 100).padStart(2, '0')}`
}
