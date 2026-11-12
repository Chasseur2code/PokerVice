// Store unique de l'app : la partie en cours, le dernier récap et l'unité d'affichage.
//
// - Chaque action « métier » ajoute, modifie ou retire des événements ; balances et stats restent
//   dérivées par lib/ (jamais stockées).
// - Toutes les mises à jour sont immuables : l'état précédent est conservé par simple référence,
//   ce qui rend `undo()` gratuit (instantané gardé 5 s, non persisté).
// - Une action refusée (mauvais statut, montant invalide…) ne change rien et renvoie `false`.
// - `finish` range la partie terminée dans `lastRecap` et remet une partie vierge dans `game` :
//   l'UI affiche le récap tant que `lastRecap` existe ; `newGame` l'efface.
//
// Fabrique sans React (zustand/vanilla) : testable sous Node avec un stockage en mémoire.
// L'instance de l'app et le hook Preact sont dans useGame.ts.
import { createStore } from 'zustand/vanilla'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { summarizePlayers, type PlayerSummary } from '../lib/derive'
import { finalBalances, type FinalStack } from '../lib/discrepancy'
import { MAX_SEATED, MIN_PLAYERS_TO_START, nextPlayerColor } from '../lib/players'
import { settle, type Transfer } from '../lib/settlement'
import { fraction } from '../lib/units'
import type { ChipConfig, DiscrepancyResolution, Game, GameEvent, GameEventType, Player, Unit } from '../lib/types'

export const STORAGE_KEY = 'pokervice'
/** Version du schéma persisté : l'incrémenter impose d'écrire la migration dans `migrate`. */
export const SCHEMA_VERSION = 1
export const UNDO_MS = 5000
export const DEFAULT_BUY_IN_CENTS = 2000

export interface LastRecap {
  /** Partie terminée, figée (statut `finished`, événements `final` compris). */
  game: Game
  /** Virements exacts au centime ; l'option « Arrondir à l'euro » se dérive avec `roundTransfers`. */
  transfers: Transfer[]
}

export interface PersistedState {
  game: Game
  lastRecap: LastRecap | null
  unit: Unit
}

export type UndoableAction =
  | 'setBuyIn'
  | 'addPlayer'
  | 'updatePlayer'
  | 'deletePlayer'
  | 'reorderSeats'
  | 'setChipConfig'
  | 'start'
  | 'rebuy'
  | 'leave'
  | 'return'
  | 'editEvent'
  | 'deleteEvent'
  | 'finish'
  | 'newGame'

export interface UndoEntry {
  action: UndoableAction
  playerId?: string
  /** Heure (ms) jusqu'à laquelle `undo()` est accepté. */
  until: number
  prev: PersistedState
  /** Unité juste après l'action : si elle a changé depuis, c'est un choix d'affichage à garder. */
  unitAfter: Unit
}

export interface AddPlayerOptions {
  /** Par défaut, la première couleur libre de la palette. */
  color?: string
  /** Buy-in enregistré si la partie a démarré ; par défaut le buy-in commun. */
  buyInCents?: number
}

export interface GameActions {
  setBuyIn(cents: number): boolean
  /** Renvoie l'id du joueur créé, ou `null` si refusé (nom vide, table pleine, partie close). */
  addPlayer(name: string, opts?: AddPlayerOptions): string | null
  /** Prénom et/ou couleur en une seule action annulable ; refusé si le prénom ou la couleur est vide. */
  updatePlayer(playerId: string, patch: { name?: string; color?: string }): boolean
  /** Seulement pour un joueur sans aucune transaction. */
  deletePlayer(playerId: string): boolean
  /**
   * Redistribue les places occupées par `playerIds` dans l'ordre donné.
   * Échanger A et B : `reorderSeats([B, A])` ; une permutation complète marche aussi.
   */
  reorderSeats(playerIds: readonly string[]): boolean
  /**
   * Possible avant « Démarrer », ou après s'il n'y a pas encore de configuration (SPEC §2.2).
   * `buyInCents` change aussi le buy-in commun dans la même action (buy-in saisi dans l'assistant).
   */
  setChipConfig(cfg: ChipConfig | undefined, buyInCents?: number): boolean
  start(): boolean
  rebuy(playerId: string, cents: number): boolean
  leave(playerId: string, stackCents: number): boolean
  return(playerId: string, buyInCents: number): boolean
  editEvent(eventId: string, patch: { amountCents?: number; at?: number }): boolean
  deleteEvent(eventId: string): boolean
  /**
   * Termine la partie avec le stack final de chaque joueur assis (tous, et eux seuls).
   * `resolution` est requise s'il y a un écart de comptage ; refusé si l'écart reste non résolu.
   */
  finish(finals: readonly FinalStack[], resolution?: DiscrepancyResolution): boolean
  /** Efface le récap (ou abandonne la partie en cours) et repart d'une table vide. */
  newGame(): boolean
  setUnit(unit: Unit): boolean
  setWakeLock(on: boolean): void
  /** Restaure l'état d'avant la dernière action, si elle date de moins de 5 s. */
  undo(): boolean
}

