import { describe, expect, it } from 'vitest'
import {
  EMPTY_SEAT_SIZE,
  HIGHLIGHT_SEAT_SIZE,
  SEAT_MAX_WIDTH,
  SEAT_TALL_HEIGHT,
  emptySeatCount,
  emptySeatSize,
  fromBottom,
  seatLayout,
  seatPositions,
  seatSize,
  tableGeometry,
  type SeatKind,
} from './seats'

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

describe('seatLayout', () => {
  const both = ['portrait', 'landscape'] as const
  const players = (n: number) => Array<SeatKind>(n).fill('player')
  const HALO = 6

  it('à 2 joueurs, les deux cartes (haut et bas) ont la largeur maximale', () => {
    for (const o of both) expect(seatLayout(players(2), o).width).toEqual([SEAT_MAX_WIDTH, SEAT_MAX_WIDTH])
  })

  it('sièges latéraux limités par le bord de la zone, jamais sous la carte de base', () => {
    // Portrait, 4 sièges : gauche et droite à 39 unités du bord → 2 × (39 + 6).
    expect(seatLayout(players(4), 'portrait').width).toEqual([140, 90, 140, 90])
    // Paysage : le bord laisserait 72, on garde la carte de base (84).
    expect(seatLayout(players(4), 'landscape').width).toEqual([140, 84, 140, 84])
  })

  it('les sièges vides gardent leur diamètre et ne bougent pas', () => {
    const kinds = fromBottom<SeatKind>(['player', 'player', 'highlighted', 'empty', 'empty', 'empty'])
    const { width, at } = seatLayout(kinds, 'portrait')
    expect(kinds.flatMap((k, i) => (k === 'player' ? [] : [width[i]]))).toEqual([EMPTY_SEAT_SIZE, EMPTY_SEAT_SIZE, EMPTY_SEAT_SIZE, HIGHLIGHT_SEAT_SIZE])
    expect(kinds.map((k) => (k === 'player' ? 'player' : emptySeatSize(k)))).toEqual(kinds.map((k, i) => (k === 'player' ? 'player' : width[i])))
    const p = seatPositions(kinds.length, 'portrait')
    kinds.forEach((k, i) => k !== 'player' && expect(at[i]).toEqual(p[i]))
  })

  // Tables que produisent les écrans : préparation (joueurs puis sièges vides, le premier mis en avant
  // sous 2 joueurs) et partie (joueurs seuls), toujours via fromBottom.
  const tables: SeatKind[][] = []
  for (let p = 0; p <= 10; p++) {
    const empties = Array.from({ length: emptySeatCount(p) }, (_, j): SeatKind => (j === 0 && p < 2 ? 'highlighted' : 'empty'))
    tables.push(fromBottom([...players(p), ...empties]))
    if (p >= 1) tables.push(fromBottom(players(p)))
  }

  it('tables réelles : bornes, carte dans la zone et aucun chevauchement (cartes de base comprises)', () => {
    for (const o of both) {
      const { zone } = tableGeometry(o)
      for (const kinds of tables) {
        const { card, at, width } = seatLayout(kinds, o)
        // Encombrement maximal de chaque siège : carte sur deux lignes, halo compris.
        const box = kinds.map((k, i) => {
          if (k === 'player') return { w: width[i]!, h: SEAT_TALL_HEIGHT }
          const d = width[i]! + (k === 'highlighted' ? 2 * HALO : 0)
          return { w: d, h: d }
        })
        for (let i = 0; i < kinds.length; i++) {
          if (kinds[i] === 'player') {
            expect(width[i]).toBeGreaterThanOrEqual(card.width)
            expect(width[i]).toBeLessThanOrEqual(SEAT_MAX_WIDTH)
            expect(at[i]!.y - SEAT_TALL_HEIGHT / 2).toBeGreaterThanOrEqual(0)
            expect(at[i]!.y + SEAT_TALL_HEIGHT / 2).toBeLessThanOrEqual(zone.height)
          }
          for (let j = i + 1; j < kinds.length; j++) {
            if (Math.abs(at[i]!.y - at[j]!.y) >= (box[i]!.h + box[j]!.h) / 2) continue
            expect(Math.abs(at[i]!.x - at[j]!.x), `${o} ${kinds.join()} ${i}-${j}`).toBeGreaterThanOrEqual((box[i]!.w + box[j]!.w) / 2)
          }
        }
      }
    }
  })

  it('symétrie gauche-droite quand tous les sièges sont occupés', () => {
    for (const o of both) {
      for (let n = 2; n <= 10; n++) {
        const { width } = seatLayout(players(n), o)
        for (let i = 0; i < n; i++) expect(width[(n - i) % n]).toBe(width[i])
      }
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

describe('fromBottom', () => {
  it('6 sièges : le premier en bas (index 3), puis sens horaire', () => {
    expect(fromBottom(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual(['d', 'e', 'f', 'a', 'b', 'c'])
  })

  it('le premier élément est toujours au siège du bas ou juste à sa gauche', () => {
    for (let n = 1; n <= 10; n++) {
      const items = Array.from({ length: n }, (_, i) => i)
      const out = fromBottom(items)
      expect(out.indexOf(0)).toBe(Math.floor(n / 2))
      expect([...out].sort((a, b) => a - b)).toEqual(items)
    }
  })

  it('liste vide', () => {
    expect(fromBottom([])).toEqual([])
  })
})
