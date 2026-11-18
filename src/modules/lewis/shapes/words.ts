// Every sentence the shapes quiz shows a student, as pure functions (MD5). The names are
// "electron geometry" (where every electron group around the middle atom points, lone pairs
// included) and "molecular geometry" (where the atoms sit). The facts follow OpenStax Chemistry 2e,
// section 7.6, through the shape table in src/chem/vsepr.ts. tests/shapes-words.test.ts scans
// every line and checks every card against the table.
import type { Problem } from '../../../chem/problems'
import { ALL_CASES, shapeCases, type ShapeInfo, type ShapeName } from '../../../chem/vsepr'
import { ALL_TERMS, cap, sampleShape, termCard, type Coach, type Sample, type TermCard, type TermId } from '../guide'
import { GEOMETRIES, KNOWN_AT, TRIES, answerOf, idealAngle, problemById, rowKey, shapeWithoutPairs, type Ask, type Kind } from './deck'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const pairsText = (n: number) => (n === 0 ? 'no lone pairs' : plural(n, 'lone pair'))
const bondedText = (n: number) => plural(n, 'bonded atom')
/** "the lone pair" or "the 2 lone pairs". */
const theirPairs = (n: number) => (n === 1 ? 'the lone pair' : `the ${n} lone pairs`)
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')
/** Bent and linear each name two rows, so a row's name adds its lone pairs where needed. */
const twice = (name: ShapeName) => ALL_CASES.filter((r) => r.shape === name).length > 1

/** Labels, headings, buttons and chips. No sentence here. */
export const WORDS = {
  tab: 'Shapes',
  title: 'Shapes',
  learnName: 'Electron and molecular geometry',
  phases: 'Series or quiz',
  learnTab: 'See all 13',
  quizTab: 'Quiz',
  back: 'Back',
  startQuiz: 'Start the quiz',
  nextQuestion: 'Next question',
  practiceAgain: 'Practice all 13 again',
  listHeading: 'All 13 by electron geometry',
  viewLabel: 'What the model shows',
  viewAll: 'Electron geometry',
  viewAtoms: 'Molecular geometry',
  knownHeading: 'Known shapes',
  example: 'Example',
  groupHeading: (geometry: string, groups: number) => `${cap(geometry)}: ${groups} electron groups`,
  nextTo: (row: ShapeInfo) => `Next: ${rowName(row)}`,
  knownCount: (n: number) => `${n} of 13 known`,
  questionNo: (n: number) => `Question ${n}`,
  cardNo: (n: number) => `${n} of 13`,
}

/** Sentences that do not change with the row. */
export const SENTENCES = {
  howTurn: 'Drag across the board to turn the model.',
  allKnown: 'All 13 shapes are known.',
  allKnownNext: 'Practice all 13 again, or go through the series.',
  rule: `A shape is known after ${KNOWN_AT} questions in a row on it are right on the first try.`,
  noneKnown: 'No shape is known yet.',
  /** A part of a counts question answered right while the other part is still open. */
  electronRight: 'The electron geometry is right.',
  /** Takes the place of the answer on a missed electron part while the molecular part is still open. */
  electronHeld: "You'll see the electron geometry after you answer the molecular geometry.",
}

/** How to pick, beside the choices: true on a phone and with a keyboard. `n` is the number of choices shown. */
export const howPick = (n: number) => `Tap a choice to pick it. With a keyboard, press 1 to ${n}: 1 picks the first choice.`

/** A row's name on a chip or in a list, where its counts stand beside it: its molecular geometry. */
export const rowLabel = (row: ShapeInfo) => cap(row.shape)
/** A row's counts on a chip: "3 atoms, 1 lone pair". */
export const rowCounts = (row: ShapeInfo) => `${plural(row.bonded, 'atom')}, ${pairsText(row.lonePairs)}`
/** A row's name where it stands alone: bent and linear add their lone pairs ("Bent with 2 lone pairs"). */
export const rowName = (row: ShapeInfo) => (twice(row.shape) ? `${cap(row.shape)} with ${pairsText(row.lonePairs)}` : cap(row.shape))

