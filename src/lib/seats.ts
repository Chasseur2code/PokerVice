// Géométrie de la table (DESIGN §3) : zone, ovale et position des sièges sur une ellipse.
// Tout est exprimé en « unités de zone » (px de la maquette 390 px) ; l'UI convertit en %.
import { MAX_SEATED } from './players'

export type Orientation = 'portrait' | 'landscape'

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface TableGeometry {
  /** Zone qui contient la table et les sièges. */
  zone: Size
  /** Rectangle de l'ovale (bord en bois compris). */
  oval: Point & Size
  /** Centre commun de l'ovale et de l'ellipse des sièges. */
  center: Point
  /** Rayons de l'ellipse sur laquelle sont centrés les sièges. */
  rx: number
  ry: number
}

const PORTRAIT: TableGeometry = {
  zone: { width: 358, height: 460 },
  oval: { x: 34, y: 30, width: 290, height: 400 },
  center: { x: 179, y: 230 },
  rx: 140,
  ry: 200,
}

/** En paysage, l'ovale passe à l'horizontale : on échange simplement les axes. */
const LANDSCAPE: TableGeometry = {
  zone: { width: PORTRAIT.zone.height, height: PORTRAIT.zone.width },
  oval: { x: PORTRAIT.oval.y, y: PORTRAIT.oval.x, width: PORTRAIT.oval.height, height: PORTRAIT.oval.width },
  center: { x: PORTRAIT.center.y, y: PORTRAIT.center.x },
  rx: PORTRAIT.ry,
  ry: PORTRAIT.rx,
}

export function tableGeometry(orientation: Orientation): TableGeometry {
  return orientation === 'portrait' ? PORTRAIT : LANDSCAPE
}

/**
 * Centres des `count` sièges, en partant du haut et dans le sens horaire :
 * θ = i·360°/N ; x = cx + rx·sin θ ; y = cy − ry·cos θ.
 * Pour N pair, le siège N/2 est celui du bas (θ = 180°).
 */
export function seatPositions(count: number, orientation: Orientation): Point[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`count invalide : ${count}`)
  const { center, rx, ry } = tableGeometry(orientation)
  return Array.from({ length: count }, (_, i) => {
    const theta = (2 * Math.PI * i) / count
    return { x: center.x + rx * Math.sin(theta), y: center.y - ry * Math.cos(theta) }
  })
}

/** Carte d'un siège occupé : réduite à partir de 9 joueurs assis pour éviter les chevauchements. */
export function seatSize(seatedCount: number): Size {
  return seatedCount >= 9 ? { width: 76, height: 54 } : { width: 84, height: 58 }
}

/** Diamètres des sièges vides (DESIGN §3). */
export const EMPTY_SEAT_SIZE = 52
export const HIGHLIGHT_SEAT_SIZE = 68

/** Nombre de sièges initial avant le premier joueur (DESIGN §4.1). */
export const INITIAL_SEATS = 6

/**
 * Sièges vides à afficher en préparation (DESIGN §4.1) : on complète jusqu'à 6,
 * puis un seul siège vide au-delà, et aucun à 10 joueurs.
 */
export function emptySeatCount(playerCount: number): number {
  if (playerCount >= MAX_SEATED) return 0
  return Math.max(1, INITIAL_SEATS - playerCount)
}
