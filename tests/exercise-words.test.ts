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