/** Why the bond angle is what it is. `who` is the middle atom by name, or "the middle atom". */
export function angleReason(row: ShapeInfo, who: string): string {
  const squeezed = row.angle.startsWith('less')
  const lp = row.lonePairs
  if (lp === 0 && row.groups === 2) return `The 2 bonds sit on opposite sides of ${who}, on a straight line.`
  if (lp === 0 && row.groups === 5) return `The 3 bonds in the flat triangle around ${who} are 120° apart, and the 2 bonds at the top and bottom are 90° from each of those 3.`
  if (lp === 0) return `The ${row.groups} bonds spread out as far apart as they can get around ${who}.`
  if (squeezed && row.groups === 5) {
    return lp === 1
      ? `The lone pair on ${who} sits in the flat triangle of 3 places around ${who}, because a lone pair has more room there than at the top or bottom. The lone pair pushes the bonds closer together.`
      : `The ${lp} lone pairs on ${who} sit in the flat triangle of 3 places around ${who}, because a lone pair has more room there than at the top or bottom. The ${lp} lone pairs push the bonds closer together.`
  }
  if (squeezed) return `A lone pair pushes harder than a bond, so the bonds on ${who} end up closer together.`
  if (row.groups === 6) return `The 2 lone pairs sit on opposite sides of ${who}, so their pushes cancel and the bonds stay at 90°.`
  return `The 3 lone pairs on ${who} take all 3 places in the flat triangle around ${who}, so the 2 bonds sit at the top and bottom, on a straight line.`
}

/** The series card for a row. `who` names the example's middle atom. */
export function learnLines(row: ShapeInfo, who: string) {
  const lp = row.lonePairs
  return {
    title: rowName(row),
    counts: `The middle atom has ${bondedText(row.bonded)} and ${pairsText(lp)}.`,
    difference:
      lp === 0
        ? `${cap(who)} has no lone pairs, so the electron geometry and the molecular geometry are both ${row.geometry}.`
        : `Count ${theirPairs(lp)} on ${who} as ${lp === 1 ? 'an electron group' : 'electron groups'} too, and the ${row.groups} groups make ${article(row.geometry)} ${row.geometry} electron geometry. Leave ${theirPairs(lp)} out, and the ${row.bonded} atoms make ${article(row.shape)} ${row.shape} molecular geometry.`,
    reason: angleReason(row, who),
  }
}

/** The table of a row's names, counts and angle. */
export function readoutRows(row: ShapeInfo): { label: string; value: string }[] {
  return [
    { label: 'Electron geometry', value: cap(row.geometry) },
    { label: 'Molecular geometry', value: cap(row.shape) },
    { label: 'Electron groups', value: `${row.groups}: ${bondedText(row.bonded)} and ${pairsText(row.lonePairs)}` },
    { label: 'Bond angle', value: row.angle },
  ]
}

/** A question as it is asked. `asks` has a line for each part of a counts question. */
export function questionLines(kind: Kind, row: ShapeInfo, who: string): { title: string; sub: string; asks: string[] } {
  if (kind === 'electron') return { title: 'Name the electron geometry.', sub: `The electron geometry is where every electron group around ${who} points, lone pairs included.`, asks: [] }
  if (kind === 'molecular') return { title: 'Name the molecular geometry.', sub: `The molecular geometry is where the atoms around ${who} sit. The lone pairs are left out of the name.`, asks: [] }
  if (kind === 'counts') {
    return { title: `The middle atom has ${bondedText(row.bonded)} and ${pairsText(row.lonePairs)}.`, sub: 'Name both geometries for these counts.', asks: ['Name the electron geometry.', 'Name the molecular geometry.'] }
  }
  return { title: `The electron geometry is ${row.geometry} and the molecular geometry is ${row.shape}.`, sub: 'Pick the bond angle between 2 bonds on the middle atom.', asks: [] }
}

export type Idea = 'right' | 'swapped' | 'no-lone-pairs' | 'ideal' | 'squeezed' | 'other'
export interface Said {
  right: boolean
  /** The wrong idea the pick is taken for. */
  idea: Idea
  /** The line for a right pick, or the card's three parts as one line. */
  text: string
  coach: Coach | null
}
const said = (idea: Idea, coach: Coach): Said => ({ right: false, idea, text: [coach.lead, coach.why, coach.ask].join(' '), coach })

