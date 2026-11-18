// Every sentence the exercises can show, for every molecule the tests know: the voice rules, the
// rules for two-atom molecules, and that no card gives an answer away too early (L3) or states the
// answer of another part that is still open.
import { describe, expect, it } from 'vitest'
import { referenceStructure } from '../src/chem/exercises'
import { ELEMENTS } from '../src/chem/elements'
import { atomsOf, neutralElectrons, type Problem } from '../src/chem/problems'
import { addElectron, removeElectron, share, unshare, type Structure } from '../src/chem/structure'
import type { Geometry } from '../src/chem/vsepr'
import { ALL_SHAPES } from '../src/chem/vsepr'
import { coachText, lower, termPieces, type Coach } from '../src/modules/lewis/guide'
import { ANGLES, NO_ANGLE, sheetOf, type PartId, type Sheet } from '../src/modules/lewis/exercise/sheet'
import { COME_BACK } from '../src/modules/lewis/exercise/state'
import * as W from '../src/modules/lewis/exercise/words'
import { ALL } from './exercise-pool'
import { star } from './helpers'

const NONE: W.Known = new Set()
const EVERY: W.Known = new Set<PartId>(['valence', 'structure', 'resonance', 'eg', 'mg', 'angle', 'bonds', 'net'])
const GEOMETRIES: Geometry[] = ['linear', 'trigonal planar', 'tetrahedral', 'trigonal bipyramidal', 'octahedral']

/** Boards a student can reach near the finished structure: an electron more or less on each atom,
 *  one more bond or one less, the atoms bonded with single bonds, and another atom in the middle. */
function boards(sh: Sheet): Structure[] {
  const ref = sh.ref
  const out: Structure[] = []
  for (const a of ref.atoms) {
    for (const op of [addElectron(ref, a.id), removeElectron(ref, a.id)]) if (op.ok) out.push(op.s)
  }
  for (const b of ref.bonds) {
    out.push(unshare(ref, b.id))
    const op = share(ref, b.a, b.b)
    if (op.ok) out.push(op.s)
  }
  const els = atomsOf(sh.p)
  const mid = els.indexOf(sh.p.center)
  const outer = els.filter((_, i) => i !== mid)
  // some of these the board refuses for some molecules (a cation's atoms run out of electrons to share)
  const tryStar = (els: Parameters<typeof star>[0], orders: number[]) => {
    try {
      out.push(star(els, orders).s)
    } catch {
      // not a board a student can reach
    }
  }
  tryStar([sh.p.center, ...outer], outer.map(() => 1))
  tryStar([sh.p.center, ...outer], outer.slice(1).map(() => 1))
  if (outer.length >= 2 && outer[0] !== sh.p.center) tryStar([outer[0]!, sh.p.center, ...outer.slice(1)], outer.map(() => 1))
  if (sh.p.charge !== 0) {
    // an ion's atoms with what neutral atoms bring, before the charge is dealt with
    let s = ref
    const fix = sh.p.charge < 0 ? removeElectron : addElectron
    for (let k = 0; k < Math.abs(sh.p.charge); k++) {
      const atom = s.atoms.find((a) => fix(s, a.id).ok)
      if (atom) s = (fix(s, atom.id) as { s: Structure }).s
    }
    out.push(s)
  }
  return out
}

interface Card {
  p: Problem
  part: PartId
  pick: string | null
  tries: number
  /** Parts answered when the card shows. */
  known: W.Known
  text: string
}

function cardsFor(sh: Sheet): Card[] {
  const out: Card[] = []
  const add = (part: PartId, pick: string | null, tries: number, known: W.Known, c: Coach | string) => out.push({ p: sh.p, part, pick, tries, known, text: typeof c === 'string' ? c : coachText(c) })
  const p = sh.p
  const z = p.formula.reduce((n, [el, k]) => n + ELEMENTS[el].z * k, 0)
  const once = p.formula.reduce((n, [el]) => n + ELEMENTS[el].valence, 0)
  for (const known of [NONE, EVERY]) {
    for (const tries of [1, 2, 3]) {
      for (const v of new Set([sh.total + 1, sh.total - 1, z, z - p.charge, once, neutralElectrons(p), neutralElectrons(p) + p.charge, sh.total * 2])) if (v !== sh.total && v > 0) add('valence', String(v), tries, known, W.valenceCoach(sh, v, tries))
      for (const s of boards(sh)) add('structure', null, tries, known, W.structureCoach(sh, s, tries, known))
      for (const g of GEOMETRIES) if (g !== sh.info.geometry) add('eg', g, tries, known, W.geometryCoach(sh, g, tries, known))
      for (const name of ALL_SHAPES) if (name !== sh.info.shape) add('mg', name, tries, known, W.shapeCoach(sh, name, tries, known))
      for (const a of ANGLES) if (a !== sh.angle) add('angle', a, tries, known, W.angleCoach(sh, a, tries, known))
      for (const k of sh.bonds) {
        const hi = Number(k.pol.high) * 10
        const lo = Number(k.pol.low) * 10
        for (const v of new Set([hi + lo, -k.pol.tenths, hi, lo, k.pol.tenths * k.count, k.pol.tenths + 3, 99])) if (Math.abs(v - k.pol.tenths) > 1e-6) add('bonds', W.tenthsText(v), tries, known, W.deltaCoach(k, v, tries))
      }
      if (sh.directions) for (const d of sh.directions.choices) if (d.id !== sh.directions.right) add('net', W.directionLabel(sh, d), tries, new Set<PartId>(['mg', 'bonds', ...known]), W.directionCoach(sh, d.id, tries))
    }
  }
  return out
}

