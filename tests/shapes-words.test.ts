// Every sentence the shapes quiz shows a student (src/modules/lewis/shapes/words.ts): the scan of
// the wording that tests/guide.test.ts does for the guided steps, every wrong-answer card checked
// against the shape table for every row and every wrong pick it can appear on, and the key-term
// cards that can open while a question is open. The table is written by hand from OpenStax
// Chemistry 2e, section 7.6.
import { describe, expect, it } from 'vitest'
import { ALL_TERMS, sampleShape, termCard, termPieces, type Sample, type TermId } from '../src/modules/lewis/guide'
import { getState } from '../src/modules/lewis/store'
import { shapesPart } from '../src/modules/lewis/shapes/part'
import { freshShapes, type ShapesState } from '../src/modules/lewis/shapes/state'
import { KINDS, KNOWN_AT, ROW_KEYS, TRIES, answerOf, choicesFor, moleculesFor, nextQuestion, pick, problemById, rowOf, type Ask, type Kind, type RowKey } from '../src/modules/lewis/shapes/deck'
import {
  SENTENCES,
  WORDS,
  angleReason,
  answerPattern,
  blockedTerms,
  feedbackFor,
  howPick,
  learnLines,
  questionLines,
  readoutRows,
  resultLine,
  knownLine,
  rowLabel,
} from '../src/modules/lewis/shapes/words'

const TABLE: Record<RowKey, { electron: string; molecular: string; angle: string; groups: number; bonded: number; pairs: number }> = {
  '2,0': { electron: 'linear', molecular: 'linear', angle: '180°', groups: 2, bonded: 2, pairs: 0 },
  '3,0': { electron: 'trigonal planar', molecular: 'trigonal planar', angle: '120°', groups: 3, bonded: 3, pairs: 0 },
  '2,1': { electron: 'trigonal planar', molecular: 'bent', angle: 'less than 120°', groups: 3, bonded: 2, pairs: 1 },
  '4,0': { electron: 'tetrahedral', molecular: 'tetrahedral', angle: '109.5°', groups: 4, bonded: 4, pairs: 0 },
  '3,1': { electron: 'tetrahedral', molecular: 'trigonal pyramidal', angle: 'less than 109.5°', groups: 4, bonded: 3, pairs: 1 },
  '2,2': { electron: 'tetrahedral', molecular: 'bent', angle: 'less than 109.5°', groups: 4, bonded: 2, pairs: 2 },
  '5,0': { electron: 'trigonal bipyramidal', molecular: 'trigonal bipyramidal', angle: '90° and 120°', groups: 5, bonded: 5, pairs: 0 },
  '4,1': { electron: 'trigonal bipyramidal', molecular: 'seesaw', angle: 'less than 90° and less than 120°', groups: 5, bonded: 4, pairs: 1 },
  '3,2': { electron: 'trigonal bipyramidal', molecular: 'T-shaped', angle: 'less than 90°', groups: 5, bonded: 3, pairs: 2 },
  '2,3': { electron: 'trigonal bipyramidal', molecular: 'linear', angle: '180°', groups: 5, bonded: 2, pairs: 3 },
  '6,0': { electron: 'octahedral', molecular: 'octahedral', angle: '90°', groups: 6, bonded: 6, pairs: 0 },
  '5,1': { electron: 'octahedral', molecular: 'square pyramidal', angle: 'less than 90°', groups: 6, bonded: 5, pairs: 1 },
  '4,2': { electron: 'octahedral', molecular: 'square planar', angle: '90°', groups: 6, bonded: 4, pairs: 2 },
}
// the molecular geometry each count of bonded atoms makes with no lone pairs (the table's first column)
const T = (k: string) => TABLE[k]!
const NO_PAIRS: Record<number, string> = { 2: 'linear', 3: 'trigonal planar', 4: 'tetrahedral', 5: 'trigonal bipyramidal', 6: 'octahedral' }
// the electron geometry for each count of electron groups
const BY_GROUPS: Record<number, string> = { 2: 'linear', 3: 'trigonal planar', 4: 'tetrahedral', 5: 'trigonal bipyramidal', 6: 'octahedral' }

const WHO = ['nitrogen', 'the middle atom']
const KINDS_OF: Record<Ask, Kind[]> = { electron: ['electron', 'counts'], molecular: ['molecular', 'counts'], angle: ['angle'] }
const right = (ask: Ask, key: RowKey) => T(key)[ask]

