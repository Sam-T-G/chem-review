// The key terms in the exercises (L10): a term whose card would work on the molecule on screen,
// or state an answer of a part that is still open, is left plain. The module opens a card with no
// molecule outside the guided steps, so these tests read each card that way.
import { describe, expect, it } from 'vitest'
import { ELEMENTS } from '../src/chem/elements'
import { bondPolarity } from '../src/chem/polarity'
import { ALL_TERMS, elementsOf, sampleShape, type Sample, type TermId } from '../src/modules/lewis/guide'
import { PART_ORDER, sheetOf, type PartId } from '../src/modules/lewis/exercise/sheet'
import { exerciseCard, plainTerms, unwrapTerms } from '../src/modules/lewis/exercise/terms'
import { exercisePart } from '../src/modules/lewis/exercise/part'
import { answered, checkValence, freshExercise, goTo, typeValence } from '../src/modules/lewis/exercise/state'
import * as store from '../src/modules/lewis/store'
import { EXERCISES } from '../src/chem/exercises'
import { ALL, WORKED } from './exercise-pool'

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
  it('blocks in the module exactly the terms the panel prints plain, so no open card links to one (Part.blockedTerms, FE-7)', () => {
    // ui.ts refuses a blocked term and drops links to it; this holds the hook to the panel's own plain set,
    // so a hook that returned fewer terms than the panel leaves plain would fail here
    const base = store.getState()
    for (const p of EXERCISES) {
      const at = EXERCISES.indexOf(p)
      for (const exercise of [goTo(freshExercise(), at), checkValence(typeValence(goTo(freshExercise(), at), String(sheetOf(p).total)), sheetOf(p))]) {
        const s = { ...base, mode: 'exercise' as const, pickerOpen: false, exercise }
        const blocked = [...exercisePart.blockedTerms!(s)].sort()
        const done = answered(exercise, sheetOf(p))
        const plain = plainTerms(sheetOf(p), new Set(PART_ORDER.filter((id) => !done.has(id)))).sort()
        expect(blocked, p.id).toEqual(plain)
        // the browser check reads this attribute; ids like "shape:trigonal planar" hold a space, so the list is split on "|"
        const printed = /data-ex-plain="([^"]*)"/.exec(exercisePart.panel(s))?.[1] ?? null
        expect(printed?.split('|').filter(Boolean).sort(), p.id).toEqual(plain)
      }
    }
  })
  it('opens more cards as the parts are answered', () => {
    for (const p of ALL) {
      const sh = sheetOf(p)
      expect(plainTerms(sh, new Set()).length, p.id).toBeLessThanOrEqual(plainTerms(sh, OPEN).length)
    }
  })
})

