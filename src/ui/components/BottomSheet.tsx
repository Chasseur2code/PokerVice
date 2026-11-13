// Bottom sheet en mobile, modale centrée à partir de 768 px (DESIGN §5).
// Fermeture : glisser la poignée vers le bas, toucher le voile ou Échap.
import type { ComponentChildren, RefObject } from 'preact'
import { createPortal } from 'preact/compat'
import { useEffect, useId, useRef, useState } from 'preact/hooks'
import { focusOrigin } from '../keyboard'

const DURATION_MS = 220
/** Au-delà de ce déplacement (px) ou de cette vitesse (px/ms), le glissement ferme la sheet. */
const DRAG_CLOSE_PX = 80
const DRAG_CLOSE_SPEED = 0.5

/**
 * Blocage du défilement de la page, compté : deux sheets se chevauchent quand l'une s'ouvre pendant
 * la sortie de l'autre. Avec une simple sauvegarde/restauration de `overflow`, la seconde notait
 * « hidden » comme valeur d'origine et laissait la page bloquée après sa fermeture.
 */
let scrollLocks = 0
function lockScroll() {
  if (scrollLocks++ === 0) document.body.style.overflow = 'hidden'
}
function unlockScroll() {
  if (--scrollLocks === 0) document.body.style.overflow = ''
}

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: ComponentChildren
  children?: ComponentChildren
  /** Zone collée en bas (bouton principal sur toute la largeur). */
  footer?: ComponentChildren
  /** Plein écran (historique, assistant jetons). */
  full?: boolean
  /**
   * Élément à focaliser à l'ouverture (sinon le panneau). Passer par ici plutôt que par un effet
   * de l'enfant : les effets des enfants passent avant celui-ci, qui noterait alors l'enfant
   * comme élément d'origine et ne rendrait plus le focus au bouton qui a ouvert la sheet.
   */
  initialFocus?: RefObject<HTMLElement | null>
}

export function BottomSheet({ open, onClose, title, children, footer, full = false, initialFocus }: BottomSheetProps) {
  // `mounted` garde la sheet dans le DOM pendant l'animation de sortie ; `shown` pilote la transition.
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Deux frames : la position de départ doit être peinte avant d'activer la transition.
      let id = requestAnimationFrame(() => {
        id = requestAnimationFrame(() => setShown(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), DURATION_MS)
    return () => clearTimeout(t)
  }, [open])

  // Échap, blocage du défilement de la page, et retour du focus à l'élément d'origine.
  useEffect(() => {
    if (!mounted) return
    const previous = focusOrigin()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    lockScroll()
    return () => {
      document.removeEventListener('keydown', onKey)
      unlockScroll()
      previous?.focus?.({ preventScroll: true })
    }
  }, [mounted])

  // Focus à chaque ouverture, y compris une réouverture pendant l'animation de sortie (toujours montée).
  // Après l'effet ci-dessus, qui a noté l'élément d'origine.
  const visible = mounted && open
  useEffect(() => {
    if (!visible) return
    const el = initialFocus?.current ?? panel.current
    el?.focus({ preventScroll: true })
  }, [visible])

  // Glissement vers le bas : on écrit directement le style (pas de re-rendu à chaque mouvement).
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    if (window.matchMedia('(min-width: 768px)').matches) return
    drag.current = { y: e.clientY, t: e.timeStamp, dy: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    panel.current?.setAttribute('data-dragging', '')
  }
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    d.dy = Math.max(0, e.clientY - d.y)
    panel.current?.style.setProperty('--drag', `${d.dy}px`)
  }
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    const el = panel.current
    el?.removeAttribute('data-dragging')
    const speed = d.dy / Math.max(1, e.timeStamp - d.t)
    if (d.dy > DRAG_CLOSE_PX || (d.dy > 10 && speed > DRAG_CLOSE_SPEED)) onClose()
    else el?.style.setProperty('--drag', '0px')
  }

  if (!mounted) return null

  return createPortal(
    <div class="fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-6">
      <div class="sheet-backdrop absolute inset-0" data-open={shown || undefined} onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-open={shown || undefined}
        class={`sheet-panel relative flex w-full flex-col rounded-t-sheet bg-surface shadow-card outline-none md:max-w-[440px] md:rounded-sheet ${
          full ? 'h-[calc(100dvh-env(safe-area-inset-top)-12px)] md:h-[85dvh] md:max-w-[560px]' : 'max-h-[92dvh]'
        }`}
      >
        <div
          class="shrink-0 touch-none px-4 pt-2 pb-3 select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div class="mx-auto mb-3 h-1 w-9 rounded-full bg-border-strong md:invisible" />
          <h2 id={titleId} class="font-display text-[20px] font-semibold">
            {title}
          </h2>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">{children}</div>
        <div class={`shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] ${footer ? 'pt-3' : ''}`}>{footer}</div>
      </div>
    </div>,
    document.body,
  )
}
