// Boutons de l'app (DESIGN §2.6, §4) : principal (accent), secondaire (contour) et icône 52×52.
import type { ButtonHTMLAttributes, ComponentChildren } from 'preact'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'class'> & {
  class?: string
  children: ComponentChildren
}

/** Action principale : ambre, texte `--on-accent`, toute la largeur, 56 px. Grisé si désactivé. */
export function PrimaryButton({ class: cls = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      class={`flex h-14 w-full items-center justify-center gap-2 rounded-btn bg-accent px-4 text-btn font-bold text-on-accent active:brightness-95 disabled:bg-disabled-bg disabled:text-text-faint ${cls}`}
      {...rest}
    />
  )
}

/** Action secondaire : fond `--surface`, bordure `--border-strong`. */
export function SecondaryButton({ class: cls = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      class={`flex h-14 w-full items-center justify-center gap-2 rounded-btn border border-border-strong bg-surface px-4 text-[16px] font-semibold text-text active:bg-bg disabled:text-text-faint ${cls}`}
      {...rest}
    />
  )
}

type IconButtonProps = Omit<ButtonProps, 'aria-label'> & {
  /** Obligatoire : un bouton qui n'a qu'une icône doit être nommé (DESIGN §2.7). */
  label: string
  /** Mis en avant (ex. « Écran allumé » actif) : passe en accent. */
  active?: boolean
}

/** Bouton icône 52×52 de la barre d'actions. */
export function IconButton({ label, active = false, class: cls = '', type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      class={`flex size-[52px] shrink-0 items-center justify-center rounded-btn border ${
        active ? 'border-accent bg-accent text-on-accent' : 'border-border-strong bg-surface text-text active:bg-bg'
      } ${cls}`}
      {...rest}
    />
  )
}
