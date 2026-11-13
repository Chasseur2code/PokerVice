// Écran de chargement d'index.html : pas de page blanche tant que le JS n'est pas arrivé.
import { expect, test } from '@playwright/test'

test('premier lancement : message d’installation tant que le JS n’est pas chargé, puis l’app', async ({ page }) => {
  // JS bloqué : comme un premier lancement sur un réseau très lent.
  await page.route('**/assets/*.js', (route) => route.abort())
  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: 'PokerVice' })).toContainText('même sans connexion')

  await page.unroute('**/assets/*.js')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Démarrer la partie' })).toBeVisible()
  await expect(page.locator('#boot')).toHaveCount(0)
})
