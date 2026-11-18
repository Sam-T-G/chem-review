// Every sentence the shapes quiz shows a student (src/modules/lewis/shapes/words.ts): the scan of
// the wording that tests/guide.test.ts does for the guided steps, every wrong-answer card checked
// against the shape table for every row and every wrong pick it can appear on, and the key-term
// cards that can open while a question is open. The table is written by hand from OpenStax
// Chemistry 2e, section 7.6.
import { describe, expect, it } from 'vitest'
import { ALL_TERMS, termCard, termPieces, type TermId } from '../src/modules/lewis/guide'
import { ROW_KEYS, TRIES, answerOf, choicesFor, rowOf, type Ask, type Kind, type RowKey } from '../src/modules/lewis/shapes/deck'
import {
  SENTENCES,
  WORDS,
  angleReason,
  answerPattern,
  blockedTerms,
  feedbackFor,
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
        expect(f.said.idea).toBe('swapped')
        // a counts question asks for the molecular geometry next, so its card does not name it
        if (f.kind === 'counts') expect(f.said.coach!.lead).toBe(`${f.pick.charAt(0).toUpperCase()}${f.pick.slice(1)} leaves out the ${t.pairs} lone pairs.`)
        else {
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
 *  none (as ui.ts does outside the guided steps). */
function reachable(text: string[], blocked: TermId[]): Set<TermId> {
  const seen = new Set<TermId>()
  const todo: TermId[] = []
  for (const line of text) for (const piece of termPieces(line)) if (piece.term && !blocked.includes(piece.term)) todo.push(piece.term)
  while (todo.length) {
    const id = todo.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const r of termCard(id, null, null).related) todo.push(r.id)
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
        const blocked = blockedTerms(asks, row)
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
    expect(checked).toBeGreaterThan(0)
  })
  it('still highlights words whose cards are safe', () => {
    const row = rowOf('2,0')
    const blocked = blockedTerms(['angle'], row)
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
