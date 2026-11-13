// The 3D board. Draws whatever structure it is given: atoms as balls, unshared electrons as beads
// on each ball, bonds as sticks carrying their two shared electrons. In the flat view the atoms sit
// on the board in their Lewis drawing; in the shape view the model lifts off the board and the
// electron groups around the center push apart (src/chem/repulsion.ts).
//
// The scene owns no chemistry. It reports gestures through callbacks and redraws on sync().
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { assess } from '../../chem/assess'
import { ELEMENTS, type El } from '../../chem/elements'
import { atomRadius, bondLength, layoutStep, slotsFor, type P2 } from '../../chem/layout2d'
import { bondWeight, isTextbook, makeDomains, normalize, textbookNear, tick, type Dom, type V3 } from '../../chem/repulsion'
import { atomById, bondsOf, formalCharge, shellCount, type Structure } from '../../chem/structure'
import { centerDomains } from '../../chem/vsepr'
import { Face } from './face'
import { Ripples, Sparks, glowTexture } from './fx'
import { BALL } from './palette'

export interface SceneCallbacks {
  tapAtom(id: string, viaKeyboard: boolean): void
  tapBond(id: string): void
  tapEmpty(): void
  bond(a: string, b: string): void
  place(el: El, at: P2 | null): void
  remove(id: string): void
  /** Something the hand should feel on a phone: an atom landing, a bond forming, a refused move. */
  feel?(kind: 'land' | 'bond' | 'refuse'): void
}

export interface SceneInput {
  s: Structure
  /** Atoms can be dragged, bonded and selected. */
  editable: boolean
  selection: { kind: 'atom' | 'bond'; id: string } | null
  view: 'flat' | 'shape'
  /** Count step: sample atoms in a fixed row. */
  specimen: boolean
  /** Electron count next to each atom. */
  showCounts: boolean
  /** Formal charge next to each atom that has one. */
  showCharges: boolean
  /** Per-atom shell report from the checker: id -> [count, target, status]. */
  shells: Map<string, { count: number; target: number; status: 'short' | 'full' | 'over' }>
  /** The last move the board refused: the atoms involved shake their heads. `n` goes up by one each time. */
  refused: { ids: string[]; n: number } | null
  /** Electron groups around the middle atom to ring after a wrong group count: its double and
   *  triple bonds, its lone pairs, or every group in turn. `n` goes up by one each time. */
  point: { n: number; which: 'multiple' | 'lone' | 'all' } | null
  /** Bond angles to mark on the 3D model: the angle each is close to in the textbook arrangement, and the words to print. */
  angles: { near: number; text: string; under: boolean }[]
}

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

const COLOR = { electron: 0xffc93c, electronGlow: 0xff9d00, ink: 0x3a3358, bond: 0x7467c2, bondSel: 0x5a4daa, board: 0xcfebdb, boardEdge: 0xb5dcc6, ring: 0x7467c2, drop: 0xffb81f, lobe: 0xffe08a }

const LIFT_HEIGHT = 2.5
const DOT_R = 0.085
/** Count step: the sample atoms and their dots are drawn this much larger. */
const SPECIMEN_SCALE = 1.75
const TILT = 0.34 // flat view: radians away from straight down
/** Width of the tray's raised rim, in board units. */
const RIM = 0.2

type Hit = { kind: 'atom'; id: string } | { kind: 'dot'; atomId: string } | { kind: 'bond'; id: string } | { kind: 'lobe'; dom: number } | null

interface AtomView {
  id: string
  el: El
  r: number
  mesh: THREE.Mesh
  /** A dark shell just behind the ball: the ink outline of a toy. */
  outline: THREE.Mesh
  label: THREE.Sprite
  face: Face
  /** The ball's shadow on the board. */
  shade: THREE.Mesh
  pos: THREE.Vector3
  grow: number
  /** Each atom bobs to its own rhythm. */
  phase: number
  /** Squash and stretch: 0 at rest, above 0 is taller and thinner. A spring pulls it back. */
  squash: number
  squashV: number
  /** Height above its resting place while a new atom drops in. */
  drop: number
  dropV: number
  landed: boolean
  /** Seconds of head-shake left after a refused move. */
  shake: number
  /** 0 to 1: the pointer is over this atom. */
  hover: number
  badge: HTMLElement
  charge: HTMLElement
  hit: HTMLButtonElement
}
interface DotView {
  key: string
  mesh: THREE.Group
  pos: THREE.Vector3
  grow: number
  dying: boolean
  /** Each electron jitters to its own rhythm. */
  phase: number
}

const v3 = (a: V3) => new THREE.Vector3(a[0], a[1], a[2])
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