/** Where the lone pairs go, for the rows where the places around the middle atom are not alike:
 *  on a trigonal bipyramid they take places in the flat triangle, and 2 lone pairs on an
 *  octahedron sit on opposite sides. Null where every place is alike. */
function lonePlaces(row: ShapeInfo): string | null {
  const lp = row.lonePairs
  if (row.groups === 5 && lp > 0) return lp === 1 ? 'The lone pair takes 1 of the 3 places in the flat triangle' : lp === 3 ? 'The 3 lone pairs take all 3 places in the flat triangle' : `The ${lp} lone pairs take ${lp} of the 3 places in the flat triangle`
  if (row.groups === 6 && lp === 2) return 'The 2 lone pairs take 2 places on opposite sides of the middle atom'
  return null
}

/** "is the bond angle" or "are the bond angles", for an angle with two parts. */
const angleIs = (angle: string) => (angle.includes(' and ') ? `${cap(angle)} are the bond angles` : `${cap(angle)} is the bond angle`)
/** "bond angle" or "bond angles" for an electron geometry's angle with no lone pairs. */
const anglesOf = (row: ShapeInfo) => (idealAngle(row).includes(' and ') ? 'bond angles' : 'bond angle')

function electronSaid(row: ShapeInfo, who: string, pick: string, model: boolean): Said {
  const p = cap(pick)
  const lp = row.lonePairs
  const again = model ? `Count the bonded atoms and the lone pairs on ${who}, then pick again.` : 'Add the bonded atoms and the lone pairs to get the electron groups, then pick again.'
  // a model question only: in a counts question the molecular geometry is asked next, and the one
  // row where this can happen (2 bonded atoms and 3 lone pairs, linear) gets the card below
  if (model && pick === row.shape && row.shape !== row.geometry) {
    return said('swapped', {
      lead: `${p} is the molecular geometry here: where the ${row.bonded} atoms around ${who} sit.`,
      why: `The electron geometry counts every electron group around ${who}, and ${lp === 1 ? 'the lone pair is an electron group' : `each of the ${lp} lone pairs is an electron group`} too.`,
      ask: again,
    })
  }
  if (lp > 0 && pick === GEOMETRIES[row.bonded - 2]) {
    return said('no-lone-pairs', { lead: `${p} is the electron geometry for ${row.bonded} electron groups.`, why: `${cap(who)} also has ${pairsText(lp)}, and each lone pair is an electron group too.`, ask: again })
  }
  const n = GEOMETRIES.indexOf(pick as never) + 2
  return said('other', {
    lead: `${p} is the electron geometry for ${n} electron groups.`,
    why: model
      ? `${cap(who)} does not have ${n} electron groups: each atom bonded to ${who} is 1 electron group, and each lone pair on ${who} is 1 more.`
      : `The middle atom does not have ${n} electron groups: each bonded atom is 1 electron group, and each lone pair is 1 more.`,
    ask: model ? `Count the electron groups on ${who}, then pick the electron geometry for that many.` : 'Add the bonded atoms and the lone pairs in the question, then pick the electron geometry for that many electron groups.',
  })
}

