// Bandeau d'installation sur l'écran d'accueil : affiché au premier lancement sur smartphone, fermé pour de bon.
import { expect, test } from '@playwright/test'

const banner = (page: import('@playwright/test').Page) => page.getByRole('complementary', { name: "Installer l'application" })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test("bandeau d'installation : visible au premier lancement, ne revient pas une fois fermé", async ({ page }) => {
  await expect(banner(page)).toContainText('plein écran, hors connexion')
  // Le bouton « Démarrer la partie » reste visible sans défiler.
  await expect(page.getByRole('button', { name: 'Démarrer la partie' })).toBeInViewport()

  await banner(page).getByRole('button', { name: 'Fermer' }).click()
  await expect(banner(page)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Démarrer la partie' })).toBeVisible()
  await expect(banner(page)).toHaveCount(0)
})

test("bandeau d'installation : absent sur ordinateur", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: false, isMobile: false })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Démarrer la partie' })).toBeVisible()
  await expect(banner(page)).toHaveCount(0)
  await context.close()
})
