// The contract between the module and its parts. A part is a mode that brings its own panel and
// its own rules for the board: the shapes quiz (`shapes/`) and the exercises (`exercise/`). The
// guided steps and free build are the module's own modes and do not go through this file.
//
// `ui.ts` asks the part of the current mode for each region of the screen, hands it the presses
// and key strokes it does not know, and lets it change what the board draws. `store.ts` asks the
// part's state file (`shapes/state.ts`, `exercise/state.ts`) what is on the board and whether it
// can be edited. A part changes the state with `update()` from `store.ts`.
//
// A part file must not call into `ui.ts` or `store.ts` while it loads (no top-level calls): the
// three files import each other.
import type { SceneInput } from './scene'
import type { Cue, Mode, State } from './store'
import { exercisePart } from './exercise/part'
import { shapesPart } from './shapes/part'

export interface Part {
  /** The words on its tab above the board. */
  tab: string
  /** The guide panel, as HTML. */
  panel(s: State): string
  /** Names the screen the panel shows. When it changes, the whole panel leaves and the new one
   *  arrives, an open key term's card closes, and the panel scrolls to its top. */
  screen(s: State): string
  /** The electron counter above the board, as HTML. Leave out to keep the module's own. */
  ledger?(s: State): string
  /** The strip of checks under the counter, as list items. Leave out to keep the module's own. */
  checks?(s: State): string
  /** The row under the board (Undo, Clear, the atoms, the view switch). Leave out to keep the module's own. */
  dock?(s: State): string
  /** What the board draws. `base` is what the module would hand the board for this state. */
  scene?(s: State, base: SceneInput): SceneInput
  /** A press on a control that carries `data-act`, after the module's own actions did not match.
   *  Name a part's actions with its prefix (`sq-`, `ex-`). Return true when the press was handled. */
  act?(el: HTMLElement, s: State): boolean
  /** A change in a text field. Return true when the field was this part's. */
  input?(el: HTMLInputElement, s: State): boolean
  /** A key press anywhere in the module. Return true when it was handled. */
  key?(e: KeyboardEvent, s: State): boolean
  /** Where the next action is: the place that glows and that the hand points at. */
  cue?(s: State): Cue | null
  /** True once the question or molecule on screen is finished. The moment it turns true on the
   *  same screen, the atoms hop and paper flies from the panel's main button. */
  done?(s: State): boolean
  /** The key terms that may not open a card right now, because the card would give away an answer
   *  that is still open. The module refuses to open them and leaves their links out of every card
   *  it opens, so a part judges each card on its own text and never on the cards it links to. */
  blockedTerms?(s: State): ReadonlySet<string>
}

export const PARTS: Partial<Record<Mode, Part>> = { shapes: shapesPart, exercise: exercisePart }

/** The parts a student can open. A part that is built but still has review findings to fix stays
 *  out of this list: its tab is not drawn, and its route opens the guided steps. The home screen
 *  has the same switch for the two cards (`OPEN` in `src/modules/registry.ts`): change both together. */
export const OPEN_PARTS: readonly Mode[] = ['shapes', 'exercise']
