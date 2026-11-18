// Every sentence the shapes quiz shows a student, as pure functions (MD5). The names are
// "electron geometry" (where every electron group around the middle atom points, lone pairs
// included) and "molecular geometry" (where the atoms sit). The facts follow OpenStax Chemistry 2e,
// section 7.6, through the shape table in src/chem/vsepr.ts. tests/shapes-words.test.ts scans
// every line and checks every card against the table.
import { ALL_CASES, shapeCases, type ShapeInfo, type ShapeName } from '../../../chem/vsepr'
import { ALL_TERMS, cap, termCard, type Coach, type TermId } from '../guide'
import { GEOMETRIES, KNOWN_AT, TRIES, idealAngle, rowKey, shapeWithoutPairs, type Ask, type Kind } from './deck'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const pairsText = (n: number) => (n === 0 ? 'no lone pairs' : plural(n, 'lone pair'))
const bondedText = (n: number) => plural(n, 'bonded atom')
/** "the lone pair" or "the 2 lone pairs". */
const theirPairs = (n: number) => (n === 1 ? 'the lone pair' : `the ${n} lone pairs`)
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')
/** Bent and linear each name two rows, so a row's name adds its electron geometry where needed. */
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
  nextTo: (row: ShapeInfo) => `Next: ${rowLabel(row)}`,
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
}

/** A row's name on a chip or in a list: its molecular geometry. */
export const rowLabel = (row: ShapeInfo) => cap(row.shape)
/** A row's counts on a chip: "3 atoms, 1 lone pair". */
export const rowCounts = (row: ShapeInfo) => `${plural(row.bonded, 'atom')}, ${pairsText(row.lonePairs)}`
/** A row's name where it stands alone: bent and linear add their electron geometry. */
const rowName = (row: ShapeInfo) => (twice(row.shape) ? `${cap(row.shape)}, ${row.geometry} electron geometry` : cap(row.shape))

/** Why the bond angle is what it is. `who` is the middle atom by name, or "the middle atom". */
export function angleReason(row: ShapeInfo, who: string): string {
  const squeezed = row.angle.startsWith('less')
  if (row.lonePairs === 0 && row.groups === 2) return `The 2 bonds sit on opposite sides of ${who}, on a straight line.`
  if (row.lonePairs === 0 && row.groups === 5) return 'The 3 bonds around the middle of the trigonal bipyramid are 120° apart, and the 2 bonds at the top and bottom are 90° from each of them.'
  if (row.lonePairs === 0) return `The ${row.groups} bonds spread out as far apart as they can get around ${who}.`
  if (squeezed && row.groups === 5) return 'Lone pairs take the seats around the middle of the trigonal bipyramid, where they have the most room, and push the bonds closer together.'
  if (squeezed) return `A lone pair pushes harder than a bond, so the bonds on ${who} end up closer together.`
  if (row.groups === 6) return `The 2 lone pairs sit on opposite sides of ${who}, so their pushes cancel and the bonds stay at 90°.`
  return `The 3 lone pairs spread evenly around ${who}, in a ring between the 2 bonds, so the 2 bonds stay on a straight line.`
}