describe('which terms open a card, for every set of open parts (COPY-10)', () => {
  const cards = new Map(ALL_TERMS.map((id) => [id, exerciseCard(id)]))
  const subsets: Set<PartId>[] = []
  for (let mask = 0; mask < 1 << PART_ORDER.length; mask++) subsets.push(new Set(PART_ORDER.filter((_, i) => mask & (1 << i))))
  /** Why a live card would give an open part away, judged by hand from the card's samples, picture and words. */
  function leak(id: TermId, p: (typeof ALL)[number], open: Set<PartId>): string | null {
    const sh = sheetOf(p)
    const c = cards.get(id)!
    const samples = samplesOf(id)
    const text = [c.name, c.also ?? '', c.means, c.example, c.note ?? '', c.pictureLabel].join(' ').toLowerCase()
    if (samples.some((m) => m.charge === p.charge && JSON.stringify([...m.formula].sort()) === JSON.stringify([...p.formula].sort()))) return 'draws the molecule'
    const columns = new Set(elementsOf(p).map((el) => ELEMENTS[el].group))
    if ((open.has('valence') || open.has('structure')) && [...c.about.els, ...samples.flatMap((m) => m.formula.map(([el]) => el))].some((el) => columns.has(ELEMENTS[el].group))) return 'an atom from a column of the molecule'
    const shapes = samples.map((m) => (atomsIn(m) === 2 ? { geometry: 'linear', shape: 'linear' } : sampleShape(m)))
    if (open.has('eg') && (shapes.some((x) => x.geometry === sh.info.geometry) || text.includes(sh.info.geometry))) return 'the electron geometry'
    if (open.has('mg') && (shapes.some((x) => x.shape === sh.info.shape) || text.includes(sh.info.shape.toLowerCase()))) return 'the molecular geometry'
    if (open.has('bonds') && c.picture.kind === 'pair' && [c.picture.a, c.picture.b].some((el) => elementsOf(p).includes(el))) return 'a bond of the molecule'
    if (open.has('angle')) {
      const angles = samples.map((m) => (atomsIn(m) === 2 ? 'none' : sampleShape(m).angle))
      if (angles.includes(sh.angle === 'none' ? 'none' : sh.angle) || (sh.angle !== 'none' && text.includes(sh.angle))) return 'the bond angle'
    }
    if (open.has('net')) {
      // a molecule of 2 atoms: its net dipole is its 1 bond dipole, so a bond like it (by the columns of
      // its 2 atoms) shows the answer (FE-2)
      const pairKey = (a: string, b: string) => [ELEMENTS[a as keyof typeof ELEMENTS].group, ELEMENTS[b as keyof typeof ELEMENTS].group].sort().join('-')
      const mine = new Set(sh.bonds.map((k) => pairKey(k.a, k.b)))
      const shown = [...(c.picture.kind === 'pair' ? [[c.picture.a, c.picture.b]] : []), ...[...[c.means, c.example, c.note ?? ''].join(' ').matchAll(/\b([A-Z][a-z]?)–([A-Z][a-z]?)\b/g)].filter((x) => x[1]! in ELEMENTS && x[2]! in ELEMENTS).map((x) => [x[1], x[2]])]
      if (sh.diatomic && shown.some(([a, b]) => mine.has(pairKey(a!, b!)))) return 'a bond like the molecule\'s, for the net dipole'
      if (shapes.some((x) => x.shape === sh.info.shape)) return 'a molecule of the same molecular geometry, for the net dipole'
    }
    return null
  }
  it('opens no card that gives an open part away, for every molecule and every set of open parts', () => {
    let checked = 0
    const bad: string[] = []
    for (const p of ALL) {
      const sh = sheetOf(p)
      for (const open of subsets) {
        const plain = new Set(plainTerms(sh, open))
        for (const id of ALL_TERMS) {
          if (plain.has(id)) continue
          checked++
          const why = leak(id, p, open)
          if (why) bad.push(`${id} on ${p.id} with ${[...open].join(',')} open: ${why}`)
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([])
    expect(checked).toBeGreaterThan(1000)
  }, 60000)
  it('keeps the bond dipole cards shut on hydrogen chloride while the net dipole is open (FE-2)', () => {
    for (const id of ['HCl', 'HBr', 'HF']) {
      const plain = plainTerms(sheetOf(ALL.find((p) => p.id === id)!), new Set<PartId>(['net']))
      for (const t of ['dipole', 'partial', 'polar-bond', 'polar']) expect(plain, `${t} on ${id}`).toContain(t)
    }
  })
  it('leaves most terms live on an empty sheet: a blocked card no longer blocks the cards that link to it', () => {
    const live = (id: string) => ALL_TERMS.length - plainTerms(sheetOf(ALL.find((p) => p.id === id)!), OPEN).length
    // water with every part open: before round 1 no term was live, because every card links to a blocked one
    expect(live('H2O')).toBeGreaterThanOrEqual(10)
    for (const p of ALL) expect(ALL_TERMS.length - plainTerms(sheetOf(p), OPEN).length, p.id).toBeGreaterThan(0)
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

describe('no live card states an open part, from facts written by hand (FX-12)', () => {
  // The card samples' geometries and angles, from OpenStax Chemistry 2e 7.6 (2 atoms: linear, no bond angle).
  const SAMPLE: Record<string, [string, string, string]> = {
    'H1Cl1 0': ['linear', 'linear', 'none'], 'F2 0': ['linear', 'linear', 'none'], 'O2 0': ['linear', 'linear', 'none'], 'N2 0': ['linear', 'linear', 'none'],
    'H2 0': ['linear', 'linear', 'none'], 'O1H1 -1': ['linear', 'linear', 'none'],
    'C1Cl4 0': ['tetrahedral', 'tetrahedral', '109.5°'], 'O3 0': ['trigonal planar', 'bent', 'less than 120°'], 'Se1F6 0': ['octahedral', 'octahedral', '90°'],
    'N1F3 0': ['tetrahedral', 'trigonal pyramidal', 'less than 109.5°'], 'B1Cl3 0': ['trigonal planar', 'trigonal planar', '120°'], 'S1Cl2 0': ['tetrahedral', 'bent', 'less than 109.5°'],
    'Be1Cl2 0': ['linear', 'linear', '180°'], 'P1F5 0': ['trigonal bipyramidal', 'trigonal bipyramidal', '90° and 120°'], 'Se1F4 0': ['trigonal bipyramidal', 'seesaw', 'less than 90° and less than 120°'],
    'Br1F3 0': ['trigonal bipyramidal', 'T-shaped', 'less than 90°'], 'I1F5 0': ['octahedral', 'square pyramidal', 'less than 90°'], 'I1Cl4 -1': ['octahedral', 'square planar', '90°'],
  }
  const NAME: Record<string, string> = { H: 'hydrogen', C: 'carbon', N: 'nitrogen', O: 'oxygen', F: 'fluorine', Cl: 'chlorine', Br: 'bromine', I: 'iodine', S: 'sulfur', P: 'phosphorus', Si: 'silicon', B: 'boron', Be: 'beryllium', Se: 'selenium', Xe: 'xenon', As: 'arsenic' }
  const HALOGENS = ['F', 'Cl', 'Br', 'I']
  /** Bonds that, on a molecule of 2 atoms, have its net dipole: the same 2 columns, written by hand. */
  function likeBonds(x: (typeof WORKED)[number]): string[] {
    const els = x.formula.flatMap(([el, n]) => new Array(n).fill(el) as string[])
    const both = (a: string[], b: string[]) => a.flatMap((p) => b.flatMap((q) => [`${p}–${q}`, `${q}–${p}`]))
    if (els.includes('H')) return both(['H'], HALOGENS)
    if (els.every((el) => HALOGENS.includes(el))) return both(HALOGENS, HALOGENS)
    if (els[0] === 'N') return both(['N', 'P'], ['N', 'P'])
    if (els[0] === 'O') return both(['O', 'S'], ['O', 'S'])
    return []
  }
  const key = (m: Sample) => `${m.formula.map(([e, n]) => e + n).join('')} ${m.charge}`
  const exact = (text: string, phrase: string) => new RegExp(`(?<!less than )${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text)
  it('holds every hand fact for all 43 molecules and every set of open parts', () => {
    const subsets: Set<PartId>[] = []
    for (let mask = 0; mask < 1 << PART_ORDER.length; mask++) subsets.push(new Set(PART_ORDER.filter((_, i) => mask & (1 << i))))
    const bad: string[] = []
    for (const p of EXERCISES) {
      const x = WORKED.find((w) => w.id === p.id)
      expect(x, `${p.id} has a hand row`).toBeDefined()
      if (!x) continue
      const els = x.formula.map(([el]) => el)
      const two = x.formula.reduce((n, [, k]) => n + k, 0) === 2
      const sameEl = Object.keys(x.bonds).includes(x.center) || (two && x.formula.length === 1)
      for (const open of subsets) {
        const plain = new Set(plainTerms(sheetOf(p), open))
        for (const id of ALL_TERMS) {
          if (plain.has(id)) continue
          const c = exerciseCard(id)
          const text = [c.name, c.also ?? '', c.means, c.example, c.note ?? '', c.pictureLabel].join(' ')
          const facts = samplesOf(id).map((m) => SAMPLE[key(m)]).filter((f): f is [string, string, string] => !!f)
          const say = (part: string) => bad.push(`${id} on ${p.id}, ${[...open].join(',')} open: states ${part}`)
          if (open.has('eg') && (exact(text, x.eg) || facts.some((f) => f[0] === x.eg))) say('the electron geometry')
          if (open.has('mg') && (exact(text, x.mg) || facts.some((f) => f[1] === x.mg))) say('the molecular geometry')
          if (open.has('angle') && ((x.angle === 'none' ? /no bond angle/i.test(text) : exact(text, x.angle)) || facts.some((f) => f[2] === x.angle))) say('the bond angle')
          if (open.has('bonds')) {
            for (const [, [delta]] of Object.entries(x.bonds)) if (text.includes(`ΔEN = ${delta}`) || text.includes(`ΔEN is ${delta}`) || (delta === '0.0' && /ΔEN is 0\b/.test(text))) say(`ΔEN ${delta}`)
            if (sameEl && (/same element/i.test(text) || /\b([A-Z][a-z]?)–\1\b/.test(text))) say('a bond of 2 atoms of one element')
            for (const el of els) if (new RegExp(`${NAME[el]}[^.]*electronegativity of|electronegativity of [^.]*${NAME[el]}|${NAME[el]} has an electronegativity`, 'i').test(text)) say(`the electronegativity of ${el}`)
          }
          if (open.has('net')) {
            if (two && likeBonds(x).some((b) => text.includes(b))) say('a bond like the molecule, its net dipole')
            if (two && x.dir) { const neg = x.dir.split(' ').at(-1)!; if (new RegExp(`points? at ${neg}`).test(text)) say('which way the dipole points') }
            if (!two && facts.some((f) => f[1] === x.mg)) say('a molecule of the same molecular geometry')
          }
        }
      }
    }
    expect(bad.slice(0, 12)).toEqual([])
  }, 60000)
})
