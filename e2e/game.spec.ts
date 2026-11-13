// Parcours complet (SPEC §12, critères 1, 2, 3 et 7) sur le build de production.
import { expect, test } from '@playwright/test'
import { addPlayer, seat, sheet } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('partie complète en € : recave, départ, rechargement, fin, récap et virements (critères 1, 2, 3)', async ({ page }) => {
  // Sans configuration jetons, aucune mention de jeton à l'écran de partie (pas de bandeau, pas de bascule).
  for (const name of ['Alice', 'Bruno', 'Chloé']) await addPlayer(page, name)
  await page.getByRole('button', { name: 'Démarrer la partie' }).click()
  await expect(seat(page, 'Alice')).toHaveAccessibleName(/20\s€ investis/)
  await expect(page.getByRole('radio', { name: /points/i })).toHaveCount(0)

  // Recave d'Alice : +1 buy-in.
  await seat(page, 'Alice').click()
  await sheet(page).getByRole('button', { name: 'Recave', exact: true }).click()
  await sheet(page).getByRole('button', { name: /\+1 buy-in/ }).click()
  await sheet(page).getByRole('button', { name: 'Valider la recave' }).click()
  await expect(seat(page, 'Alice')).toHaveAccessibleName(/40\s€ investis/)

  // Chloé part avec 10 € : -10 €.
  await seat(page, 'Chloé').click()
  await sheet(page).getByRole('button', { name: 'Quitter la table' }).click()
  await sheet(page).getByLabel('Stack de sortie').fill('10')
  await sheet(page).getByRole('button', { name: 'Quitter la table' }).click()
  await expect(seat(page, 'Chloé')).toHaveCount(0)
  await expect(page.getByText(/1 parti · Chloé/)).toBeVisible()

  // Rechargement en pleine partie : tout est restauré, chrono compris (il ne repart pas de zéro).
  const statsBefore = await page.getByLabel('Statistiques de la partie').textContent()
  await page.waitForTimeout(1100)
  await page.reload()
  await expect(seat(page, 'Alice')).toHaveAccessibleName(/40\s€ investis/)
  await expect(seat(page, 'Bruno')).toHaveAccessibleName(/20\s€ investis/)
  await expect(page.getByText(/1 parti · Chloé/)).toBeVisible()
  const stats = page.getByLabel('Statistiques de la partie')
  await expect(stats).toContainText('70 €') // en jeu : 80 investis - 10 sortis
  await expect(stats).toContainText('Recaves1')
  expect(statsBefore).toContain('0:00:0')
  await expect(stats).toContainText(/Durée0:00:0[1-9]/)

  // Fin de partie : Alice 55, Bruno 15 → Alice +15, Bruno -5, Chloé -10.
  await page.getByRole('button', { name: 'Terminer la partie' }).click()
  await sheet(page).getByRole('button', { name: 'Compter les stacks' }).click()
  await page.getByLabel('Stack final').fill('55')
  await page.getByRole('button', { name: 'Suivant' }).click()
  await page.getByLabel('Stack final').fill('15')
  // Comptes justes : pas d'étape de vérification, on arrive directement au récap.
  await page.getByRole('button', { name: 'Valider' }).click()

  // Récap : Chloé, partie avant la fin, est dans les balances et dans les virements.
  const body = page.locator('main')
  await expect(page.getByRole('region', { name: 'Balances' })).toContainText(/Chloé.*-10,00\s€/)
  await expect(body).toContainText(/Chloé\s*→\s*Alice\s*10(,00)?\s€/)
  await expect(body).toContainText(/Bruno\s*→\s*Alice\s*5(,00)?\s€/)

  // Le récap survit lui aussi au rechargement.
  await page.reload()
  await expect(body).toContainText(/Chloé\s*→\s*Alice\s*10(,00)?\s€/)
})

test('la configuration jetons est verrouillée après « Démarrer » (critère 7)', async ({ page }) => {
  for (const name of ['Alice', 'Bruno']) await addPlayer(page, name)
  await page.getByRole('button', { name: "Besoin d'aide pour les jetons ?" }).click()
  await sheet(page).getByRole('button', { name: /juste convertir/ }).click()
  await expect(sheet(page)).toHaveCount(1)
  await sheet(page).getByRole('button', { name: 'Valider' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Démarrer la partie' }).click()

  await page.getByRole('button', { name: 'Jetons' }).click()
  await expect(sheet(page).getByText('Verrouillé depuis le début de la partie.')).toBeVisible()
  await expect(sheet(page).getByRole('button', { name: 'Valider' })).toHaveCount(0)
  await expect(sheet(page).getByText('Retirer le convertisseur')).toHaveCount(0)
})
