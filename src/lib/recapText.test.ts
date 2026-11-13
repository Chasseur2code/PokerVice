import { describe, expect, it } from 'vitest'
import { previewFinalBalances } from './discrepancy'
import { recapRows, recapStats } from './recap'
import { recapPeriod, recapText } from './recapText'
import { roundTransfers, settle } from './settlement'
import type { Game, GameEvent, GameEventType } from './types'

// Heures locales : le texte affiche l'heure du téléphone, le test ne dépend pas du fuseau.
const START = new Date(2026, 10, 5, 20, 12).getTime()
const END = new Date(2026, 10, 6, 1, 47).getTime()

let n = 0
function ev(type: GameEventType, playerId: string, amountCents: number, at = START): GameEvent {
  return { id: `e${n++}`, at, type, playerId, amountCents }
}

function game(events: GameEvent[], names: string[], extra: Partial<Game> = {}): Game {
  return {
    version: 1,
    status: 'finished',
    createdAt: START - 60_000,
    startedAt: START,
    endedAt: END,
    defaultBuyInCents: 5000,
    players: names.map((name, i) => ({ id: name.toLowerCase(), name, color: '#000', seatOrder: i })),
    events,
    wakeLock: false,
    ...extra,
  }
}

function transfersOf(g: Game) {
  return settle(recapRows(g).map((r) => ({ playerId: r.player.id, balanceCents: r.balanceCents })))
}

describe('recapText', () => {
  // L'exemple de SPEC §8.3 : 4 buy-ins de 50 €.
  const names = ['Julie', 'Hugo', 'Léo', 'Sarah']
  const finals: Record<string, number> = { hugo: 9230, sarah: 6210, 'léo': 4560, julie: 0 }
  const spec = game(
    [...names.map((nm) => ev('buyin', nm.toLowerCase(), 5000)), ...Object.entries(finals).map(([id, c]) => ev('final', id, c, END))],
    names,
  )

  it('reproduit exactement le format de SPEC §8.3', () => {
    const rows = recapRows(spec)
    expect(recapText(spec, rows, transfersOf(spec))).toBe(
      [
        'PokerVice — 05/11/2026 · 20:12 → 01:47 (5h35)',
        '',
        'Balances',
        '+42,30 € Hugo',
        '+12,10 € Sarah',
        ' -4,40 € Léo',
        '-50,00 € Julie',
        '',
        'Virements',
        'Julie → Hugo : 42,30 €',
        'Julie → Sarah : 7,70 €',
        'Léo → Sarah : 4,40 €',
      ]
        .join('\n')
        // Intl fr-FR : espace insécable avant « € ».
        .replace(/ €/g, ' €'),
    )
  })

  it('arrondit les virements si on lui passe les virements arrondis', () => {
    const text = recapText(spec, recapRows(spec), roundTransfers(transfersOf(spec)))
    expect(text).toContain('Julie → Hugo : 42,00 €')
    expect(text).toContain('Julie → Sarah : 8,00 €')
  })

  it('sans virement, le dit', () => {
    const g = game([ev('buyin', 'a', 2000), ev('buyin', 'b', 2000), ev('final', 'a', 2000), ev('final', 'b', 2000)], ['A', 'B'])
    expect(recapText(g, recapRows(g), transfersOf(g)).endsWith('Virements\nAucun virement')).toBe(true)
  })

  it('période : date et heures de début et de fin, durée courte', () => {
    expect(recapPeriod(spec)).toBe('05/11/2026 · 20:12 → 01:47 (5h35)')
  })
})

describe('recapRows et recapStats', () => {
  it('un joueur parti avant la fin apparaît dans les balances et les virements (critère 3)', () => {
    // Thomas part avec 32,40 € pour 20 € investis ; Hugo et Julie finissent.
    const g = game(
      [
        ev('buyin', 'hugo', 2000),
        ev('buyin', 'julie', 2000),
        ev('buyin', 'thomas', 2000),
        ev('rebuy', 'julie', 2000),
        ev('leave', 'thomas', 3240, START + 1000),
        ev('final', 'hugo', 2500, END),
        ev('final', 'julie', 2260, END),
      ],
      ['Hugo', 'Julie', 'Thomas'],
    )
    const rows = recapRows(g)
    expect(rows.map((r) => [r.player.name, r.balanceCents])).toEqual([
      ['Thomas', 1240],
      ['Hugo', 500],
      ['Julie', -1740],
    ])
    expect(rows.reduce((s, r) => s + r.balanceCents, 0)).toBe(0)
    expect(rows[0]).toMatchObject({ investedCents: 2000, stackCents: 3240 })

    const transfers = transfersOf(g)
    expect(transfers).toEqual([
      { from: 'julie', to: 'thomas', amountCents: 1240 },
      { from: 'julie', to: 'hugo', amountCents: 500 },
    ])

    const stats = recapStats(g, rows)
    expect(stats).toMatchObject({ durationMs: END - START, totalInvestedCents: 8000, rebuyCount: 1 })
    expect(stats.topWinner?.player.name).toBe('Thomas')
    expect(stats.topLoser?.player.name).toBe('Julie')
  })

  it("l'écart résolu est compris dans les stacks et les balances (somme nulle)", () => {
    // 40 € en jeu, 39 € comptés : il manque 1 €, réparti au prorata (30/9).
    const g = game(
      [ev('buyin', 'a', 2000), ev('buyin', 'b', 2000), ev('final', 'a', 3000, END), ev('final', 'b', 900, END)],
      ['A', 'B'],
      { discrepancyResolution: { type: 'prorata' } },
    )
    const rows = recapRows(g)
    expect(rows.map((r) => r.stackCents)).toEqual([3077, 923])
    expect(rows.reduce((s, r) => s + r.balanceCents, 0)).toBe(0)
  })

  it('sans gagnant ni perdant, pas de « plus gros gagnant »', () => {
    const g = game([ev('buyin', 'a', 2000), ev('final', 'a', 2000, END)], ['A', 'B'])
    const rows = recapRows(g)
    expect(rows).toHaveLength(1) // B n'a jamais joué
    expect(recapStats(g, rows)).toMatchObject({ topWinner: undefined, topLoser: undefined })
  })
})

describe('previewFinalBalances', () => {
  const running = game([ev('buyin', 'a', 2000), ev('buyin', 'b', 2000)], ['A', 'B'], { status: 'running', endedAt: undefined })

  it("donne l'écart brut avant résolution", () => {
    const p = previewFinalBalances(running, [
      { playerId: 'a', cents: 3000 },
      { playerId: 'b', cents: 1500 },
    ])
    expect(p).toMatchObject({ discrepancyCents: 500, resolved: false })
  })

  it('signale une imputation qui rendrait un stack négatif', () => {
    const finals = [
      { playerId: 'a', cents: 4200 },
      { playerId: 'b', cents: 100 },
    ]
    expect(previewFinalBalances(running, finals, { type: 'assign', playerId: 'b' }).stacks.some((s) => s.cents < 0)).toBe(true)
    const ok = previewFinalBalances(running, finals, { type: 'assign', playerId: 'a' })
    expect(ok.resolved).toBe(true)
    expect(ok.balances.get('a')).toBe(1900)
  })
})
