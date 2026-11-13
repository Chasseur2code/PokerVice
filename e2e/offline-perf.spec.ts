// Critères 8 (hors ligne, aucune requête tierce) et 9 (fluide avec 10 joueurs et 50+ événements).
import { expect, test } from '@playwright/test'
import { addPlayer, seat, sheet } from './helpers'

test('aucune requête vers un autre domaine, puis fonctionne hors ligne (critère 8)', async ({ page, context, baseURL }) => {
  const origins = new Set<string>()
  page.on('request', (r) => origins.add(new URL(r.url()).origin))

  await page.goto('/')
  for (const name of ['Alice', 'Bruno']) await addPlayer(page, name)
  await page.getByRole('button', { name: 'Démarrer la partie' }).click()
  expect([...origins].filter((o) => o !== new URL(baseURL!).origin && o !== 'null')).toEqual([])
  expect(await context.cookies()).toEqual([])

  // Le service worker a précaché le build : l'app se recharge sans réseau, partie comprise.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await context.setOffline(true)
  await page.reload()
  await expect(seat(page, 'Alice')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Terminer la partie' })).toBeVisible()
  await context.setOffline(false)
})

test('10 joueurs, 60 événements : le chrono seul bouge, une recave reste rapide (critère 9)', async ({ page }) => {
  // Partie préparée directement dans localStorage (même format que le store persisté).
  const now = Date.now()
  const players = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`,
    name: `Joueur ${i + 1}`,
    color: ['#E5484D', '#3E63DD', '#F59E0B', '#8E4EC6', '#12A594', '#E93D82', '#F76B15', '#05A2C2', '#A18072', '#6B7280'][i],
    seatOrder: i,
  }))
  const events = [
    ...players.map((p, i) => ({ id: `b${i}`, at: now - 3_600_000, type: 'buyin', playerId: p.id, amountCents: 2000 })),
    ...Array.from({ length: 50 }, (_, k) => ({ id: `r${k}`, at: now - 3_000_000 + k * 1000, type: 'rebuy', playerId: `p${k % 10}`, amountCents: 2000 })),
  ]
  const game = { version: 1, status: 'running', createdAt: now - 3_700_000, startedAt: now - 3_600_000, defaultBuyInCents: 2000, players, events, wakeLock: false }
  await page.goto('/')
  await page.evaluate((state) => localStorage.setItem('pokervice', JSON.stringify({ state, version: 1 })), { game, lastRecap: null, unit: 'eur' })
  await page.reload()
  await expect(seat(page, 'Joueur 1')).toHaveAccessibleName(/120\s€ investis/)

  // Téléphone milieu de gamme : processeur ralenti 4 fois.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  // Pendant 2,5 s sans geste, seul le texte du chrono change dans la page.
  const outsideChrono = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const chrono = [...document.querySelectorAll('dt')].find((dt) => dt.textContent === 'Durée')!.nextElementSibling!
        let count = 0
        const obs = new MutationObserver((list) => {
          for (const m of list) if (!chrono.contains(m.target)) count++
        })
        obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
        setTimeout(() => (obs.disconnect(), resolve(count)), 2500)
      }),
  )
  expect(outsideChrono).toBe(0)

  // Recave complète (tap sur le siège → menu → +1 buy-in → validation → siège à jour).
  const t0 = Date.now()
  await seat(page, 'Joueur 1').click()
  await sheet(page).getByRole('button', { name: 'Recave', exact: true }).click()
  await sheet(page).getByRole('button', { name: /\+1 buy-in/ }).click()
  await sheet(page).getByRole('button', { name: 'Valider la recave' }).click()
  await expect(seat(page, 'Joueur 1')).toHaveAccessibleName(/140\s€ investis/)
  const elapsed = Date.now() - t0
  console.log(`Recave avec CPU ÷4 : ${elapsed} ms (animations de sheet comprises)`)

  // Temps de rendu pur, sans l'attente des animations : tap sur un siège jusqu'à l'image suivante peinte.
  const tapMs = await page.evaluate(async () => {
    const btn = document.querySelector<HTMLButtonElement>('[aria-label^="Joueur 2,"]')!
    const t = performance.now()
    btn.click()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return performance.now() - t
  })
  console.log(`Tap sur un siège → sheet rendue (CPU ÷4) : ${tapMs.toFixed(0)} ms`)
  expect(tapMs).toBeLessThan(200)
})
