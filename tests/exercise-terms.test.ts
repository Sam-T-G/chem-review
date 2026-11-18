// The key terms in the exercises (L10): a term whose card would work on the molecule on screen,
// or state an answer of a part that is still open, is left plain. The module opens a card with no
// molecule outside the guided steps, so these tests read each card that way.
import { describe, expect, it } from 'vitest'
import { ELEMENTS } from '../src/chem/elements'
import { bondPolarity } from '../src/chem/polarity'
import { ALL_TERMS, elementsOf, sampleShape, type Sample, type TermId } from '../src/modules/lewis/guide'
import { PART_ORDER, sheetOf, type PartId } from '../src/modules/lewis/exercise/sheet'
import { exerciseCard, plainTerms, unwrapTerms } from '../src/modules/lewis/exercise/terms'
import { ALL } from './exercise-pool'

const OPEN = new Set<PartId>(PART_ORDER)
const samplesOf = (id: TermId): Sample[] => {
  const c = exerciseCard(id)
  return [...c.about.samples, ...(c.picture.kind === 'lewis' ? c.picture.samples : []), ...(c.picture.kind === 'model' ? [c.picture.sample] : [])]
}
const atomsIn = (m: Sample) => m.formula.reduce((n, [, k]) => n + k, 0)

describe('which terms open a card on an exercise with every part open', () => {
  it('never opens a card that draws the molecule on screen or names it', () => {
    for (const p of ALL) {
      for (const id of ALL_TERMS.filter((t) => !plainTerms(sheetOf(p), OPEN).includes(t))) {
        for (const m of samplesOf(id)) expect(m.charge === p.charge && JSON.stringify([...m.formula].sort()) === JSON.stringify([...p.formula].sort()), `${id} on ${p.id}`).toBe(false)
      }
    }
  })
  it('never opens a card that counts or draws an atom from a column of the molecule', () => {
    for (const p of ALL) {
      const columns = new Set(elementsOf(p).map((el) => ELEMENTS[el].group))
      for (const id of ALL_TERMS.filter((t) => !plainTerms(sheetOf(p), OPEN).includes(t))) {
        const c = exerciseCard(id)
        const used = [...c.about.els, ...samplesOf(id).flatMap((m) => m.formula.map(([el]) => el))]
        expect(used.filter((el) => columns.has(ELEMENTS[el].group)), `${id} on ${p.id}`).toEqual([])
      }
    }
  })
  it('never opens a card with a molecule of the same electron or molecular geometry, or a bond the molecule has', () => {
    for (const p of ALL) {
      const sh = sheetOf(p)
      for (const id of ALL_TERMS.filter((t) => !plainTerms(sh, OPEN).includes(t))) {
        for (const m of samplesOf(id)) {
          const shape = atomsIn(m) === 2 ? { geometry: 'linear', shape: 'linear' } : sampleShape(m)
          expect(shape.geometry, `${id} on ${p.id}`).not.toBe(sh.info.geometry)
          expect(shape.shape, `${id} on ${p.id}`).not.toBe(sh.info.shape)
        }
        const pic = exerciseCard(id).picture
        if (pic.kind === 'pair') {
          expect([pic.a, pic.b].filter((el) => elementsOf(p).includes(el)), `${id} on ${p.id}`).toEqual([])
          expect(sh.bonds.map((k) => k.pol.delta), `${id} on ${p.id}`).not.toContain(bondPolarity(pic.a, pic.b).delta)
        }
      }
    }
  })
  it('never opens a card that links to a card left plain', () => {
    for (const p of ALL) {
      const plain = new Set(plainTerms(sheetOf(p), OPEN))
      for (const id of ALL_TERMS.filter((t) => !plain.has(t))) for (const r of exerciseCard(id).related) expect(plain.has(r.id), `${id} links to ${r.id} on ${p.id}`).toBe(false)
    }
  })
  it('opens more cards as the parts are answered', () => {
    for (const p of ALL) {
      const sh = sheetOf(p)
      expect(plainTerms(sh, new Set()).length, p.id).toBeLessThanOrEqual(plainTerms(sh, OPEN).length)
    }
  })
})

describe('taking the button off a term', () => {
  const button = (id: string, word: string, n: number) => `<button type="button" class="mb-term" data-term="${id}" data-key="term-${n}" aria-haspopup="dialog" aria-expanded="false" title="What this word means">${word}</button>`
  it('keeps the word and drops the button for a plain term only', () => {
    const html = `<p>${button('valence', 'valence electrons', 1)} and ${button('polar', 'polar', 2)}</p>`
    expect(unwrapTerms(html, new Set(['valence']))).toBe(`<p>valence electrons and ${button('polar', 'polar', 2)}</p>`)
    expect(unwrapTerms(html, new Set())).toBe(html)
  })
})