export type GameState = PersistedState & { undoable: UndoEntry | null } & GameActions

// ——— Aides pures ———

let idCounter = 0
/** Id court et unique. Pas de `crypto.randomUUID` : absent hors contexte sécurisé (http sur le wifi). */
function makeId(): string {
  idCounter = (idCounter + 1) % 1296
  return Date.now().toString(36) + idCounter.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6)
}

export function blankGame(defaultBuyInCents = DEFAULT_BUY_IN_CENTS, wakeLock = false, now = Date.now()): Game {
  return { version: SCHEMA_VERSION, status: 'setup', createdAt: now, defaultBuyInCents, players: [], events: [], wakeLock }
}

function isCents(v: number, allowZero: boolean): boolean {
  return Number.isSafeInteger(v) && (allowZero ? v >= 0 : v > 0)
}

function isValidChipConfig(cfg: ChipConfig): boolean {
  const { num, den } = cfg.centsPerPoint
  if (!Number.isSafeInteger(num) || num <= 0 || !Number.isSafeInteger(den) || den <= 0) return false
  // La fraction doit déjà être réduite (cf. type Fraction).
  if (fraction(num, den).den !== den) return false
  return (
    Number.isSafeInteger(cfg.bbPoints) && cfg.bbPoints > 0 &&
    Number.isSafeInteger(cfg.sbPoints) && cfg.sbPoints > 0 && cfg.sbPoints <= cfg.bbPoints
  )
}

/**
 * Configuration de l'assistant : le stack de départ vaut le buy-in, donc 1 pt = buy-in ÷ stack.
 * Changer le buy-in avant « Démarrer » change la valeur du point, pas les jetons.
 */
function rescaleToBuyIn(cfg: ChipConfig | undefined, buyInCents: number): ChipConfig | undefined {
  if (cfg?.mode !== 'assistant' || !cfg.colors?.length) return cfg
  const stack = cfg.colors.reduce((s, c) => s + c.valuePoints * c.perPlayer, 0)
  return stack > 0 ? { ...cfg, centsPerPoint: fraction(buyInCents, stack) } : cfg
}

function event(type: GameEventType, playerId: string, amountCents: number, at: number): GameEvent {
  return { id: makeId(), at, type, playerId, amountCents }
}

function seatedCount(summaries: Map<string, PlayerSummary>): number {
  let n = 0
  for (const s of summaries.values()) if (s.status === 'seated') n += 1
  return n
}

function statusOf(game: Game, playerId: string) {
  return summarizePlayers(game).get(playerId)?.status
}

/** Un historique modifié ne doit pas faire dépasser la limite de joueurs assis. */
function withinSeatLimit(events: GameEvent[], game: Game): boolean {
  return seatedCount(summarizePlayers({ players: game.players, events })) <= MAX_SEATED
}

// ——— Store ———