/** Every wrong-answer card and every right line the quiz can show, with what produced it. */
function allFeedback() {
  const out: { key: RowKey; ask: Ask; kind: Kind; who: string; pick: string; tries: number; said: ReturnType<typeof feedbackFor> }[] = []
  for (const key of ROW_KEYS) {
    const row = rowOf(key)
    for (const ask of ['electron', 'molecular', 'angle'] as Ask[]) {
      for (const kind of KINDS_OF[ask]) {
        for (const who of kind === 'electron' || kind === 'molecular' ? WHO.slice(0, 1) : WHO.slice(1)) {
          for (const pick of choicesFor(ask, row)) {
            for (let tries = 1; tries <= TRIES; tries++) out.push({ key, ask, kind, who, pick, tries, said: feedbackFor(ask, row, who, pick, tries, kind) })
          }
        }
      }
    }
  }
  return out
}
const FEEDBACK = allFeedback()

/** Labels, headings, buttons and chips: short, with no period. */
const labels: string[] = []
function allCopy(): string[] {
  const lines: string[] = [...Object.values(SENTENCES)]
  labels.push(...Object.values(WORDS).filter((x): x is string => typeof x === 'string'))
  for (const key of ROW_KEYS) {
    const row = rowOf(key)
    const l = learnLines(row, 'nitrogen')
    lines.push(l.counts, l.difference, l.reason)
    labels.push(l.title, rowLabel(row), WORDS.nextTo(row), WORDS.knownCount(0), WORDS.questionNo(1))
    for (const r of readoutRows(row)) labels.push(r.label, r.value)
    for (const ask of ['electron', 'molecular', 'angle'] as Ask[]) labels.push(...choicesFor(ask, row))
    for (const who of WHO) lines.push(angleReason(row, who))
    for (const kind of ['electron', 'molecular', 'counts', 'angle'] as Kind[]) {
      const q = questionLines(kind, row, kind === 'counts' || kind === 'angle' ? 'the middle atom' : 'nitrogen')
      lines.push(q.title, q.sub, ...q.asks)
    }
    lines.push(knownLine(row))
    for (const n of [0, 1, 12, 13]) labels.push(WORDS.knownCount(n), WORDS.questionNo(n + 1))
  }
  lines.push(howPick(5), howPick(6))
  // the molecular cards of a counts question while the missed electron part is held back
  for (const key of ROW_KEYS) for (const p of choicesFor('molecular', rowOf(key))) lines.push(feedbackFor('molecular', rowOf(key), 'the middle atom', p, 1, 'counts', true).text)
  for (const f of FEEDBACK) {
    lines.push(f.said.text)
    if (f.said.coach) lines.push(f.said.coach.lead, f.said.coach.why, f.said.coach.ask)
  }
  for (const first of [true, false]) for (const r of [true, false]) lines.push(resultLine(r, first))
  return [...new Set(lines.filter(Boolean))]
}
const sentences = allCopy()
const lines = [...new Set([...sentences, ...labels])]

