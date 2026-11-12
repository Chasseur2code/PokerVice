// La table (DESIGN §2.2 et §3) : feutre, bord en bois, liseré, centre libre, sièges autour.
// Les positions viennent de lib/seats (unités de zone) et sont converties en % de la zone :
// la table garde ses proportions quelle que soit la largeur de l'écran.
//
// Réordonner (DESIGN §5) : un appui long de 400 ms soulève un siège occupé, qui suit alors le doigt ;
// on le lâche sur un autre siège occupé pour échanger les places. Le déplacement est écrit directement
// dans le style (variables --drag-x/y) : aucun re-rendu pendant le glissement.
import type { ComponentChildren } from 'preact'
import { Plus } from 'lucide-preact'
import { useMemo, useRef, useState } from 'preact/hooks'
import { seatLayout, tableGeometry, type Orientation, type Point, type SeatKind } from '../../lib/seats'

export type SeatSlot =
  | {
      kind: 'player'
      key: string
      name: string
      color: string
      /** Montant déjà formaté dans l'unité courante (total investi) ; absent avant « Démarrer ». */
      amount?: string
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
  /** Active le réordonnancement par appui long : reçoit les clés des deux sièges occupés à échanger. */
  onSwap?: (fromKey: string, toKey: string) => void
}

const LONG_PRESS_MS = 400
/** Au-delà de ce déplacement (px) avant les 400 ms, c'est un défilement et non un appui long. */
const MOVE_TOLERANCE_PX = 8

interface Press {
  key: string
  el: HTMLElement
  pointerId: number
  x: number
  y: number
  timer?: ReturnType<typeof setTimeout>
  lifted: boolean
}

export interface SeatGestures {
  onPointerDown: (e: PointerEvent, key: string) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
  onPointerCancel: (e: PointerEvent) => void
  /** Empêche le défilement de la page pendant qu'un siège est soulevé. */
  onTouchMove: (e: TouchEvent) => void
  /** Vrai juste après un dépôt : le clic qui suit l'appui long ne doit pas ouvrir le menu. */
  swallowClick: () => boolean
}

function useSeatGestures(onSwap: TableProps['onSwap']): { lifted: string | null; gestures?: SeatGestures } {
  const [lifted, setLifted] = useState<string | null>(null)
  const press = useRef<Press | null>(null)
  const swallow = useRef(false)

  const reset = (p: Press) => {
    clearTimeout(p.timer)
    p.el.style.removeProperty('--drag-x')
    p.el.style.removeProperty('--drag-y')
    press.current = null
    if (p.lifted) setLifted(null)
  }

  if (!onSwap) return { lifted: null }

  return {
    lifted,
    gestures: {
      onPointerDown(e, key) {
        if (e.button !== 0 || press.current) return
        const p: Press = { key, el: e.currentTarget as HTMLElement, pointerId: e.pointerId, x: e.clientX, y: e.clientY, lifted: false }
        p.timer = setTimeout(() => {
          p.lifted = true
          try {
            p.el.setPointerCapture(p.pointerId)
          } catch {
            // Pointeur déjà relâché : le pointerup suivant n'arrivera pas, on abandonne.
            reset(p)
            return
          }
          setLifted(key)
          navigator.vibrate?.(10)
        }, LONG_PRESS_MS)
        press.current = p
      },
      onPointerMove(e) {
        const p = press.current
        if (!p || e.pointerId !== p.pointerId) return
        const dx = e.clientX - p.x
        const dy = e.clientY - p.y
        if (!p.lifted) {
          if (dx * dx + dy * dy > MOVE_TOLERANCE_PX ** 2) reset(p)
          return
        }
        p.el.style.setProperty('--drag-x', `${dx}px`)
        p.el.style.setProperty('--drag-y', `${dy}px`)
      },
      onPointerUp(e) {
        const p = press.current
        if (!p || e.pointerId !== p.pointerId) return
        const wasLifted = p.lifted
        let target: string | undefined
        if (wasLifted) {
          // Le siège soulevé est sous le doigt : on le rend « transparent » le temps de chercher la cible.
          p.el.style.pointerEvents = 'none'
          target = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-seat]')?.dataset.seat
          p.el.style.pointerEvents = ''
          swallow.current = true
          // Le clic éventuel arrive dans la même tâche que pointerup : on le laisse passer ensuite.
          setTimeout(() => (swallow.current = false), 0)
        }
        reset(p)
        if (wasLifted && target && target !== p.key) onSwap(p.key, target)
      },
      onPointerCancel(e) {
        const p = press.current
        if (p && e.pointerId === p.pointerId) reset(p)
      },
      onTouchMove(e) {
        if (press.current?.lifted && e.cancelable) e.preventDefault()
      },
      swallowClick: () => swallow.current,
    },
  }
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

