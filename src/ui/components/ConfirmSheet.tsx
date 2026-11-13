// Petite sheet de confirmation : un texte et un bouton principal (« Terminer la partie », « Nouvelle partie »).
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
}

export function ConfirmSheet({ open, onClose, title, confirmLabel, onConfirm, children }: ConfirmSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} footer={<PrimaryButton onClick={onConfirm}>{confirmLabel}</PrimaryButton>}>
      <p class="pb-1 text-[15px]">{children}</p>
    </BottomSheet>
  )
}
