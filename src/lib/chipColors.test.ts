import { describe, expect, it } from 'vitest'
import { CHIP_KITS, paletteEntry } from './chipColors'
import { proposeChips } from './chips'

describe('mallettes précomposées', () => {
  it('ne citent que des couleurs de la palette, sans doublon, 4 à 7 couleurs', () => {
    for (const kit of CHIP_KITS) {
      expect(kit.colors.length).toBeGreaterThanOrEqual(4)
      expect(kit.colors.length).toBeLessThanOrEqual(7)
      expect(new Set(kit.colors.map((c) => c.color)).size).toBe(kit.colors.length)
      for (const c of kit.colors) expect(() => paletteEntry(c.color)).not.toThrow()
    }
  })

  it('la mallette de Félix donne une proposition à 6 joueurs sans recave, 10 € et 100 BB', () => {
    // Avec une recave (12 stacks), 94 gris ne suffisent plus pour 8 petits jetons chacun.
    const kit = CHIP_KITS.find((k) => k.name === 'Mallette de Félix')!
    const result = proposeChips({
      buyInCents: 1000,
      maxPlayers: 6,
      rebuysPerPlayer: 0,
      depthBB: 100,
      stock: kit.colors.map((c, i) => ({ id: `k${i}`, name: c.color, hex: paletteEntry(c.color).hex, qty: c.qty, fixedValue: c.value })),
    })
    expect(result.ok).toBe(true)
  })
})
