import { describe, expect, it } from 'vitest'
import { computeStats, elapsedMs, formatChrono, formatDurationShort, summarizePlayers } from './derive'
import { fraction } from './units'
import type { ChipConfig, Game, GameEvent, GameEventType } from './types'

const T0 = Date.UTC(2026, 10, 5, 19, 12)
const MIN = 60_000

let seq = 0
const ev = (type: GameEventType, playerId: string, amountCents: number, minutes: number): GameEvent => ({
  id: `e${++seq}`,
  at: T0 + minutes * MIN,
  type,
  playerId,
  amountCents,
})

function makeGame(events: GameEvent[], chipConfig?: ChipConfig): Game {
  return {
    version: 1,
    status: 'running',
    createdAt: T0,
    startedAt: T0,
    defaultBuyInCents: 2000,
    chipConfig,
    players: ['hugo', 'julie', 'leo', 'sarah'].map((id, i) => ({ id, name: id, color: '#000', seatOrder: i })),
    events,
    wakeLock: false,
  }
}

const cfg: ChipConfig = { mode: 'converter', centsPerPoint: fraction(1, 5), bbPoints: 100, sbPoints: 50 }

// 4 joueurs à 20 € ; Julie recave deux fois ; Léo part avec 15,60 € puis revient avec 20 € ;
// Sarah part avec 32,40 €.
const events = [
  ev('buyin', 'hugo', 2000, 0),
  ev('buyin', 'julie', 2000, 0),
  ev('buyin', 'leo', 2000, 0),
  ev('buyin', 'sarah', 2000, 0),
  ev('rebuy', 'julie', 2000, 30),
  ev('leave', 'leo', 1560, 45),
  ev('rebuy', 'julie', 1000, 50),
  ev('leave', 'sarah', 3240, 60),
  ev('return', 'leo', 2000, 90),
]

describe('summarizePlayers', () => {
  const s = summarizePlayers(makeGame(events))

  it('investi = buy-ins + recaves (+ retours)', () => {
    expect(s.get('hugo')!.investedCents).toBe(2000)
    expect(s.get('julie')!.investedCents).toBe(5000)
    expect(s.get('leo')!.investedCents).toBe(4000)
  })

  it('nombre de recaves par joueur (le retour n’en est pas une)', () => {
    expect(s.get('julie')!.rebuys).toBe(2)
    expect(s.get('leo')!.rebuys).toBe(0)
  })

  it('balance d’un joueur parti = stack de sortie − investi', () => {
    const sarah = s.get('sarah')!
    expect(sarah.status).toBe('left')
    expect(sarah.leftAt).toBe(T0 + 60 * MIN)
    expect(sarah.balanceCents).toBe(1240)
  })

  it('joueur parti puis revenu : assis, historique et balance cumulée conservés', () => {
    const leo = s.get('leo')!
    expect(leo.status).toBe('seated')
    expect(leo.leftAt).toBeUndefined()
    expect(leo.cashedOutCents).toBe(1560)
    expect(leo.balanceCents).toBe(1560 - 4000)
  })

  it('stack final compté dans la balance en fin de partie', () => {
    const fin = summarizePlayers(makeGame([...events, ev('final', 'leo', 3000, 200)]))
    expect(fin.get('leo')!.balanceCents).toBe(1560 + 3000 - 4000)
  })

  it('le statut suit l’heure des événements, pas leur ordre dans la liste', () => {
    const shuffled = [ev('return', 'hugo', 2000, 20), ev('buyin', 'hugo', 2000, 0), ev('leave', 'hugo', 1000, 10)]
    expect(summarizePlayers(makeGame(shuffled)).get('hugo')!.status).toBe('seated')
  })

  it('supprimer le départ rassoit le joueur', () => {
    const withoutLeave = events.filter((e) => !(e.type === 'leave' && e.playerId === 'sarah'))
    expect(summarizePlayers(makeGame(withoutLeave)).get('sarah')!.status).toBe('seated')
  })

  it('joueur sans événement (préparation) : assis, tout à zéro', () => {
    const empty = summarizePlayers(makeGame([])).get('hugo')!
    expect(empty).toMatchObject({ investedCents: 0, cashedOutCents: 0, balanceCents: 0, rebuys: 0, status: 'seated' })
  })
})

