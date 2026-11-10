import { describe, expect, it } from 'vitest'

// Garde-fou d'environnement : l'app formate tous les montants avec Intl fr-FR.
describe('environnement', () => {
  it('formate un montant en euros à la française', () => {
    const s = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(1234.5)
    expect(s.replace(/\s/g, ' ')).toBe('1 234,50 €')
  })
})