function slerp(a: V3, b: V3, t: number): V3 {
  const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  const th = Math.acos(d)
  if (th < 1e-4) return b
  if (Math.PI - th < 1e-3) return normalize([a[0] + (b[0] - a[0]) * t + 0.02, a[1] + (b[1] - a[1]) * t + 0.02 * (1 - t) * t, a[2] + (b[2] - a[2]) * t])
  const s = Math.sin(th)
  const ka = Math.sin((1 - t) * th) / s
  const kb = Math.sin(t * th) / s
  return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb]
}
/** Some unit vector square to `d`. */
function perp(d: THREE.Vector3): THREE.Vector3 {
  const up = Math.abs(d.y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  return new THREE.Vector3().crossVectors(d, up).normalize()
}

/** A soft round shadow as a picture: dark in the middle, fading to nothing at the edge.
 *  Drawn shadows instead of the renderer's shadow maps: they look the same on every device
 *  (the iOS Simulator's web view drew shadow maps as a dark sheet over the whole board) and cost
 *  one flat square per atom. */
function blobTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const fade = g.createRadialGradient(64, 64, 6, 64, 64, 64)
  fade.addColorStop(0, 'rgba(74, 58, 140, 0.34)')
  fade.addColorStop(0.45, 'rgba(74, 58, 140, 0.2)')
  fade.addColorStop(1, 'rgba(74, 58, 140, 0)')
  g.fillStyle = fade
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class Scene {
  private readonly wrap: HTMLElement
  private readonly overlay: HTMLElement
  private readonly cb: SceneCallbacks
  private readonly positions: Map<string, P2>
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200)
  private readonly raycaster = new THREE.Raycaster()

  private readonly boardGroup = new THREE.Group()
  private readonly ballGeo = new THREE.SphereGeometry(1, 40, 28)
  private readonly dotGeo = new THREE.SphereGeometry(1, 18, 14)
  private readonly stickGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1)
  private readonly dotMat = new THREE.MeshStandardMaterial({ color: COLOR.electron, emissive: COLOR.electronGlow, emissiveIntensity: 0.55, roughness: 0.3 })
  private readonly glow = glowTexture()
  /** The halo around every electron. One material, so they all pulse together. */
  private readonly haloMat = new THREE.SpriteMaterial({ map: this.glow, color: 0xffc23a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })
  private readonly sparks: Sparks
  private readonly ripples: Ripples
  private readonly rimMat = new THREE.MeshBasicMaterial({ color: COLOR.ink, side: THREE.BackSide })
  private readonly stickMat = new THREE.MeshStandardMaterial({ color: COLOR.bond, roughness: 0.5 })
  private readonly stickSelMat = new THREE.MeshStandardMaterial({ color: COLOR.bondSel, roughness: 0.5, emissive: 0x7467c2, emissiveIntensity: 0.5 })
  private readonly lobeMat = new THREE.MeshStandardMaterial({ color: COLOR.lobe, transparent: true, opacity: 0, roughness: 0.7, depthWrite: false })
  private readonly labelTex = new Map<El, THREE.Texture>()
  private readonly blobGeo = new THREE.PlaneGeometry(1, 1)
  private readonly blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })

  private readonly atoms = new Map<string, AtomView>()
  private readonly sticks = new Map<string, THREE.Mesh>()
  private readonly bondHits = new Map<string, HTMLButtonElement>()
  private dots: DotView[] = []
  private readonly lobes: THREE.Mesh[] = []
  private readonly selRing: THREE.Mesh
  private readonly dropRing: THREE.Mesh
  private readonly rubber: THREE.Mesh
  private ghost: { el: El; mesh: THREE.Mesh; startX: number; startY: number; moved: boolean } | null = null

  private input: SceneInput = { s: { atoms: [], bonds: [], seq: 1 }, editable: false, selection: null, view: 'flat', specimen: false, showCounts: false, showCharges: false, shells: new Map(), refused: null, point: null, angles: [] }
  private insets: Insets = { top: 96, right: 16, bottom: 132, left: 16 }
  private halfW = 5.6
  private halfH = 3.5
  private boardKey = ''
  private flatDist = 20
  private orbitBase = 12
  /** Radius of a ball that holds the lifted model: the shape view zooms to it. */
  private modelR = 3
  private orbit = { az: 0.55, pol: 1.2, zoom: 1 }
  private dotsDirty = true
  private reduced = false
  /** Seconds since the scene started: the clock for every idle motion. */
  private time = 0
  /** Where the pointer last was on the board, and when: the atoms look at it. */
  private pointer: { at: THREE.Vector3; seen: number } | null = null
  private hoverId: string | null = null
  /** Bonds and electrons that just appeared: celebrated on the next frame, once positions are known. */
  private pending: ({ kind: 'bond'; a: string; b: string } | { kind: 'electron'; id: string })[] = []
  private refusedSeen = -1
  /** Dotted arcs between two bonds on the 3D model, each with the textbook angle printed beside it. */
  private arcs: { beads: THREE.InstancedMesh; mat: THREE.MeshBasicMaterial; label: HTMLElement; pair: [string, string] | null; show: number }[] = []
  private readonly beadGeo = new THREE.SphereGeometry(1, 10, 8)
  /** Atoms waiting for their turn to hop after a step is finished. */
  private cheers: { id: string; at: number }[] = []
  private pointSeen = -1
  /** Rings still to draw around electron groups: when, and how to find the group at that moment (atoms may still be moving). */
  private groupRings: { at: number; where: () => { x: number; z: number; from: number; to: number } | null }[] = []
  /** How many group rings have been drawn, for tests. */
  private ringed = 0
  /** Seconds since the 3D model was last touched; it turns slowly on its own after a pause. */
  private untouched = 0

  // shape view
  private liftRaw = 0
  private liftTarget = 0
  private centerId: string | null = null
  private doms: Dom[] = []
  private domAtoms: (string | null)[] = []
  private glide: { from: V3[]; to: V3[]; t: number; dur: number } | null = null
  private quiet = 0

  // pointer
  private press: { kind: 'atom' | 'dot' | 'bond' | 'empty' | 'orbit' | 'dom'; pointerId: number; id?: string; dom?: number; x: number; y: number; moved: boolean; grab?: P2 } | null = null
  private pinned: string | null = null
  private dropTarget: string | null = null
  private coarse = false
  private last = 0
  private raf = 0
  private readonly ro: ResizeObserver
  /** Told the board's size in board units whenever it changes. */
  onBoardSize: ((halfW: number, halfH: number) => void) | null = null

  constructor(wrap: HTMLElement, overlay: HTMLElement, positions: Map<string, P2>, cb: SceneCallbacks) {
    this.wrap = wrap
    this.overlay = overlay
    this.positions = positions
    this.cb = cb
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.domElement.className = 'mb-canvas'
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    wrap.appendChild(this.renderer.domElement)

    // A plain lit room for the balls to reflect: it is what makes them read as glossy candy.
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.scene.environmentIntensity = 0.5
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd6cff5, 1.55))
    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(-5, 14, 6)
    this.scene.add(sun)
    this.scene.add(this.boardGroup)
    this.sparks = new Sparks(this.scene, this.glow)
    this.ripples = new Ripples(this.scene)

    const ringGeo = new THREE.TorusGeometry(1, 0.05, 10, 64)
    ringGeo.rotateX(Math.PI / 2)
    this.selRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COLOR.ring }))
    this.dropRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COLOR.drop }))
    this.selRing.visible = false
    this.dropRing.visible = false
    this.scene.add(this.selRing, this.dropRing)
    this.rubber = new THREE.Mesh(this.stickGeo, new THREE.MeshBasicMaterial({ color: COLOR.drop, transparent: true, opacity: 0.85 }))
    this.rubber.visible = false
    this.scene.add(this.rubber)

    const el = this.wrap
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointercancel', this.onCancel)
    el.addEventListener('lostpointercapture', this.onCancel)
    el.addEventListener('pointerleave', this.onLeave)
    el.addEventListener('wheel', this.onWheel, { passive: false })

    this.ro = new ResizeObserver(() => this.fit())
    this.ro.observe(wrap)
    this.fit()
    void document.fonts?.load('900 64px "Nunito Variable"').then(() => this.refreshLabels())
    this.raf = requestAnimationFrame(this.frame)
  }

  /** Stop everything and let go of the canvas, listeners and GPU objects. The scene cannot be used afterwards. */
  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    const el = this.wrap
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointermove', this.onMove)
    el.removeEventListener('pointerup', this.onUp)
    el.removeEventListener('pointercancel', this.onCancel)
    el.removeEventListener('lostpointercapture', this.onCancel)
    el.removeEventListener('pointerleave', this.onLeave)
    el.removeEventListener('wheel', this.onWheel)
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose()
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
      for (const m of mats) {
        ;(m as THREE.Material & { map?: THREE.Texture | null }).map?.dispose()
        m.dispose()
      }
    })
    for (const tex of this.labelTex.values()) tex.dispose()
    this.scene.environment?.dispose()
    this.glow.dispose()
    this.overlay.replaceChildren()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ------------------------------------------------------------------ public

  setInsets(insets: Insets) {
    const same = (Object.keys(insets) as (keyof Insets)[]).every((k) => Math.abs(insets[k] - this.insets[k]) < 2)
    if (same) return
    this.insets = insets
    this.fit()
  }

  sync(input: SceneInput) {
    const before = this.input
    this.input = input
    const s = input.s

    // atoms
    for (const [id, view] of this.atoms) {
      // Gone, or the same id now names a different element: the Guided and Free build boards both
      // number their atoms from a1, so switching boards can swap what an id means.
      if (atomById(s, id)?.el !== view.el) {
        this.scene.remove(view.mesh, view.outline, view.label, view.shade, view.face.group)
        ;(view.mesh.material as THREE.Material).dispose()
        view.label.material.dispose()
        view.face.dispose()
        view.badge.remove()
        view.charge.remove()
        view.hit.remove()
        this.atoms.delete(id)
      }
    }
    this.placeSpecimens()
    for (const atom of s.atoms) {
      if (!this.positions.has(atom.id)) this.positions.set(atom.id, { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 })
      if (!this.atoms.has(atom.id)) this.atoms.set(atom.id, this.makeAtom(atom.id, atom.el))
    }

    // sticks: one mesh per line of each bond
    const wanted = new Set<string>()
    for (const b of s.bonds) for (let i = 0; i < b.order; i++) wanted.add(`${b.id}#${i}`)
    for (const [key, mesh] of this.sticks) {
      if (!wanted.has(key)) {
        this.scene.remove(mesh)
        this.sticks.delete(key)
      }
    }
    for (const key of wanted) {
      if (this.sticks.has(key)) continue
      const mesh = new THREE.Mesh(this.stickGeo, this.stickMat)
      mesh.userData.born = this.time
      this.scene.add(mesh)
      this.sticks.set(key, mesh)
    }
    // keyboard targets for bonds
    for (const [id, btn] of this.bondHits) {
      if (!s.bonds.some((b) => b.id === id)) {
        btn.remove()
        this.bondHits.delete(id)
      }
    }
    for (const b of s.bonds) {
      let btn = this.bondHits.get(b.id)
      if (!btn) {
        btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'mb-hit mb-hit-bond'
        btn.addEventListener('click', () => this.cb.tapBond(b.id))
        this.overlay.appendChild(btn)
        this.bondHits.set(b.id, btn)
      }
      const A = atomById(s, b.a)
      const B = atomById(s, b.b)
      const kind = b.order === 1 ? 'single' : b.order === 2 ? 'double' : 'triple'
      btn.setAttribute('aria-label', A && B ? `${ELEMENTS[A.el].name} to ${ELEMENTS[B.el].name.toLowerCase()} ${kind} bond` : 'bond')
      btn.disabled = !input.editable
    }

    // badges and keyboard targets for atoms
    for (const atom of s.atoms) {
      const view = this.atoms.get(atom.id)!
      const shell = input.shells.get(atom.id)
      const count = shell?.count ?? shellCount(s, atom.id)
      const target = shell?.target ?? 8
      // an expanded shell (sulfur in SF6 with 12) shows its count alone: "12 of 8" would read as a mistake
      const expanded = count > target && shell?.status === 'full'
      view.badge.innerHTML = expanded ? `<b>${count}</b>` : `<b>${count}</b><i>of ${target}</i>`
      view.badge.dataset.state = shell?.status ?? 'short'
      const fc = formalCharge(s, atom.id)
      view.charge.textContent = fc === 0 ? '' : `${Math.abs(fc) === 1 ? '' : Math.abs(fc)}${fc > 0 ? '+' : '−'}`
      view.charge.dataset.sign = fc > 0 ? 'plus' : 'minus'
      view.charge.hidden = fc === 0
      const bonds = bondsOf(s, atom.id).length
      view.hit.setAttribute(
        'aria-label',
        input.specimen
          ? `${ELEMENTS[atom.el].name} with ${atom.lone} ${atom.lone === 1 ? 'dot' : 'dots'}`
          : `${ELEMENTS[atom.el].name}: ${expanded ? count : `${count} of ${target}`} electrons, ${bonds} ${bonds === 1 ? 'bond' : 'bonds'}${fc ? `, formal charge ${fc > 0 ? '+' : '−'}${Math.abs(fc)}` : ''}`,
      )
      view.hit.disabled = !input.editable
      view.hit.setAttribute('aria-pressed', String(input.selection?.kind === 'atom' && input.selection.id === atom.id))
    }

    this.dotsDirty = true
    // what just happened on the board, for the sparks and hops on the next frame
    if (!input.specimen && !before.specimen && before.s !== s) {
      for (const b of s.bonds) {
        const was = before.s.bonds.find((x) => x.id === b.id)?.order ?? 0
        if (b.order > was && atomById(before.s, b.a) && atomById(before.s, b.b)) this.pending.push({ kind: 'bond', a: b.a, b: b.b })
      }
      if (s.bonds.length === before.s.bonds.length && s.bonds.every((b) => before.s.bonds.find((x) => x.id === b.id)?.order === b.order)) {
        for (const atom of s.atoms) {
          const was = atomById(before.s, atom.id)
          if (was && atom.lone > was.lone) this.pending.push({ kind: 'electron', id: atom.id })
        }
      }
    }
    // a refusal from before this board was opened is old news
    if (this.refusedSeen < 0) this.refusedSeen = input.refused?.n ?? 0
    if (input.refused && input.refused.n !== this.refusedSeen) {
      this.refusedSeen = input.refused.n
      for (const id of input.refused.ids) {
        const view = this.atoms.get(id)
        if (view) view.shake = 0.5
      }
      this.cb.feel?.('refuse')
    }
    // a wrong group count: ring the groups it was about (not ones from before this board was opened)
    if (this.pointSeen < 0) this.pointSeen = input.point?.n ?? 0
    if (before.s !== s || input.view !== 'flat') this.groupRings.length = 0
    if (input.point && input.point.n !== this.pointSeen) {
      this.pointSeen = input.point.n
      this.groupRings.length = 0
      if (input.view === 'flat') this.ringGroups(input.point.which)
    }
    if (input.view === 'shape' && (before.view !== 'shape' || before.s !== s)) this.enterShape()
    if (input.view === 'flat') this.liftTarget = 0
    if (!input.editable) {
      this.pinned = null
      this.dropTarget = null
    }
  }

  /** Count step: the sample atoms stand in a row across the middle of the board. */
  private placeSpecimens() {
    if (!this.input.specimen) return
    const atoms = this.input.s.atoms
    const step = Math.min(3.2, (this.halfW * 2 - 2.4) / Math.max(1, atoms.length - 1))
    atoms.forEach((atom, i) => this.positions.set(atom.id, { x: (i - (atoms.length - 1) / 2) * step, y: 0 }))
  }

  /** Called by the tray when a chip is pressed: the atom follows the pointer until it is dropped. */
  beginPlace(el: El, ev: PointerEvent) {
    if (this.ghost) return
    const mesh = new THREE.Mesh(this.ballGeo, new THREE.MeshStandardMaterial({ color: BALL[el].color, roughness: 0.42, transparent: true, opacity: 0.85 }))
    mesh.scale.setScalar(atomRadius(el))
    mesh.visible = false
    this.scene.add(mesh)
    this.ghost = { el, mesh, startX: ev.clientX, startY: ev.clientY, moved: false }
    const pointerId = ev.pointerId
    const move = (e: PointerEvent) => {
      const g = this.ghost
      if (!g || e.pointerId !== pointerId) return
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 6) g.moved = true
      const p = this.boardPoint(e.clientX, e.clientY, atomRadius(g.el))
      g.mesh.visible = g.moved && !!p
      if (p) {
        g.mesh.position.set(p.x, atomRadius(g.el) + 0.25, -p.y)
        this.pointer = { at: g.mesh.position.clone(), seen: this.time }
      }
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const g = this.ghost
      this.ghost = null
      if (!g) return
      this.scene.remove(g.mesh)
      ;(g.mesh.material as THREE.Material).dispose()
      if (e.type === 'pointercancel') return
      if (!g.moved) {
        this.cb.place(g.el, null)
        return
      }
      const rect = this.wrap.getBoundingClientRect()
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
      const p = inside ? this.boardPoint(e.clientX, e.clientY, atomRadius(g.el)) : null
      if (p && Math.abs(p.x) <= this.halfW && Math.abs(p.y) <= this.halfH) this.cb.place(g.el, p)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  /** A step was finished: every atom hops, one after another, with a few sparks. */
  /** Queues a ring around each of the named electron groups of the middle atom, one after another,
   *  then once more. A bonded atom gets a ring around it, a double or triple bond a ring around the
   *  bond, a lone pair a ring around its 2 electrons. */
  private ringGroups(which: 'multiple' | 'lone' | 'all') {
    const s = this.input.s
    const top = assess(s).topology
    if (top.kind !== 'star' || this.reduced) return
    const centerId = top.center
    type Spot = { x: number; z: number; from: number; to: number }
    const spots: (() => Spot | null)[] = []
    if (which !== 'lone') {
      for (const b of bondsOf(s, centerId)) {
        const otherId = b.a === centerId ? b.b : b.a
        if (which === 'all') {
          spots.push(() => {
            const other = this.atoms.get(otherId)
            return other ? { x: other.pos.x, z: other.pos.z, from: other.r * 0.9, to: other.r * 1.75 } : null
          })
        } else if (b.order > 1) {
          spots.push(() => {
            const f = this.bondFrame(b.a, b.b)
            return f ? { x: f.mid.x, z: f.mid.z, from: 0.22, to: 0.8 } : null
          })
        }
      }
    }
    if (which !== 'multiple') {
      const pairs = slotsFor(s, this.positions, centerId, this.pinned ?? undefined).groups.filter((g) => g.count === 2).length
      for (let k = 0; k < pairs; k++) {
        spots.push(() => {
          const center = this.atoms.get(centerId)
          const g = slotsFor(this.input.s, this.positions, centerId, this.pinned ?? undefined).groups.filter((x) => x.count === 2)[k]
          if (!center || !g) return null
          const reach = center.r + DOT_R * 0.55
          return { x: center.pos.x + Math.cos(g.angle) * reach, z: center.pos.z - Math.sin(g.angle) * reach, from: 0.16, to: 0.6 }
        })
      }
    }
    const beat = 0.34
    spots.forEach((where, i) => {
      for (const round of [0, 1]) this.groupRings.push({ where, at: this.time + 0.25 + i * beat + round * (spots.length * beat + 0.55) })
    })
  }

  cheer() {
    if (this.reduced) return
    let i = 0
    for (const atom of this.input.s.atoms) this.cheers.push({ id: atom.id, at: this.time + 0.09 * i++ })
  }

  // ------------------------------------------------------------------ build

  private labelTexture(el: El): THREE.Texture {
    const cached = this.labelTex.get(el)
    if (cached) return cached
    const c = document.createElement('canvas')
    c.width = c.height = 160
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    this.labelTex.set(el, tex)
    this.paintLabel(el, tex)
    return tex
  }
  private paintLabel(el: El, tex: THREE.Texture) {
    const c = tex.image as HTMLCanvasElement
    const g = c.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, c.width, c.height)
    g.font = `900 ${el.length > 1 ? 84 : 100}px "Nunito Variable", ui-rounded, system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = BALL[el].ink
    g.fillText(el, c.width / 2, c.height / 2 + 6)
    tex.needsUpdate = true
  }
  private refreshLabels() {
    for (const [el, tex] of this.labelTex) this.paintLabel(el, tex)
  }

  private makeAtom(id: string, el: El): AtomView {
    const r = atomRadius(el) * (this.input.specimen ? SPECIMEN_SCALE : 1)
    const mesh = new THREE.Mesh(this.ballGeo, new THREE.MeshPhysicalMaterial({ color: BALL[el].color, roughness: 0.34, clearcoat: 0.65, clearcoatRoughness: 0.3 }))
    const outline = new THREE.Mesh(this.ballGeo, this.rimMat)
    const face = new Face(BALL[el].color)
    // a soft round shadow on the board under the ball (see blobTexture)
    const shade = new THREE.Mesh(this.blobGeo, this.blobMat)
    shade.rotation.x = -Math.PI / 2
    shade.renderOrder = 1
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelTexture(el), transparent: true, depthWrite: false }))
    label.scale.setScalar(r * 1.24)
    label.renderOrder = 4
    this.scene.add(mesh, outline, label, shade, face.group)

    // both start invisible: the frame loop fades them in where the step shows them
    const badge = document.createElement('span')
    badge.className = 'mb-count'
    badge.style.opacity = '0'
    const charge = document.createElement('span')
    charge.className = 'mb-fc'
    charge.style.opacity = '0'
    charge.hidden = true
    const hit = document.createElement('button')
    hit.type = 'button'
    hit.className = 'mb-hit'
    hit.addEventListener('click', () => this.cb.tapAtom(id, true))
    this.overlay.append(hit, badge, charge)
    const p = this.positions.get(id) ?? { x: 0, y: 0 }
    // a new atom drops onto the board and lands with a bounce; the count step's samples just pop in
    const drops = !this.reduced && !this.input.specimen
    return {
      id, el, r, mesh, outline, label, face, shade, badge, charge, hit,
      pos: new THREE.Vector3(p.x, r, -p.y),
      grow: this.reduced ? 1 : drops ? 0.8 : 0.3,
      phase: Math.random() * 10,
      squash: 0,
      squashV: 0,
      drop: drops ? 1.3 : 0,
      dropV: 0,
      landed: !drops,
      shake: 0,
      hover: 0,
    }
  }

  private buildBoard() {
    const key = `${this.halfW}x${this.halfH}`
    if (key === this.boardKey) return
    this.boardKey = key
    for (const child of this.boardGroup.children) {
      const mesh = child as THREE.Mesh
      mesh.geometry.dispose()
      const mat = mesh.material as THREE.Material & { map?: THREE.Texture | null }
      mat.map?.dispose()
      mat.dispose()
    }
    this.boardGroup.clear()
    const w = this.halfW
    const h = this.halfH
    const rounded = (hw: number, hh: number, rad: number) => {
      const sh = new THREE.Shape()
      sh.moveTo(-hw + rad, -hh)
      sh.lineTo(hw - rad, -hh)
      sh.absarc(hw - rad, -hh + rad, rad, -Math.PI / 2, 0, false)
      sh.lineTo(hw, hh - rad)
      sh.absarc(hw - rad, hh - rad, rad, 0, Math.PI / 2, false)
      sh.lineTo(-hw + rad, hh)
      sh.absarc(-hw + rad, hh - rad, rad, Math.PI / 2, Math.PI, false)
      sh.lineTo(-hw, -hh + rad)
      sh.absarc(-hw + rad, -hh + rad, rad, Math.PI, Math.PI * 1.5, false)
      return sh
    }
    const floor = rounded(w, h, 0.7)

    // the tray's body: a thick slab whose sides show under the rim
    const slab = new THREE.ExtrudeGeometry(rounded(w + RIM, h + RIM, 0.7 + RIM), { depth: 0.5, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 3, curveSegments: 20 })
    slab.rotateX(-Math.PI / 2)
    slab.translate(0, -0.62, 0)
    this.boardGroup.add(new THREE.Mesh(slab, new THREE.MeshStandardMaterial({ color: 0x8fcdb0, roughness: 0.8 })))

    // the raised rim around the floor
    const ring = rounded(w + RIM, h + RIM, 0.7 + RIM)
    ring.holes.push(rounded(w, h, 0.7))
    const rim = new THREE.ExtrudeGeometry(ring, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 20 })
    rim.rotateX(-Math.PI / 2)
    rim.translate(0, -0.04, 0)
    this.boardGroup.add(new THREE.Mesh(rim, new THREE.MeshStandardMaterial({ color: 0xb4e2cc, roughness: 0.55 })))

    // the floor, painted once: mint that is lighter toward the upper left, darker at the edges,
    // with one small dot per board unit so movement across it is easy to see
    const px = 96
    const c = document.createElement('canvas')
    c.width = Math.round(w * 2 * px)
    c.height = Math.round(h * 2 * px)
    const g = c.getContext('2d')!
    g.fillStyle = '#d3eede'
    g.fillRect(0, 0, c.width, c.height)
    const light = g.createRadialGradient(c.width * 0.28, c.height * 0.22, 0, c.width * 0.28, c.height * 0.22, c.width * 0.75)
    light.addColorStop(0, 'rgba(255, 255, 255, 0.55)')
    light.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)')
    light.addColorStop(1, 'rgba(120, 190, 160, 0.22)')
    g.fillStyle = light
    g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = 'rgba(88, 168, 134, 0.42)'
    for (let x = -Math.floor(w) ; x <= Math.floor(w); x++) {
      for (let y = -Math.floor(h); y <= Math.floor(h); y++) {
        g.beginPath()
        g.arc((x + w) * px, (y + h) * px, px * 0.055, 0, Math.PI * 2)
        g.fill()
      }
    }
    // a soft inner shadow along the rim
    const edge = px * 0.5
    for (const [x0, y0, x1, y1] of [[0, 0, 0, edge], [0, c.height, 0, c.height - edge], [0, 0, edge, 0], [c.width, 0, c.width - edge, 0]] as const) {
      const fall = g.createLinearGradient(x0, y0, x1, y1)
      fall.addColorStop(0, 'rgba(60, 130, 100, 0.22)')
      fall.addColorStop(1, 'rgba(60, 130, 100, 0)')
      g.fillStyle = fall
      g.fillRect(0, 0, c.width, c.height)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const top = new THREE.Mesh(new THREE.ShapeGeometry(floor, 20), new THREE.MeshBasicMaterial({ map: tex }))
    // ShapeGeometry uvs are in board units; stretch the picture across the whole floor
    const uv = top.geometry.attributes.uv!
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + w) / (2 * w), (uv.getY(i) + h) / (2 * h))
    top.rotation.x = -Math.PI / 2
    top.position.y = 0.004
    this.boardGroup.add(top)
  }

  // ------------------------------------------------------------------ camera

  private safe() {
    const w = this.wrap.clientWidth || 1
    const h = this.wrap.clientHeight || 1
    const sw = Math.max(120, w - this.insets.left - this.insets.right)
    const sh = Math.max(120, h - this.insets.top - this.insets.bottom)
    return { w, h, sw, sh, cx: this.insets.left + sw / 2, cy: this.insets.top + sh / 2 }
  }

  private fit() {
    const { w, h, sw, sh, cx, cy } = this.safe()
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()

    // The board fills the safe area. On a narrow stage it is smaller in board units, so atoms
    // stay big enough to grab with a finger.
    const ratio = Math.max(0.55, Math.min(1.25, sh / sw))
    const halfW = sw >= 700 ? 4.3 : 3.1 + (Math.max(0, sw - 360) / 340) * 1.2
    this.halfW = Math.round(halfW * 10) / 10
    this.halfH = Math.round(Math.max(2.2, Math.min(3.8, halfW * ratio)) * 10) / 10
    this.buildBoard()
    this.placeSpecimens()
    this.onBoardSize?.(this.halfW, this.halfH)

    // flat view: the whole board, seen from just far enough away
    this.flatDist = this.fitRect(this.halfW + RIM + 0.12, this.halfH + RIM + 0.12)

    // shape view: a ball of radius 3 around the lifted model stays inside the safe area
    const t = Math.tan((this.camera.fov * Math.PI) / 360)
    this.orbitBase = Math.max(3.0 / (t * (sh / h)), 3.0 / (t * this.camera.aspect * (sw / w))) * 1.04

    // shift the picture so its center is the center of the safe area
    this.camera.setViewOffset(w, h, -(cx - w / 2), -(cy - h / 2), w, h)
    this.camera.updateProjectionMatrix()
  }

  /** The smallest camera distance at which a rectangle on the board is inside the safe area. */
  private fitRect(halfW: number, halfH: number): number {
    const { w, h, sw, sh } = this.safe()
    const cam = this.camera.clone()
    cam.clearViewOffset()
    cam.updateProjectionMatrix()
    const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => new THREE.Vector3(sx * halfW, 0, sz * halfH)))
    const fits = (d: number) => {
      cam.position.set(0, d * Math.cos(TILT), d * Math.sin(TILT))
      cam.lookAt(0, 0, 0)
      cam.updateMatrixWorld()
      return corners.every((c) => {
        const q = c.clone().project(cam)
        return Math.abs(q.x) * (w / 2) <= sw / 2 && Math.abs(q.y) * (h / 2) <= sh / 2
      })
    }
    let lo = 3
    let hi = 160
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2
      if (fits(mid)) hi = mid
      else lo = mid
    }
    return hi
  }
  private placeCamera(lift: number) {
    const flat = new THREE.Vector3(0, this.flatDist * Math.cos(TILT), this.flatDist * Math.sin(TILT))
    const R = this.orbitBase * (this.modelR / 3) * this.orbit.zoom
    const { az, pol } = this.orbit
    const orb = new THREE.Vector3(R * Math.sin(pol) * Math.sin(az), LIFT_HEIGHT * 0.9 + R * Math.cos(pol), R * Math.sin(pol) * Math.cos(az))
    this.camera.position.lerpVectors(flat, orb, lift)
    this.camera.lookAt(0, LIFT_HEIGHT * 0.9 * lift, 0)
    this.camera.updateMatrixWorld()
  }

  private toScreen(p: THREE.Vector3): { x: number; y: number } {
    const q = p.clone().project(this.camera)
    return { x: (q.x * 0.5 + 0.5) * this.wrap.clientWidth, y: (-q.y * 0.5 + 0.5) * this.wrap.clientHeight }
  }
  private pxRadius(p: THREE.Vector3, r: number): number {
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
    const a = this.toScreen(p)
    const b = this.toScreen(p.clone().addScaledVector(right, r))
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  private ray(clientX: number, clientY: number): THREE.Ray {
    const rect = this.wrap.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    return this.raycaster.ray
  }
  /** Remember where the pointer is, in the scene, so the atoms can look at it. */
  private watch(clientX: number, clientY: number) {
    let at: THREE.Vector3 | null = null
    if (this.liftRaw > 0.5) at = this.ray(clientX, clientY).closestPointToPoint(new THREE.Vector3(0, LIFT_HEIGHT, 0), new THREE.Vector3())
    else {
      const p = this.boardPoint(clientX, clientY, 0.5)
      if (p) at = new THREE.Vector3(p.x, 0.5, -p.y)
    }
    if (at) this.pointer = { at, seen: this.time }
  }
  /** Where the pointer meets the board, at ball height `y`. */
  private boardPoint(clientX: number, clientY: number, y: number): P2 | null {
    const hit = this.ray(clientX, clientY).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3())
    return hit ? { x: hit.x, y: -hit.z } : null
  }

  // ------------------------------------------------------------------ shape view

  private enterShape() {
    const s = this.input.s
    const top = assess(s).topology
    if (top.kind !== 'star') return
    this.centerId = top.center
    const d = centerDomains(s, top.center)
    this.doms = makeDomains(
      d.bonds.map((b) => bondWeight(b.order)),
      d.lonePairs,
    )
    this.domAtoms = [...d.bonds.map((b) => b.atomId), ...new Array<string | null>(d.lonePairs).fill(null)]

    // start from the flat drawing: each group points along its seat, nudged off the plane so it can move
    const slots = slotsFor(s, this.positions, top.center)
    const pairs = slots.groups.filter((g) => g.count === 2)
    this.doms.forEach((dom, i) => {
      const atomId = this.domAtoms[i]
      const seat = atomId ? slots.bonds.find((b) => b.id === atomId)?.angle : pairs[i - d.bonds.length]?.angle
      const a = seat ?? (i * Math.PI * 2) / this.doms.length
      dom.dir = normalize([Math.cos(a), i % 2 === 0 ? 0.05 : -0.05, -Math.sin(a)])
    })
    const center = atomById(s, top.center)
    let reach = (center ? atomRadius(center.el) : 0.5) + (d.lonePairs ? 0.95 : 0.3)
    for (const b of d.bonds) {
      const other = atomById(s, b.atomId)
      if (center && other) reach = Math.max(reach, bondLength(center.el, other.el, b.order) + atomRadius(other.el) + 0.45)
    }
    this.modelR = Math.max(2, Math.min(3.2, reach))

    const near = textbookNear(this.doms)
    const to = near ? this.upright(near) : null
    this.glide = to ? { from: this.doms.map((x) => x.dir), to, t: 0, dur: this.reduced ? 0.01 : 1.25 } : null
    this.orbit.az = this.clearView(to ?? this.doms.map((x) => x.dir))
    this.liftTarget = 1
    this.quiet = 0
  }

  /** The camera direction (angle around the vertical) from which the bonded atoms overlap least,
   *  so the shape is readable the moment it lifts. Ties go to the direction nearest the current one. */
  private clearView(dirs: V3[]): number {
    const atoms = dirs.filter((_, i) => this.domAtoms[i] !== null).map(v3)
    if (atoms.length < 2) return this.orbit.az
    const points = [new THREE.Vector3(), ...atoms.map((v) => v.multiplyScalar(1.7))]
    const pol = this.orbit.pol
    let best = this.orbit.az
    let bestGap = -1
    for (let k = 0; k < 36; k++) {
      const az = this.orbit.az + (k * Math.PI * 2) / 36
      const toCam = new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az))
      // drop the part of each point that lies along the line of sight: what is left is its place on screen
      const flat = points.map((q) => q.clone().addScaledVector(toCam, -q.dot(toCam)))
      let gap = Infinity
      for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) gap = Math.min(gap, flat[i]!.distanceTo(flat[j]!))
      if (gap > bestGap + 0.02) {
        bestGap = gap
        best = az
      }
    }
    return best
  }

  /** Turn a settled arrangement the way textbooks draw it: lone pairs on top (ammonia, water), and
   *  the two end seats of a trigonal bipyramid straight up and down. Then spin it about the
   *  vertical so the groups travel as little as possible from where they start. */
  private upright(dirs: V3[]): V3[] {
    const Y = new THREE.Vector3(0, 1, 0)
    const vecs = dirs.map(v3)
    const lone = vecs.filter((_, i) => this.doms[i]!.lone)
    let up: THREE.Vector3 | null = null
    if (vecs.length === 5) {
      // the pair of seats closest to opposite is the axis
      let widest = 0
      for (let i = 0; i < 5; i++)
        for (let j = i + 1; j < 5; j++) {
          const a = vecs[i]!.angleTo(vecs[j]!)
          if (a > widest) {
            widest = a
            up = vecs[i]!.clone().sub(vecs[j]!).normalize()
          }
        }
      if (up && up.y < 0) up.negate()
    } else if (lone.length) {
      const sum = lone.reduce((acc, v) => acc.add(v), new THREE.Vector3())
      up = sum.length() > 0.2 ? sum.normalize() : lone[0]!.clone()
    }
    if (up) {
      const q = new THREE.Quaternion().setFromUnitVectors(up, Y)
      for (const v of vecs) v.applyQuaternion(q)
    }
    const from = this.doms.map((d) => v3(d.dir))
    let best = vecs
    let bestCost = Infinity
    for (let k = 0; k < 48; k++) {
      const q = new THREE.Quaternion().setFromAxisAngle(Y, (k * Math.PI * 2) / 48)
      const turned = vecs.map((v) => v.clone().applyQuaternion(q))
      const cost = turned.reduce((sum, v, i) => sum + v.angleTo(from[i]!) ** 2, 0)
      if (cost < bestCost) {
        bestCost = cost
        best = turned
      }
    }
    return best.map((v) => [v.x, v.y, v.z] as V3)
  }

  private stepShape(dt: number) {
    if (this.glide) {
      const g = this.glide
      g.t = Math.min(1, g.t + dt / g.dur)
      const e = ease(g.t)
      this.doms.forEach((dom, i) => (dom.dir = slerp(g.from[i]!, g.to[i]!, e)))
      if (g.t >= 1) this.glide = null
      return
    }
    if (this.doms.length < 2) return
    const moved = tick(this.doms, dt)
    const dragging = this.press?.kind === 'dom'
    // "quiet" means slower than about 3 degrees per second
    this.quiet = moved / dt < 0.05 && !dragging ? this.quiet + dt : 0
    if (this.quiet > 0.25 && !isTextbook(this.doms)) {
      // came to rest in the wrong seats (a lone pair dragged to an axial seat): slide to the textbook arrangement
      const to = textbookNear(this.doms)
      if (to) this.glide = { from: this.doms.map((x) => x.dir), to, t: 0, dur: this.reduced ? 0.01 : 0.8 }
      this.quiet = 0
    }
  }

  // ------------------------------------------------------------------ frame

  private readonly frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    // a slow device still runs the model in real time (down to 10 frames per second); a tab that
    // was in the background does not jump ahead
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 0.016)
    this.last = now
    const { s } = this.input

    if (!this.input.specimen) layoutStep(s, this.positions, dt, { pinned: this.pinned, halfW: this.halfW, halfH: this.halfH })

    const speed = this.reduced ? 100 : 1 / 1.25
    this.liftRaw += Math.max(-speed * dt, Math.min(speed * dt, this.liftTarget - this.liftRaw))
    const lift = ease(this.liftRaw)
    if (this.liftRaw > 0) this.stepShape(dt)
    this.placeCamera(lift)

    this.time += dt
    const still = this.reduced
    const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
    const camUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1)
    const held = this.pinned ? this.atoms.get(this.pinned) : undefined
    // what the atoms look at: the atom in the student's hand, else wherever the pointer was a moment ago
    const gaze = held ? held.pos : this.pointer && this.time - this.pointer.seen < 2.5 ? this.pointer.at : null

    // atoms
    const centerPos = new THREE.Vector3(0, LIFT_HEIGHT + (still ? 0 : Math.sin(this.time * 1.2) * 0.06), 0)
    const centerAtom = this.centerId ? atomById(s, this.centerId) : undefined
    for (const atom of s.atoms) {
      const view = this.atoms.get(atom.id)
      const p = this.positions.get(atom.id)
      if (!view || !p) continue
      const pinned = atom.id === this.pinned

      // a new atom falls onto the board and bounces once
      if (view.drop > 0) {
        view.dropV -= 30 * dt
        view.drop += view.dropV * dt
        if (view.drop <= 0) {
          if (!view.landed) {
            view.landed = true
            view.squashV -= 6.5
            this.ripples.ping(p.x, -p.y, 0xffffff, view.r * 0.9, view.r * 2.8)
            this.cb.feel?.('land')
          }
          if (view.dropV < -3) {
            view.drop = 0.001
            view.dropV = -view.dropV * 0.3
          } else {
            view.drop = 0
            view.dropV = 0
          }
        }
      }
      // squash and stretch settle on a spring
      view.squashV += (-190 * view.squash - 14 * view.squashV) * dt
      view.squash = Math.max(-0.34, Math.min(0.4, view.squash + view.squashV * dt))
      const hot = atom.id === this.hoverId || atom.id === this.dropTarget ? 1 : 0
      view.hover += (hot - view.hover) * (1 - Math.exp(-14 * dt))
      // resting atoms bob gently, each to its own rhythm; a refused move makes an atom shake its head
      const bob = still || pinned ? 0 : Math.sin(this.time * 1.5 + view.phase) * 0.03 * (0.6 + view.r) * (1 - lift)
      let sway = 0
      if (view.shake > 0) {
        view.shake -= dt
        sway = Math.sin(view.shake * 46) * 0.08 * Math.min(1, view.shake / 0.25)
      }

      const flat = new THREE.Vector3(p.x + sway, view.r + (pinned ? 0.24 : 0) + view.drop + bob, -p.y)
      let target = flat
      if (lift > 0 && centerAtom) {
        if (atom.id === this.centerId) target = flat.clone().lerp(centerPos, lift)
        else {
          const i = this.domAtoms.indexOf(atom.id)
          const bond = bondsOf(s, atom.id)[0]
          if (i >= 0 && bond) {
            const L = bondLength(centerAtom.el, atom.el, bond.order)
            target = flat.clone().lerp(centerPos.clone().addScaledVector(v3(this.doms[i]!.dir), L), lift)
          }
        }
      }
      view.pos.copy(target)
      view.grow += (1 - view.grow) * (1 - Math.exp(-14 * dt))
      const size = view.r * view.grow * (1 + 0.06 * view.hover)
      const sq = view.squash
      // a squashed ball keeps its underside where it was
      const body = view.pos.clone()
      body.y += view.r * sq * (1 - lift)
      view.mesh.position.copy(body)
      view.mesh.scale.set(size * (1 - 0.45 * sq), size * (1 + sq), size * (1 - 0.45 * sq))
      view.outline.position.copy(body)
      view.outline.scale.copy(view.mesh.scale).multiplyScalar(1.05)
      const toCam = this.camera.position.clone().sub(body).normalize()
      // A squashed ball is wider than its radius and a stretched one taller, so the face and the
      // symbol ride in front of whichever is bigger and never sink into the ball.
      const bulge = size * Math.max(1 + sq, 1 - 0.45 * sq)
      // the symbol sits below the middle of the ball, under the eyes
      view.label.position.copy(body).addScaledVector(toCam, bulge * 1.03).addScaledVector(camUp, -size * 0.23)
      view.label.scale.setScalar(size * 1.24)
      view.face.update(dt, this.time, {
        center: body,
        radius: size,
        front: bulge * 1.02,
        toCam,
        right: camRight,
        up: camUp,
        quat: this.camera.quaternion,
        lookAt: gaze && gaze !== view.pos ? gaze : null,
        wide: pinned || view.shake > 0,
        content: this.input.shells.get(atom.id)?.status === 'full' && bondsOf(s, atom.id).length > 0,
        still,
      })
      // The shadow sits on the board a little to the right of the ball and toward the viewer, as
      // if lit from the upper left. A lifted ball casts a wider shadow, further off.
      const height = Math.max(0, view.pos.y - view.r)
      view.shade.position.set(view.pos.x + 0.1 + height * 0.16, 0.012, view.pos.z + 0.08 + height * 0.14)
      view.shade.scale.setScalar(view.r * view.grow * (2.75 + height * 0.5))
    }

    // what just happened: a new bond gets sparks and a hop from both atoms, a new electron a small pop
    for (const fx of this.pending) {
      if (still) break
      if (fx.kind === 'bond') {
        const f = this.bondFrame(fx.a, fx.b)
        if (!f) continue
        this.sparks.burst(f.mid, 0xffd15c, 14)
        this.ripples.ping(f.mid.x, f.mid.z, 0xffc23a, 0.25, 1.6)
        for (const v of [f.A, f.B]) {
          v.squashV += 6.5
          v.face.joy = 0.8
        }
      } else {
        const v = this.atoms.get(fx.id)
        if (!v) continue
        this.sparks.burst(v.pos.clone().add(new THREE.Vector3(0, v.r, 0)), 0xffd15c, 6, 1.5)
        v.squashV += 3.5
      }
    }
    if (this.pending.some((fx) => fx.kind === 'bond')) this.cb.feel?.('bond')
    if (this.cheers.length) {
      this.cheers = this.cheers.filter((c) => {
        if (c.at > this.time) return true
        const v = this.atoms.get(c.id)
        if (v) {
          v.squashV += 7
          v.face.joy = 1.1
          this.sparks.burst(v.pos.clone().add(new THREE.Vector3(0, v.r * 0.9, 0)), 0xffd15c, 5, 1.8)
        }
        return false
      })
    }
    this.pending.length = 0
    if (this.groupRings.length) {
      this.groupRings = this.groupRings.filter((g) => {
        if (g.at > this.time) return true
        const spot = g.where()
        if (spot) {
          // two rings, one inside the other, read as one thick ring
          this.ripples.ping(spot.x, spot.z, COLOR.ring, spot.from, spot.to, 1.1, 0.9)
          this.ripples.ping(spot.x, spot.z, COLOR.ring, spot.from * 0.82, spot.to * 0.9, 1.1, 0.9)
          this.ringed++
        }
        return false
      })
    }
    this.sparks.update(dt)
    this.ripples.update(dt)
    this.haloMat.opacity = still ? 0.45 : 0.42 + 0.14 * Math.sin(this.time * 2.2)

    // left alone, the lifted model turns slowly so every side comes into view
    if (this.liftRaw >= 1 && !still) {
      this.untouched += dt
      // the turn eases in over a second
      if (this.untouched > 2.5 && !this.press) this.orbit.az += dt * 0.16 * Math.min(1, this.untouched - 2.5)
    } else this.untouched = 0

    this.updateSticks()
    this.updateDots(dt, lift)
    this.updateLobes(lift)
    this.updateRings(lift)
    this.updateArcs(dt, lift)
    this.updateOverlay(lift)
    this.renderer.render(this.scene, this.camera)
  }

  private bondFrame(aId: string, bId: string) {
    const A = this.atoms.get(aId)
    const B = this.atoms.get(bId)
    if (!A || !B) return null
    const dir = B.pos.clone().sub(A.pos)
    const dist = dir.length() || 1
    dir.divideScalar(dist)
    const side = perp(dir)
    const gap = Math.max(0, dist - A.r - B.r)
    const mid = A.pos.clone().addScaledVector(dir, A.r + gap / 2)
    return { A, B, dir, side, dist, mid }
  }

  private updateSticks() {
    const sel = this.input.selection
    for (const b of this.input.s.bonds) {
      const f = this.bondFrame(b.a, b.b)
      if (!f) continue
      for (let i = 0; i < b.order; i++) {
        const mesh = this.sticks.get(`${b.id}#${i}`)
        if (!mesh) continue
        const off = (i - (b.order - 1) / 2) * 0.21
        mesh.position.copy(f.A.pos).addScaledVector(f.dir, f.dist / 2).addScaledVector(f.side, off)
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), f.dir)
        const selected = sel?.kind === 'bond' && sel.id === b.id
        // a new stick grows out from the middle and overshoots a little before it settles
        const age = Math.min(1, (this.time - ((mesh.userData.born as number | undefined) ?? -9)) / 0.32)
        const k = this.reduced ? 1 : 1 + 2.2 * (age - 1) ** 3 + 1.2 * (age - 1) ** 2
        const thick = (selected ? 0.085 : 0.065) * (0.5 + 0.5 * k)
        mesh.scale.set(thick, f.dist * Math.max(0.05, k), thick)
        mesh.material = selected ? this.stickSelMat : this.stickMat
      }
    }
  }

  /** Where every electron should be right now: `L:` unshared electrons on atoms, `B:` shared electrons on bonds. */
  private dotTargets(lift: number): Map<string, THREE.Vector3> {
    const out = new Map<string, THREE.Vector3>()
    const s = this.input.s
    for (const atom of s.atoms) {
      const view = this.atoms.get(atom.id)
      if (!view || atom.lone === 0) continue
      const big = this.input.specimen ? SPECIMEN_SCALE : 1
      const reach = view.r + DOT_R * big * 0.55
      const split = 0.135 * big
      const put = (dir: THREE.Vector3, tangent: THREE.Vector3, count: number, into: THREE.Vector3[]) => {
        if (count === 2) {
          into.push(view.pos.clone().addScaledVector(dir.clone().addScaledVector(tangent, split / reach).normalize(), reach))
          into.push(view.pos.clone().addScaledVector(dir.clone().addScaledVector(tangent, -split / reach).normalize(), reach))
        } else into.push(view.pos.clone().addScaledVector(dir, reach))
      }

      const flat: THREE.Vector3[] = []
      const slots = slotsFor(s, this.positions, atom.id, this.pinned ?? undefined)
      if (lift < 1) {
        for (const g of slots.groups) {
          const dir = new THREE.Vector3(Math.cos(g.angle), 0, -Math.sin(g.angle))
          put(dir, new THREE.Vector3(-Math.sin(g.angle), 0, -Math.cos(g.angle)), g.count, flat)
        }
      }
      const lifted: THREE.Vector3[] = []
      if (lift > 0 && this.centerId) {
        const counts = slots.groups.map((g) => g.count)
        if (atom.id === this.centerId) {
          const loneDoms = this.doms.filter((d) => d.lone)
          counts.forEach((count, k) => {
            const dom = loneDoms[k]
            const dir = dom ? v3(dom.dir) : new THREE.Vector3(0, 1, 0)
            put(dir, perp(dir), count, lifted)
          })
        } else {
          // an outer atom: its groups fan out behind it, away from the bond
          const i = this.domAtoms.indexOf(atom.id)
          const out3 = i >= 0 ? v3(this.doms[i]!.dir) : new THREE.Vector3(0, 1, 0)
          const u = perp(out3)
          const w = new THREE.Vector3().crossVectors(out3, u)
          const g = counts.length
          const polar = g === 1 ? 0 : g === 2 ? Math.PI / 3 : g === 3 ? 1.2310 : 1.4
          counts.forEach((count, k) => {
            const az = (k * Math.PI * 2) / g + 0.6
            const dir = out3
              .clone()
              .multiplyScalar(Math.cos(polar))
              .addScaledVector(u, Math.sin(polar) * Math.cos(az))
              .addScaledVector(w, Math.sin(polar) * Math.sin(az))
            const tangent = g === 1 ? u : new THREE.Vector3().crossVectors(out3, dir).normalize()
            put(dir, tangent, count, lifted)
          })
        }
      }
      for (let k = 0; k < atom.lone; k++) {
        const a = flat[k]
        const b = lifted[k]
        const p = a && b ? a.lerp(b, lift) : (b ?? a)
        if (p) out.set(`L:${atom.id}:${k}`, p)
      }
    }
    for (const b of s.bonds) {
      const f = this.bondFrame(b.a, b.b)
      if (!f) continue
      for (let i = 0; i < b.order; i++) {
        const off = (i - (b.order - 1) / 2) * 0.21
        const base = f.mid.clone().addScaledVector(f.side, off)
        const slide = this.reduced ? 0 : Math.sin(this.time * 1.7 + i * Math.PI + f.dist) * 0.05
        out.set(`B:${b.id}:${i}:0`, base.clone().addScaledVector(f.dir, -0.125 + slide))
        out.set(`B:${b.id}:${i}:1`, base.clone().addScaledVector(f.dir, 0.125 + slide))
      }
    }
    return out
  }

  private makeDot(key: string, at: THREE.Vector3): DotView {
    const group = new THREE.Group()
    const bead = new THREE.Mesh(this.dotGeo, this.dotMat)
    bead.scale.setScalar(DOT_R)
    const rim = new THREE.Mesh(this.dotGeo, this.rimMat)
    rim.scale.setScalar(DOT_R * 1.3)
    const halo = new THREE.Sprite(this.haloMat)
    halo.scale.setScalar(DOT_R * 4.6)
    halo.renderOrder = 3
    group.add(rim, bead, halo)
    this.scene.add(group)
    return { key, mesh: group, pos: at.clone(), grow: this.reduced ? 1 : 0, dying: false, phase: Math.random() * 20 }
  }

  private updateDots(dt: number, lift: number) {
    const targets = this.dotTargets(lift)
    if (this.dotsDirty) {
      this.dotsDirty = false
      // electrons that still have their place keep it; the rest travel to the nearest new place
      const live = this.dots.filter((d) => !d.dying)
      const free = new Map(targets)
      const homeless: DotView[] = []
      for (const d of live) {
        if (free.has(d.key)) free.delete(d.key)
        else homeless.push(d)
      }
      const pairs: { d: DotView; key: string; dist: number }[] = []
      for (const d of homeless) for (const [key, p] of free) pairs.push({ d, key, dist: d.pos.distanceTo(p) })
      pairs.sort((a, b) => a.dist - b.dist)
      const usedDots = new Set<DotView>()
      for (const { d, key } of pairs) {
        if (usedDots.has(d) || !free.has(key)) continue
        d.key = key
        usedDots.add(d)
        free.delete(key)
      }
      for (const d of homeless) if (!usedDots.has(d)) d.dying = true
      for (const [key, p] of free) this.dots.push(this.makeDot(key, p))
    }
    const k = 1 - Math.exp(-(this.reduced ? 60 : 15) * dt)
    for (const d of this.dots) {
      const t = targets.get(d.key)
      if (t && !d.dying) d.pos.lerp(t, k)
      d.grow += ((d.dying ? 0 : 1) - d.grow) * (1 - Math.exp(-16 * dt))
      const big = this.input.specimen ? SPECIMEN_SCALE : 1
      d.mesh.position.copy(d.pos)
      if (!this.reduced) {
        const w = 0.013 * big
        d.mesh.position.x += Math.cos(this.time * 1.9 + d.phase) * w
        d.mesh.position.y += Math.sin(this.time * 2.6 + d.phase * 1.3) * w * 0.9
        d.mesh.position.z += Math.sin(this.time * 2.1 + d.phase * 0.7) * w
      }
      d.mesh.scale.setScalar(Math.max(0.001, d.grow) * big)
    }
    this.dots = this.dots.filter((d) => {
      if (d.dying && d.grow < 0.03) {
        this.scene.remove(d.mesh)
        return false
      }
      return true
    })
  }

  private updateLobes(lift: number) {
    const lone = lift > 0 && this.centerId ? this.doms.filter((d) => d.lone) : []
    const center = this.centerId ? this.atoms.get(this.centerId) : undefined
    while (this.lobes.length < lone.length) {
      const m = new THREE.Mesh(this.ballGeo, this.lobeMat)
      m.renderOrder = 2
      this.scene.add(m)
      this.lobes.push(m)
    }
    this.lobeMat.opacity = 0.5 * lift
    this.lobes.forEach((m, i) => {
      const dom = lone[i]
      m.visible = !!dom && !!center && lift > 0.02
      if (!dom || !center) return
      const dir = v3(dom.dir)
      m.position.copy(center.pos).addScaledVector(dir, center.r + 0.2)
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      const breath = this.reduced ? 1 : 1 + 0.05 * Math.sin(this.time * 1.5 + i * 1.7)
      m.scale.set(0.4 * breath, 0.52 * breath, 0.4 * breath)
    })
  }

  private updateRings(lift: number) {
    const sel = this.input.selection
    const selView = sel?.kind === 'atom' ? this.atoms.get(sel.id) : undefined
    this.selRing.visible = !!selView && lift < 0.05
    if (selView) {
      this.selRing.position.set(selView.pos.x, 0.05, selView.pos.z)
      this.selRing.scale.setScalar(selView.r + 0.36)
    }
    const drop = this.dropTarget ? this.atoms.get(this.dropTarget) : undefined
    this.dropRing.visible = !!drop
    if (drop) {
      this.dropRing.position.set(drop.pos.x, 0.06, drop.pos.z)
      this.dropRing.scale.setScalar(drop.r + 0.42)
    }
  }

  private updateOverlay(lift: number) {
    const showFlat = lift < 0.25 && !this.input.specimen
    for (const view of this.atoms.values()) {
      const c = this.toScreen(view.pos)
      const rpx = this.pxRadius(view.pos, view.r)
      view.hit.style.transform = `translate(${c.x - rpx}px, ${c.y - rpx}px)`
      view.hit.style.width = view.hit.style.height = `${rpx * 2}px`
      const side = this.openSide(view, c)
      view.badge.style.transform = `translate(${c.x + side.x}px, ${c.y + side.y}px) translate(-50%, -50%)`
      view.badge.style.opacity = showFlat && this.input.showCounts ? '1' : '0'
      view.charge.style.transform = `translate(${c.x + rpx * 0.66}px, ${c.y - rpx * 0.66}px) translate(0, -100%)`
      view.charge.style.opacity = !this.input.specimen && this.input.showCharges ? '1' : '0'
    }
    for (const b of this.input.s.bonds) {
      const btn = this.bondHits.get(b.id)
      const f = this.bondFrame(b.a, b.b)
      if (!btn || !f) continue
      const c = this.toScreen(f.mid)
      btn.style.transform = `translate(${c.x - 14}px, ${c.y - 14}px)`
    }
  }

  /** The angle marks on the lifted model. An arc is drawn only while its two bonds really are at
   *  that angle, so it goes away while a student is pulling the model out of shape. */
  private updateArcs(dt: number, lift: number) {
    const marks = lift > 0.97 ? this.input.angles : []
    while (this.arcs.length < marks.length) {
      const mat = new THREE.MeshBasicMaterial({ color: COLOR.ink, transparent: true, opacity: 0, depthWrite: false })
      const beads = new THREE.InstancedMesh(this.beadGeo, mat, 48)
      beads.frustumCulled = false
      beads.renderOrder = 2
      this.scene.add(beads)
      const label = document.createElement('span')
      label.className = 'mb-angle'
      this.overlay.appendChild(label)
      this.arcs.push({ beads, mat, label, pair: null, show: 0 })
    }
    const center = this.centerId ? this.atoms.get(this.centerId) : undefined
    const outer = this.domAtoms.filter((id): id is string => !!id).map((id) => this.atoms.get(id)).filter((v): v is AtomView => !!v)
    const dirOf = (v: AtomView) => v.pos.clone().sub(center!.pos).normalize()
    const between = (a: AtomView, b: AtomView) => (Math.acos(Math.max(-1, Math.min(1, dirOf(a).dot(dirOf(b))))) * 180) / Math.PI
    const camUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1)
    const taken = new Set<string>()
    const m4 = new THREE.Matrix4()

    this.arcs.forEach((arc, k) => {
      const mark = marks[k]
      let want = 0
      let A: AtomView | undefined
      let B: AtomView | undefined
      if (mark && center && outer.length >= 2) {
        // "less than 109.5°" is met by anything a little under it; a plain number has to be matched closely
        const ok = (deg: number) => (mark.under ? deg <= mark.near + 1.5 && deg >= mark.near - 28 : Math.abs(deg - mark.near) <= 5)
        // How far the label for a pair of bonds would sit from the middle atom on screen, in
        // ball radii. Under about 1.3 the label would cover the ball.
        const clear = (a: AtomView, b: AtomView) => {
          const mid = dirOf(a).add(dirOf(b))
          if (mid.length() < 0.15) mid.copy(camUp)
          const at = center.pos.clone().addScaledVector(mid.normalize(), center.r + 0.9)
          const c0 = this.toScreen(center.pos)
          const c1 = this.toScreen(at)
          return Math.hypot(c1.x - c0.x, c1.y - c0.y) / Math.max(1, this.pxRadius(center.pos, center.r))
        }
        const held = arc.pair ? ([this.atoms.get(arc.pair[0]), this.atoms.get(arc.pair[1])] as const) : null
        const dragging = this.press?.kind === 'dom'
        const keep = held?.[0] && held[1] && outer.includes(held[0]) && outer.includes(held[1]) && !taken.has(`${held[0].id}|${held[1].id}`)
        if (keep && (dragging || (ok(between(held[0]!, held[1]!)) && clear(held[0]!, held[1]!) > 1.3))) [A, B] = held as readonly [AtomView, AtomView]
        else {
          // of the pairs of bonds at this angle that another mark has not taken, the one whose
          // label sits furthest out from the middle atom as seen from here
          let best = keep && ok(between(held[0]!, held[1]!)) ? clear(held[0]!, held[1]!) + 0.25 : -1
          if (best > 0) [A, B] = held as readonly [AtomView, AtomView]
          for (let i = 0; i < outer.length; i++) {
            for (let j = i + 1; j < outer.length; j++) {
              if (taken.has(`${outer[i]!.id}|${outer[j]!.id}`) || !ok(between(outer[i]!, outer[j]!))) continue
              const score = clear(outer[i]!, outer[j]!)
              if (score > best) {
                best = score
                A = outer[i]
                B = outer[j]
              }
            }
          }
          // a mark that moves to another pair of bonds fades in there
          if (A && B && (arc.pair?.[0] !== A.id || arc.pair[1] !== B.id)) arc.show = 0
          arc.pair = A && B ? [A.id, B.id] : null
        }
        if (A && B) {
          taken.add(`${A.id}|${B.id}`)
          taken.add(`${B.id}|${A.id}`)
          if (ok(between(A, B))) want = 1
        }
      }
      arc.show += (want - arc.show) * (1 - Math.exp(-(want ? 5 : 16) * dt))
      const visible = arc.show > 0.02 && !!A && !!B && !!center && !!mark
      arc.beads.visible = visible
      arc.label.style.opacity = visible ? String(Math.min(1, arc.show * 1.2)) : '0'
      if (!visible || !A || !B || !center || !mark) return

      const a = dirOf(A)
      const b = dirOf(B)
      const theta = Math.acos(Math.max(-1, Math.min(1, a.dot(b))))
      // the arc swings from one bond toward the other; two bonds on a straight line get an arc over the top
      let v = b.clone().addScaledVector(a, -a.dot(b))
      if (v.length() < 0.09) v = camUp.clone().addScaledVector(a, -a.dot(camUp))
      v.normalize()
      const reach = Math.min(A.pos.distanceTo(center.pos), B.pos.distanceTo(center.pos))
      const rho = center.r + 0.14 + (reach - center.r) * (k === 0 ? 0.3 : 0.52)
      const edge = Math.min(0.2, theta * 0.12)
      const n = Math.max(3, Math.min(48, Math.round(((theta - 2 * edge) * rho) / 0.105)))
      for (let i = 0; i < n; i++) {
        const phi = edge + ((theta - 2 * edge) * i) / (n - 1)
        const at = center.pos.clone().addScaledVector(a, Math.cos(phi) * rho).addScaledVector(v, Math.sin(phi) * rho)
        m4.makeScale(0.03, 0.03, 0.03).setPosition(at)
        arc.beads.setMatrixAt(i, m4)
      }
      arc.beads.count = n
      arc.beads.instanceMatrix.needsUpdate = true
      arc.mat.opacity = arc.show * 0.85
      const mid = center.pos.clone().addScaledVector(a, Math.cos(theta / 2) * (rho + 0.34)).addScaledVector(v, Math.sin(theta / 2) * (rho + 0.34))
      const c = this.toScreen(mid)
      if (arc.label.textContent !== mark.text) arc.label.textContent = mark.text
      arc.label.style.transform = `translate(${c.x}px, ${c.y}px) translate(-50%, -50%)`
    })
  }

  /** Screen offset from an atom's center to a spot clear of its bonds, for the electron count. */
  private openSide(view: AtomView, c: { x: number; y: number }): { x: number; y: number } {
    const rpx = this.pxRadius(view.pos, view.r)
    const angles = bondsOf(this.input.s, view.id)
      .map((b) => this.atoms.get(b.a === view.id ? b.b : b.a))
      .filter((o): o is AtomView => !!o)
      .map((o) => {
        const p = this.toScreen(o.pos)
        return Math.atan2(p.y - c.y, p.x - c.x)
      })
      .sort((a, b) => a - b)
    // no bonds: the lower right, between the dots. One bond: straight away from it. More: the widest gap.
    if (angles.length === 0) return { x: rpx * 0.8 + 8, y: rpx * 0.8 + 4 }
    let dir = angles[0]! + Math.PI
    if (angles.length > 1) {
      let widest = -1
      angles.forEach((a, i) => {
        const next = i + 1 < angles.length ? angles[i + 1]! : angles[0]! + Math.PI * 2
        if (next - a > widest + 1e-6) {
          widest = next - a
          dir = a + (next - a) / 2
        }
      })
    }
    const reach = rpx + 27
    return { x: Math.cos(dir) * reach, y: Math.sin(dir) * reach * 0.86 }
  }

  // ------------------------------------------------------------------ picking

  private pick(clientX: number, clientY: number, skipAtom?: string): Hit {
    const rect = this.wrap.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const slack = this.coarse ? 10 : 4

    if (this.liftRaw > 0.5) {
      let best: Hit = null
      let bestDepth = Infinity
      const consider = (p: THREE.Vector3, r: number, hit: Hit) => {
        const c = this.toScreen(p)
        if (Math.hypot(c.x - x, c.y - y) > this.pxRadius(p, r) + slack) return
        const depth = p.distanceTo(this.camera.position)
        if (depth < bestDepth) {
          bestDepth = depth
          best = hit
        }
      }
      this.domAtoms.forEach((id, i) => {
        const view = id ? this.atoms.get(id) : undefined
        if (view) consider(view.pos, view.r, { kind: 'lobe', dom: i })
      })
      const loneIdx = this.doms.map((d, i) => (d.lone ? i : -1)).filter((i) => i >= 0)
      this.lobes.forEach((m, i) => {
        if (m.visible && loneIdx[i] !== undefined) consider(m.position, 0.46, { kind: 'lobe', dom: loneIdx[i]! })
      })
      return best
    }

    // 1. a bead under the pointer
    const dotHit = (reach: number): Hit => {
      let best: Hit = null
      let bestD = reach
      for (const d of this.dots) {
        if (d.dying || !d.key.startsWith('L:')) continue
        const c = this.toScreen(d.pos)
        const dist = Math.hypot(c.x - x, c.y - y)
        if (dist < bestD) {
          bestD = dist
          best = { kind: 'dot', atomId: d.key.split(':')[1]! }
        }
      }
      return best
    }
    if (!skipAtom) {
      const tight = dotHit(this.pxRadius(new THREE.Vector3(), DOT_R) + 3)
      if (tight) return tight
    }
    // 2. an atom, when the pointer is on the ball itself
    const atomAt = (extra: number): Hit => {
      let found: Hit = null
      let bestRatio = Infinity
      for (const view of this.atoms.values()) {
        if (view.id === skipAtom) continue
        const c = this.toScreen(view.pos)
        const rpx = this.pxRadius(view.pos, view.r)
        const dist = Math.hypot(c.x - x, c.y - y)
        if (dist <= rpx + extra && dist / rpx < bestRatio) {
          bestRatio = dist / rpx
          found = { kind: 'atom', id: view.id }
        }
      }
      return found
    }
    // looking for a place to drop: only atoms count, with some slack
    if (skipAtom) return atomAt(slack)
    const onBall = atomAt(0)
    if (onBall) return onBall
    // 3. a bond. It comes before the slack around atoms: on a phone a bond is short, and a finger
    //    aimed at its middle is also within reach of the atoms at its ends.
    for (const b of this.input.s.bonds) {
      const f = this.bondFrame(b.a, b.b)
      if (!f) continue
      const p1 = this.toScreen(f.A.pos.clone().addScaledVector(f.dir, f.A.r))
      const p2 = this.toScreen(f.B.pos.clone().addScaledVector(f.dir, -f.B.r))
      const vx = p2.x - p1.x
      const vy = p2.y - p1.y
      const t = Math.max(0, Math.min(1, ((x - p1.x) * vx + (y - p1.y) * vy) / (vx * vx + vy * vy || 1)))
      if (Math.hypot(p1.x + vx * t - x, p1.y + vy * t - y) <= (this.coarse ? 14 : 9) + b.order * 3) return { kind: 'bond', id: b.id }
    }
    // 4. an atom the pointer just missed, then a bead near the pointer
    return atomAt(slack) ?? dotHit(this.coarse ? 22 : 13)
  }

  // ------------------------------------------------------------------ pointer

  private readonly onDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.press) return
    this.coarse = e.pointerType === 'touch'
    this.untouched = 0
    this.watch(e.clientX, e.clientY)
    const hit = this.pick(e.clientX, e.clientY)
    const base = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    if (this.liftRaw > 0.5) {
      this.press = hit?.kind === 'lobe' ? { ...base, kind: 'dom', dom: hit.dom } : { ...base, kind: 'orbit' }
      if (hit?.kind === 'lobe') {
        this.glide = null
        this.doms[hit.dom]!.pinned = true
      }
    } else if (!this.input.editable || !hit) this.press = { ...base, kind: 'empty' }
    else if (hit.kind === 'atom') {
      const p = this.positions.get(hit.id)
      const at = this.boardPoint(e.clientX, e.clientY, this.atoms.get(hit.id)?.r ?? 0.5)
      this.press = { ...base, kind: 'atom', id: hit.id, grab: p && at ? { x: at.x - p.x, y: at.y - p.y } : { x: 0, y: 0 } }
    } else if (hit.kind === 'dot') this.press = { ...base, kind: 'dot', id: hit.atomId }
    else if (hit.kind === 'bond') this.press = { ...base, kind: 'bond', id: hit.id }
    this.wrap.setPointerCapture(e.pointerId)
    this.wrap.classList.toggle('is-grabbing', this.press?.kind === 'atom' || this.press?.kind === 'dot' || this.press?.kind === 'dom')
  }

  private readonly onMove = (e: PointerEvent) => {
    const p = this.press
    this.watch(e.clientX, e.clientY)
    if (!p) {
      if (e.pointerType === 'mouse') {
        const hit = this.pick(e.clientX, e.clientY)
        const can = this.liftRaw > 0.5 ? hit !== null : this.input.editable && hit !== null
        this.wrap.classList.toggle('is-hot', can)
        this.hoverId = can && hit?.kind === 'atom' ? hit.id : null
      }
      return
    }
    this.untouched = 0
    // a second finger on the board does not take over the drag
    if (e.pointerId !== p.pointerId) return
    // the button was let go somewhere the release never reached this page (a context menu, another window)
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      this.release(e)
      return
    }
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.moved && Math.hypot(dx, dy) > (this.coarse ? 9 : 5)) p.moved = true
    if (!p.moved) return

    if (p.kind === 'orbit') {
      this.orbit.az -= (e.movementX || 0) * 0.008
      this.orbit.pol = Math.max(0.3, Math.min(1.62, this.orbit.pol - (e.movementY || 0) * 0.008))
    } else if (p.kind === 'dom' && p.dom !== undefined) {
      const center = new THREE.Vector3(0, LIFT_HEIGHT, 0)
      const atomId = this.domAtoms[p.dom]
      const view = atomId ? this.atoms.get(atomId) : undefined
      const R = view ? view.pos.distanceTo(center) || 1.6 : 0.9
      const ray = this.ray(e.clientX, e.clientY)
      const hit = ray.intersectSphere(new THREE.Sphere(center, R), new THREE.Vector3())
      const point = hit ?? ray.closestPointToPoint(center, new THREE.Vector3())
      const dir = point.sub(center).normalize()
      this.doms[p.dom]!.dir = [dir.x, dir.y, dir.z]
    } else if (p.kind === 'atom' && p.id) {
      this.pinned = p.id
      const at = this.boardPoint(e.clientX, e.clientY, this.atoms.get(p.id)?.r ?? 0.5)
      if (at && p.grab) this.positions.set(p.id, { x: at.x - p.grab.x, y: at.y - p.grab.y })
      const over = this.pick(e.clientX, e.clientY, p.id)
      this.dropTarget = over?.kind === 'atom' ? over.id : null
    } else if (p.kind === 'dot' && p.id) {
      const from = this.atoms.get(p.id)
      const at = this.boardPoint(e.clientX, e.clientY, from?.r ?? 0.5)
      const over = this.pick(e.clientX, e.clientY, p.id)
      this.dropTarget = over?.kind === 'atom' ? over.id : null
      if (from && at) {
        const end = new THREE.Vector3(at.x, from.pos.y, -at.y)
        const dir = end.clone().sub(from.pos)
        const len = dir.length()
        this.rubber.visible = len > 0.05
        this.rubber.position.copy(from.pos).addScaledVector(dir, 0.5)
        this.rubber.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
        this.rubber.scale.set(0.035, len, 0.035)
      }
    }
  }

  private readonly onUp = (e: PointerEvent) => {
    const p = this.press
    if (p && e.pointerId !== p.pointerId) return
    this.release(e)
    if (!p) return
    if (p.kind === 'dom' || p.kind === 'orbit') return
    if (!p.moved) {
      if (p.kind === 'atom' && p.id) this.cb.tapAtom(p.id, false)
      else if (p.kind === 'dot' && p.id) this.cb.tapAtom(p.id, false)
      else if (p.kind === 'bond' && p.id) this.cb.tapBond(p.id)
      else {
        // a tap on the bare board leaves a ring where it landed
        const at = this.liftRaw < 0.5 && !this.reduced ? this.boardPoint(e.clientX, e.clientY, 0) : null
        if (at && Math.abs(at.x) <= this.halfW && Math.abs(at.y) <= this.halfH) this.ripples.ping(at.x, -at.y, 0xffffff, 0.12, 0.9, 0.5)
        this.cb.tapEmpty()
      }
      return
    }
    const over = p.id ? this.pick(e.clientX, e.clientY, p.id) : null
    if ((p.kind === 'atom' || p.kind === 'dot') && p.id && over?.kind === 'atom') {
      this.cb.bond(p.id, over.id)
      return
    }
    if (p.kind === 'atom' && p.id) {
      const at = this.positions.get(p.id)
      if (at && (Math.abs(at.x) > this.halfW + 0.3 || Math.abs(at.y) > this.halfH + 0.3)) this.cb.remove(p.id)
    }
  }

  private readonly onCancel = (e: PointerEvent) => {
    if (!this.press || e.pointerId === this.press.pointerId) this.release(e)
  }

  private readonly onLeave = () => {
    this.hoverId = null
    this.pointer = null
  }

  private release(e: PointerEvent) {
    if (this.press?.kind === 'dom' && this.press.dom !== undefined && this.doms[this.press.dom]) this.doms[this.press.dom]!.pinned = false
    this.press = null
    this.pinned = null
    this.dropTarget = null
    this.rubber.visible = false
    this.quiet = 0
    this.wrap.classList.remove('is-grabbing')
    if (this.wrap.hasPointerCapture(e.pointerId)) this.wrap.releasePointerCapture(e.pointerId)
  }

  private readonly onWheel = (e: WheelEvent) => {
    if (this.liftRaw < 0.5) return
    e.preventDefault()
    this.untouched = 0
    this.orbit.zoom = Math.max(0.7, Math.min(1.6, this.orbit.zoom * Math.exp(e.deltaY * 0.0012)))
  }

  /** For tests driven through the page: where an atom or bond is on screen right now. */
  debugPoints() {
    const rect = this.wrap.getBoundingClientRect()
    const atoms = [...this.atoms.values()].map((v) => {
      const c = this.toScreen(v.pos)
      return { id: v.id, el: v.el, x: rect.left + c.x, y: rect.top + c.y, r: this.pxRadius(v.pos, v.r) }
    })
    const bonds = this.input.s.bonds.map((b) => {
      const f = this.bondFrame(b.a, b.b)
      const c = f ? this.toScreen(f.mid) : { x: 0, y: 0 }
      return { id: b.id, order: b.order, x: rect.left + c.x, y: rect.top + c.y }
    })
    const lobes = this.lobes.filter((m) => m.visible).map((m) => {
      const c = this.toScreen(m.position)
      return { x: rect.left + c.x, y: rect.top + c.y }
    })
    const dots = this.dots.filter((d) => !d.dying).map((d) => {
      const c = this.toScreen(d.pos)
      return { key: d.key, x: rect.left + c.x, y: rect.top + c.y }
    })
    return { atoms, bonds, lobes, dots, lift: this.liftRaw, ringed: this.ringed, board: { halfW: this.halfW, halfH: this.halfH } }
  }
  /** For tests: the angle in degrees between two bonded atoms as seen from the center, in the 3D model. */
  debugAngles(): number[] {
    const out: number[] = []
    const b = this.doms.filter((d) => !d.lone)
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) out.push((v3(b[i]!.dir).angleTo(v3(b[j]!.dir)) * 180) / Math.PI)
    return out
  }
}

