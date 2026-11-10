import { describe, expect, it } from 'vitest'
import { emptySeatCount, seatPositions, seatSize, tableGeometry } from './seats'

function close(p: { x: number; y: number }, x: number, y: number) {
  expect(p.x).toBeCloseTo(x, 9)
  expect(p.y).toBeCloseTo(y, 9)
}

describe('seatPositions', () => {
  it('portrait, 4 sièges : haut, droite, bas, gauche (sens horaire)', () => {
    const [top, right, bottom, left] = seatPositions(4, 'portrait')
    close(top!, 179, 30)
    close(right!, 319, 230)
    close(bottom!, 179, 430)
    close(left!, 39, 230)
  })

  it('portrait, 6 sièges : le siège 3 est en bas, les autres symétriques', () => {
    const p = seatPositions(6, 'portrait')
    close(p[3]!, 179, 430)
    // sin 60° = √3/2, cos 60° = 1/2
    close(p[1]!, 179 + 140 * (Math.sqrt(3) / 2), 230 - 100)
    close(p[5]!, 179 - 140 * (Math.sqrt(3) / 2), 230 - 100)
  })

  it('paysage : ovale horizontal (rx et ry inversés)', () => {
    const [top, right, bottom, left] = seatPositions(4, 'landscape')
    close(top!, 230, 39)
    close(right!, 430, 179)
    close(bottom!, 230, 319)
    close(left!, 30, 179)
  })

  it('tous les sièges sont sur l’ellipse, de 2 à 10 joueurs, dans les deux orientations', () => {
    for (const o of ['portrait', 'landscape'] as const) {
      const { center, rx, ry } = tableGeometry(o)
      for (let n = 2; n <= 10; n++) {
        const p = seatPositions(n, o)
        expect(p).toHaveLength(n)
        for (const { x, y } of p) {
          expect(((x - center.x) / rx) ** 2 + ((y - center.y) / ry) ** 2).toBeCloseTo(1, 9)
        }
      }
    }
  })

  it('cas limites', () => {
    expect(seatPositions(0, 'portrait')).toEqual([])
    close(seatPositions(1, 'portrait')[0]!, 179, 30)
    expect(() => seatPositions(-1, 'portrait')).toThrow()
    expect(() => seatPositions(2.5, 'portrait')).toThrow()
  })
})

describe('tableGeometry', () => {
  it('portrait conforme à DESIGN §3, paysage = transposé', () => {
    const p = tableGeometry('portrait')
    expect(p.zone).toEqual({ width: 358, height: 460 })
    expect(p.oval).toEqual({ x: 34, y: 30, width: 290, height: 400 })
    const l = tableGeometry('landscape')
    expect(l.zone).toEqual({ width: 460, height: 358 })
    expect(l.oval).toEqual({ x: 30, y: 34, width: 400, height: 290 })
    expect([l.rx, l.ry]).toEqual([200, 140])
    // L'ovale est centré sur le centre de l'ellipse.
    for (const g of [p, l]) {
      expect(g.oval.x + g.oval.width / 2).toBe(g.center.x)
      expect(g.oval.y + g.oval.height / 2).toBe(g.center.y)
    }
  })
})

describe('seatSize', () => {
  it('84×58 jusqu’à 8 joueurs, 76×54 à partir de 9', () => {
    expect(seatSize(2)).toEqual({ width: 84, height: 58 })
    expect(seatSize(8)).toEqual({ width: 84, height: 58 })
    expect(seatSize(9)).toEqual({ width: 76, height: 54 })
    expect(seatSize(10)).toEqual({ width: 76, height: 54 })
  })
})

describe('emptySeatCount', () => {
  it('complète jusqu’à 6, puis un seul, puis aucun à 10', () => {
    expect([0, 1, 5, 6, 7, 9, 10].map(emptySeatCount)).toEqual([6, 5, 1, 1, 1, 1, 0])
  })
})