function allLines(): { p: Problem; line: string; label?: boolean }[] {
  const out: { p: Problem; line: string; label?: boolean }[] = []
  const push = (p: Problem, ...lines: (string | null | undefined)[]) => {
    for (const l of lines) if (l) out.push({ p, line: l })
  }
  /** Words on a button, a chip, a heading or a cell of the table: not sentences. */
  const label = (p: Problem, ...lines: string[]) => {
    for (const l of lines) out.push({ p, line: l, label: true })
  }
  for (const p of ALL) {
    const sh = sheetOf(p)
    const q = W.prompts(sh)
    label(p, ...q.net.choices.map((c) => c.label))
    push(p, q.valence, q.structure, q.resonance, q.eg, q.mg, q.angle, q.bonds, q.net.ask, q.net.sub, q.netWait, q.resonanceWait, q.direction, q.liftWait)
    for (const c of cardsFor(sh)) push(p, c.text)
    push(p, W.valenceRight(sh), W.structureRightText(sh), W.structureAnswer(sh), W.geometryRight(sh), W.shapeRight(sh), W.angleRight(sh))
    for (const yes of [true, false]) {
      const r = W.resonanceText(sh, yes)
      push(p, r.text, r.coach && coachText(r.coach))
      const n = W.netText(sh, yes)
      push(p, n.text)
    }
    for (const k of sh.bonds) {
      push(p, W.deltaRight(k))
      label(p, W.EX_WORDS.deltaBox(k))
      for (const polar of [true, false]) push(p, W.bondPickText(k, polar).text)
    }
    if (sh.directions) {
      push(p, W.directionRight(sh))
      for (const d of sh.directions.choices) label(p, W.directionLabel(sh, d))
    }
    for (const row of W.finishedRows(sh)) label(p, row.label, row.value)
    push(p, W.finishedNote(sh, [], COME_BACK), W.finishedNote(sh, ['valence', 'angle'], COME_BACK), W.finishedNote(sh, ['eg'], COME_BACK))
    label(p, ...sh.geometryChoices.map(W.geometryLabel), ...sh.shapeChoices.map(W.geometryLabel), ...sh.angleChoices.map(W.angleLabel))
  }
  const words = Object.values(W.EX_WORDS).filter((x): x is string => typeof x === 'string')
  label(ALL[0]!, ...words, ...Object.values(W.PART_TITLES))
  return out
}

