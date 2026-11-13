// Toast (DESIGN §5) : un seul à la fois, 5 s, avec une action facultative (« Annuler »).
// L'état vit dans un petit store à part : n'importe quel code peut appeler showToast() sans prop drilling.
import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export const TOAST_MS = 5000
const FADE_MS = 150

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastData {
  /** Identifiant unique : un nouveau toast remplace le précédent et relance le minuteur. */
  id: number
  message: ComponentChildren
  action?: ToastAction
}

const toastStore = createStore<{ toast: ToastData | null }>(() => ({ toast: null }))
let nextId = 1
let timer: ReturnType<typeof setTimeout> | undefined

export function showToast(message: ComponentChildren, action?: ToastAction): void {
  clearTimeout(timer)
  toastStore.setState({ toast: { id: nextId++, message, action } })
  timer = setTimeout(hideToast, TOAST_MS)
}

export function hideToast(): void {
  clearTimeout(timer)
  toastStore.setState({ toast: null })
}

/**
 * À placer une fois dans l'app. En haut de l'écran, 12 px sous la zone de sécurité : il ne couvre
 * ni la barre d'actions, ni le bouton principal d'une sheet, ni le clavier virtuel.
 */
export function ToastHost() {
  const toast = useStore(toastStore, (s) => s.toast)
  // On garde le dernier toast affiché pendant son fondu de sortie.
  const [shown, setShown] = useState<ToastData | null>(toast)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (toast) {
      setShown(toast)
      setVisible(false)
      let id = requestAnimationFrame(() => {
        id = requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = setTimeout(() => setShown(null), FADE_MS)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div
      role="status"
      aria-live="polite"
      class="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-50 flex justify-center px-4"
    >
      {shown && (
        <div
          key={shown.id}
          data-open={visible || undefined}
          class="toast pointer-events-auto flex min-h-11 w-full max-w-[calc(var(--container-md)-2rem)] items-center gap-3 rounded-row bg-toast-bg py-2 pr-2 pl-4 text-body text-white shadow-seat"
        >
          <div class="min-w-0 flex-1">{shown.message}</div>
          {shown.action && (
            <button
              type="button"
              class="h-11 shrink-0 rounded-btn px-3 font-bold text-accent active:bg-white/10"
              onClick={() => {
                shown.action!.onClick()
                hideToast()
              }}
            >
              {shown.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