function molecularSaid(row: ShapeInfo, who: string, pick: string, model: boolean, held: boolean): Said {
  const p = cap(pick)
  const lp = row.lonePairs
  const place = model ? null : lonePlaces(row)
  // a counts question: name where the atoms sit, saying where the lone pairs go when the places differ
  const leaveOut = place ? `${place}, so name where the ${row.bonded} atoms sit in the other places, then pick again.` : `Leave out ${theirPairs(lp)} and name where the ${row.bonded} atoms sit, then pick again.`
  if (pick === row.geometry && row.geometry !== row.shape) {
    return said('swapped', {
      // with the electron part held back the lead does not name the electron geometry (FQ-4)
      lead: held ? `Your pick counts all ${row.groups} electron groups around ${who}, lone pairs included.` : `${p} is the electron geometry here: where all ${row.groups} electron groups around ${who} point, lone pairs included.`,
      why: `The molecular geometry is named for where the atoms are, and ${lp === 1 ? `1 of the ${row.groups} corners holds a lone pair` : `${lp} of the ${row.groups} corners hold lone pairs`}.`,
      ask: model ? `Look at where the ${row.bonded} bonded atoms sit, then pick again.` : leaveOut,
    })
  }
  if (lp > 0 && pick === shapeWithoutPairs(row)) {
    return said('no-lone-pairs', {
      lead: `${p} would be the molecular geometry if ${who} had no lone pairs.`,
      why: place
        ? `${cap(who)} has ${pairsText(lp)} and ${row.groups} electron groups. ${place}, so the ${row.bonded} atoms sit in the other ${row.bonded} places.`
        : `${cap(who)} has ${pairsText(lp)} and ${row.groups} electron groups. ${cap(theirPairs(lp))} ${lp === 1 ? 'takes 1' : `take ${lp}`} of the ${row.groups} places around ${who}, so the ${row.bonded} atoms sit in the other ${row.bonded} places.`,
      ask: model ? `Look at where the ${row.bonded} atoms sit on the model, then pick again.` : place ? `Name where the ${row.bonded} atoms sit, then pick again.` : leaveOut,
    })
  }
  const cases = shapeCases(pick as ShapeName)
  // bent is 2 bonded atoms with 1 or 2 lone pairs, and linear is 2 bonded atoms with none or 3
  const pairs = cases.length === 1 ? pairsText(cases[0]!.lonePairs) : cases.every((c) => c.lonePairs > 0) ? `${cases.map((c) => c.lonePairs).join(' or ')} lone pairs` : cases.map((c) => pairsText(c.lonePairs)).join(' or ')
  const k = cases[0]!.bonded
  const counts = `${bondedText(k)} and ${pairs}`
  const lead = `${p} is the molecular geometry for ${counts}.`
  const why = k !== row.bonded ? `${p} needs ${bondedText(k)}, and ${who} has ${row.bonded}.` : `${p} needs ${pairs}, and ${who} has ${pairsText(lp)}.`
  if (model) return said('other', { lead, why, ask: `Pick the molecular geometry for ${bondedText(row.bonded)} and ${pairsText(lp)}.` })
  // a counts question gives the counts already, so the ask goes back one step, to the electron geometry
  const ask =
    lp === 0
      ? `With no lone pairs, the molecular geometry has the same name as the electron geometry for ${row.groups} electron groups. Pick again.`
      : place
        ? `Start from the electron geometry for ${row.groups} electron groups. ${place}, so name where the ${row.bonded} atoms sit in the other places.`
        : `Start from the electron geometry for ${row.groups} electron groups, leave out the ${lp === 1 ? 'corner that holds the lone pair' : `${lp} corners that hold the lone pairs`}, and name where the ${row.bonded} atoms sit.`
  return said('other', { lead, why, ask })
}

function angleSaid(row: ShapeInfo, pick: string): Said {
  const lp = row.lonePairs
  if (row.angle.startsWith('less') && pick === idealAngle(row)) {
    // the why says what the lone pairs do, so the ask does not say it again: with "closer together"
    // in the ask only one choice would be left for the last try
    return said('ideal', {
      lead: `${angleIs(pick)} when all ${row.groups} electron groups are bonds.`,
      why: `Here ${pairsText(lp)} ${lp === 1 ? 'sits' : 'sit'} on the middle atom, and a lone pair pushes harder than a bond, so the bonds end up closer together.`,
      ask: 'Pick again.',
    })
  }
  if (!row.angle.startsWith('less') && pick.startsWith('less')) {
    const why =
      lp === 0
        ? 'The middle atom has no lone pairs, so nothing squeezes the bonds.'
        : row.groups === 6
          ? 'The 2 lone pairs sit on opposite sides of the middle atom, so their pushes cancel and the bonds keep their full angle.'
          : 'The 3 lone pairs sit in the flat triangle around the middle atom, so they push on the top and bottom bonds equally from every side.'
    return said('squeezed', {
      lead: pick.includes(' and ') ? `${cap(pick)} are bond angles squeezed by lone pairs.` : `${cap(pick)} is a bond angle squeezed by lone pairs.`,
      why,
      ask: lp === 0 ? `Pick the angle for ${row.groups} electron groups that are all bonds.` : row.groups === 5 ? 'Pick the angle between the top bond and the bottom bond.' : 'Pick the angle the bonds have with nothing squeezing them.',
    })
  }
  // the rows whose angle the pick is, by electron geometry
  const owners = ALL_CASES.filter((r) => r.angle === pick)
  const geos = [...new Set(owners.map((r) => r.geometry))]
  const of = geos
    .map((g) => `${article(g)} ${g} electron geometry with ${owners.filter((r) => r.geometry === g).map((r) => pairsText(r.lonePairs)).join(' or with ')}`)
    .join(', or ')
  const lead = `${angleIs(pick)} of ${of}.`
  if (row.groups === 5 && lp === 3) {
    // 2 bonded atoms and 3 lone pairs: the lone pairs take the flat triangle, so no angle of the trigonal bipyramid is between the 2 bonds
    return said('other', {
      lead,
      why: `Here the middle atom has a trigonal bipyramidal electron geometry, and the 3 lone pairs take all 3 places in the flat triangle around the middle atom, so the 2 bonds are the top and bottom ones.`,
      ask: 'Pick the angle between the top bond and the bottom bond.',
    })
  }
  return said('other', {
    lead,
    why: `Here the middle atom has ${article(row.geometry)} ${row.geometry} electron geometry and ${pairsText(lp)}.`,
    ask:
      lp > 0
        ? `Start from the ${anglesOf(row)} of the ${row.geometry} electron geometry, then check what ${theirPairs(lp)} ${lp === 1 ? 'does' : 'do'} to ${anglesOf(row) === 'bond angles' ? 'those angles' : 'that angle'}.`
        : `Find the ${anglesOf(row)} of the ${row.geometry} electron geometry, then pick again.`,
  })
}