export function createGameStore(storage: StateStorage) {
  return createStore<GameState>()(
    persist(
      (set, get) => {
        /** La partie modifiable : ni récap affiché, ni partie close. */
        const openGame = (): Game | null => {
          const { game, lastRecap } = get()
          return lastRecap || game.status === 'finished' ? null : game
        }

        /** Applique un changement et garde l'état précédent pour `undo()`. */
        const commit = (action: UndoableAction, next: Partial<PersistedState>, playerId?: string) => {
          set((s) => ({
            ...next,
            undoable: {
              action,
              playerId,
              until: Date.now() + UNDO_MS,
              prev: { game: s.game, lastRecap: s.lastRecap, unit: s.unit },
              unitAfter: next.unit ?? s.unit,
            },
          }))
        }

        const appendEvent = (action: UndoableAction, ev: GameEvent): void => {
          const game = get().game
          commit(action, { game: { ...game, events: [...game.events, ev] } }, ev.playerId)
        }

        return {
          game: blankGame(),
          lastRecap: null,
          unit: 'eur',
          undoable: null,

          setBuyIn(cents) {
            const game = openGame()
            if (!game || !isCents(cents, false)) return false
            // Une fois la partie démarrée, la configuration jetons est verrouillée : on n'y touche plus.
            const chipConfig = game.status === 'setup' ? rescaleToBuyIn(game.chipConfig, cents) : game.chipConfig
            commit('setBuyIn', { game: { ...game, defaultBuyInCents: cents, chipConfig } })
            return true
          },

          addPlayer(name, opts = {}) {
            const game = openGame()
            const trimmed = name.trim()
            if (!game || !trimmed || opts.color === '' || seatedCount(summarizePlayers(game)) >= MAX_SEATED) return null
            const buyIn = opts.buyInCents ?? game.defaultBuyInCents
            if (game.status === 'running' && !isCents(buyIn, false)) return null
            const player: Player = {
              id: makeId(),
              name: trimmed,
              color: opts.color ?? nextPlayerColor(game.players),
              seatOrder: game.players.reduce((m, p) => Math.max(m, p.seatOrder + 1), 0),
            }
            const events = game.status === 'running' ? [...game.events, event('buyin', player.id, buyIn, Date.now())] : game.events
            commit('addPlayer', { game: { ...game, players: [...game.players, player], events } }, player.id)
            return player.id
          },

          updatePlayer(playerId, { name, color }) {
            const game = openGame()
            const player = game?.players.find((p) => p.id === playerId)
            const trimmed = name?.trim()
            if (!game || !player || trimmed === '' || color === '') return false
            const next = { ...player, name: trimmed ?? player.name, color: color ?? player.color }
            if (next.name === player.name && next.color === player.color) return true
            commit('updatePlayer', { game: { ...game, players: game.players.map((p) => (p.id === playerId ? next : p)) } }, playerId)
            return true
          },

          deletePlayer(playerId) {
            const game = openGame()
            if (!game?.players.some((p) => p.id === playerId)) return false
            if (game.events.some((e) => e.playerId === playerId)) return false
            commit('deletePlayer', { game: { ...game, players: game.players.filter((p) => p.id !== playerId) } }, playerId)
            return true
          },

          reorderSeats(playerIds) {
            const game = openGame()
            if (!game || playerIds.length === 0 || new Set(playerIds).size !== playerIds.length) return false
            const byId = new Map(game.players.map((p) => [p.id, p]))
            if (!playerIds.every((id) => byId.has(id))) return false
            const slots = playerIds.map((id) => byId.get(id)!.seatOrder).sort((a, b) => a - b)
            const newOrder = new Map(playerIds.map((id, i) => [id, slots[i]!]))
            const players = game.players.map((p) => (newOrder.has(p.id) ? { ...p, seatOrder: newOrder.get(p.id)! } : p))
            commit('reorderSeats', { game: { ...game, players } })
            return true
          },

          setChipConfig(cfg, buyInCents) {
            const game = openGame()
            if (!game || (buyInCents !== undefined && !isCents(buyInCents, false))) return false
            // Verrouillée dès « Démarrer » : en cours de partie, on peut seulement en créer une.
            if (game.status === 'running' && (game.chipConfig || !cfg)) return false
            if (cfg && !isValidChipConfig(cfg)) return false
            const defaultBuyInCents = buyInCents ?? game.defaultBuyInCents
            commit('setChipConfig', { game: { ...game, chipConfig: cfg, defaultBuyInCents }, unit: cfg ? get().unit : 'eur' })
            return true
          },

          start() {
            const game = openGame()
            if (!game || game.status !== 'setup' || game.players.length < MIN_PLAYERS_TO_START) return false
            const now = Date.now()
            const seats = [...game.players].sort((a, b) => a.seatOrder - b.seatOrder)
            const buyIns = seats.map((p) => event('buyin', p.id, game.defaultBuyInCents, now))
            commit('start', { game: { ...game, status: 'running', startedAt: now, events: [...game.events, ...buyIns] } })
            return true
          },

          rebuy(playerId, cents) {
            const game = openGame()
            if (game?.status !== 'running' || !isCents(cents, false) || statusOf(game, playerId) !== 'seated') return false
            appendEvent('rebuy', event('rebuy', playerId, cents, Date.now()))
            return true
          },

          leave(playerId, stackCents) {
            const game = openGame()
            if (game?.status !== 'running' || !isCents(stackCents, true) || statusOf(game, playerId) !== 'seated') return false
            appendEvent('leave', event('leave', playerId, stackCents, Date.now()))
            return true
          },

          return(playerId, buyInCents) {
            const game = openGame()
            if (game?.status !== 'running' || !isCents(buyInCents, false)) return false
            const summaries = summarizePlayers(game)
            if (summaries.get(playerId)?.status !== 'left' || seatedCount(summaries) >= MAX_SEATED) return false
            appendEvent('return', event('return', playerId, buyInCents, Date.now()))
            return true
          },

          editEvent(eventId, patch) {
            const game = openGame()
            const ev = game?.events.find((e) => e.id === eventId)
            if (game?.status !== 'running' || !ev) return false
            const amountCents = patch.amountCents ?? ev.amountCents
            const at = patch.at ?? ev.at
            if (!isCents(amountCents, ev.type === 'leave') || !Number.isSafeInteger(at)) return false
            // Ni avant le début ni dans le futur : un départ « à venir » primerait sur tout retour réel.
            if (patch.at !== undefined && (at < game.startedAt! || at > Date.now())) return false
            // Tri stable par heure : à heure égale, l'ordre de saisie est conservé.
            const events = game.events.map((e) => (e.id === eventId ? { ...e, amountCents, at } : e)).sort((a, b) => a.at - b.at)
            if (patch.at !== undefined && !withinSeatLimit(events, game)) return false
            commit('editEvent', { game: { ...game, events } }, ev.playerId)
            return true
          },

          deleteEvent(eventId) {
            const game = openGame()
            const ev = game?.events.find((e) => e.id === eventId)
            if (game?.status !== 'running' || !ev) return false
            const events = game.events.filter((e) => e.id !== eventId)
            if (ev.type === 'leave' && !withinSeatLimit(events, game)) return false
            commit('deleteEvent', { game: { ...game, events } }, ev.playerId)
            return true
          },

          finish(finals, resolution) {
            const game = openGame()
            if (game?.status !== 'running') return false
            const seated = [...summarizePlayers(game).values()].filter((s) => s.status === 'seated').map((s) => s.playerId)
            const finalIds = new Set(finals.map((f) => f.playerId))
            if (finalIds.size !== finals.length || finalIds.size !== seated.length || !seated.every((id) => finalIds.has(id))) return false
            if (!finals.every((f) => isCents(f.cents, true))) return false
            if (resolution && resolution.type !== 'prorata' && resolution.type !== 'assign') return false

            const now = Date.now()
            const draft: Game = {
              ...game,
              status: 'finished',
              endedAt: now,
              events: [...game.events, ...finals.map((f) => event('final', f.playerId, f.cents, now))],
              discrepancyResolution: resolution && { ...resolution },
            }
            // Un seul calcul : sans écart, la résolution est ignorée (puis retirée) ; avec un écart,
            // un joueur inconnu ou non compté donne `resolved: false`.
            const fb = finalBalances(draft)
            if (!fb.resolved || fb.stacks.some((f) => f.cents < 0)) return false
            if (fb.discrepancyCents === 0) draft.discrepancyResolution = undefined
            const transfers = settle([...fb.balances].map(([playerId, balanceCents]) => ({ playerId, balanceCents })))
            commit('finish', { lastRecap: { game: draft, transfers }, game: blankGame(game.defaultBuyInCents, game.wakeLock, now) })
            return true
          },

          newGame() {
            const { game } = get()
            commit('newGame', { lastRecap: null, game: blankGame(game.defaultBuyInCents, game.wakeLock), unit: 'eur' })
            return true
          },

          setUnit(unit) {
            const { game, lastRecap } = get()
            const cfg = lastRecap ? lastRecap.game.chipConfig : game.chipConfig
            if (unit !== 'eur' && !cfg) return false
            set({ unit })
            return true
          },

          setWakeLock(on) {
            set((s) => ({ game: { ...s.game, wakeLock: on } }))
          },

          undo() {
            const { undoable: u } = get()
            if (!u || Date.now() > u.until) {
              if (u) set({ undoable: null })
              return false
            }
            // L'écran allumé et l'unité choisie après l'action sont des préférences, pas des actions :
            // on ne les remonte pas dans le temps (sauf unité impossible sans configuration jetons).
            set((s) => {
              const { game, lastRecap } = u.prev
              let unit = s.unit === u.unitAfter ? u.prev.unit : s.unit
              if (unit !== 'eur' && !(lastRecap ? lastRecap.game.chipConfig : game.chipConfig)) unit = 'eur'
              return {
                ...u.prev,
                game: game.wakeLock === s.game.wakeLock ? game : { ...game, wakeLock: s.game.wakeLock },
                unit,
                undoable: null,
              }
            })
            return true
          },
        }
      },
      {
        name: STORAGE_KEY,
        version: SCHEMA_VERSION,
        storage: createJSONStorage<PersistedState>(() => storage),
        partialize: ({ game, lastRecap, unit }): PersistedState => ({ game, lastRecap, unit }),
        // Point d'entrée des migrations futures : `if (version < 2) { …transformer… }`.
        migrate: (persisted) => persisted as PersistedState,
      },
    ),
  )
}

export type GameStore = ReturnType<typeof createGameStore>