describe('the words of the exercises', () => {
  const lines = allLines()
  const distinct = [...new Set(lines.map((x) => x.line))]

  it('collects every line for every molecule', () => {
    expect(distinct.length).toBeGreaterThan(600)
  })
  it('has no em dashes, no leftover template text, and no doubled spaces', () => {
    for (const line of distinct) {
      expect(line, line).not.toMatch(/—/)
      expect(line, line).not.toMatch(/undefined|NaN|null|\[object|\$\{/)
      expect(line, line).not.toMatch(/ {2}/)
      expect(line, line).not.toMatch(/\b0 of 0\b/)
    }
  })
  it('never gives an atom feelings or uses the phrases Sam has banned', () => {
    const banned = /\b(wants?|likes?|happy|prefers?|loves?|hates?|seamless|comprehensive|robust|leverage|delve|showcase|elevate|unlock|not only|not just|more than just|think of|tells a story|simply|just)\b|that's next|let's/i
    for (const line of distinct) expect(line, line).not.toMatch(banned)
  })
  it('names the atom: no sentence starts with "It"', () => {
    for (const line of distinct) expect(line, line).not.toMatch(/(^|\. )It /)
  })
  it('uses "1 electron", never "1 electrons", and the same for atoms, bonds, groups and pairs', () => {
    for (const line of distinct) expect(line, line).not.toMatch(/\b1 (electrons|atoms|bonds|groups|lone pairs|valence electrons|bonded atoms|electron groups)\b/)
  })
  it('ends full sentences with a period or a question mark', () => {
    const sentences = new Set(lines.filter((x) => !x.label).map((x) => x.line))
    for (const line of sentences) if (/^[A-Z].* .* /.test(line)) expect(line, line).toMatch(/[.?”]$/)
  })
  it('never says "the middle atom" or counts electron groups for a molecule of two atoms', () => {
    for (const { p, line } of lines) {
      if (atomsOf(p).length !== 2) continue
      expect(line, `${p.id}: ${line}`).not.toMatch(/the middle atom|outer atom/)
      expect(line, `${p.id}: ${line}`).not.toMatch(new RegExp(`electron groups? around ${lower(p.center)}`))
    }
  })
  it('opens only key terms that the module knows, and keeps every sentence whole when cut into terms', () => {
    for (const line of distinct) expect(termPieces(line).map((x) => x.text).join(''), line).toBe(line)
  })
})

describe('what a card gives away', () => {
  /** What each part's answer looks like in a sentence, for this molecule. */
  function tokens(sh: Sheet): Record<PartId, RegExp[]> {
    const p = sh.p
    const name = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const c = lower(p.center)
    const lp = sh.info.lonePairs
    const pairs = lp === 0 ? 'no lone pairs' : `${lp} lone pairs?`
    return {
      valence: [new RegExp(`\\b${sh.total} (valence )?electrons?\\b(?! group)`), new RegExp(`has ${sh.total}\\b`), new RegExp(`make ${sh.total}\\b`)],
      structure: sh.diatomic ? [] : [new RegExp(`${c} has (\\d+ bonded atoms? and )?${pairs}`, 'i')],
      resonance: [/equally good Lewis structure|the best Lewis structure/],
      eg: [new RegExp(`\\b${sh.info.geometry}\\b`, 'i')],
      mg: [new RegExp(`\\b${sh.info.shape}\\b`, 'i')],
      angle: sh.angle === NO_ANGLE ? [/no bond angle/i] : [new RegExp(sh.angle.replace(/\./g, '\\.'), 'i')],
      bonds: sh.bonds.flatMap((k) => [new RegExp(`= ${k.pol.delta}\\b`), new RegExp(`ΔEN (for ${k.a}–${k.b} )?is ${k.pol.delta}`)]),
      net: [
        new RegExp(`${name} is (polar|nonpolar)`, 'i'),
        new RegExp(`dipoles in ${name} (do not )?cancel`, 'i'),
        ...(sh.directions ? [new RegExp(`points ${W.directionLabel(sh, sh.directions.choices.find((d) => d.id === sh.directions!.right)!)}`)] : []),
      ],
    }
  }
  const cards = ALL.flatMap((p) => cardsFor(sheetOf(p)))

  it('checks a few thousand cards', () => {
    expect(cards.length).toBeGreaterThan(2000)
  })
  it('holds a part’s own answer back until the third try (L3)', () => {
    // the patterns find answers: on the third try every part but the structure states its own
    const third = cards.filter((c) => c.tries >= 3 && c.part !== 'structure')
    for (const c of third) expect(tokens(sheetOf(c.p))[c.part].some((re) => re.test(c.text)), `${c.p.id} ${c.part}: ${c.text}`).toBe(true)
    for (const c of cards) {
      if (c.tries >= 3) continue
      const sh = sheetOf(c.p)
      for (const re of tokens(sh)[c.part]) {
        const pick = c.pick ?? ''
        // the student's own pick may be named, and with two atoms "no bond angle" is how a wrong pick is explained
        if (pick && re.test(pick)) continue
        if (c.part === 'angle' && sh.diatomic) continue
        expect(c.text, `${c.p.id} ${c.part} try ${c.tries}: ${c.text}`).not.toMatch(re)
      }
    }
  })
  it('never states the answer of another part that is still open', () => {
    for (const c of cards) {
      const sh = sheetOf(c.p)
      const t = tokens(sh)
      for (const part of Object.keys(t) as PartId[]) {
        if (part === c.part || c.known.has(part)) continue
        for (const re of t[part]) {
          if (c.pick && re.test(c.pick)) continue
          // a part's own answer on its last try names that part's word, which can be another part's answer too (tetrahedral and tetrahedral)
          if (c.tries >= 3 && t[c.part].some((own) => own.source === re.source)) continue
          if (c.tries >= 3 && ((c.part === 'mg' && part === 'eg' && sh.info.geometry === sh.info.shape) || (c.part === 'eg' && part === 'mg' && sh.info.geometry === sh.info.shape))) continue
          expect(c.text, `${c.p.id} ${c.part} try ${c.tries} shows ${part}: ${c.text}`).not.toMatch(re)
        }
      }
    }
  })
  it('names the wrong idea behind the likely wrong answers', () => {
    const sh = sheetOf(ALL.find((p) => p.id === 'PCl3')!)
    const g = W.geometryCoach(sh, 'trigonal planar', 1, NONE)
    expect(g.lead).toBe('Trigonal planar is the electron geometry for 3 electron groups, the number of atoms bonded to phosphorus.')
    expect(W.shapeCoach(sh, 'tetrahedral', 1, new Set<PartId>(['eg'])).lead).toBe('Tetrahedral is the electron geometry of phosphorus trichloride: where all 4 electron groups point, lone pairs included.')
    expect(W.shapeCoach(sh, 'trigonal planar', 1, new Set<PartId>(['structure'])).lead).toBe('Trigonal planar would be the molecular geometry if phosphorus had no lone pairs.')
    expect(W.angleCoach(sh, NO_ANGLE, 1, NONE).lead).toBe('Only a molecule of 2 atoms has no bond angle.')
    const k = sh.bonds[0]!
    expect(W.deltaCoach(k, 51, 1).lead).toBe('5.1 is the two electronegativities added.')
    expect(W.deltaCoach(k, -9, 1).lead).toBe('−0.9 is the smaller electronegativity minus the larger.')
    expect(W.deltaCoach(k, 30, 1).lead).toBe('3.0 is the electronegativity of chlorine.')
    expect(W.deltaCoach(k, 27, 1).lead).toBe('2.7 is ΔEN times the 3 P–Cl bonds.')
    expect(W.deltaCoach(k, 9, 3).lead).toBe('For P–Cl, ΔEN = 3.0 − 2.1 = 0.9.')
    const dirs = sh.directions!
    const lone = dirs.choices.find((d) => d.kind === 'lone-to')!
    expect(W.directionCoach(sh, lone.id, 1).lead).toBe('Toward the lone pair is the opposite way.')
    const one = dirs.choices.find((d) => d.kind === 'one')!
    expect(W.directionCoach(sh, one.id, 1).lead).toBe('Along 1 P–Cl bond follows only 1 of the 3 P–Cl bonds.')
  })
  it('explains a structure from what is on the board', () => {
    const sh = sheetOf(ALL.find((p) => p.id === 'PCl3')!)
    const ref = referenceStructure(sh.p)!
    const extra = addElectron(ref, ref.atoms[1]!.id)
    if (!extra.ok) throw new Error(extra.why)
    expect(W.structureCoach(sh, extra.s, 1, NONE).lead).toBe('The board has 27 electrons, more than phosphorus trichloride has.')
    expect(W.structureCoach(sh, extra.s, 1, new Set<PartId>(['valence'])).lead).toBe('The board has 27 electrons, 1 more than phosphorus trichloride has.')
    expect(W.structureAnswer(sh)).toBe('In the Lewis structure of phosphorus trichloride, phosphorus has 1 lone pair. 3 chlorine atoms each have a single bond to phosphorus and 3 lone pairs.')
  })
})

describe('round 1 review fixes', () => {
  const lines = allLines()
  const distinct = [...new Set(lines.map((x) => x.line))]
  const on = (id: string) => sheetOf(ALL.find((p) => p.id === id)!)
  const both: W.Known = new Set<PartId>(['eg', 'mg'])

  it('puts "an" before a vowel and makes a two-angle label plural (COPY-16, COPY-17)', () => {
    for (const line of distinct) {
      expect(line, line).not.toMatch(/\ba (octahedral|[aeiou])/i)
      expect(line, line).not.toMatch(/° and [^.]*° is the bond angle/)
    }
    expect(W.angleCoach(on('SeCl4'), '90° and 120°', 1, both).lead).toBe('90° and 120° are the bond angles when all 5 electron groups are bonded atoms.')
  })
  it('never says "each" bond, or adds up dipoles, for a molecule with only 1 bond (COPY-20)', () => {
    for (const { p, line } of lines) {
      if (atomsOf(p).length !== 2) continue
      expect(line, `${p.id}: ${line}`).not.toMatch(/In each|the bond dipoles add up/)
    }
    const sh = on('IF')
    const wrong = sh.directions!.choices.find((c) => c.id !== sh.directions!.right)!
    expect(coachText(W.directionCoach(sh, wrong.id, 2))).toBe('From fluorine toward iodine is the opposite way. The I–F bond dipole points at its δ− atom, and it is the only bond dipole, so the net dipole points the same way. In the I–F bond, fluorine is δ−. Pick again.')
  })
  it('gives a two-atom molecule a reason for its net dipole that does not repeat the lead (COPY-19)', () => {
    expect(W.netText(on('IF'), false).text).toBe('Iodine monofluoride has only 1 bond, so nothing cancels its dipole. ΔEN for I–F is 1.5, so the bond is polar. Iodine monofluoride is polar.')
  })
  it('names every other dipole on an "along 1 bond" card, and only dipoles that are there (CHEMWORDS-4, CHEMWORDS-5, COPY-21)', () => {
    const one = (id: string) => {
      const sh = on(id)
      return W.directionCoach(sh, sh.directions!.choices.find((c) => c.kind === 'one')!.id, 1)
    }
    // phosgene: C–Cl 0.5 and C–O 1.0 are both polar on the course table
    expect(one('COCl2').why).toBe('The net dipole adds up every bond dipole, and the other C–Cl dipole and the C–O dipole point other ways, so the total does not lie along that bond.')
    expect(one('H2O').why).toBe('The net dipole adds up every bond dipole, and the other O–H dipole points another way, so the total does not lie along that bond.')
    expect(one('PCl3').why).toBe('The net dipole adds up every bond dipole, and the other 2 P–Cl dipoles point other ways, so the total does not lie along that bond.')
  })
  it('names the direction by the atoms, as the worksheet does for water (CHEMWORDS-9, CHEMWORDS-7)', () => {
    expect(W.directionRight(on('H2O'))).toBe('The net dipole points away from the 2 hydrogen atoms, through the oxygen atom.')
    expect(W.finishedRows(on('H2O')).at(-1)!.value).toBe('Polar, away from the 2 hydrogen atoms, through the oxygen atom')
    expect(W.directionRight(on('O3'))).toBe('The net dipole points toward the 2 outer oxygen atoms.')
    for (const { line } of lines) expect(line, line).not.toMatch(/points toward the \d* ?lone pairs?/)
  })
  it('states a shell rule that is true for every atom the pool holds (CHEMWORDS-10)', () => {
    const sh = on('IF')
    const op = share(sh.ref, sh.ref.atoms[0]!.id, sh.ref.atoms[1]!.id)
    if (!op.ok) throw new Error(op.why)
    expect(coachText(W.structureCoach(sh, op.s, 1, NONE))).toBe('Iodine has more electrons than the outer shell holds here. Only a middle atom from period 3 onward, with 2 or more atoms bonded to it, can hold more than 8 electrons. Swipe across a bond to take one line off, or tap the atom and use “− electron”.')
    for (const line of distinct) expect(line, line).not.toMatch(/no more than that/)
  })
  it('says why a generic wrong pick fails and hands back a smaller question (COPY-4)', () => {
    const water = on('H2O')
    expect(coachText(W.geometryCoach(water, 'trigonal planar', 1, NONE))).toBe('Trigonal planar is the electron geometry for 3 electron groups. Each atom bonded to oxygen is 1 electron group, and each lone pair on oxygen is 1 more. Count the electron groups on oxygen in water, then pick the electron geometry for that many.')
    // round 2 (FE-6, FE-3): the why no longer says lone pairs squeeze, and XeF4's lone pairs go on opposite sides
    expect(coachText(W.angleCoach(water, '180°', 1, both))).toBe('180° is the bond angle for 2 bonded atoms with no lone pairs, or 2 bonded atoms with 3 lone pairs. The bond angle starts from the angle of the electron geometry, and the 2 lone pairs on oxygen can change it. Put the 2 lone pairs on oxygen in 2 of the 4 places of a tetrahedral electron geometry. Find the angle between the bonds in the places left, then decide whether the lone pairs squeeze them.')
    expect(W.angleCoach(on('XeF4'), '120°', 1, both).ask).toBe('Put the 2 lone pairs on opposite sides of xenon. Find the angles between the bonds in the places left, then decide whether the lone pairs squeeze them.')
    for (const line of distinct) expect(line, line).not.toMatch(/has a different number|different count/)
  })
  it('gives a reason with the third-try answer even before the structure is built (COPY-11)', () => {
    for (const p of ALL) {
      const sh = sheetOf(p)
      const pick = sh.shapeChoices.find((x) => x !== sh.info.shape)!
      expect(W.shapeCoach(sh, pick, 3, NONE).why, p.id).not.toBe('')
    }
    expect(W.shapeCoach(on('H2O'), 'linear', 3, NONE).why).toBe('Oxygen has 2 bonded atoms, and the molecular geometry names where those atoms sit, with any lone pairs on oxygen left out.')
    expect(W.geometryCoach(on('H2O'), 'linear', 3, NONE).why).toBe('Oxygen has 4 electron groups, counting each of its 2 bonded atoms and each lone pair on oxygen as 1 group.')
  })
  it('says something new on the second try of every card (COPY-23)', () => {
    for (const p of ALL) {
      const sh = sheetOf(p)
      for (const known of [NONE, EVERY]) {
        for (const g of GEOMETRIES) if (g !== sh.info.geometry) expect(coachText(W.geometryCoach(sh, g, 2, known)), `${p.id} eg ${g}`).not.toBe(coachText(W.geometryCoach(sh, g, 1, known)))
        for (const name of ALL_SHAPES) if (name !== sh.info.shape) expect(coachText(W.shapeCoach(sh, name, 2, known)), `${p.id} mg ${name}`).not.toBe(coachText(W.shapeCoach(sh, name, 1, known)))
        for (const a of sh.angleChoices) if (a !== sh.angle && (sh.diatomic || known.has('structure'))) expect(coachText(W.angleCoach(sh, a, 2, known)), `${p.id} angle ${a}`).not.toBe(coachText(W.angleCoach(sh, a, 1, known)))
        for (const s of boards(sh)) {
          const t1 = coachText(W.structureCoach(sh, s, 1, known))
          if (/^The board has/.test(t1)) expect(coachText(W.structureCoach(sh, s, 2, known)), `${p.id} structure`).not.toBe(t1)
        }
      }
    }
    // the second try's ask is a thing to do, never a bare count
    expect(W.geometryCoach(on('H2O'), 'trigonal planar', 2, EVERY).ask).toBe('Oxygen has 2 bonded atoms and 2 lone pairs. Add the bonded atoms and the lone pairs together, and pick the electron geometry for that many electron groups.')
  })
  it('reads plainly in the smaller places (COPY-22, COPY-30)', () => {
    for (const line of distinct) {
      expect(line, line).not.toMatch(/\barrangement\b|\b0 or \d lone pairs|in their places|Check my/)
    }
    expect(W.EX_WORDS.checkStructure).toBe('Check the structure')
    expect(W.prompts(on('H2O')).netWait).toBe('The net dipole adds up the bond dipoles, and which way they point depends on the molecular geometry. Answer Molecular geometry and Bond polarity first.')
    expect(W.finishedNote(on('H2O'), ['eg'], COME_BACK)).toBe(`Water comes back after you finish ${COME_BACK} more molecules, because Electron geometry had a wrong answer.`)
    expect(W.finishedTitle(on('H2O'))).toBe('The answers for water')
  })
})

describe('round 2 review fixes', () => {
  const on = (id: string) => sheetOf(ALL.find((p) => p.id === id)!)
  const str: W.Known = new Set<PartId>(['structure'])
  const both: W.Known = new Set<PartId>(['eg', 'mg'])

  it('says where lone pairs go for 5 and 6 electron groups (FE-3)', () => {
    // worked by hand (OpenStax 7.6): in a trigonal bipyramid lone pairs take the places of the flat triangle around
    // the middle; 2 lone pairs on 6 groups sit on opposite sides
    expect(W.shapeCoach(on('ICl3'), 'trigonal planar', 1, str).ask).toBe('Iodine has 5 places for electron groups: 3 in a flat triangle around it, 1 above and 1 below. Put the 2 lone pairs in the triangle, where they have the most room, then name where the 3 outer atoms sit.')
    expect(W.shapeCoach(on('XeF4'), 'tetrahedral', 1, str).ask).toBe('Xenon has 6 places for electron groups, at the 2 ends of 3 lines that cross at xenon. Put the 2 lone pairs on opposite sides, as far apart as they can get, then name where the 4 outer atoms sit.')
    expect(W.angleCoach(on('ICl2-'), '120°', 1, both).ask).toBe('Put the 3 lone pairs in all 3 places of the flat triangle around iodine. Find the angle between the bonds in the places left, then decide whether the lone pairs squeeze them.')
    expect(W.angleCoach(on('H2O'), '180°', 1, both).ask).toBe('Put the 2 lone pairs on oxygen in 2 of the 4 places of a tetrahedral electron geometry. Find the angle between the bonds in the places left, then decide whether the lone pairs squeeze them.')
  })
  it('says something new on the second try of an angle card before the structure is built (FE-4)', () => {
    for (const p of ALL) {
      const sh = sheetOf(p)
      for (const a of sh.angleChoices) if (a !== sh.angle) expect(coachText(W.angleCoach(sh, a, 2, NONE)), `${p.id} angle ${a}`).not.toBe(coachText(W.angleCoach(sh, a, 1, NONE)))
    }
  })
  it('gives a reason with every third-try bond angle (FE-5)', () => {
    for (const p of ALL) {
      const sh = sheetOf(p)
      for (const known of [NONE, EVERY]) expect(W.angleCoach(sh, sh.angleChoices.find((a) => a !== sh.angle)!, 3, known).why, p.id).not.toBe('')
    }
    expect(W.angleCoach(on('CH2Cl2'), '120°', 3, NONE).why).toBe('The electron groups around carbon push each other as far apart as they can get, which leaves the bonds 109.5° apart.')
    expect(W.angleCoach(on('XeF4'), '120°', 3, NONE).why).toBe('The lone pairs on xenon sit on opposite sides of it and push the bonds equally, so the bonds stay 90° apart.')
  })
  it('never tells a molecule with no lone pairs that lone pairs can squeeze its bonds (FE-6)', () => {
    for (const p of ALL) {
      const sh = sheetOf(p)
      if (sh.diatomic || sh.info.lonePairs > 0) continue
      for (const known of [NONE, both, EVERY]) for (const t of [1, 2]) for (const a of ANGLES) if (a !== sh.angle) expect(coachText(W.angleCoach(sh, a, t, known)), `${p.id} ${a}`).not.toMatch(/can squeeze|can push/)
    }
    expect(W.angleCoach(on('CH2Cl2'), '120°', 1, both).why).toBe('With no lone pairs on carbon, the bond angle is the angle of the electron geometry.')
  })
  it('hands back the bond count to a two-atom molecule without naming a choice (FE-8)', () => {
    const sh = on('IF')
    expect(coachText(W.angleCoach(sh, '180°', 1, NONE))).toBe('180° is an angle between 2 bonds. A bond angle needs 2 bonds that meet at a middle atom. Count the bonds in iodine monofluoride, then pick again.')
    expect(coachText(W.angleCoach(sh, '180°', 2, NONE))).toBe('180° is an angle between 2 bonds. Iodine monofluoride has only 2 atoms, so 1 bond joins them. A double or triple bond still counts as 1 bond. Pick again.')
    for (const line of new Set(allLines().map((x) => x.line))) expect(line, line).not.toMatch(/Pick the choice/)
  })
  it('calls ozone\'s middle atom "the middle oxygen atom" (FE-9)', () => {
    const sh = on('O3')
    const texts = cardsFor(sh).filter((c) => c.part !== 'valence' && c.part !== 'bonds').map((c) => c.text)
    texts.push(W.structureAnswer(sh), W.geometryRight(sh), W.shapeRight(sh), W.angleRight(sh))
    for (const t of texts) expect(t.replace(/(middle|outer|the 2|the 3|2|3) oxygen atoms?/g, ''), t).not.toMatch(/\boxygen\b/i)
    expect(W.shapeCoach(sh, 'linear', 1, str).ask).toBe('Put the lone pair in 1 of the 3 places around the middle oxygen atom, then name where the 2 outer atoms sit.')
  })
  it('says something new on the second try of every direction card (FE-10)', () => {
    for (const p of ALL) {
      const sh = sheetOf(p)
      for (const c of sh.directions?.choices ?? []) if (c.id !== sh.directions!.right) expect(coachText(W.directionCoach(sh, c.id, 2)), `${p.id} ${c.id}`).not.toBe(coachText(W.directionCoach(sh, c.id, 1)))
    }
    const sh = on('COCl2')
    const wrong = sh.directions!.choices.find((c) => c.id !== sh.directions!.right)!
    expect(W.directionCoach(sh, wrong.id, 2).ask).toBe('In the C–O bond, oxygen is δ−, and in each C–Cl bond, chlorine is δ−. The C–O dipole is the largest, with ΔEN 1.0. Pick again.')
  })
})

describe('round 3 review fixes', () => {
  const on = (id: string) => sheetOf(ALL.find((p) => p.id === id)!)
  const str: W.Known = new Set<PartId>(['structure'])
  const both: W.Known = new Set<PartId>(['eg', 'mg'])
  const pick = (id: string, test: (c: { id: string; kind: string }) => boolean) => on(id).directions!.choices.find(test)!

  it('keeps ozone\'s direction cards to what the open parts allow: no formal charges, no drawings (FX-1)', () => {
    const sh = on('O3')
    for (const c of sh.directions!.choices) if (c.id !== sh.directions!.right) for (const t of [1, 2]) expect(coachText(W.directionCoach(sh, c.id, t)), c.id).not.toMatch(/drawing|formal charge/)
    expect(W.directionCoach(sh, pick('O3', (c) => c.kind === 'lone-to').id, 2).ask).toBe('In each O–O bond, the outer oxygen atom is δ−. Pick again.')
  })
  it('names the one bond the net dipole runs along, and says the other dipoles cancel (FX-4)', () => {
    // worked by hand: a square pyramid's 4 base dipoles cancel in pairs; a T-shape's 2 axial dipoles cancel;
    // a seesaw's 2 axial dipoles cancel and its 2 equatorial ones add up away from the lone pair
    expect(W.directionChip(on('ICl5'), pick('ICl5', (c) => c.id === on('ICl5').directions!.right))).toBe('Toward the chlorine atom across from the lone pair')
    expect(W.directionChip(on('ICl3'), pick('ICl3', (c) => c.id === on('ICl3').directions!.right))).toBe('Toward the chlorine atom in the flat triangle with the 2 lone pairs')
    const wrong = (id: string) => on(id).directions!.choices.find((c) => c.id !== on(id).directions!.right && c.kind !== 'lone-to')!
    expect(W.directionChip(on('ICl5'), wrong('ICl5'))).toBe('Toward 1 of the 4 chlorine atoms in the square')
    expect(W.directionChip(on('ICl3'), wrong('ICl3'))).toBe('Toward 1 of the 2 chlorine atoms across from each other')
    const why = (id: string) => W.directionCoach(on(id), wrong(id).id, 3).why
    expect(why('ICl5')).toBe('The 4 I–Cl dipoles of the square cancel in pairs, so only the dipole of the I–Cl bond across from the lone pair is left.')
    expect(why('ClF5')).toBe('The 4 Cl–F dipoles of the square cancel in pairs, so only the dipole of the Cl–F bond across from the lone pair is left.')
    expect(why('ICl3')).toBe('The 2 I–Cl dipoles across from each other cancel, so only the dipole of the I–Cl bond in the flat triangle is left.')
    expect(W.directionCoach(on('SeCl4'), pick('SeCl4', (c) => c.kind === 'lone-to').id, 3).why).toBe('The 2 Se–Cl dipoles across from each other cancel, and the other 2 add up, pointing away from the lone pair.')
  })
  it('says how many places there are around the middle atom (FX-5)', () => {
    expect(W.shapeCoach(on('SeCl4'), 'tetrahedral', 1, str).ask).toBe('Selenium has 5 places for electron groups: 3 in a flat triangle around it, 1 above and 1 below. Put the lone pair in the triangle, where it has the most room, then name where the 4 outer atoms sit.')
    expect(W.shapeCoach(on('ICl3'), 'trigonal planar', 1, str).ask).toBe('Iodine has 5 places for electron groups: 3 in a flat triangle around it, 1 above and 1 below. Put the 2 lone pairs in the triangle, where they have the most room, then name where the 3 outer atoms sit.')
    expect(W.shapeCoach(on('XeF4'), 'tetrahedral', 1, str).ask).toBe('Xenon has 6 places for electron groups, at the 2 ends of 3 lines that cross at xenon. Put the 2 lone pairs on opposite sides, as far apart as they can get, then name where the 4 outer atoms sit.')
  })
  it('says where balanced lone pairs sit and that they leave the angle as it is (FX-6)', () => {
    expect(W.angleCoach(on('XeF4'), '120°', 3, NONE).why).toBe('The lone pairs on xenon sit on opposite sides of it and push the bonds equally, so the bonds stay 90° apart.')
    expect(W.angleCoach(on('ICl2-'), '120°', 3, NONE).why).toBe('The lone pairs on iodine sit in the flat triangle around it and push both bonds equally, so the bonds stay 180° apart.')
    expect(W.angleCoach(on('XeF4'), '120°', 1, both).why).toBe('The bond angle starts from the angle of the electron geometry. Check whether the lone pairs on xenon push some bonds harder than others.')
    expect(W.angleCoach(on('XeF4'), 'less than 90°', 1, str).why).toBe('The lone pairs on xenon sit on opposite sides of it and push the bonds equally, so the bonds are not squeezed.')
  })
  it('splits the angle ask into short sentences (FX-7)', () => {
    expect(W.angleCoach(on('ICl3'), '120°', 1, both).ask).toBe('Put the 2 lone pairs in 2 of the 3 places of the flat triangle around iodine. Find the angles between the bonds in the places left, then decide whether the lone pairs squeeze them.')
    expect(W.angleCoach(on('H2O'), '180°', 1, both).ask).toBe('Put the 2 lone pairs on oxygen in 2 of the 4 places of a tetrahedral electron geometry. Find the angle between the bonds in the places left, then decide whether the lone pairs squeeze them.')
    for (const line of new Set(allLines().map((x) => x.line))) for (const sentence of line.split(/(?<=\.) /)) expect(sentence.split(' ').length, sentence).toBeLessThanOrEqual(36)
  })
  it('names which 2 of ozone\'s 3 oxygen atoms a shell card is about (FX-8)', () => {
    const sh = on('O3')
    const texts = boards(sh).map((b) => coachText(W.structureCoach(sh, b, 1, NONE)))
    for (const t of texts) expect(t, t).not.toMatch(/(^|\. )\d oxygen atoms have/)
    expect(texts.some((t) => t.startsWith('The middle oxygen atom and 1 outer oxygen atom have'))).toBe(true)
  })
  it('writes a bond to hydrogen with hydrogen first, as the course does (FX-9)', () => {
    for (const id of ['HCl', 'HBr', 'HF']) {
      const sh = on(id)
      const t = coachText(W.directionCoach(sh, sh.directions!.choices.find((c) => c.id !== sh.directions!.right)!.id, 2))
      expect(t, id).toMatch(/In the H–(Cl|Br|F) bond/)
    }
  })
  it('gives a two-atom molecule its bond count on try 2, not the answer (FX-10, FX-11)', () => {
    expect(coachText(W.angleCoach(on('N2'), '180°', 2, NONE))).toBe('180° is an angle between 2 bonds. A nitrogen molecule has only 2 atoms, so 1 bond joins them. A double or triple bond still counts as 1 bond. Pick again.')
  })
})