describe('the wording', () => {
  it('collects a few hundred distinct lines', () => {
    expect(lines.length).toBeGreaterThan(200)
  })
  it('has no em dashes, no leftover template text, and no doubled spaces', () => {
    for (const line of lines) {
      expect(line, line).not.toMatch(/—/)
      expect(line, line).not.toMatch(/undefined|NaN|\[object|\$\{/)
      expect(line, line).not.toMatch(/ {2}/)
      expect(line, line).not.toMatch(/\b0 of 0\b/)
      expect(line, line).not.toMatch(/\b(\w+) \1\b/i)
    }
  })
  it('never gives an atom feelings or uses the phrases Sam has banned', () => {
    // the same pattern as the end of tests/guide.test.ts
    const banned = /\b(wants?|likes?|happy|prefers?|loves?|hates?|seamless|comprehensive|robust|leverage|delve|showcase|elevate|unlock|not only|not just|more than just|think of|tells a story|simply|just)\b|that's next|let's/i
    for (const line of lines) expect(line, line).not.toMatch(banned)
  })
  it('names the atom: no sentence starts with "It"', () => {
    for (const line of lines) expect(line, line).not.toMatch(/(^|\. )It /)
  })
  it('uses "1 electron group", never "1 electron groups", and the same for atoms and pairs', () => {
    for (const line of lines) expect(line, line).not.toMatch(/\b1 (electrons|atoms|bonds|groups|electron groups|lone pairs|bonded atoms|corners)\b/)
    for (const line of lines) expect(line, line).not.toMatch(/\b1 of the \d corners hold\b|\b[02-9] of the \d corners holds\b/)
  })
  it('ends every sentence with a period or a question mark, and no label with one', () => {
    for (const line of sentences) expect(line, line).toMatch(/[.?]$/)
    for (const line of labels) expect(line, line).not.toMatch(/\.$/)
  })
  it('calls the two names "electron geometry" and "molecular geometry", never "arrangement" or "shape name"', () => {
    for (const line of lines) expect(line, line).not.toMatch(/\barrangement\b|\bshape name\b/i)
  })
})

describe('a right pick', () => {
  it('is right exactly when it is the answer in the table', () => {
    for (const f of FEEDBACK) expect(f.said.right, `${f.key} ${f.ask} ${f.pick}`).toBe(f.pick === right(f.ask, f.key))
  })
  it('names the answer and the counts of the row', () => {
    for (const f of FEEDBACK.filter((x) => x.said.right)) {
      const t = T(f.key)
      expect(f.said.text.toLowerCase(), f.said.text).toContain(right(f.ask, f.key).toLowerCase())
      if (f.ask === 'electron') expect(f.said.text, f.said.text).toContain(`${t.groups} electron groups`)
      if (f.ask === 'molecular') expect(f.said.text, f.said.text).toContain(`${t.bonded} `)
    }
  })
})

describe('a wrong pick', () => {
  const wrong = FEEDBACK.filter((f) => !f.said.right)
  it('gets a card in three parts', () => {
    for (const f of wrong) {
      expect(f.said.coach, `${f.key} ${f.pick}`).not.toBeNull()
      expect(f.said.coach!.lead.length).toBeGreaterThan(0)
      expect(f.said.coach!.why.length).toBeGreaterThan(0)
      expect(f.said.coach!.ask.length).toBeGreaterThan(0)
    }
  })
  it('the card begins with what the pick is', () => {
    for (const f of wrong) expect(f.said.coach!.lead.toLowerCase().startsWith(f.pick.toLowerCase()), f.said.coach!.lead).toBe(true)
  })
  it('holds the answer back before the last try, and gives it on the last try', () => {
    for (const f of wrong) {
      const answer = answerPattern(f.ask, rowOf(f.key))
      // the student's own pick can hold the same number ("less than 109.5°" when the answer is 109.5°)
      const text = f.said.text.split(f.pick).join(' ').split(f.pick.charAt(0).toUpperCase() + f.pick.slice(1)).join(' ')
      if (f.tries < TRIES) expect(text, `${f.key} ${f.ask} ${f.pick}: ${f.said.text}`).not.toMatch(answer)
      else expect(f.said.text, `${f.key} ${f.ask} ${f.pick}`).toMatch(answer)
    }
  })
  it('names the electron geometry given for the molecular geometry, and the other way round', () => {
    for (const f of wrong) {
      const t = T(f.key)
      if (f.ask === 'molecular' && f.pick === t.electron) {
        expect(f.said.idea).toBe('swapped')
        expect(f.said.coach!.lead).toMatch(/is the electron geometry here/)
        expect(f.said.coach!.lead).toContain(`all ${t.groups} electron groups`)
        expect(f.said.coach!.why).toContain(t.pairs === 1 ? `1 of the ${t.groups} corners holds a lone pair` : `${t.pairs} of the ${t.groups} corners hold lone pairs`)
      }
      if (f.ask === 'electron' && f.pick === t.molecular) {
        expect(f.said.idea).toBe(f.kind === 'counts' ? 'no-lone-pairs' : 'swapped')
        // a counts question asks for the molecular geometry next, so its card does not name it or
        // say that the pick leaves out the lone pairs (COPY-3): the pick gets the card for the
        // electron geometry of the bonded atoms alone
        if (f.kind === 'counts') {
          expect(f.said.idea).toBe('no-lone-pairs')
          expect(f.said.coach!.lead).toBe(`${f.pick.charAt(0).toUpperCase()}${f.pick.slice(1)} is the electron geometry for ${t.bonded} electron groups.`)
        } else {
          expect(f.said.coach!.lead).toMatch(/is the molecular geometry here/)
          expect(f.said.coach!.lead).toContain(`the ${t.bonded} atoms`)
        }
      }
    }
    expect(wrong.filter((f) => f.said.idea === 'swapped').length).toBeGreaterThan(20)
  })
  it('names the lone pairs left out, only where leaving them out gives the pick', () => {
    for (const f of wrong.filter((x) => x.said.idea === 'no-lone-pairs')) {
      const t = T(f.key)
      expect(t.pairs).toBeGreaterThan(0)
      if (f.ask === 'molecular') {
        expect(f.pick).toBe(NO_PAIRS[t.bonded])
        expect(f.said.coach!.lead).toMatch(/would be the molecular geometry if .* had no lone pairs/)
      }
      if (f.ask === 'electron') {
        expect(f.pick).toBe(BY_GROUPS[t.bonded])
        expect(f.said.coach!.lead).toContain(`for ${t.bonded} electron groups`)
      }
      expect(f.said.coach!.why).toContain(t.pairs === 1 ? '1 lone pair' : `${t.pairs} lone pairs`)
    }
    for (const f of wrong.filter((x) => x.ask === 'molecular' && x.pick === NO_PAIRS[T(x.key).bonded] && x.pick !== T(x.key).electron)) expect(f.said.idea).toBe('no-lone-pairs')
  })
  it('names the ideal angle given where lone pairs make it smaller', () => {
    const ideal: Record<string, string> = { linear: '180°', 'trigonal planar': '120°', tetrahedral: '109.5°', 'trigonal bipyramidal': '90° and 120°', octahedral: '90°' }
    for (const f of wrong.filter((x) => x.ask === 'angle')) {
      const t = T(f.key)
      if (t.angle.startsWith('less') && f.pick === ideal[t.electron]) {
        expect(f.said.idea).toBe('ideal')
        expect(f.said.coach!.lead).toContain(`when all ${t.groups} electron groups are bonds`)
        expect(f.said.coach!.why).toContain(t.pairs === 1 ? '1 lone pair' : `${t.pairs} lone pairs`)
      } else if (!t.angle.startsWith('less') && f.pick.startsWith('less')) {
        expect(f.said.idea).toBe('squeezed')
      } else expect(f.said.idea, `${f.key} ${f.pick}`).toBe('other')
    }
  })
  it('says which rows an angle belongs to, and each named row has that angle in the table', () => {
    for (const f of wrong.filter((x) => x.ask === 'angle' && x.said.idea === 'other')) {
      // "90° is the bond angle of an octahedral electron geometry with no lone pairs or with 2 lone pairs."
      const lead = f.said.coach!.lead
      const owners = ROW_KEYS.filter((k) => T(k).angle === f.pick)
      for (const k of owners) expect(lead, lead).toContain(T(k).electron)
      for (const k of ROW_KEYS.filter((x) => !owners.includes(x))) if (!owners.some((o) => T(o).electron === T(k).electron)) expect(lead, lead).not.toContain(` ${T(k).electron} `)
    }
  })
  it('the reason for a squeezed angle is only given where lone pairs squeeze it', () => {
    for (const key of ROW_KEYS) {
      const t = T(key)
      const reason = angleReason(rowOf(key), 'nitrogen')
      if (t.angle.startsWith('less')) expect(reason, key).toMatch(/closer together/)
      else expect(reason, key).not.toMatch(/closer together/)
      if (key === '4,2') expect(reason).toMatch(/opposite sides/)
      if (key === '2,3') expect(reason).toMatch(/straight line/)
    }
  })
})

describe('the series', () => {
  it('each card names both geometries, the counts and the angle from the table', () => {
    for (const key of ROW_KEYS) {
      const t = T(key)
      const rows = Object.fromEntries(readoutRows(rowOf(key)).map((r) => [r.label, r.value]))
      expect(rows['Electron geometry']!.toLowerCase(), key).toBe(t.electron)
      expect(rows['Molecular geometry']!.toLowerCase(), key).toBe(t.molecular.toLowerCase())
      expect(rows['Bond angle'], key).toBe(t.angle)
      expect(rows['Electron groups'], key).toContain(`${t.groups}:`)
      expect(rows['Electron groups'], key).toContain(t.bonded === 1 ? '1 bonded atom' : `${t.bonded} bonded atoms`)
    }
  })
})

/** The cards a student can reach from a set of lines: each highlighted word's card, and each
 *  card's related terms in turn. The quiz has no guided problem on screen, so cards are built for
 *  none (as ui.ts does outside the guided steps). ui.ts never opens a blocked term and leaves its
 *  link out of every card (the part's blockedTerms hook), so the walk stops at a blocked term. */
function reachable(text: string[], blocked: TermId[]): Set<TermId> {
  const seen = new Set<TermId>()
  const todo: TermId[] = []
  for (const line of text) for (const piece of termPieces(line)) if (piece.term && !blocked.includes(piece.term)) todo.push(piece.term)
  while (todo.length) {
    const id = todo.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const r of termCard(id, null, null).related) if (!blocked.includes(r.id)) todo.push(r.id)
  }
  return seen
}
const cardText = (id: TermId) => {
  const c = termCard(id, null, null)
  return [c.name, c.means, c.example, c.pictureLabel, c.note ?? '', c.also ?? ''].join(' ')
}

describe('key terms while a question is open', () => {
  it('no card a student can open states the answer', () => {
    let checked = 0
    for (const key of ROW_KEYS) {
      const row = rowOf(key)
      for (const kind of ['electron', 'molecular', 'counts', 'angle'] as Kind[]) {
        const who = kind === 'counts' || kind === 'angle' ? 'the middle atom' : 'nitrogen'
        const asks: Ask[] = kind === 'counts' ? ['electron', 'molecular'] : kind === 'angle' ? ['angle'] : [kind]
        const answers = asks.map((a) => answerPattern(a, row))
        for (const p of moleculesFor(key)) {
        const blocked = blockedTerms(asks, row, p.id)
        const q = questionLines(kind, row, who)
        // the question, and every card a wrong first pick can bring up while the question is still open
        const text = [q.title, q.sub, ...q.asks, SENTENCES.howTurn]
        for (const a of asks) for (const p of choicesFor(a, row)) {
          const said = feedbackFor(a, row, who, p, 1, kind)
          if (said.coach) text.push(said.coach.lead, said.coach.why, said.coach.ask)
        }
        for (const id of reachable(text, blocked)) {
          for (const answer of answers) expect(cardText(id), `${key} ${kind}: the card for ${id}`).not.toMatch(answer)
          checked++
        }
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
  it('still highlights words whose cards are safe', () => {
    const row = rowOf('2,0')
    const blocked = blockedTerms(['angle'], row, 'CO2')
    expect(ALL_TERMS.filter((id) => !blocked.includes(id)).length).toBeGreaterThan(10)
  })
  it('answerPattern finds the answer and not a longer name around it', () => {
    expect('a tetrahedron').toMatch(answerPattern('electron', rowOf('4,0')))
    expect('octahedral').not.toMatch(answerPattern('electron', rowOf('4,0')))
    expect('trigonal bipyramidal').not.toMatch(answerPattern('molecular', rowOf('3,1')))
    expect('at 90° and 120°').toMatch(answerPattern('angle', rowOf('6,0')))
    expect('109.5°').toMatch(answerPattern('angle', rowOf('3,1')))
  })
  it('the row is never answered by its own answer under another name in the table', () => {
    for (const key of ROW_KEYS) expect(answerOf('electron', rowOf(key))).toBe(T(key).electron)
  })
})

// ---------------------------------------------------------------- review round 1 (2026-11-17)

const SAMPLE_COUNTS = (m: Sample) => (m.formula.reduce((n, [, k]) => n + k, 0) > 2 ? sampleShape(m) : null)
const samplesOf = (id: TermId): Sample[] => {
  const c = termCard(id, null, null)
  return [...c.about.samples, ...(c.picture.kind === 'lewis' ? c.picture.samples : []), ...(c.picture.kind === 'model' ? [c.picture.sample] : [])]
}
const sameSpecies = (m: Sample, id: string) => {
  const p = problemById(id)
  return m.charge === p.charge && JSON.stringify([...m.formula].sort()) === JSON.stringify([...p.formula].sort())
}
const ASKS_OF: Record<Kind, Ask[]> = { electron: ['electron'], molecular: ['molecular'], counts: ['electron', 'molecular'], angle: ['angle'] }

describe('key terms while a question is open, against the molecule and the counts (COPY-1, COPY-8)', () => {
  it('no card that can open works the molecule on the board, a molecule with the row\'s counts, or states the answer', () => {
    let checked = 0
    for (const key of ROW_KEYS) {
      const row = rowOf(key)
      const t = T(key)
      for (const kind of KINDS) {
        const asks = ASKS_OF[kind]
        for (const p of moleculesFor(key)) {
          const blocked = blockedTerms(asks, row, p.id)
          for (const id of ALL_TERMS.filter((x) => !blocked.includes(x))) {
            const label = `${key} ${kind} ${p.id}: the card for ${id}`
            for (const a of asks) expect(cardText(id), label).not.toMatch(answerPattern(a, row))
            for (const m of samplesOf(id)) {
              expect(sameSpecies(m, p.id), `${label} draws ${m.id}`).toBe(false)
              const s = SAMPLE_COUNTS(m)
              expect(s !== null && s.bonded === t.bonded && s.lonePairs === t.pairs, `${label} works ${m.id}, ${t.bonded} bonded atoms and ${t.pairs} lone pairs`).toBe(false)
            }
            if (asks.includes('angle')) {
              expect(id, label).not.toBe('bond-angle')
              expect(cardText(id), `${label} says what lone pairs do to an angle`).not.toMatch(/squeez|push(es)? harder/i)
            }
            checked++
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000)
  })
  it('the electron group card (nitrogen trifluoride, 3 bonded atoms and 1 lone pair) never opens on a row 3,1 question', () => {
    for (const kind of KINDS) for (const p of moleculesFor('3,1')) expect(blockedTerms(ASKS_OF[kind], rowOf('3,1'), p.id), `${kind} ${p.id}`).toContain('electron-group')
  })
  it('the bond angle card never opens while a bond angle is asked', () => {
    for (const key of ROW_KEYS) for (const p of moleculesFor(key)) expect(blockedTerms(['angle'], rowOf(key), p.id), key).toContain('bond-angle')
  })
  it('the part hands the module the same set the panel leaves plain, and none once the question is finished', () => {
    let st: ShapesState = { ...freshShapes(), phase: 'quiz' }
    st = nextQuestion(st, new Set())
    const q = st.q!
    const s = { ...getState(), mode: 'shapes' as const, shapes: st }
    expect([...shapesPart.blockedTerms!(s)].sort()).toEqual([...blockedTerms(q.asks.map((a) => a.ask), rowOf(q.row), q.molecule)].sort())
    let done = st
    for (let i = 0; i < 4 && done.q!.right === null; i++) {
      const a = done.q!.asks.find((x) => x.right === null)!
      done = pick(done, answerOf(a.ask, rowOf(done.q!.row))).st
    }
    expect(shapesPart.blockedTerms!({ ...s, shapes: done }).size).toBe(0)
    expect(shapesPart.blockedTerms!({ ...s, shapes: { ...st, phase: 'learn' } }).size).toBe(0)
  })
})

/** A counts question on a row with the electron part missed twice, the molecular part open. */
function missedElectron(key: RowKey): ShapesState {
  const row = rowOf(key)
  const asks = ASKS_OF.counts.map((ask) => ({ ask, choices: choicesFor(ask, row), picks: [] as string[], right: null }))
  let st: ShapesState = { ...freshShapes(), phase: 'quiz', turn: 1, q: { n: 1, row: key, kind: 'counts', molecule: moleculesFor(key)[0]!.id, asks, right: null, firstTry: false, madeKnown: false } }
  for (const w of choicesFor('electron', row).filter((c) => c !== T(key).electron).slice(0, TRIES)) st = pick(st, w).st
  return st
}
const panelText = (st: ShapesState) => {
  const html = shapesPart.panel({ ...getState(), mode: 'shapes', shapes: st })
  return html.replace(/<div class="mb-choices[^>]*>[\s\S]*?<\/div>/g, ' ').replace(/<\/?button\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ')
}

describe('a counts question whose electron part was missed (COPY-2, CODE-1)', () => {
  it('keeps the electron geometry\'s name off the panel while the molecular part is open, and shows it once the question is finished', () => {
    for (const key of ROW_KEYS) {
      const st = missedElectron(key)
      expect(st.q!.asks[0]!.right, key).toBe(false)
      expect(st.q!.right, key).toBeNull()
      const text = panelText(st)
      expect(text, key).not.toMatch(answerPattern('electron', rowOf(key)))
      expect(text, key).not.toMatch(answerPattern('molecular', rowOf(key)))
      expect(text, key).toContain(SENTENCES.electronHeld)
      const done = pick(st, T(key).molecular).st
      expect(done.q!.right, key).toBe(false)
      expect(panelText(done), key).toContain(`The electron geometry is ${T(key).electron}`)
    }
  })
  it('no electron card in a counts question names the molecular geometry, outside the student\'s own pick', () => {
    for (const f of FEEDBACK.filter((x) => x.kind === 'counts' && x.ask === 'electron' && !x.said.right && x.said.coach)) {
      const c = f.said.coach!
      const lines = [c.lead, c.why, ...(f.tries < TRIES ? [c.ask] : [])].join(' ')
      const text = lines.split(f.pick).join(' ').split(f.pick.charAt(0).toUpperCase() + f.pick.slice(1)).join(' ')
      expect(text, `${f.key} ${f.pick}: ${lines}`).not.toMatch(answerPattern('molecular', rowOf(f.key)))
    }
  })
})

describe('the open question shows how to pick (COPY-28)', () => {
  it('a how-to line for tapping a choice that names the number keys, only while a question is open', () => {
    for (const n of [5, 6]) {
      expect(howPick(n)).toMatch(/\btap\b/i)
      expect(howPick(n)).toMatch(new RegExp(`press 1 to ${n}\\b`))
    }
    const st = nextQuestion({ ...freshShapes(), phase: 'quiz' }, new Set())
    expect(panelText(st)).toContain(howPick(st.q!.asks[0]!.choices.length))
  })
})

describe('the cards and lines the review asked to change', () => {
  const wrong = FEEDBACK.filter((f) => !f.said.right)
  const card = (key: RowKey, ask: Ask, kind: Kind, pick: string, tries = 1) => feedbackFor(ask, rowOf(key), kind === 'counts' || kind === 'angle' ? 'the middle atom' : 'xenon', pick, tries, kind)
  it('COPY-3: in a counts question, linear on row 2,3 gets the card for leaving out the lone pairs, with no word on the molecular geometry', () => {
    const s = card('2,3', 'electron', 'counts', 'linear')
    expect(s.idea).toBe('no-lone-pairs')
    expect(s.coach!.lead).toBe('Linear is the electron geometry for 2 electron groups.')
    expect(s.text).not.toMatch(/leaves out/)
  })
  it('COPY-4: a fallback card says why the pick fails without saying "different"', () => {
    for (const f of wrong.filter((x) => x.said.idea === 'other' && x.ask !== 'angle')) expect(f.said.coach!.why, f.said.text).not.toMatch(/\bdifferent\b/)
    for (const f of wrong.filter((x) => x.said.idea === 'other' && x.ask === 'electron')) {
      const n = Object.entries(BY_GROUPS).find(([, g]) => g === f.pick)![0]
      expect(f.said.coach!.why, f.said.text).toContain(`does not have ${n} electron groups`)
    }
    // a counts question: the ask hands back a smaller question than the title
    for (const f of wrong.filter((x) => x.said.idea === 'other' && x.ask === 'molecular' && x.kind === 'counts' && x.tries === 1)) {
      expect(f.said.coach!.ask, f.said.text).not.toMatch(/^Find the molecular geometry with/)
      expect(f.said.coach!.ask, f.said.text).toMatch(/electron geometry/)
    }
  })
  it('COPY-5: the ideal-angle card does not say which way to go before the last try', () => {
    for (const f of wrong.filter((x) => x.said.idea === 'ideal' && x.tries === 1)) expect(f.said.coach!.ask, f.said.text).not.toMatch(/closer|smaller|less/)
  })
  it('COPY-6: a molecular geometry card never asks to count lone pairs as electron groups', () => {
    for (const f of wrong.filter((x) => x.ask === 'molecular')) expect(f.said.text, f.said.text).not.toMatch(/as electron groups too|pushes the atoms into other places/)
  })
  it('CHEMWORDS-2, COPY-7: row 2,3\'s angle card says the 3 lone pairs take the flat triangle and the 2 bonds are the top and bottom ones', () => {
    for (const pick of choicesFor('angle', rowOf('2,3')).filter((x) => x !== '180°' && !x.startsWith('less'))) {
      const s = card('2,3', 'angle', 'angle', pick)
      expect(s.coach!.why, pick).toMatch(/3 lone pairs take all 3 places in the flat triangle/)
      expect(s.coach!.why, pick).toMatch(/top and bottom/)
      expect(s.text, pick).not.toMatch(/Start from the bond angle/)
    }
  })
  it('COPY-14: the trigonal bipyramid rows with lone pairs say where the lone pairs sit in plain words, singular for 1', () => {
    for (const line of lines) expect(line, line).not.toMatch(/\bseats?\b/)
    expect(angleReason(rowOf('4,1'), 'sulfur')).toMatch(/^The lone pair on sulfur sits in the flat triangle of 3 places around sulfur/)
    expect(angleReason(rowOf('3,2'), 'chlorine')).toMatch(/^The 2 lone pairs on chlorine sit in the flat triangle of 3 places around chlorine/)
  })
  it('COPY-18, COPY-26: a name two rows share adds the row\'s lone pairs, in titles, the Next button and the known line', () => {
    const titles = ROW_KEYS.map((k) => learnLines(rowOf(k), 'nitrogen').title)
    expect(new Set(titles).size).toBe(13)
    expect(new Set(ROW_KEYS.map((k) => WORDS.nextTo(rowOf(k)))).size).toBe(13)
    expect(knownLine(rowOf('2,0'))).toBe(`Linear with no lone pairs is known: you got ${KNOWN_AT} questions in a row right on the first try.`)
    expect(knownLine(rowOf('2,2'))).toBe(`Bent with 2 lone pairs is known: you got ${KNOWN_AT} questions in a row right on the first try.`)
    expect(knownLine(rowOf('3,1'))).toBe(`Trigonal pyramidal is known: you got ${KNOWN_AT} questions in a row right on the first try.`)
  })
  it('COPY-21: the series line on lone pairs has the student count them, with no idea doing a person\'s job', () => {
    expect(learnLines(rowOf('2,1'), 'sulfur').difference).toBe(
      'Count the lone pair on sulfur as an electron group too, and the 3 groups make a trigonal planar electron geometry. Leave the lone pair out, and the 2 atoms make a bent molecular geometry.',
    )
    expect(learnLines(rowOf('6,0'), 'sulfur').difference).not.toMatch(/Count/)
    for (const k of ROW_KEYS) expect(learnLines(rowOf(k), 'sulfur').difference).not.toMatch(/geometry (counts|names)/)
  })
  it('COPY-24: no line says a geometry has lone pairs, and no line says "the lone pairs" for 1', () => {
    for (const line of lines) expect(line, line).not.toMatch(/This molecular geometry has|\bdo to it\b/)
    for (const f of wrong.filter((x) => T(x.key).pairs === 1)) expect(f.said.text, f.said.text).not.toMatch(/\bthe lone pairs (do|push)\b/)
  })
  it('COPY-25: a counts line has a subject and a verb', () => {
    for (const k of ROW_KEYS) {
      expect(learnLines(rowOf(k), 'sulfur').counts).toMatch(/^The middle atom has /)
      expect(questionLines('counts', rowOf(k), 'the middle atom').title).toMatch(/^The middle atom has /)
    }
  })
  it('COPY-29: the result line promises no return it cannot keep', () => {
    for (const first of [true, false]) for (const r of [true, false]) expect(resultLine(r, first)).not.toMatch(/after the next question/)
  })
})

// ---------------------------------------------------------------- fix check, round 2 (2026-11-17)

describe('round 2 of the fixes', () => {
  it('FQ-1: while a bond angle is asked, no card that can open states any bond angle, in its text or its picture', () => {
    let checked = 0
    for (const key of ROW_KEYS) {
      for (const p of moleculesFor(key)) {
        const blocked = blockedTerms(['angle'], rowOf(key), p.id)
        for (const id of ALL_TERMS.filter((x) => !blocked.includes(x))) {
          const c = termCard(id, null, null)
          expect(cardText(id), `${key} ${p.id}: the card for ${id}`).not.toMatch(/\d°/)
          expect(c.picture.kind === 'model' && c.picture.angle, `${key} ${p.id}: the picture of ${id} marks an angle`).toBe(false)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(100)
    // the case the check found: the bent card ("The bond angle is less than 109.5°") on row 2,1
    for (const p of moleculesFor('2,1')) expect(blockedTerms(['angle'], rowOf('2,1'), p.id), p.id).toContain('shape:bent')
  })
  it('FQ-2: a counts question on a row whose lone pairs take particular places says where they go', () => {
    const place: Record<RowKey, RegExp> = {
      '4,1': /The lone pair takes 1 of the 3 places in the flat triangle/,
      '3,2': /The 2 lone pairs take 2 of the 3 places in the flat triangle/,
      '2,3': /The 3 lone pairs take all 3 places in the flat triangle/,
      '4,2': /The 2 lone pairs take 2 places on opposite sides of the middle atom/,
    }
    for (const f of FEEDBACK.filter((x) => x.kind === 'counts' && x.ask === 'molecular' && !x.said.right && x.tries === 1 && place[x.key])) {
      expect(f.said.text, `${f.key} ${f.pick}`).toMatch(place[f.key]!)
      expect(f.said.text, f.said.text).not.toMatch(/leave out the (\d )?corners?/i)
    }
  })
  it('FQ-3: row 2,3\'s squeezed card asks for the angle between the top and bottom bonds', () => {
    for (const pick of choicesFor('angle', rowOf('2,3')).filter((x) => x.startsWith('less'))) {
      expect(feedbackFor('angle', rowOf('2,3'), 'the middle atom', pick, 1, 'angle').coach!.ask, pick).toBe('Pick the angle between the top bond and the bottom bond.')
    }
  })
  it('FQ-4: with the electron part held back, no molecular card names the electron geometry, for every row and pick', () => {
    for (const key of ROW_KEYS) {
      const st = missedElectron(key)
      for (const w of choicesFor('molecular', rowOf(key)).filter((c) => c !== T(key).molecular)) {
        const one = pick(st, w).st
        expect(one.q!.right, `${key} ${w}`).toBeNull()
        expect(panelText(one), `${key} ${w}`).not.toMatch(answerPattern('electron', rowOf(key)))
      }
    }
  })
  it('FQ-5: the how-to for picking is true with or without a keyboard, and gives the keys for the choices shown', () => {
    expect(howPick(5)).toBe('Tap a choice to pick it. With a keyboard, press 1 to 5: 1 picks the first choice.')
    const st = nextQuestion({ ...freshShapes(), phase: 'quiz' }, new Set())
    const n = st.q!.asks[0]!.choices.length
    expect(panelText(st)).toContain(howPick(n))
  })
})
