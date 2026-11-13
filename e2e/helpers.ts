import { expect, type Page } from '@playwright/test'

/** Sheet ouverte (dialogue) ; il n'y en a qu'une à la fois une fois les animations finies. */
export const sheet = (page: Page) => page.getByRole('dialog')

/** Ajoute un joueur en préparation par le premier siège vide. */
export async function addPlayer(page: Page, name: string) {
  await page.getByRole('button', { name: 'Ajouter un joueur' }).first().click()
  await sheet(page).getByLabel('Prénom').fill(name)
  await sheet(page).getByRole('button', { name: 'Ajouter' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/** Siège d'un joueur (aria-label « Prénom, … »). */
export const seat = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name},`) })