/** What a pick gets: a right line, or a card in three parts. On the last try the card's last part
 *  gives the answer. `who` is the middle atom by name for a model question, "the middle atom" for
 *  the others. `tries` counts this pick: 1 for the first. `held` is true for the molecular part of a
 *  counts question while the missed electron part's answer is held back. */
export function feedbackFor(ask: Ask, row: ShapeInfo, who: string, pick: string, tries: number, kind: Kind, held = false): Said {
  const model = kind === 'electron' || kind === 'molecular'
  if (ask === 'electron' && pick === row.geometry) {
    return { right: true, idea: 'right', text: `${cap(pick)}: ${row.groups} electron groups around ${who}, ${bondedText(row.bonded)} and ${pairsText(row.lonePairs)}.`, coach: null }
  }
  if (ask === 'molecular' && pick === row.shape) {
    const text =
      row.lonePairs === 0
        ? `${cap(pick)}: ${row.bonded} atoms around ${who} and no lone pairs.`
        : `${cap(pick)}: the ${row.bonded} atoms around ${who}. ${cap(theirPairs(row.lonePairs))} ${row.lonePairs === 1 ? 'is' : 'are'} left out of the name.`
    return { right: true, idea: 'right', text, coach: null }
  }
  if (ask === 'angle' && pick === row.angle) return { right: true, idea: 'right', text: `${cap(pick)}. ${angleReason(row, who)}`, coach: null }
  const s = ask === 'electron' ? electronSaid(row, who, pick, model) : ask === 'molecular' ? molecularSaid(row, who, pick, model, held) : angleSaid(row, pick)
  if (tries < TRIES) return s
  const reveal =
    ask === 'electron'
      ? `The electron geometry is ${row.geometry}: ${row.groups} electron groups, ${bondedText(row.bonded)} and ${pairsText(row.lonePairs)}.`
      : ask === 'molecular'
        ? `The molecular geometry is ${row.shape}: ${bondedText(row.bonded)} and ${pairsText(row.lonePairs)}.`
        : `${row.angle.includes(' and ') ? `The bond angles are ${row.angle}.` : `The bond angle is ${row.angle}.`} ${angleReason(row, who)}`
  return said(s.idea, { ...s.coach!, ask: reveal })
}

/** The card of a missed electron part while the molecular part of a counts question is still open:
 *  its lead and why stay, and the answer waits. With no lone pairs the two names are the same. */
export const heldBack = (c: Coach): Coach => ({ ...c, ask: SENTENCES.electronHeld })

