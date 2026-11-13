// Petite sheet de confirmation : un texte et un bouton principal (« Terminer la partie », « Nouvelle partie »),
// avec éventuellement une action secondaire en dessous (« Abandonner la partie »).
import type { ComponentChildren } from 'preact'
import { BottomSheet } from './BottomSheet'
import { PrimaryButton } from './Button'

export interface ConfirmSheetProps {
  open: boolean
  onClose: () => void
  title: string
  confirmLabel: string
  onConfirm: () => void
  children: ComponentChildren
  /** Action secondaire sous le bouton principal. */
  secondary?: ComponentChildren
}

export function ConfirmSheet({ open, onClose, title, confirmLabel, onConfirm, children, secondary }: ConfirmSheetProps) {
  const footer = (
    <div class="flex flex-col items-center gap-1">
      <PrimaryButton onClick={onConfirm}>{confirmLabel}</PrimaryButton>
      {secondary}
    </div>
  )
  return (
    <BottomSheet open={open} onClose={onClose} title={title} footer={footer}>
      <p class="pb-1 text-[15px]">{children}</p>
    </BottomSheet>
  )
}
