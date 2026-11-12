// Pastille de jeton (DESIGN §2.4) : fond plein et anneau intérieur. Décorative : la valeur est écrite à côté.
import { chipRing } from '../../lib/chipColors'

export function ChipDot({ hex, size = 16 }: { hex: string; size?: number }) {
  const ring = size < 20 ? 3 : Math.round(size / 6)
  return (
    <span
      class="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: hex, boxShadow: `inset 0 0 0 ${ring}px ${chipRing(hex)}` }}
      aria-hidden="true"
    />
  )
}
