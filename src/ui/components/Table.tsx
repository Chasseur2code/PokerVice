// La table (DESIGN §2.2 et §3) : feutre, bord en bois, liseré, centre libre, sièges autour.
// Les positions viennent de lib/seats (unités de zone) et sont converties en % de la zone :
// la table garde ses proportions quelle que soit la largeur de l'écran.
import type { ComponentChildren } from 'preact'
import { Plus } from 'lucide-preact'
import {
  EMPTY_SEAT_SIZE,
  HIGHLIGHT_SEAT_SIZE,
  seatPositions,
  seatSize,
  tableGeometry,
  type Orientation,
  type Point,
} from '../../lib/seats'

export type SeatSlot =
  | {
      kind: 'player'
      key: string
      name: string
      color: string
      /** Montant déjà formaté dans l'unité courante (total investi). */
      amount: string
      /** Ex. « Hugo, 20 € investis ». */
      ariaLabel: string
      onClick?: () => void
    }
  | {
      kind: 'empty'
      key: string
      /** Siège mis en avant (premier lancement) : ambre avec halo. */
      highlighted?: boolean
      ariaLabel?: string
      onClick?: () => void
    }

export interface TableProps {
  /** Sièges dans l'ordre horaire, le premier en haut. */
  seats: SeatSlot[]
  orientation: Orientation
  /** Contenu posé sur le feutre (titre, BB, buy-in…). */
  center?: ComponentChildren
}

/**
 * Taille d'un élément en px de maquette, réduite proportionnellement si la zone est plus étroite
 * que la maquette (`cqw` = 1 % de la largeur de la zone, qui est un conteneur de requête).
 */
function scaled(px: number, zoneWidth: number): string {
  return `min(${px}px, ${((px / zoneWidth) * 100).toFixed(3)}cqw)`
}

function pct(v: number, total: number): string {
  return `${((v / total) * 100).toFixed(3)}%`
}

export function Table({ seats, orientation, center }: TableProps) {
  const g = tableGeometry(orientation)
  const W = g.zone.width
  const H = g.zone.height
  const positions = seatPositions(seats.length, orientation)
  const card = seatSize(seats.filter((s) => s.kind === 'player').length)

  return (
    <div class="relative w-full [container-type:inline-size]" style={{ aspectRatio: `${W} / ${H}` }}>
      <div
        class="absolute flex items-center justify-center rounded-[50%] text-on-felt shadow-table"
        style={{
          left: pct(g.oval.x, W),
          top: pct(g.oval.y, H),
          width: pct(g.oval.width, W),
          height: pct(g.oval.height, H),
          background: 'var(--felt)',
          border: 'var(--wood-width) solid var(--color-wood)',
        }}
      >
        <div
          class="pointer-events-none absolute rounded-[50%]"
          style={{ inset: 'calc(var(--rail-inset) - var(--wood-width))', border: 'var(--rail-border)' }}
        />
        <div class="relative flex max-w-[66%] flex-col items-center gap-1 text-center">{center}</div>
      </div>

      {seats.map((s, i) => (
        <Seat key={s.key} slot={s} at={positions[i]!} zone={g.zone} card={card} />
      ))}
    </div>
  )
}

interface SeatProps {
  slot: SeatSlot
  at: Point
  zone: { width: number; height: number }
  card: { width: number; height: number }
}

function Seat({ slot, at, zone, card }: SeatProps) {
  const position = { left: pct(at.x, zone.width), top: pct(at.y, zone.height) }
  const base = 'seat absolute'

  if (slot.kind === 'player') {
    return (
      <button
        type="button"
        aria-label={slot.ariaLabel}
        title={slot.name}
        onClick={slot.onClick}
        class={`${base} flex flex-col justify-center gap-0.5 rounded-seat bg-surface px-2 text-left shadow-seat`}
        style={{ ...position, width: scaled(card.width, zone.width), height: scaled(card.height, zone.width) }}
      >
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="size-2.5 shrink-0 rounded-full" style={{ background: slot.color }} />
          <span class="truncate text-seat-name font-semibold">{slot.name}</span>
        </span>
        <span class="num truncate text-body font-bold">{slot.amount}</span>
      </button>
    )
  }

  const size = scaled(slot.highlighted ? HIGHLIGHT_SEAT_SIZE : EMPTY_SEAT_SIZE, zone.width)
  return (
    <button
      type="button"
      aria-label={slot.ariaLabel ?? 'Ajouter un joueur'}
      onClick={slot.onClick}
      class={`${base} flex items-center justify-center rounded-full ${
        slot.highlighted
          ? 'border-4 border-bg bg-accent text-on-accent shadow-halo'
          : 'border-2 border-dashed border-border-dashed bg-bg text-text-faint'
      }`}
      style={{ ...position, width: size, height: size }}
    >
      <Plus size={slot.highlighted ? 28 : 22} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
