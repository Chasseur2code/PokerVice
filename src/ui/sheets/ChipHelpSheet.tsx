// Petite sheet « Besoin d'aide pour les jetons ? » (DESIGN §4.1) : assistant ou simple convertisseur.
import { BottomSheet } from '../components/BottomSheet'
import { SecondaryButton } from '../components/Button'

export interface ChipHelpSheetProps {
  open: boolean
  onClose: () => void
  onAssistant: () => void
  onConverter: () => void
}

export function ChipHelpSheet({ open, onClose, onAssistant, onConverter }: ChipHelpSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Besoin d'aide pour les jetons ?">
      <div class="flex flex-col gap-2.5 pt-1">
        <SecondaryButton onClick={onAssistant}>Oui, aide-moi à répartir les jetons</SecondaryButton>
        <SecondaryButton onClick={onConverter}>Non, juste convertir points ↔ €</SecondaryButton>
      </div>
    </BottomSheet>
  )
}
