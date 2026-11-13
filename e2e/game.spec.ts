// Parcours complet (SPEC §12, critères 1, 2, 3 et 7) sur le build de production, buy-in par défaut (10 €).
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
  await expect(seat(page, 'Alice')).toHaveAccessibleName(/10\s€ investis/)
  await expect(page.getByRole('radio', { name: /points/i })).toHaveCount(0)

  // Recave d'Alice : +1 buy-in.
  await seat(page, 'Alice').click()
  await sheet(page).getByRole('button', { name: 'Recave', exact: true }).click()
  await sheet(page).getByRole('button', { name: /\+1 buy-in/ }).click()
  await sheet(page).getByRole('button', { name: 'Valider la recave' }).click()
  await expect(seat(page, 'Alice')).toHaveAccessibleName(/20\s€ investis/)

  // Chloé part avec 4 € : -6 €.
  await seat(page, 'Chloé').click()
  await sheet(page).getByRole('button', { name: 'Quitter la table' }).click()
  await sheet(page).getByLabel('Stack de sortie').fill('4')
  await sheet(page).getByRole('button', { name: 'Quitter la table' }).click()
  await expect(seat(page, 'Chloé')).toHaveCount(0)
  await expect(page.getByText(/1 parti · Chloé/)).toBeVisible()

  // Rechargement en pleine partie : tout est restauré, chrono compris (il ne repart pas de zéro).
  const statsBefore = await page.getByLabel('Statistiques de la partie').textContent()
  await page.waitForTimeout(1100)
  await page.reload()
  await expect(seat(page, 'Alice')).toHaveAccessibleName(/20\s€ investis/)
  await expect(seat(page, 'Bruno')).toHaveAccessibleName(/10\s€ investis/)
  await expect(page.getByText(/1 parti · Chloé/)).toBeVisible()
  const stats = page.getByLabel('Statistiques de la partie')
  await expect(stats).toContainText('36 €') // en jeu : 40 investis - 4 sortis
  await expect(stats).toContainText('Recaves1')
  expect(statsBefore).toContain('0:00:0')
  await expect(stats).toContainText(/Durée0:00:0[1-9]/)

  // Fin de partie : Alice 29, Bruno 7 → Alice +9, Bruno -3, Chloé -6.
  await page.getByRole('button', { name: 'Terminer la partie' }).click()
  await sheet(page).getByRole('button', { name: 'Compter les stacks' }).click()
  await page.getByLabel('Stack final').fill('29')
  await page.getByRole('button', { name: 'Suivant' }).click()
  await page.getByLabel('Stack final').fill('7')
  // Comptes justes : pas d'étape de vérification, on arrive directement au récap.
  await page.getByRole('button', { name: 'Valider' }).click()

  // Récap : Chloé, partie avant la fin, est dans les balances et dans les virements.
  const body = page.locator('main')
  await expect(page.getByRole('region', { name: 'Balances' })).toContainText(/Chloé.*-6,00\s€/)
  await expect(body).toContainText(/Chloé\s*→\s*Alice\s*6(,00)?\s€/)
  await expect(body).toContainText(/Bruno\s*→\s*Alice\s*3(,00)?\s€/)

  // Le récap survit lui aussi au rechargement.
  await page.reload()
  await expect(body).toContainText(/Chloé\s*→\s*Alice\s*6(,00)?\s€/)
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

test('« Nouveau joueur » : le champ Prénom a le focus dès le tap sur le siège', async ({ page }) => {
  await page.getByRole('button', { name: 'Ajouter un joueur' }).first().click()
  await expect(sheet(page).getByLabel('Prénom')).toBeFocused()
  await page.keyboard.type('Alice')
  await page.keyboard.press('Enter')
  await expect(seat(page, 'Alice')).toBeVisible()
})

test('abandonner la partie ramène à une table vide, sans récap', async ({ page }) => {
  for (const name of ['Alice', 'Bruno']) await addPlayer(page, name)
  await page.getByRole('button', { name: 'Démarrer la partie' }).click()
  await page.getByRole('button', { name: 'Terminer la partie' }).click()
  await sheet(page).getByRole('button', { name: 'Abandonner la partie (sans récap)' }).click()
  await expect(page.getByRole('button', { name: 'Démarrer la partie' })).toBeDisabled()
  await expect(seat(page, 'Alice')).toHaveCount(0)
  // « Annuler » du toast rend la partie.
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(seat(page, 'Alice')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Terminer la partie' })).toBeVisible()
})

test('avec une config jetons, les stacks finaux se saisissent en points par défaut', async ({ page }) => {
  for (const name of ['Alice', 'Bruno']) await addPlayer(page, name)
  await page.getByRole('button', { name: "Besoin d'aide pour les jetons ?" }).click()
  await sheet(page).getByRole('button', { name: /juste convertir/ }).click()
  await sheet(page).getByLabel('1 point =').fill('0,01') // 10 € = 1 000 pts
  await sheet(page).getByRole('button', { name: 'Valider' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Démarrer la partie' }).click()

  await page.getByRole('button', { name: 'Terminer la partie' }).click()
  await sheet(page).getByRole('button', { name: 'Compter les stacks' }).click()
  await expect(page.getByRole('button', { name: 'Points' })).toHaveAttribute('aria-pressed', 'true')
  const remaining = page.locator('section').filter({ hasText: 'Reste à attribuer' })
  await expect(remaining).toContainText(/2\s000\spts/)
  await page.getByLabel('Stack final').fill('1500')
  await page.getByRole('button', { name: 'Suivant' }).click()
  // Bascule en € pour le second : il reste 5 € (500 pts).
  await page.getByRole('button', { name: 'Euros' }).click()
  await expect(remaining).toContainText(/5\s€/)
  await page.getByLabel('Stack final').fill('5')
  await page.getByRole('button', { name: 'Valider' }).click()
  await expect(page.locator('main')).toContainText(/Bruno\s*→\s*Alice\s*5(,00)?\s€/)
})

test('« Mallette de Félix » remplit les couleurs, et l’assistant laisse les grosses valeurs en réserve', async ({ page }) => {
  await page.getByRole('button', { name: "Besoin d'aide pour les jetons ?" }).click()
  await sheet(page).getByRole('button', { name: /aide-moi à répartir/ }).click()
  const assistant = sheet(page)
  await assistant.getByRole('button', { name: 'Mallette de Félix' }).click()
  await expect(assistant.getByLabel('Quantité de jetons Gris')).toHaveValue('94')
  await expect(assistant.getByLabel(/^Valeur imposée d'un jeton Gris/)).toHaveValue('')
  await expect(assistant.getByLabel(/^Valeur imposée d'un jeton Jaune/)).toHaveValue('1000')
  await expect(assistant.getByLabel('Quantité de jetons Violet')).toHaveValue('23')

  // 6 joueurs (défaut sans joueurs installés), sans recave : une répartition existe.
  await assistant.getByRole('button', { name: 'Recaves prévues par joueur : moins' }).click()
  await assistant.getByRole('button', { name: 'Proposer une répartition' }).click()
  await expect(assistant.getByRole('button', { name: 'Valider la répartition' })).toBeEnabled()
})
