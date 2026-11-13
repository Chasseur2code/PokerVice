// Couleurs des jetons (DESIGN §2.4) : fond plein et anneau intérieur de 3 px.

export interface ChipPaletteEntry {
  name: string
  hex: string
  ring: string
}

/** Palette proposée dans l'assistant, dans l'ordre d'affichage (hexadécimal en majuscules). */
export const CHIP_PALETTE: readonly ChipPaletteEntry[] = [
  { name: 'Blanc', hex: '#FFFFFF', ring: '#CFC6B8' },
  { name: 'Rouge', hex: '#D63A3A', ring: '#F1B5B5' },
  { name: 'Vert', hex: '#1F8A4C', ring: '#A9DABC' },
  { name: 'Bleu', hex: '#2F5BD3', ring: '#B4C6F4' },
  { name: 'Noir', hex: '#1F1F1F', ring: '#8A8A8A' },
  { name: 'Violet', hex: '#7D3FC0', ring: '#D2B8EF' },
  { name: 'Jaune', hex: '#F2C230', ring: '#FAE7A6' },
  { name: 'Rose', hex: '#E0457B', ring: '#F6BCD0' },
  { name: 'Orange', hex: '#EE7A1E', ring: '#F8CDA6' },
  { name: 'Gris', hex: '#8B8F96', ring: '#D3D5D9' },
]

/** Anneau d'une couleur de jeton ; gris neutre pour une couleur hors palette. */
export function chipRing(hex: string): string {
  return CHIP_PALETTE.find((c) => c.hex === hex.toUpperCase())?.ring ?? '#CFC6B8'
}

/** Couleurs proposées à l'ouverture de l'assistant (mallette classique à 4 couleurs). */
export const DEFAULT_CHIP_COLORS = ['Blanc', 'Rouge', 'Vert', 'Noir'].map((n) => CHIP_PALETTE.find((c) => c.name === n)!)

/** Première couleur de la palette absente de `used` (sinon la première). */
export function nextChipColor(used: readonly string[]): ChipPaletteEntry {
  const taken = new Set(used.map((h) => h.toUpperCase()))
  return CHIP_PALETTE.find((c) => !taken.has(c.hex)) ?? CHIP_PALETTE[0]!
}

/** Mallette précomposée : couleurs de la palette, quantité et valeur imprimée (absente = « auto »). */
export interface ChipKit {
  name: string
  colors: readonly { color: string; qty: number; value?: number }[]
}

/** Mallettes proposées en un tap dans l'assistant (au plus 7 couleurs chacune). */
export const CHIP_KITS: readonly ChipKit[] = [
  {
    name: 'Mallette de Félix',
    colors: [
      { color: 'Gris', qty: 94 },
      { color: 'Rouge', qty: 40, value: 5 },
      { color: 'Bleu', qty: 46, value: 10 },
      { color: 'Vert', qty: 24, value: 25 },
      { color: 'Noir', qty: 22, value: 100 },
      { color: 'Jaune', qty: 23, value: 1000 },
      { color: 'Violet', qty: 23, value: 500 },
    ],
  },
]

/** Entrée de palette d'une couleur de mallette (par son nom). */
export function paletteEntry(name: string): ChipPaletteEntry {
  const entry = CHIP_PALETTE.find((c) => c.name === name)
  if (!entry) throw new Error(`Couleur hors palette : ${name}`)
  return entry
}