describe('computeStats', () => {
  it('argent en jeu = investis − stacks de sortie des partis', () => {
    // Investi : 2000×4 + 2000 + 1000 + 2000 = 13 000 ; sorties : 1560 + 3240.
    const st = computeStats(makeGame(events))
    expect(st.totalInvestedCents).toBe(13000)
    expect(st.moneyInPlayCents).toBe(13000 - 1560 - 3240)
  })

  it('tapis moyen = argent en jeu ÷ joueurs assis, au centime', () => {
    const st = computeStats(makeGame(events))
    expect(st.seatedCount).toBe(3) // Hugo, Julie, Léo (revenu)
    expect(st.avgStackCents).toBe(2733) // 8 200 / 3 = 2 733,33…
  })

  it('tapis moyen en BB arrondi à l’entier, seulement avec configuration', () => {
    expect(computeStats(makeGame(events)).avgStackBB).toBeNull()
    // 8 200 c / 3 = 27,33 € ; BB = 0,20 € → 136,67 → 137.
    expect(computeStats(makeGame(events, cfg)).avgStackBB).toBe(137)
  })

  it('recaves = événements rebuy uniquement', () => {
    expect(computeStats(makeGame(events)).rebuyCount).toBe(2)
  })

  it('personne d’assis : pas de tapis moyen', () => {
    const allLeft = [ev('buyin', 'hugo', 2000, 0), ev('leave', 'hugo', 2000, 5)]
    const g = makeGame(allLeft)
    g.players = g.players.slice(0, 1)
    const st = computeStats(g)
    expect(st.seatedCount).toBe(0)
    expect(st.avgStackCents).toBeNull()
    expect(st.avgStackBB).toBeNull()
    expect(st.moneyInPlayCents).toBe(0)
  })

  it('ignore les événements d’un joueur supprimé', () => {
    const st = computeStats(makeGame([...events, ev('rebuy', 'fantome', 5000, 100)]))
    expect(st.rebuyCount).toBe(2)
    expect(st.totalInvestedCents).toBe(13000)
  })

  it('10 joueurs et 500 événements : rapide', () => {
    const g = makeGame([])
    g.players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#000', seatOrder: i }))
    g.events = Array.from({ length: 500 }, (_, i) => ev(i < 10 ? 'buyin' : 'rebuy', `p${i % 10}`, 2000, i))
    const t = performance.now()
    for (let k = 0; k < 100; k++) computeStats(g)
    expect(performance.now() - t).toBeLessThan(200)
    expect(computeStats(g).rebuyCount).toBe(490)
  })
})

describe('durée', () => {
  it('se calcule depuis startedAt, figée à endedAt', () => {
    expect(elapsedMs({ startedAt: T0 }, T0 + 90 * MIN)).toBe(90 * MIN)
    expect(elapsedMs({ startedAt: T0, endedAt: T0 + 10 * MIN }, T0 + 90 * MIN)).toBe(10 * MIN)
    expect(elapsedMs({}, T0)).toBe(0)
    expect(elapsedMs({ startedAt: T0 }, T0 - 1000)).toBe(0) // horloge reculée
  })
  it('chrono h:mm:ss', () => {
    expect(formatChrono(0)).toBe('0:00:00')
    expect(formatChrono((1 * 3600 + 5 * 60 + 3) * 1000 + 999)).toBe('1:05:03')
    expect(formatChrono(12 * 3600 * 1000)).toBe('12:00:00')
  })
  it('format court « 5h35 »', () => {
    expect(formatDurationShort((5 * 60 + 35) * MIN)).toBe('5h35')
    expect(formatDurationShort(7 * MIN)).toBe('0h07')
  })
})
