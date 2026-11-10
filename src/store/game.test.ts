import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StateStorage } from 'zustand/middleware'
import { computeStats, summarizePlayers } from '../lib/derive'
import type { ChipConfig } from '../lib/types'
import { createGameStore, STORAGE_KEY, UNDO_MS, type GameStore } from './game'

function memoryStorage(): StateStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

const T0 = new Date('2026-11-05T20:12:00').getTime()
const cfg: ChipConfig = { mode: 'converter', centsPerPoint: { num: 1, den: 5 }, bbPoints: 100, sbPoints: 50 }

let storage: ReturnType<typeof memoryStorage>
let store: GameStore
const s = () => store.getState()

/** Avance l'horloge (au-delà de la fenêtre d'annulation par défaut). */
function later(ms = UNDO_MS + 1000) {
  vi.setSystemTime(Date.now() + ms)
}

function idOf(name: string): string {
  return s().game.players.find((p) => p.name === name)!.id
}

function setupThree() {
  s().addPlayer('Hugo')
  s().addPlayer('Julie')
  s().addPlayer('Léo')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  storage = memoryStorage()
  store = createGameStore(storage)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('préparation', () => {
  it('démarre sur une table vide à 20 €', () => {
    expect(s().game.status).toBe('setup')
    expect(s().game.defaultBuyInCents).toBe(2000)
    expect(s().lastRecap).toBeNull()
    expect(s().unit).toBe('eur')
  })

  it('ajoute des joueurs avec couleurs et places successives, sans événement', () => {
    setupThree()
    expect(s().game.players.map((p) => [p.name, p.color, p.seatOrder])).toEqual([
      ['Hugo', '#E5484D', 0],
      ['Julie', '#3E63DD', 1],
      ['Léo', '#F59E0B', 2],
    ])
    expect(s().game.events).toEqual([])
  })

  it('refuse un nom vide et une 11e place', () => {
    expect(s().addPlayer('   ')).toBeNull()
    for (let i = 0; i < 10; i++) expect(s().addPlayer(`J${i}`)).not.toBeNull()
    expect(s().addPlayer('Onzième')).toBeNull()
  })

  it('renomme, change la couleur, supprime', () => {
    setupThree()
    expect(s().renamePlayer(idOf('Léo'), '  Léonard ')).toBe(true)
    expect(s().renamePlayer(idOf('Hugo'), ' ')).toBe(false)
    expect(s().setColor(idOf('Hugo'), '#6B7280')).toBe(true)
    expect(s().game.players[0]!.color).toBe('#6B7280')
    expect(s().deletePlayer(idOf('Julie'))).toBe(true)
    expect(s().game.players.map((p) => p.name)).toEqual(['Hugo', 'Léonard'])
  })

  it('valide le buy-in commun', () => {
    expect(s().setBuyIn(1000)).toBe(true)
    expect(s().setBuyIn(0)).toBe(false)
    expect(s().setBuyIn(12.5)).toBe(false)
    expect(s().game.defaultBuyInCents).toBe(1000)
  })

  it('réordonne les sièges (échange et permutation complète)', () => {
    setupThree()
    const [h, j, l] = ['Hugo', 'Julie', 'Léo'].map(idOf) as [string, string, string]
    expect(s().reorderSeats([l, h])).toBe(true) // échange Hugo (0) et Léo (2)
    const order = () => [...s().game.players].sort((a, b) => a.seatOrder - b.seatOrder).map((p) => p.name)
    expect(order()).toEqual(['Léo', 'Julie', 'Hugo'])
    expect(s().reorderSeats([j, h, l])).toBe(true)
    expect(order()).toEqual(['Julie', 'Hugo', 'Léo'])
    expect(s().reorderSeats([h, h])).toBe(false)
    expect(s().reorderSeats(['inconnu'])).toBe(false)
  })

  it('refuse de démarrer à moins de 2 joueurs', () => {
    s().addPlayer('Seul')
    expect(s().start()).toBe(false)
    expect(s().game.status).toBe('setup')
  })
})

describe('configuration jetons', () => {
  it('modifiable avant « Démarrer », verrouillée ensuite (critère 7)', () => {
    setupThree()
    expect(s().setChipConfig(cfg)).toBe(true)
    expect(s().setChipConfig({ ...cfg, bbPoints: 200 })).toBe(true)
    s().start()
    expect(s().setChipConfig({ ...cfg, bbPoints: 50 })).toBe(false)
    expect(s().setChipConfig(undefined)).toBe(false)
    expect(s().game.chipConfig?.bbPoints).toBe(200)
  })

  it('peut être créée en cours de partie si elle n’existait pas (SPEC §2.2), puis verrouillée', () => {
    setupThree()
    s().start()
    expect(s().setChipConfig(cfg)).toBe(true)
    expect(s().setChipConfig({ ...cfg, bbPoints: 50 })).toBe(false)
  })

  it('refuse une configuration invalide', () => {
    expect(s().setChipConfig({ ...cfg, centsPerPoint: { num: 0, den: 1 } })).toBe(false)
    expect(s().setChipConfig({ ...cfg, bbPoints: 1.5 })).toBe(false)
  })

  it('les unités Pts et BB exigent une configuration', () => {
    expect(s().setUnit('pts')).toBe(false)
    s().setChipConfig(cfg)
    expect(s().setUnit('bb')).toBe(true)
    s().setChipConfig(undefined)
    expect(s().unit).toBe('eur')
  })
})

describe('partie complète', () => {
  it('enchaîne démarrage, recave, départ, retour, ajout, correction et fin', () => {
    setupThree()
    expect(s().start()).toBe(true)
    const g = s().game
    expect(g.status).toBe('running')
    expect(g.startedAt).toBe(T0)
    expect(g.events.map((e) => [e.type, e.amountCents, e.at])).toEqual([
      ['buyin', 2000, T0],
      ['buyin', 2000, T0],
      ['buyin', 2000, T0],
    ])
    expect(s().start()).toBe(false)

    const [h, j, l] = ['Hugo', 'Julie', 'Léo'].map(idOf) as [string, string, string]
    later()
    expect(s().rebuy(j, 2000)).toBe(true)
    expect(s().rebuy(j, 0)).toBe(false)
    later()
    expect(s().leave(h, 3240)).toBe(true) // Hugo part à +12,40 €
    expect(s().rebuy(h, 2000)).toBe(false) // parti : pas de recave
    expect(s().leave(h, 0)).toBe(false)
    expect(summarizePlayers(s().game).get(h)).toMatchObject({ status: 'left', balanceCents: 1240 })
    later()
    expect(s().return(h, 2000)).toBe(true)
    expect(s().return(h, 2000)).toBe(false) // déjà assis
    later()
    const s2 = s().addPlayer('Sarah', { buyInCents: 1500 })!
    expect(s().game.events.at(-1)).toMatchObject({ type: 'buyin', playerId: s2, amountCents: 1500 })
    expect(s().deletePlayer(s2)).toBe(false) // a une transaction

    // Correction dans l'historique : la recave de Julie était de 10 €.
    const rebuyId = s().game.events.find((e) => e.type === 'rebuy')!.id
    expect(s().editEvent(rebuyId, { amountCents: 1000 })).toBe(true)
    expect(s().editEvent(rebuyId, { amountCents: -5 })).toBe(false)

    // En jeu : 3×20 + 10 (recave) + 20 (retour) + 15 (Sarah) − 32,40 (départ) = 72,60 €
    expect(computeStats(s().game).moneyInPlayCents).toBe(7260)

    later()
    const finals = [
      { playerId: h, cents: 1000 },
      { playerId: j, cents: 4000 },
      { playerId: l, cents: 760 },
      { playerId: s2, cents: 1500 },
    ]
    expect(s().finish(finals.slice(1))).toBe(false) // il manque un joueur assis
    expect(s().finish(finals)).toBe(true)

    const recap = s().lastRecap!
    expect(recap.game.status).toBe('finished')
    expect(recap.game.endedAt).toBe(Date.now())
    expect(recap.game.events.filter((e) => e.type === 'final')).toHaveLength(4)
    // Hugo : 32,40 + 10 − 40 = +2,40 ; Julie : 40 − 30 = +10 ; Léo : 7,60 − 20 = −12,40 ; Sarah : 0
    const total = recap.transfers.reduce((t, x) => t + x.amountCents, 0)
    expect(total).toBe(1240)
    expect(recap.transfers).toHaveLength(2)
    expect(recap.transfers.every((t) => t.from === l)).toBe(true)

    // Partie close : plus aucune action, nouvelle table prête avec le même buy-in.
    expect(s().game.status).toBe('setup')
    expect(s().addPlayer('Tardif')).toBeNull()
    expect(s().newGame()).toBe(true)
    expect(s().lastRecap).toBeNull()
    expect(s().game.players).toEqual([])
  })

  it('exige une résolution de l’écart de comptage (critère 5)', () => {
    setupThree()
    s().start()
    const ids = ['Hugo', 'Julie', 'Léo'].map(idOf)
    const finals = [
      { playerId: ids[0]!, cents: 3000 },
      { playerId: ids[1]!, cents: 2001 },
      { playerId: ids[2]!, cents: 899 }, // somme 59,00 € pour 60,00 € en jeu
    ]
    expect(s().finish(finals)).toBe(false)
    expect(s().finish(finals, { type: 'prorata' })).toBe(true)
    const { game, transfers } = s().lastRecap!
    expect(game.discrepancyResolution).toEqual({ type: 'prorata' })
    const paid = transfers.reduce((t, x) => t + x.amountCents, 0)
    expect(paid).toBeGreaterThan(0)
  })

  it('ne stocke pas de résolution inutile', () => {
    setupThree()
    s().start()
    const finals = ['Hugo', 'Julie', 'Léo'].map((n) => ({ playerId: idOf(n), cents: 2000 }))
    expect(s().finish(finals, { type: 'prorata' })).toBe(true)
    expect(s().lastRecap!.game.discrepancyResolution).toBeUndefined()
    expect(s().lastRecap!.transfers).toEqual([])
  })

  it('supprime un événement', () => {
    setupThree()
    s().start()
    s().rebuy(idOf('Hugo'), 2000)
    const id = s().game.events.at(-1)!.id
    expect(s().deleteEvent(id)).toBe(true)
    expect(s().deleteEvent(id)).toBe(false)
    expect(computeStats(s().game).rebuyCount).toBe(0)
  })

  it('garde les événements triés par heure après modification', () => {
    setupThree()
    s().start()
    later(60_000)
    s().rebuy(idOf('Hugo'), 2000)
    const rebuy = s().game.events.at(-1)!
    expect(s().editEvent(rebuy.id, { at: T0 - 1 })).toBe(true)
    expect(s().game.events[0]!.id).toBe(rebuy.id)
  })
})

describe('annulation', () => {
  it('restaure l’état précédent pendant 5 s', () => {
    setupThree()
    s().start()
    const before = s().game
    s().rebuy(idOf('Hugo'), 2000)
    expect(s().undoable?.action).toBe('rebuy')
    vi.setSystemTime(Date.now() + UNDO_MS)
    expect(s().undo()).toBe(true)
    expect(s().game).toBe(before)
    expect(s().undoable).toBeNull()
  })

  it('expire après 5 s', () => {
    setupThree()
    s().start()
    s().rebuy(idOf('Hugo'), 2000)
    vi.setSystemTime(Date.now() + UNDO_MS + 1)
    expect(s().undo()).toBe(false)
    expect(computeStats(s().game).rebuyCount).toBe(1)
  })

  it('n’annule que la dernière action', () => {
    setupThree()
    s().start()
    s().rebuy(idOf('Hugo'), 2000)
    s().rebuy(idOf('Julie'), 2000)
    expect(s().undo()).toBe(true)
    expect(s().undo()).toBe(false)
    expect(computeStats(s().game).rebuyCount).toBe(1)
  })

  it('annule une fin de partie et une nouvelle partie', () => {
    setupThree()
    s().start()
    const running = s().game
    s().finish(['Hugo', 'Julie', 'Léo'].map((n) => ({ playerId: idOf(n), cents: 2000 })))
    expect(s().undo()).toBe(true)
    expect(s().game).toBe(running)
    expect(s().lastRecap).toBeNull()

    s().finish(running.players.map((p) => ({ playerId: p.id, cents: 2000 })))
    const recap = s().lastRecap
    s().newGame()
    expect(s().undo()).toBe(true)
    expect(s().lastRecap).toBe(recap)
  })

  it('une action refusée ne touche pas à l’annulation en cours', () => {
    setupThree()
    s().start()
    s().rebuy(idOf('Hugo'), 2000)
    expect(s().rebuy(idOf('Hugo'), -1)).toBe(false)
    expect(s().undoable?.action).toBe('rebuy')
  })

  it('ne remonte pas l’interrupteur écran allumé', () => {
    setupThree()
    s().setWakeLock(true)
    expect(s().undo()).toBe(true) // annule l'ajout de Léo
    expect(s().game.wakeLock).toBe(true)
    expect(s().game.players).toHaveLength(2)
  })
})

describe('persistance', () => {
  it('sauvegarde sous la clé pokervice, version 1, sans l’instantané d’annulation', () => {
    setupThree()
    const raw = JSON.parse(storage.data.get(STORAGE_KEY)!)
    expect(raw.version).toBe(1)
    expect(Object.keys(raw.state).sort()).toEqual(['game', 'lastRecap', 'unit'])
  })

  it('restaure à l’identique après un rechargement, chrono compris (critère 2)', () => {
    setupThree()
    s().setChipConfig(cfg)
    s().setUnit('bb')
    s().start()
    later()
    s().rebuy(idOf('Julie'), 2000)
    s().leave(idOf('Hugo'), 3240)
    const before = { game: s().game, lastRecap: s().lastRecap, unit: s().unit }

    later(3_600_000)
    const reloaded = createGameStore(storage)
    const r = reloaded.getState()
    expect({ game: r.game, lastRecap: r.lastRecap, unit: r.unit }).toEqual(before)
    expect(r.game.startedAt).toBe(T0)
    expect(r.undoable).toBeNull()
    // Le store rechargé reste pleinement utilisable.
    expect(r.rebuy(r.game.players[1]!.id, 2000)).toBe(true)
  })

  it('restaure un récap', () => {
    setupThree()
    s().start()
    s().finish(['Hugo', 'Julie', 'Léo'].map((n, i) => ({ playerId: idOf(n), cents: [3000, 2000, 1000][i]! })))
    const reloaded = createGameStore(storage).getState()
    expect(reloaded.lastRecap).toEqual(s().lastRecap)
  })
})