export function Table({ seats, orientation, center, onSwap }: TableProps) {
  const g = tableGeometry(orientation)
  const W = g.zone.width
  const H = g.zone.height
  // La disposition ne dépend que de la nature des sièges : recalculée seulement quand elle change.
  const kinds = seats.map((s): SeatKind => (s.kind === 'player' ? 'player' : s.highlighted ? 'highlighted' : 'empty')).join()
  const layout = useMemo(() => seatLayout(kinds.split(',') as SeatKind[], orientation), [kinds, orientation])
  const { lifted, gestures } = useSeatGestures(onSwap)

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
        <Seat
          key={s.key}
          slot={s}
          at={layout.at[i]!}
          zone={g.zone}
          card={layout.card}
          width={layout.width[i]!}
          gestures={gestures}
          lifted={lifted === s.key}
        />
      ))}
    </div>
  )
}

interface SeatProps {
  slot: SeatSlot
  at: Point
  zone: { width: number; height: number }
  card: { width: number; height: number }
  /**
   * Siège occupé : largeur maximale de la carte (unités de zone), qui s'ajuste au prénom entre `card.width`
   * et ce maximum. Siège vide : diamètre.
   */
  width: number
  gestures?: SeatGestures
  lifted: boolean
}

function Seat({ slot, at, zone, card, width, gestures, lifted }: SeatProps) {
  const position = { left: pct(at.x, zone.width), top: pct(at.y, zone.height) }
  const base = 'seat absolute'

  if (slot.kind === 'player') {
    return (
      <button
        type="button"
        aria-label={slot.ariaLabel}
        title={slot.name}
        data-seat={slot.key}
        data-lifted={lifted || undefined}
        onClick={() => {
          if (!gestures?.swallowClick()) slot.onClick?.()
        }}
        onPointerDown={gestures && ((e) => gestures.onPointerDown(e, slot.key))}
        onPointerMove={gestures?.onPointerMove}
        onPointerUp={gestures?.onPointerUp}
        onPointerCancel={gestures?.onPointerCancel}
        onTouchMove={gestures?.onTouchMove}
        onContextMenu={gestures && ((e) => e.preventDefault())}
        class={`${base} flex flex-col justify-center gap-0.5 rounded-seat border-l-4 bg-surface py-1 pr-2 pl-1.5 text-left shadow-seat`}
        style={{
          ...position,
          // Largeur du contenu, bornée : un prénom court garde une carte compacte.
          width: 'max-content',
          minWidth: scaled(card.width, zone.width),
          maxWidth: scaled(width, zone.width),
          // Hauteur minimale seulement : un prénom sur deux lignes agrandit la carte.
          minHeight: scaled(card.height, zone.width),
          borderLeftColor: slot.color,
        }}
      >
        <span class="line-clamp-2 text-seat-name leading-tight font-semibold hyphens-auto [overflow-wrap:anywhere]">{slot.name}</span>
        {slot.amount !== undefined && <span class="num truncate text-body font-bold">{slot.amount}</span>}
      </button>
    )
  }

  const size = scaled(width, zone.width)
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