/** Said under a finished question: how it counts toward "known". */
export function resultLine(right: boolean, firstTry: boolean): string {
  if (right && firstTry) return 'Right on the first try.'
  if (right) return 'Right on the second try, so this shape comes back soon.'
  return 'This shape comes back soon for another try.'
}
/** Said when a question makes its row known. */
export const knownLine = (row: ShapeInfo) => `${rowName(row)} is known: you got ${KNOWN_AT} questions in a row right on the first try.`

// ---------------------------------------------------------------- key terms while a question is open

/** What on screen would answer the question: the name (a tetrahedron counts as tetrahedral), or
 *  any number of degrees in the angle. */
export function answerPattern(ask: Ask, row: ShapeInfo): RegExp {
  if (ask === 'angle') {
    const nums = row.angle.match(/\d+(?:\.\d+)?°/g) ?? []
    return new RegExp(`(?<![\\d.])(?:${nums.map((n) => n.replace('.', '\\.')).join('|')})`)
  }
  const name = ask === 'electron' ? row.geometry : row.shape
  const stem = name.endsWith('al') ? `${name.slice(0, -2)}(?:al|on)?` : name
  return new RegExp(`(?<![\\p{L}-])${stem}(?!\\p{L})`, 'iu')
}

const cardText = (c: TermCard) => [c.name, c.means, c.example, c.pictureLabel, c.note ?? '', c.also ?? ''].join(' ')
/** The molecules a card works or draws. */
const samplesOf = (c: TermCard): Sample[] => [...c.about.samples, ...(c.picture.kind === 'lewis' ? c.picture.samples : []), ...(c.picture.kind === 'model' ? [c.picture.sample] : [])]
/** A sample's row of the shape table, or null for a molecule of two atoms. */
const sampleRow = (m: Sample): ShapeInfo | null => (m.formula.reduce((n, [, k]) => n + k, 0) > 2 ? sampleShape(m) : null)
const sameSpecies = (m: Sample, p: Problem) => m.charge === p.charge && JSON.stringify([...m.formula].sort()) === JSON.stringify([...p.formula].sort())
/** A card that says what lone pairs do to a bond angle ("Lone pairs push harder than bonds do"). */
const SQUEEZE = /squeez|push(es)? harder/i

/** Why a key term's card would give the open question away, or null when it may open. The card is
 *  built for no guided problem, as ui.ts builds it outside the guided steps, and is judged on its
 *  own text and molecules: ui.ts leaves links to blocked terms out of every card it opens. */
export function giveAway(id: TermId, asks: Ask[], row: ShapeInfo, molecule: Problem): string | null {
  const c = termCard(id, null, null)
  const text = cardText(c)
  if (asks.some((a) => answerPattern(a, row).test(text))) return 'states the answer'
  const samples = samplesOf(c)
  if (samples.some((m) => sameSpecies(m, molecule))) return 'works the molecule of the question'
  const rows = samples.map(sampleRow)
  if (rows.some((r) => r && r.bonded === row.bonded && r.lonePairs === row.lonePairs)) return 'works a molecule with the same bonded atoms and lone pairs'
  if (c.picture.kind === 'model' && rows.some((r) => r && asks.some((a) => answerOf(a, r) === answerOf(a, row)))) return 'draws a model with the same answer'
  if (asks.includes('angle') && (id === 'bond-angle' || SQUEEZE.test(text))) return 'says what lone pairs do to a bond angle'
  // any bond angle on a card is a pick to steer toward or away from (FQ-1: the bent card gives SCl2's angle on a row 2,1 question)
  if (asks.includes('angle') && (/\d°/.test(text) || (c.picture.kind === 'model' && c.picture.angle))) return 'states a bond angle'
  return null
}

const blockedMemo = new Map<string, TermId[]>()
/** The key terms left plain while a question is open, and that the module may not open: each one
 *  whose card gives the question away (`giveAway`). `molecule` is the question's molecule. */
export function blockedTerms(asks: Ask[], row: ShapeInfo, molecule: string): TermId[] {
  const memoKey = `${asks.join('+')}|${rowKey(row)}|${molecule}`
  const hit = blockedMemo.get(memoKey)
  if (hit) return hit
  const p = problemById(molecule)
  const out = ALL_TERMS.filter((id) => giveAway(id, asks, row, p) !== null)
  blockedMemo.set(memoKey, out)
  return out
}
