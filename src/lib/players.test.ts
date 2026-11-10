import { describe, expect, it } from 'vitest'
import { PLAYER_COLORS, nextPlayerColor } from './players'

describe('nextPlayerColor', () => {
  it('suit l’ordre de la palette', () => {
    expect(nextPlayerColor([])).toBe('#E5484D')
    expect(nextPlayerColor([{ color: '#E5484D' }])).toBe('#3E63DD')
  })

  it('reprend une couleur libérée', () => {
    expect(nextPlayerColor([{ color: '#3E63DD' }])).toBe('#E5484D')
  })

  it('ignore la casse', () => {
    expect(nextPlayerColor([{ color: '#e5484d' }])).toBe('#3E63DD')
  })

  it('reboucle quand tout est pris', () => {
    const all = PLAYER_COLORS.map((color) => ({ color }))
    expect(nextPlayerColor(all)).toBe(PLAYER_COLORS[0])
  })
})