/** The series card for a row. `who` names the example's middle atom. */
export function learnLines(row: ShapeInfo, who: string) {
  return {
    title: cap(row.shape),
    counts: `${cap(bondedText(row.bonded))} and ${pairsText(row.lonePairs)} on the middle atom.`,
    difference:
      row.lonePairs === 0
        ? `${cap(who)} has no lone pairs, so the electron geometry and the molecular geometry are both ${row.geometry}.`
        : `The electron geometry counts ${theirPairs(row.lonePairs)} on ${who} too, so the electron geometry is ${row.geometry}. The molecular geometry names where the ${row.bonded} atoms sit: ${row.shape}.`,
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
    return { title: `${cap(bondedText(row.bonded))} and ${pairsText(row.lonePairs)} on the middle atom.`, sub: 'Name both geometries for these counts.', asks: ['Name the electron geometry.', 'Name the molecular geometry.'] }
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

/** "is the bond angle" or "are the bond angles", for an angle with two parts. */
const angleIs = (angle: string) => (angle.includes(' and ') ? `${cap(angle)} are the bond angles` : `${cap(angle)} is the bond angle`)

function electronSaid(row: ShapeInfo, who: string, pick: string, model: boolean): Said {
  const p = cap(pick)
  const lp = row.lonePairs
  const again = model ? `Count the bonded atoms and the lone pairs on ${who}, then pick again.` : 'Add the bonded atoms and the lone pairs to get the electron groups, then pick again.'
  if (pick === row.shape && row.shape !== row.geometry) {
    return said('swapped', {
      // in a counts question the molecular geometry is asked next, so this card does not name it
      lead: model ? `${p} is the molecular geometry here: where the ${row.bonded} atoms around ${who} sit.` : `${p} leaves out the ${row.lonePairs} lone pairs.`,
      why: `The electron geometry counts every electron group around ${who}, and ${lp === 1 ? 'the lone pair is an electron group' : `each of the ${lp} lone pairs is an electron group`} too.`,
      ask: again,
    })
  }
  if (lp > 0 && pick === GEOMETRIES[row.bonded - 2]) {
    return said('no-lone-pairs', { lead: `${p} is the electron geometry for ${row.bonded} electron groups.`, why: `${cap(who)} also has ${pairsText(lp)}, and each lone pair is an electron group too.`, ask: again })
  }
  return said('other', { lead: `${p} is the electron geometry for ${GEOMETRIES.indexOf(pick as never) + 2} electron groups.`, why: `${cap(who)} has a different number of electron groups around it.`, ask: again })
}

function molecularSaid(row: ShapeInfo, who: string, pick: string, model: boolean): Said {
  const p = cap(pick)
  const lp = row.lonePairs
  if (pick === row.geometry && row.geometry !== row.shape) {
    return said('swapped', {
      lead: `${p} is the electron geometry here: where all ${row.groups} electron groups around ${who} point, lone pairs included.`,
      why: `The molecular geometry is named for where the atoms are, and ${lp === 1 ? `1 of the ${row.groups} corners holds a lone pair` : `${lp} of the ${row.groups} corners hold lone pairs`}.`,
      ask: model ? `Look at where the ${row.bonded} bonded atoms sit, then pick again.` : `Leave out the lone pairs and name where the ${row.bonded} atoms sit, then pick again.`,
    })
  }
  if (lp > 0 && pick === shapeWithoutPairs(row)) {
    return said('no-lone-pairs', {
      lead: `${p} would be the molecular geometry if ${who} had no lone pairs.`,
      why: `${cap(who)} also has ${pairsText(lp)}. Each lone pair takes up room of its own and pushes the atoms into other places.`,
      ask: model ? `Count the lone pairs on ${who} too, then pick again.` : `Count the ${pairsText(lp)} as electron groups too, then pick again.`,
    })
  }
  const cases = shapeCases(pick as ShapeName)
  // bent is 2 bonded atoms with 1 or 2 lone pairs, and linear is 2 bonded atoms with none or 3
  const pairs = cases.length === 1 ? pairsText(cases[0]!.lonePairs) : cases.every((c) => c.lonePairs > 0) ? `${cases.map((c) => c.lonePairs).join(' or ')} lone pairs` : cases.map((c) => pairsText(c.lonePairs)).join(' or ')
  const counts = `${bondedText(cases[0]!.bonded)} and ${pairs}`
  return said('other', {
    lead: `${p} is the molecular geometry for ${counts}.`,
    why: model ? `${cap(who)} has a different count of bonded atoms and lone pairs.` : `${cap(who)} has ${bondedText(row.bonded)} and ${pairsText(row.lonePairs)}.`,
    ask: model ? `Count the bonded atoms and the lone pairs on ${who}, then pick again.` : `Find the molecular geometry with ${bondedText(row.bonded)} and ${pairsText(row.lonePairs)}, then pick again.`,
  })
}

function angleSaid(row: ShapeInfo, pick: string): Said {
  const lp = row.lonePairs
  if (row.angle.startsWith('less') && pick === idealAngle(row)) {
    return said('ideal', {
      lead: `${angleIs(pick)} when all ${row.groups} electron groups are bonds.`,
      why: `Here ${pairsText(lp)} ${lp === 1 ? 'sits' : 'sit'} on the middle atom, and a lone pair pushes harder than a bond, so the bonds end up closer together.`,
      ask: `Pick again, with the ${lp === 1 ? 'lone pair' : 'lone pairs'} pushing the bonds closer together.`,
    })
  }
  if (!row.angle.startsWith('less') && pick.startsWith('less')) {
    const why =
      lp === 0
        ? 'This molecular geometry has no lone pairs on the middle atom, so nothing squeezes the bonds.'
        : row.groups === 6
          ? 'The 2 lone pairs sit on opposite sides of the middle atom, so their pushes cancel and the bonds keep their full angle.'
          : 'The 3 lone pairs spread evenly around the middle atom, so they push on the 2 bonds equally from every side.'
    return said('squeezed', {
      lead: pick.includes(' and ') ? `${cap(pick)} are bond angles squeezed by lone pairs.` : `${cap(pick)} is a bond angle squeezed by lone pairs.`,
      why,
      ask: lp === 0 ? `Pick the angle for ${row.groups} electron groups that are all bonds.` : 'Pick the angle the bonds have with nothing squeezing them.',
    })
  }
  // the rows whose angle the pick is, by electron geometry
  const owners = ALL_CASES.filter((r) => r.angle === pick)
  const geos = [...new Set(owners.map((r) => r.geometry))]
  const of = geos
    .map((g) => `${article(g)} ${g} electron geometry with ${owners.filter((r) => r.geometry === g).map((r) => pairsText(r.lonePairs)).join(' or with ')}`)
    .join(', or ')
  return said('other', {
    lead: `${angleIs(pick)} of ${of}.`,
    why: `Here the middle atom has ${article(row.geometry)} ${row.geometry} electron geometry and ${pairsText(lp)}.`,
    ask: lp > 0 ? `Start from the bond angle of the ${row.geometry} electron geometry, then check what the lone pairs do to it.` : `Find the bond angle of the ${row.geometry} electron geometry, then pick again.`,
  })
}

/** What a pick gets: a right line, or a card in three parts. On the last try the card's last part
 *  gives the answer. `who` is the middle atom by name for a model question, "the middle atom" for
 *  the others. `tries` counts this pick: 1 for the first. */
export function feedbackFor(ask: Ask, row: ShapeInfo, who: string, pick: string, tries: number, kind: Kind): Said {
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
  const s = ask === 'electron' ? electronSaid(row, who, pick, model) : ask === 'molecular' ? molecularSaid(row, who, pick, model) : angleSaid(row, pick)
  if (tries < TRIES) return s
  const reveal =
    ask === 'electron'
      ? `The electron geometry is ${row.geometry}: ${row.groups} electron groups, ${bondedText(row.bonded)} and ${pairsText(row.lonePairs)}.`
      : ask === 'molecular'
        ? `The molecular geometry is ${row.shape}: ${bondedText(row.bonded)} and ${pairsText(row.lonePairs)}.`
        : `${row.angle.includes(' and ') ? `The bond angles are ${row.angle}.` : `The bond angle is ${row.angle}.`} ${angleReason(row, who)}`
  return said(s.idea, { ...s.coach!, ask: reveal })
}

/** Said under a finished question: how it counts toward "known". */
export function resultLine(right: boolean, firstTry: boolean): string {
  if (right && firstTry) return 'Right on the first try.'
  if (right) return 'Right on the second try, so this shape comes back after the next question.'
  return 'This shape comes back after the next question.'
}
/** Said when a question makes its row known. */
export const knownLine = (row: ShapeInfo) => `${rowName(row)} is known: ${KNOWN_AT} questions in a row right on the first try.`

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

const cardText = (id: TermId) => {
  const c = termCard(id, null, null)
  return [c.name, c.means, c.example, c.pictureLabel, c.note ?? '', c.also ?? ''].join(' ')
}
const blockedMemo = new Map<string, TermId[]>()
/** The key terms left plain while a question is open: each one whose card, or a card one of its
 *  related terms leads to, states the answer. Cards are built for no guided problem, as ui.ts
 *  builds them outside the guided steps. */
export function blockedTerms(asks: Ask[], row: ShapeInfo): TermId[] {
  const memoKey = `${asks.join('+')}|${rowKey(row)}`
  const hit = blockedMemo.get(memoKey)
  if (hit) return hit
  const answers = asks.map((a) => answerPattern(a, row))
  const gives = new Map<TermId, boolean>(ALL_TERMS.map((id) => [id, answers.some((re) => re.test(cardText(id)))]))
  const out = ALL_TERMS.filter((start) => {
    const seen = new Set<TermId>()
    const todo = [start]
    while (todo.length) {
      const id = todo.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      if (gives.get(id)) return true
      for (const r of termCard(id, null, null).related) todo.push(r.id)
    }
    return false
  })
  blockedMemo.set(memoKey, out)
  return out
}
