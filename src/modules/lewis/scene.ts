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
  /** A swipe across a bond's line: one line of that bond is cut. */
  cut(bondId: string): void
  /** An atom is being carried across the board (`id` and where the pointer is), or was just let go (`null`). */
  carry?(id: string | null, clientX: number, clientY: number): void
  /** An atom was let go at a point on the page. True when that took it off the board (it was dropped on the bin). */
  drop?(id: string, clientX: number, clientY: number): boolean
  /** A dipole arrow drawn from one atom to another. The arrow points at `to`. */
  drawBond(from: string, to: string): void
  /** The net dipole drawn on the lifted model: its direction on screen (x to the right, y up), each
   *  bond from the middle atom as the viewer sees it at that moment (unit vectors, z toward the
   *  viewer), and the drawn direction in the board's own 3D frame. */
  drawNet(drawn: { x: number; y: number }, seen: { atomId: string; dir: V3 }[], world: V3): void
  /** Puts an atom on the board and gives its id back, or null when the board did not take it. */
  place(el: El, at: P2 | null): string | null
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
  /** Bond dipoles to draw: an arrow beside each listed bond that points at its δ− atom (`out` 1:
   *  the outer atom, −1: the middle atom), with δ+ and δ− beside the atoms. `net` also draws the
   *  net dipole through the middle atom of the lifted model. `size` is the length of each bond's
   *  arrow when they are added up. The three labels are the words to print. Null draws nothing. */
  dipoles: { center: string; bonds: { atomId: string; out: -1 | 1; size: number }[]; net: boolean; plus: string; minus: string; netLabel: string } | null
  /** What a student can draw on the board now. 'bond': a dipole arrow from one atom to another,
   *  with a press, a drag and a release, or with a tap on each. 'net': the net dipole, dragged out
   *  of the middle atom of the lifted model. `aim` goes up by one each time the model should turn
   *  until the net dipole lies across the screen. `wrong` is the last arrow that was drawn wrong (a
   *  bond's arrow by its two atoms, the net dipole by its direction in the board's 3D frame): it
   *  stays on the board, in the color for mistakes, until the next arrow is started. `labels` is
   *  what a screen reader says for each atom an arrow can start or end on. Null: nothing. */
  draw: {
    kind: 'bond' | 'net'
    center: string
    aim: number
    wrong: { from: string; to: string } | { dir: V3 } | null
    labels: Record<string, string>
    /** What to print beside the arrow's head while it is being drawn: for a bond's arrow, by the
     *  atom it points at ("points at oxygen"). */
    captions: Record<string, string>
    /** The net dipole's aim points: small dots around the model, one beyond each bonded atom, one
     *  beyond each lone pair of the middle atom, one toward the middle of the bonded atoms and one
     *  straight away from it. An arrow dragged near a dot snaps to it, and a tap on a dot sets the
     *  arrow there. These are the words printed beside the arrow for each. Null for a bond's arrow. */
    aims: { atoms: Record<string, string>; lone: string; middle: string; away: string } | null
  } | null
  /** An atom dropped from the tray onto an atom on the board is bonded to it in the same move. */
  dropBonds: boolean
  /** Which electron groups of the middle atom the lifted model shows. 'all' (the default) draws the
   *  lone pairs with the bonded atoms: the electron geometry. 'atoms' leaves the lone pairs out, so
   *  only the atoms are seen: the molecular geometry. The groups keep their places either way. */
  groupsView?: 'all' | 'atoms'
}

interface ArrowView {
  g: SVGGElement
  /** Each part is drawn twice: a wide white copy underneath, so the arrow reads on any color. */
  shafts: SVGLineElement[]
  heads: SVGPathElement[]
  crosses: SVGLineElement[]
}
const SVG_NS = 'http://www.w3.org/2000/svg'

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
  /** Where the panels over the board's top end. On a phone the board reaches under part of the
   *  strip of checks (`top` is above this), but a label there would be hidden. */
  clear: number
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

  private input: SceneInput = { s: { atoms: [], bonds: [], seq: 1 }, editable: false, selection: null, view: 'flat', specimen: false, showCounts: false, showCharges: false, shells: new Map(), refused: null, point: null, angles: [], dipoles: null, draw: null, dropBonds: false }
  private insets: Insets = { top: 96, right: 16, bottom: 132, left: 16, clear: 96 }
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
  private pending: ({ kind: 'bond'; a: string; b: string } | { kind: 'dipole'; a: string; b: string } | { kind: 'electron'; id: string })[] = []
  private refusedSeen = -1
  /** Dotted arcs between two bonds on the 3D model, each with the textbook angle printed beside it. */
  private arcs: { beads: THREE.InstancedMesh; mat: THREE.MeshBasicMaterial; label: HTMLElement; pair: [string, string] | null; show: number }[] = []
  private readonly beadGeo = new THREE.SphereGeometry(1, 10, 8)
  /** Atoms waiting for their turn to hop after a step is finished. */
  private cheers: { id: string; at: number }[] = []
  /** The arrows for bond dipoles and the net dipole, drawn over the board. */
  private readonly dipoleSvg = document.createElementNS(SVG_NS, 'svg')
  private bondArrows: ArrowView[] = []
  private netArrow: ArrowView | null = null
  private netTag: HTMLElement | null = null
  private readonly deltaTags = new Map<string, HTMLElement>()
  /** For tests: how many bond dipoles the board was asked to draw and how many arrows are on screen
   *  (an arrow that points at the viewer is too short to draw), and the same for the net dipole. */
  private dipolesShown = { wanted: 0, bonds: 0, net: false, netDrawn: false }
  /** The arrow a student is drawing, and the last one that was drawn wrong. */
  private drawArrow: ArrowView | null = null
  private wrongArrow: ArrowView | null = null
  /** While an arrow is being drawn: where the pointer is, in the board's own pixels, and the atom under it. */
  private arrowTo: { x: number; y: number } | null = null
  private arrowOver: string | null = null
  /** The net dipole as the keyboard has turned it, in degrees counterclockwise from pointing right. Null while the keyboard is not drawing. */
  private keyAim: number | null = null
  /** Where the camera is turning to, so the net dipole lies across the screen. */
  private aim: { az: number; pol: number } | null = null
  private aimWanted = false
  /** A wrong net dipole that is no longer shown: the student pulled the model out of shape after
   *  drawing it, so the direction it was drawn in means something else now. */
  private wrongGone: V3 | null = null
  /** The net dipole's aim points as they are on screen now, the dots drawn for them, and the one the arrow has snapped to. */
  private aims: { x: number; y: number; label: string }[] = []
  private readonly aimDots: HTMLElement[] = []
  private aimNear = -1
  /** The words beside the head of the arrow that is being drawn. */
  private capTag: HTMLElement | null = null
  /** A swipe across the bare board: the line it has drawn so far, and the bonds it has cut. */
  private readonly cutPath = document.createElementNS(SVG_NS, 'polyline')
  private cutPoints: { x: number; y: number }[] = []
  private cutDone = new Set<string>()
  /** For tests: whether the arrow being drawn and the last wrong arrow are on screen, and which way a wrong net dipole points there (pixels, y down). */
  private drawnShown: { drawing: boolean; wrong: boolean; wrongWay: { x: number; y: number } | null } = { drawing: false, wrong: false, wrongWay: null }
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
  private press: { kind: 'atom' | 'dot' | 'bond' | 'empty' | 'cut' | 'orbit' | 'dom' | 'arrow' | 'aim'; pointerId: number; id?: string; dom?: number; x: number; y: number; moved: boolean; grab?: P2 } | null = null
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
    // `clear` only places labels, so a change to it alone does not move the camera.
    const same = (['top', 'right', 'bottom', 'left'] as const).every((k) => Math.abs(insets[k] - this.insets[k]) < 2)
    this.insets = same ? { ...this.insets, clear: insets.clear } : insets
    if (!same) this.fit()
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
        this.deltaTags.get(id)?.remove()
        this.deltaTags.delete(id)
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
      // while an arrow can be drawn, the atoms it can start or end on say so and take the keyboard
      const drawLabel = input.draw && !input.specimen && (input.draw.kind === 'bond' || atom.id === input.draw.center) ? input.draw.labels[atom.id] : undefined
      const selected = input.selection?.kind === 'atom' && input.selection.id === atom.id
      view.hit.setAttribute(
        'aria-label',
        drawLabel ??
          (input.specimen
            ? `${ELEMENTS[atom.el].name} with ${atom.lone} ${atom.lone === 1 ? 'dot' : 'dots'}`
            : `${ELEMENTS[atom.el].name}: ${expanded ? count : `${count} of ${target}`} electrons, ${bonds} ${bonds === 1 ? 'bond' : 'bonds'}${fc ? `, formal charge ${fc > 0 ? '+' : '−'}${Math.abs(fc)}` : ''}`),
      )
      view.hit.disabled = !input.editable && drawLabel === undefined
      view.hit.setAttribute('aria-pressed', String(selected))
      // on the lifted model there is no ring on the board under a selected atom, so the arrow's first atom is marked here
      view.hit.classList.toggle('is-start', selected && drawLabel !== undefined && input.view === 'shape')
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
    // a bond's arrow that was just drawn right, or the net dipole: sparks, and the atoms hop
    if (before.dipoles && input.dipoles && before.s === s && before.dipoles.center === input.dipoles.center) {
      const center = input.dipoles.center
      for (const b of input.dipoles.bonds) if (!before.dipoles.bonds.some((x) => x.atomId === b.atomId)) this.pending.push({ kind: 'dipole', a: center, b: b.atomId })
      if (input.dipoles.net && !before.dipoles.net) this.pending.push({ kind: 'dipole', a: center, b: center })
    }
    // the net dipole is to be drawn: the model turns until it lies across the screen
    if (input.draw?.kind === 'net') {
      if (before.draw?.kind !== 'net' || before.draw.aim !== input.draw.aim) this.aimWanted = true
    } else {
      this.keyAim = null
      this.aim = null
      this.aimWanted = false
    }
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
      if (p && Math.abs(p.x) <= this.halfW && Math.abs(p.y) <= this.halfH) {
        // dropped on an atom that is already on the board: put it beside that atom and bond the two
        const onto = this.input.dropBonds && this.liftRaw < 0.5 ? this.atomAt(e.clientX, e.clientY) : null
        const id = this.cb.place(g.el, p)
        if (id && onto) this.cb.bond(id, onto)
      }
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
    hit.addEventListener('click', () => this.hitClick(id))
    hit.addEventListener('keydown', (e) => this.hitKey(id, e))
    hit.addEventListener('blur', () => (this.keyAim = null))
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
    if (this.aimWanted && this.liftRaw >= 1 && !this.glide) {
      this.aimWanted = false
      this.aim = this.sideView()
    }
    if (this.aim && !this.press) {
      const k = this.reduced ? 1 : 1 - Math.exp(-5 * dt)
      const turn = Math.atan2(Math.sin(this.aim.az - this.orbit.az), Math.cos(this.aim.az - this.orbit.az))
      const tip = this.aim.pol - this.orbit.pol
      this.orbit.az += turn * k
      this.orbit.pol += tip * k
      if (Math.abs(turn) < 0.01 && Math.abs(tip) < 0.01) this.aim = null
    }
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
      const hot = atom.id === this.hoverId || atom.id === this.dropTarget || atom.id === this.arrowOver ? 1 : 0
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
      if (fx.kind === 'dipole') {
        const A = this.atoms.get(fx.a)
        const B = this.atoms.get(fx.b)
        if (!A || !B) continue
        this.sparks.burst(A.pos.clone().lerp(B.pos, 0.5), 0xffd15c, 10)
        for (const v of new Set([A, B])) {
          v.squashV += 5
          v.face.joy = 0.8
        }
      } else if (fx.kind === 'bond') {
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
    if (this.pending.some((fx) => fx.kind !== 'electron')) this.cb.feel?.('bond')
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
      // not while the net dipole is being drawn: the model has turned to show it from the side
      if (this.untouched > 2.5 && !this.press && this.input.draw?.kind !== 'net') this.orbit.az += dt * 0.16 * Math.min(1, this.untouched - 2.5)
    } else this.untouched = 0

    this.updateSticks()
    this.updateDots(dt, lift)
    this.updateLobes(lift)
    this.updateRings(lift)
    this.updateArcs(dt, lift)
    this.updateOverlay(lift)
    this.updateDipoles(lift)
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

  private makeArrow(kind: string): ArrowView {
    const g = document.createElementNS(SVG_NS, 'g')
    g.setAttribute('class', kind)
    const part = <K extends 'line' | 'path'>(tag: K, cls: string) => {
      const el = document.createElementNS(SVG_NS, tag)
      el.setAttribute('class', cls)
      g.appendChild(el)
      return el
    }
    // the white copies first, so they sit underneath
    const shafts = [part('line', 'is-under'), part('line', 'is-under')]
    const crosses = [part('line', 'is-under')]
    const heads = [part('path', 'is-under')]
    shafts.push(part('line', 'is-ink'), part('line', 'is-ink'))
    crosses.push(part('line', 'is-ink'))
    heads.push(part('path', 'is-ink'))
    this.dipoleSvg.appendChild(g)
    return { g, shafts, heads, crosses }
  }
  /** Draws an arrow from one screen point to another: a shaft (in two pieces when `gap` cuts a
   *  hole in it for an atom), a head at the far end, and a short cross near the start, the way
   *  a dipole arrow is drawn on paper. */
  private placeArrow(a: ArrowView, from: { x: number; y: number }, to: { x: number; y: number }, gap: { at: { x: number; y: number }; r: number } | null, head: number) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy)
    // A bond that points toward the viewer is short on screen. Its arrow gets a smaller head, and
    // is left out only when there is no room for an arrow at all.
    if (len < 11) {
      a.g.style.display = 'none'
      return false
    }
    head = Math.min(head, len / 2.6)
    a.g.style.display = ''
    const ux = dx / len
    const uy = dy / len
    const tip = { x: to.x - ux * head * 0.9, y: to.y - uy * head * 0.9 } // the shaft stops inside the head
    const line = (el: SVGLineElement, x1: number, y1: number, x2: number, y2: number) => {
      el.setAttribute('x1', x1.toFixed(1))
      el.setAttribute('y1', y1.toFixed(1))
      el.setAttribute('x2', x2.toFixed(1))
      el.setAttribute('y2', y2.toFixed(1))
    }
    for (let k = 0; k < 2; k++) {
      const first = a.shafts[k * 2]!
      const second = a.shafts[k * 2 + 1]!
      if (gap) {
        // the piece before the atom and the piece after it
        const along = (gap.at.x - from.x) * ux + (gap.at.y - from.y) * uy
        const before = Math.max(0, along - gap.r)
        const after = Math.min(len - head * 0.9, along + gap.r)
        line(first, from.x, from.y, from.x + ux * before, from.y + uy * before)
        line(second, from.x + ux * after, from.y + uy * after, tip.x, tip.y)
        second.style.display = ''
      } else {
        line(first, from.x, from.y, tip.x, tip.y)
        second.style.display = 'none'
      }
      const at = Math.min(len * 0.2, head * 1.6)
      const cx = from.x + ux * at
      const cy = from.y + uy * at
      line(a.crosses[k]!, cx - uy * head * 0.62, cy + ux * head * 0.62, cx + uy * head * 0.62, cy - ux * head * 0.62)
      const bx = to.x - ux * head * 1.25
      const by = to.y - uy * head * 1.25
      a.heads[k]!.setAttribute('d', `M${to.x.toFixed(1)} ${to.y.toFixed(1)}L${(bx - uy * head * 0.7).toFixed(1)} ${(by + ux * head * 0.7).toFixed(1)}L${(bx + uy * head * 0.7).toFixed(1)} ${(by - ux * head * 0.7).toFixed(1)}Z`)
    }
    return true
  }

  /** Bond dipoles as arrows beside their bonds, δ+ and δ− beside the atoms, and on the lifted
   *  model the net dipole through the middle atom. The net arrow is the sum of the bond arrows as
   *  the model has them now, so it swings when a student pulls an atom aside. */
  private updateDipoles(lift: number) {
    const d = this.input.specimen ? null : this.input.dipoles
    const center = d ? this.atoms.get(d.center) : undefined
    const bonds = d && center ? d.bonds : []
    if (!this.dipoleSvg.isConnected) {
      this.dipoleSvg.setAttribute('class', 'mb-dipoles')
      this.dipoleSvg.setAttribute('aria-hidden', 'true')
      this.overlay.appendChild(this.dipoleSvg)
    }
    while (this.bondArrows.length < bonds.length) this.bondArrows.push(this.makeArrow('mb-dipole'))
    const signs = new Map<string, string>()
    let shown = 0
    this.bondArrows.forEach((arrow, i) => {
      const b = bonds[i]
      const other = b ? this.atoms.get(b.atomId) : undefined
      if (!d || !b || !other || !center) {
        arrow.g.style.display = 'none'
        return
      }
      const { start, end } = this.besideBond(center, other)
      const ok = b.out === 1 ? this.placeArrow(arrow, start, end, null, 9) : this.placeArrow(arrow, end, start, null, 9)
      if (ok) shown++
      signs.set(b.atomId, b.out === 1 ? d.minus : d.plus)
      // the middle atom carries the other sign, unless its bonds disagree
      const mine = b.out === 1 ? d.plus : d.minus
      signs.set(d.center, signs.has(d.center) && signs.get(d.center) !== mine ? '' : mine)
    })

    // δ+ and δ− beside the atoms: outside an outer atom, and on the open side of the middle atom
    for (const [id, tag] of this.deltaTags) {
      if (!signs.get(id)) tag.style.opacity = '0'
    }
    if (d && center) {
      const pc = this.toScreen(center.pos)
      let mx = 0
      let my = 0
      for (const b of bonds) {
        const other = this.atoms.get(b.atomId)
        if (!other) continue
        const po = this.toScreen(other.pos)
        const len = Math.hypot(po.x - pc.x, po.y - pc.y) || 1
        mx += (po.x - pc.x) / len
        my += (po.y - pc.y) / len
      }
      for (const [id, text] of signs) {
        const view = this.atoms.get(id)
        if (!view || !text) continue
        let tag = this.deltaTags.get(id)
        if (!tag) {
          tag = document.createElement('span')
          tag.className = 'mb-delta'
          tag.setAttribute('aria-hidden', 'true') // the panel says the same in words
          this.overlay.appendChild(tag)
          this.deltaTags.set(id, tag)
        }
        const c = this.toScreen(view.pos)
        const r = this.pxRadius(view.pos, view.r)
        let ox: number
        let oy: number
        if (id === d.center) {
          // away from where most of the bonds go; up and to the left when they go every way
          const m = Math.hypot(mx, my)
          ox = m > 0.35 ? -mx / m : -0.7
          oy = m > 0.35 ? -my / m : -0.7
        } else {
          const len = Math.hypot(c.x - pc.x, c.y - pc.y) || 1
          ox = (c.x - pc.x) / len
          oy = (c.y - pc.y) / len
        }
        tag.textContent = text
        tag.dataset.sign = text === d.minus ? 'minus' : 'plus'
        tag.style.transform = `translate(${(c.x + ox * (r + 15)).toFixed(1)}px, ${(c.y + oy * (r + 15)).toFixed(1)}px) translate(-50%, -50%)`
        tag.style.opacity = '1'
      }
    }

    // the net dipole, on the lifted model only: the flat drawing does not have the real angles
    let net = false
    let netWanted = false
    if (d && d.net && center && lift > 0.97) {
      const sum = this.netDir()
      if (sum) {
        netWanted = true
        if (!this.netArrow) this.netArrow = this.makeArrow('mb-dipole is-net')
        if (!this.netTag) {
          this.netTag = document.createElement('span')
          this.netTag.className = 'mb-delta is-net'
          this.netTag.setAttribute('aria-hidden', 'true')
          this.overlay.appendChild(this.netTag)
        }
        const from = this.toScreen(center.pos.clone().addScaledVector(sum, -(center.r + 0.4)))
        const to = this.toScreen(center.pos.clone().addScaledVector(sum, center.r + 1.35))
        const pc = this.toScreen(center.pos)
        const rc = this.pxRadius(center.pos, center.r)
        // When the net dipole points along one bond (one polar bond among nonpolar ones), an arrow
        // through the middle atom would land on that bond's outer atom. It is drawn beside the
        // bond, on the upper side, where the bond's own arrow is not.
        const along = bonds.map((b) => this.atoms.get(b.atomId)).find((o) => o && o.pos.clone().sub(center.pos).normalize().dot(sum) > 0.9)
        if (along) {
          const len = Math.hypot(to.x - from.x, to.y - from.y) || 1
          const ux = (to.x - from.x) / len
          const uy = (to.y - from.y) / len
          const side = ux >= 0 ? -1 : 1
          const off = Math.max(rc, this.pxRadius(along.pos, along.r)) + 16
          const shift = { x: -uy * side * off, y: ux * side * off }
          from.x = pc.x + shift.x
          from.y = pc.y + shift.y
          to.x += shift.x
          to.y += shift.y
          net = this.placeArrow(this.netArrow, from, to, null, 13)
        } else net = this.placeArrow(this.netArrow, from, to, { at: pc, r: rc + 4 }, 13)
        if (net) {
          const len = Math.hypot(to.x - from.x, to.y - from.y) || 1
          this.netTag.textContent = d.netLabel
          let tx = to.x + ((to.x - from.x) / len) * 16
          let ty = to.y + ((to.y - from.y) / len) * 16
          // Past the arrowhead the label can land under the panels over the board's top (on a
          // phone, the strip of checks). Then it sits beside the arrowhead, on the side the arrow
          // leans toward, and below the panels.
          const tw = this.netTag.offsetWidth
          const th = this.netTag.offsetHeight
          if (ty - th / 2 < this.insets.clear + 4) {
            const side = to.x - from.x >= 0 ? 1 : -1
            tx = to.x + side * (tw / 2 + 14)
            ty = Math.max(to.y, this.insets.clear + 4 + th / 2)
            const W = this.wrap.clientWidth
            if (tx + tw / 2 > W - 8 || tx - tw / 2 < 8) tx = to.x - side * (tw / 2 + 14)
          }
          this.netTag.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) translate(-50%, -50%)`
        }
      }
    }
    if (this.netArrow && !net) this.netArrow.g.style.display = 'none'
    if (this.netTag) this.netTag.style.opacity = net ? '1' : '0'
    this.dipolesShown = { wanted: bonds.length, bonds: shown, net: netWanted, netDrawn: net }
    this.updateDrawn(lift)
  }

  /** The two ends of an arrow beside a bond, from near the middle atom to near the outer atom. It
   *  sits on the side of the bond that is lower on screen, where no face is. */
  private besideBond(center: AtomView, other: AtomView): { start: { x: number; y: number }; end: { x: number; y: number } } {
    const pc = this.toScreen(center.pos)
    const po = this.toScreen(other.pos)
    const rc = this.pxRadius(center.pos, center.r)
    const ro = this.pxRadius(other.pos, other.r)
    const dx = po.x - pc.x
    const dy = po.y - pc.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const side = ux >= 0 ? 1 : -1
    const off = Math.min(rc, ro) * 0.62 + 7
    const nx = -uy * side * off
    const ny = ux * side * off
    return { start: { x: pc.x + ux * rc * 0.3 + nx, y: pc.y + uy * rc * 0.3 + ny }, end: { x: po.x - ux * ro * 0.3 + nx, y: po.y - uy * ro * 0.3 + ny } }
  }

  /** The bond dipoles on the board added up as the model has them now, as a direction. Null when
   *  they cancel or there are none. */
  private netDir(): THREE.Vector3 | null {
    const d = this.input.dipoles
    const center = d ? this.atoms.get(d.center) : undefined
    if (!d || !center) return null
    const sum = new THREE.Vector3()
    for (const b of d.bonds) {
      const other = this.atoms.get(b.atomId)
      if (other) sum.addScaledVector(other.pos.clone().sub(center.pos).normalize(), b.out * b.size)
    }
    const biggest = Math.max(1, ...d.bonds.map((b) => b.size))
    return sum.length() > biggest * 0.12 ? sum.normalize() : null
  }

  /** The camera direction for drawing the net dipole: the turn around the vertical, nearest the
   *  current one, that shows the net dipole from the side with no atom in front of another. A net
   *  dipole that points up or down is seen from the side at any turn, unless the camera looks down
   *  from above. */
  private sideView(): { az: number; pol: number } | null {
    const n = this.netDir()
    const center = this.centerId ? this.atoms.get(this.centerId) : undefined
    if (!n || !center) return null
    const pol = Math.abs(n.y) > 0.6 ? Math.max(this.orbit.pol, 1.2) : this.orbit.pol
    const points = [new THREE.Vector3(), ...[...this.atoms.values()].filter((v) => v !== center).map((v) => v.pos.clone().sub(center.pos))]
    const views = Array.from({ length: 72 }, (_, k) => {
      // the nearest turns first: none, 5° one way, 5° the other, 10° ...
      const az = this.orbit.az + (Math.ceil(k / 2) * (k % 2 ? 1 : -1) * Math.PI * 2) / 72
      const toCam = new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az))
      // drop the part of each atom's place that lies along the line of sight: what is left is its place on screen
      const flat = points.map((q) => q.clone().addScaledVector(toCam, -q.dot(toCam)))
      let gap = Infinity
      for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) gap = Math.min(gap, flat[i]!.distanceTo(flat[j]!))
      return { az, along: Math.abs(toCam.dot(n)), gap }
    })
    // "from the side" is within about 17° of it; when no turn gets that close, the closest ones count
    const least = Math.min(...views.map((v) => v.along))
    const side = views.filter((v) => v.along <= Math.max(0.3, least + 0.05))
    // atoms 0.9 apart on screen do not cover each other; when no turn gives that, the widest gap counts
    const enough = Math.min(0.9, Math.max(...side.map((v) => v.gap)) - 0.05)
    const best = side.find((v) => v.gap >= enough) ?? side[0]!
    return { az: best.az, pol }
  }

  /** The aim points for the net dipole, where they are on screen now, and the dots drawn for them.
   *  One beyond each bonded atom, one beyond each lone pair of the middle atom, one toward the
   *  middle of the bonded atoms and one straight away from it. Two that point the same way count
   *  once, and one that points at the viewer or away is left out, because no arrow on screen can
   *  point there. */
  private placeAims(lift: number) {
    const d = this.input.specimen ? null : this.input.draw
    const center = d ? this.atoms.get(d.center) : undefined
    const found: { x: number; y: number; label: string }[] = []
    const words = d?.kind === 'net' ? d.aims : null
    if (d && words && center && lift > 0.97) {
      const ways: { dir: THREE.Vector3; far: number; label: string }[] = []
      const add = (dir: THREE.Vector3, far: number, label: string) => {
        if (dir.lengthSq() < 1e-6 || !label) return
        dir.normalize()
        if (!ways.some((w) => w.dir.angleTo(dir) < 0.3)) ways.push({ dir, far, label })
      }
      const sum = new THREE.Vector3()
      for (const b of bondsOf(this.input.s, d.center)) {
        const other = this.atoms.get(b.a === d.center ? b.b : b.a)
        if (!other) continue
        const v = other.pos.clone().sub(center.pos)
        add(v.clone(), v.length() + other.r + 0.42, words.atoms[other.id] ?? '')
        sum.add(v.normalize())
      }
      const open = center.r + 1.3
      this.doms.forEach((dom) => {
        if (dom.lone) add(v3(dom.dir), open, words.lone)
      })
      if (sum.length() > 0.35) {
        add(sum.clone(), open, words.middle)
        add(sum.clone().negate(), open, words.away)
      }
      const c = this.toScreen(center.pos)
      const rc = this.pxRadius(center.pos, center.r)
      for (const w of ways) {
        const at = this.toScreen(center.pos.clone().addScaledVector(w.dir, w.far))
        if (Math.hypot(at.x - c.x, at.y - c.y) < rc + 22) continue
        if (found.some((f) => Math.hypot(f.x - at.x, f.y - at.y) < 26)) continue
        found.push({ x: at.x, y: at.y, label: w.label })
      }
    }
    this.aims = found
    if (this.aimNear >= found.length) this.aimNear = -1
    while (this.aimDots.length < found.length) {
      const dot = document.createElement('span')
      dot.className = 'mb-aim'
      dot.setAttribute('aria-hidden', 'true')
      this.overlay.appendChild(dot)
      this.aimDots.push(dot)
    }
    this.aimDots.forEach((dot, i) => {
      const a = found[i]
      dot.style.opacity = a ? '1' : '0'
      if (a) dot.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px) translate(-50%, -50%)`
      dot.classList.toggle('is-near', i === this.aimNear)
    })
  }

  /** The arrow a student is drawing now, and the last arrow that was drawn wrong. */
  private updateDrawn(lift: number) {
    const d = this.input.specimen ? null : this.input.draw
    const center = d ? this.atoms.get(d.center) : undefined
    const press = this.press?.kind === 'arrow' && this.press.moved ? this.press : null
    const from = press?.id ? this.atoms.get(press.id) : undefined
    const net = d?.kind === 'net'
    const start = from ?? (net && this.keyAim !== null ? center : undefined)
    this.placeAims(lift)
    let caption = ''
    let capAt: { x: number; y: number } | null = null

    // the arrow under the pointer, or the one the arrow keys are turning
    let drawing = false
    if (d && start) {
      if (!this.drawArrow) this.drawArrow = this.makeArrow('mb-dipole is-draw')
      this.drawArrow.g.classList.toggle('is-net', net)
      const c = this.toScreen(start.pos)
      const r = this.pxRadius(start.pos, start.r)
      let to: { x: number; y: number } | null = null
      if (from && this.arrowTo) {
        to = this.arrowTo
        const over = this.arrowOver ? this.atoms.get(this.arrowOver) : undefined
        if (over) {
          // over an atom, the arrow stops at that atom's edge, and says which atom it points at
          const oc = this.toScreen(over.pos)
          const reach = Math.hypot(oc.x - c.x, oc.y - c.y) || 1
          const gap = this.pxRadius(over.pos, over.r) + 3
          to = { x: oc.x - ((oc.x - c.x) / reach) * gap, y: oc.y - ((oc.y - c.y) / reach) * gap }
          caption = d.captions[over.id] ?? ''
          capAt = { x: oc.x, y: oc.y - gap - 16 }
        }
        const aim = net ? this.aims[this.aimNear] : undefined
        if (aim) {
          // near an aim point, the net dipole snaps to it and says where that is
          to = { x: aim.x, y: aim.y }
          caption = aim.label
          capAt = { x: aim.x, y: aim.y - 24 }
        }
      } else if (this.keyAim !== null) {
        const a = (this.keyAim * Math.PI) / 180
        to = { x: c.x + Math.cos(a) * (r + 78), y: c.y - Math.sin(a) * (r + 78) }
      }
      const len = to ? Math.hypot(to.x - c.x, to.y - c.y) : 0
      if (to && len > r + 6) drawing = this.placeArrow(this.drawArrow, { x: c.x + ((to.x - c.x) / len) * (r + 3), y: c.y + ((to.y - c.y) / len) * (r + 3) }, to, null, net ? 13 : 9)
    }
    if (this.drawArrow && !drawing) this.drawArrow.g.style.display = 'none'
    // the words beside the arrow's head: what the arrow points at
    const hover = !drawing && net ? this.aims[this.aimNear] : undefined
    if (hover) {
      caption = hover.label
      capAt = { x: hover.x, y: hover.y - 24 }
    }
    if (caption && capAt) {
      if (!this.capTag) {
        this.capTag = document.createElement('span')
        this.capTag.className = 'mb-delta is-cap'
        this.capTag.setAttribute('aria-hidden', 'true')
        this.overlay.appendChild(this.capTag)
      }
      this.capTag.textContent = caption
      this.capTag.style.transform = `translate(${capAt.x.toFixed(1)}px, ${capAt.y.toFixed(1)}px) translate(-50%, -50%)`
      this.capTag.style.opacity = '1'
    } else if (this.capTag) this.capTag.style.opacity = '0'

    // the last wrong arrow stays where it was drawn until the next one is started
    let wrong = false
    let wrongWay: { x: number; y: number } | null = null
    const w = d && !start && !(d.wrong && 'dir' in d.wrong && d.wrong.dir === this.wrongGone) ? d.wrong : null
    if (d && w && center) {
      if (!this.wrongArrow) this.wrongArrow = this.makeArrow('mb-dipole is-wrong')
      this.wrongArrow.g.classList.toggle('is-net', 'dir' in w)
      if ('dir' in w) {
        const dir = v3(w.dir)
        const a = this.toScreen(center.pos.clone().addScaledVector(dir, center.r + 0.08))
        const b = this.toScreen(center.pos.clone().addScaledVector(dir, center.r + 1.35))
        if (lift > 0.97) wrong = this.placeArrow(this.wrongArrow, a, b, null, 13)
        if (wrong) wrongWay = { x: b.x - a.x, y: b.y - a.y }
      } else {
        const other = this.atoms.get(w.from === d.center ? w.to : w.from)
        if (other) {
          const { start: a, end: b } = this.besideBond(center, other)
          wrong = w.to === other.id ? this.placeArrow(this.wrongArrow, a, b, null, 9) : this.placeArrow(this.wrongArrow, b, a, null, 9)
        }
      }
    }
    if (this.wrongArrow && !wrong) this.wrongArrow.g.style.display = 'none'
    this.drawnShown = { drawing, wrong, wrongWay }
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

  /** The atom under a point on screen, the one nearest the viewer when several overlap. */
  private atomAt(clientX: number, clientY: number, skip?: string): string | null {
    const rect = this.wrap.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const slack = this.coarse ? 12 : 5
    let best: string | null = null
    let bestDepth = Infinity
    for (const view of this.atoms.values()) {
      if (view.id === skip) continue
      const c = this.toScreen(view.pos)
      if (Math.hypot(c.x - x, c.y - y) > this.pxRadius(view.pos, view.r) + slack) continue
      const depth = view.pos.distanceTo(this.camera.position)
      if (depth < bestDepth) {
        bestDepth = depth
        best = view.id
      }
    }
    return best
  }
  /** True while a point on screen is on this atom's ball. */
  private onAtom(id: string, clientX: number, clientY: number, slack = 0): boolean {
    const view = this.atoms.get(id)
    if (!view) return false
    const rect = this.wrap.getBoundingClientRect()
    const c = this.toScreen(view.pos)
    return Math.hypot(clientX - rect.left - c.x, clientY - rect.top - c.y) <= this.pxRadius(view.pos, view.r) + slack
  }
  /** The aim point under the pointer, or −1. */
  private aimAt(clientX: number, clientY: number): number {
    const rect = this.wrap.getBoundingClientRect()
    const reach = this.coarse ? 22 : 15
    let best = -1
    let bestD = reach
    this.aims.forEach((a, i) => {
      const dist = Math.hypot(clientX - rect.left - a.x, clientY - rect.top - a.y)
      if (dist < bestD) {
        bestD = dist
        best = i
      }
    })
    return best
  }
  /** The aim point that an arrow from the middle atom to this point on the board points at, within 13°, or −1. */
  private aimToward(x: number, y: number): number {
    const d = this.input.draw
    const center = d ? this.atoms.get(d.center) : undefined
    if (!center) return -1
    const c = this.toScreen(center.pos)
    if (Math.hypot(x - c.x, y - c.y) < this.pxRadius(center.pos, center.r) + 10) return -1
    const way = Math.atan2(y - c.y, x - c.x)
    let best = -1
    let least = (13 * Math.PI) / 180
    this.aims.forEach((a, i) => {
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(a.y - c.y, a.x - c.x) - way), Math.cos(Math.atan2(a.y - c.y, a.x - c.x) - way)))
      if (off < least) {
        least = off
        best = i
      }
    })
    return best
  }
  /** A stroke across the bare board: each bond line it crosses is cut once. */
  private swipe(clientX: number, clientY: number) {
    const rect = this.wrap.getBoundingClientRect()
    const to = { x: clientX - rect.left, y: clientY - rect.top }
    const from = this.cutPoints[this.cutPoints.length - 1]
    if (!from || Math.hypot(to.x - from.x, to.y - from.y) < 3) return
    this.cutPoints.push(to)
    if (!this.cutPath.isConnected) {
      this.cutPath.setAttribute('class', 'mb-cut')
      this.dipoleSvg.appendChild(this.cutPath)
    }
    this.cutPath.setAttribute('points', this.cutPoints.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '))
    // do the two segments cross?
    const side = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
    for (const b of this.input.s.bonds) {
      if (this.cutDone.has(b.id)) continue
      const f = this.bondFrame(b.a, b.b)
      if (!f) continue
      const p1 = this.toScreen(f.A.pos.clone().addScaledVector(f.dir, f.A.r * 0.9))
      const p2 = this.toScreen(f.B.pos.clone().addScaledVector(f.dir, -f.B.r * 0.9))
      // the bond's two ends lie on opposite sides of the stroke, and the stroke's two ends on opposite
      // sides of the bond or right on its line (a point of the stroke can land exactly on the line)
      const s1 = side(p1, p2, from)
      const s2 = side(p1, p2, to)
      if (side(from, to, p1) * side(from, to, p2) < 0 && s1 * s2 <= 0 && (s1 !== 0 || s2 !== 0)) {
        this.cutDone.add(b.id)
        if (!this.reduced) this.sparks.burst(f.mid, 0xff8fa3, 8, 1.6)
        this.cb.feel?.('land')
        this.cb.cut(b.id)
      }
    }
  }

  /** The atom under the pointer that an arrow can start on now: any atom for a bond's arrow, the
   *  middle atom of the lifted model for the net dipole. The net dipole starts anywhere on the
   *  middle atom, also where an outer atom sits in front of it: no other atom can start that arrow. */
  private arrowStart(clientX: number, clientY: number): string | null {
    const d = this.input.specimen ? null : this.input.draw
    if (!d) return null
    if (d.kind === 'net') return this.liftRaw >= 0.97 && this.onAtom(d.center, clientX, clientY, this.coarse ? 12 : 5) ? d.center : null
    return this.atomAt(clientX, clientY)
  }
  /** Reports a net dipole drawn out of the middle atom along a direction on screen (pixels, y down). */
  private finishNet(vx: number, vy: number) {
    const d = this.input.draw
    const center = d ? this.atoms.get(d.center) : undefined
    if (!d || d.kind !== 'net' || !center) return
    const seen = bondsOf(this.input.s, d.center).flatMap((b) => {
      const other = this.atoms.get(b.a === d.center ? b.b : b.a)
      if (!other) return []
      const v = other.pos.clone().sub(center.pos).normalize().transformDirection(this.camera.matrixWorldInverse)
      return [{ atomId: other.id, dir: [v.x, v.y, v.z] as V3 }]
    })
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1)
    const world = right.multiplyScalar(vx).addScaledVector(up, -vy).normalize()
    this.cb.drawNet({ x: vx, y: -vy }, seen, [world.x, world.y, world.z])
  }
  /** Enter or Space on an atom's keyboard target. While the net dipole can be drawn, the middle
   *  atom's target shows the arrow first and sets it on the next press. */
  private hitClick(id: string) {
    const d = this.input.draw
    if (d?.kind !== 'net' || id !== d.center) {
      this.cb.tapAtom(id, true)
      return
    }
    // the atoms are still moving while the model lifts: no arrow can be judged yet
    if (this.liftRaw < 0.97) return
    this.untouched = 0
    if (this.keyAim === null) this.keyAim = 90
    else {
      const a = (this.keyAim * Math.PI) / 180
      this.keyAim = null
      this.finishNet(Math.cos(a), -Math.sin(a))
    }
  }
  /** The left and right arrow keys turn the net dipole arrow, 15° at a time. */
  private hitKey(id: string, e: KeyboardEvent) {
    const d = this.input.draw
    const turn = e.key === 'ArrowLeft' ? 15 : e.key === 'ArrowRight' ? -15 : 0
    if (d?.kind !== 'net' || id !== d.center || !turn || this.liftRaw < 0.97) return
    e.preventDefault()
    this.untouched = 0
    this.keyAim = ((this.keyAim ?? 90) + turn + 360) % 360
  }

  // ------------------------------------------------------------------ pointer

  private readonly onDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.press) return
    this.coarse = e.pointerType === 'touch'
    this.untouched = 0
    this.watch(e.clientX, e.clientY)
    const hit = this.pick(e.clientX, e.clientY)
    const base = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    // the student has taken the model in hand: it stops turning by itself
    this.aim = null
    const arrowFrom = this.arrowStart(e.clientX, e.clientY)
    const aim = arrowFrom ? -1 : this.aimAt(e.clientX, e.clientY)
    if (arrowFrom) {
      this.press = { ...base, kind: 'arrow', id: arrowFrom }
      this.keyAim = null
    } else if (aim >= 0) {
      this.press = { ...base, kind: 'aim', dom: aim }
      this.keyAim = null
    } else if (this.liftRaw > 0.5) {
      this.press = hit?.kind === 'lobe' ? { ...base, kind: 'dom', dom: hit.dom } : { ...base, kind: 'orbit' }
      if (hit?.kind === 'lobe') {
        this.glide = null
        this.doms[hit.dom]!.pinned = true
        const wrong = this.input.draw?.wrong
        if (wrong && 'dir' in wrong) this.wrongGone = wrong.dir
      }
    } else if (!this.input.editable) this.press = { ...base, kind: 'empty' }
    else if (!hit) {
      // a stroke that starts on the bare board cuts the bonds it crosses
      this.press = { ...base, kind: 'cut' }
      const rect = this.wrap.getBoundingClientRect()
      this.cutPoints = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }]
      this.cutDone = new Set()
    } else if (hit.kind === 'atom') {
      const p = this.positions.get(hit.id)
      const at = this.boardPoint(e.clientX, e.clientY, this.atoms.get(hit.id)?.r ?? 0.5)
      this.press = { ...base, kind: 'atom', id: hit.id, grab: p && at ? { x: at.x - p.x, y: at.y - p.y } : { x: 0, y: 0 } }
    } else if (hit.kind === 'dot') this.press = { ...base, kind: 'dot', id: hit.atomId }
    else if (hit.kind === 'bond') this.press = { ...base, kind: 'bond', id: hit.id }
    this.wrap.setPointerCapture(e.pointerId)
    this.wrap.classList.toggle('is-grabbing', this.press?.kind === 'atom' || this.press?.kind === 'dot' || this.press?.kind === 'dom')
    this.wrap.classList.toggle('is-aim', this.press?.kind === 'arrow' || this.press?.kind === 'aim')
  }

  private readonly onMove = (e: PointerEvent) => {
    const p = this.press
    this.watch(e.clientX, e.clientY)
    if (!p) {
      if (e.pointerType === 'mouse') {
        const arrowFrom = this.arrowStart(e.clientX, e.clientY)
        const aim = arrowFrom ? -1 : this.aimAt(e.clientX, e.clientY)
        const hit = arrowFrom || aim >= 0 ? null : this.pick(e.clientX, e.clientY)
        const can = this.liftRaw > 0.5 ? hit !== null : this.input.editable && hit !== null
        this.wrap.classList.toggle('is-hot', can)
        this.wrap.classList.toggle('is-aim', arrowFrom !== null || aim >= 0)
        this.aimNear = aim
        this.hoverId = arrowFrom ?? (can && hit?.kind === 'atom' ? hit.id : null)
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

    if (p.kind === 'arrow' && p.id) {
      const rect = this.wrap.getBoundingClientRect()
      this.arrowTo = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      this.arrowOver = this.input.draw?.kind === 'bond' && !this.onAtom(p.id, e.clientX, e.clientY) ? this.atomAt(e.clientX, e.clientY, p.id) : null
      this.aimNear = this.input.draw?.kind === 'net' ? this.aimToward(this.arrowTo.x, this.arrowTo.y) : -1
    } else if (p.kind === 'orbit') {
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
    } else if (p.kind === 'cut') {
      this.swipe(e.clientX, e.clientY)
    } else if (p.kind === 'atom' && p.id) {
      this.pinned = p.id
      const at = this.boardPoint(e.clientX, e.clientY, this.atoms.get(p.id)?.r ?? 0.5)
      if (at && p.grab) this.positions.set(p.id, { x: at.x - p.grab.x, y: at.y - p.grab.y })
      const over = this.pick(e.clientX, e.clientY, p.id)
      this.dropTarget = over?.kind === 'atom' ? over.id : null
      this.cb.carry?.(p.id, e.clientX, e.clientY)
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
    if (p.kind === 'arrow') {
      const d = this.input.draw
      if (!d || !p.id) return
      if (d.kind === 'bond') {
        // A tap starts or ends an arrow. A drag is an arrow from the atom it started on to the atom it
        // was let go on. A finger that slid a little and never left the first atom is still a tap:
        // an atom hidden behind that one is not what the student pointed at.
        const tap = !p.moved || this.onAtom(p.id, e.clientX, e.clientY)
        const over = tap ? null : this.atomAt(e.clientX, e.clientY, p.id)
        if (tap) this.cb.tapAtom(p.id, false)
        else if (over) this.cb.drawBond(p.id, over)
        return
      }
      const center = this.atoms.get(d.center)
      if (!center || !p.moved) return
      const rect = this.wrap.getBoundingClientRect()
      const c = this.toScreen(center.pos)
      // an arrow let go near an aim point is the arrow to that point
      const snap = this.aims[this.aimToward(e.clientX - rect.left, e.clientY - rect.top)]
      const vx = (snap ? snap.x : e.clientX - rect.left) - c.x
      const vy = (snap ? snap.y : e.clientY - rect.top) - c.y
      // an arrow has to reach out of the atom it starts on
      if (Math.hypot(vx, vy) > this.pxRadius(center.pos, center.r) + 10) this.finishNet(vx, vy)
      return
    }
    if (p.kind === 'aim') {
      // a tap on an aim point sets the net dipole there
      const d = this.input.draw
      const center = d ? this.atoms.get(d.center) : undefined
      const to = this.aims[p.dom ?? -1]
      if (d?.kind === 'net' && center && to) {
        const rect = this.wrap.getBoundingClientRect()
        const c = this.toScreen(center.pos)
        if (Math.hypot(e.clientX - rect.left - to.x, e.clientY - rect.top - to.y) < 30) this.finishNet(to.x - c.x, to.y - c.y)
      }
      return
    }
    if (p.kind === 'cut') {
      if (p.moved) return
      // a tap on the bare board, as before
    }
    // let go over the bin: the atom comes off the board
    if (p.kind === 'atom' && p.id && p.moved && this.cb.drop?.(p.id, e.clientX, e.clientY)) return
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
    if (!this.press) this.aimNear = -1
  }

  private release(e: PointerEvent) {
    if (this.press?.kind === 'dom' && this.press.dom !== undefined && this.doms[this.press.dom]) this.doms[this.press.dom]!.pinned = false
    // an atom that was being carried is let go, however the press ended
    if (this.press?.kind === 'atom') this.cb.carry?.(null, e.clientX, e.clientY)
    this.press = null
    this.pinned = null
    this.dropTarget = null
    this.rubber.visible = false
    this.cutPoints = []
    this.cutPath.setAttribute('points', '')
    this.aimNear = -1
    this.arrowTo = null
    this.arrowOver = null
    this.quiet = 0
    this.wrap.classList.remove('is-grabbing', 'is-aim')
    if (this.wrap.hasPointerCapture(e.pointerId)) this.wrap.releasePointerCapture(e.pointerId)
  }

  private readonly onWheel = (e: WheelEvent) => {
    if (this.liftRaw < 0.5) return
    e.preventDefault()
    this.untouched = 0
    this.orbit.zoom = Math.max(0.7, Math.min(1.6, this.orbit.zoom * Math.exp(e.deltaY * 0.0012)))
  }

  /** Where an atom is on the page right now and how big it is drawn there, for the rings and the
   *  pointing hand that the panel draws over the board. Null for an atom that is not on the board. */
  atomOnPage(id: string): { x: number; y: number; r: number } | null {
    const view = this.atoms.get(id)
    if (!view) return null
    const rect = this.wrap.getBoundingClientRect()
    const c = this.toScreen(view.pos)
    return { x: rect.left + c.x, y: rect.top + c.y, r: this.pxRadius(view.pos, view.r) }
  }
  /** Where the middle of the flat board is on the page, at the height of a ball lying on it. */
  boardOnPage(): { x: number; y: number } {
    const rect = this.wrap.getBoundingClientRect()
    const c = this.toScreen(new THREE.Vector3(0, 0.5, 0))
    return { x: rect.left + c.x, y: rect.top + c.y }
  }
  /** Where each aim point for the net dipole is on the page. Empty while the net dipole is not being asked for. */
  aimsOnPage(): { x: number; y: number }[] {
    const rect = this.wrap.getBoundingClientRect()
    return this.aims.map((a) => ({ x: rect.left + a.x, y: rect.top + a.y }))
  }
  /** True while the student has the mouse button or a finger down on the board, or is carrying an atom from the tray. */
  get busy(): boolean {
    return this.press !== null || this.ghost !== null
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
    // the box on the page that holds the four corners of the board, at the height of a ball lying on it
    const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => this.toScreen(new THREE.Vector3(sx * this.halfW, 0.5, sz * this.halfH))))
    const xs = corners.map((q) => q.x)
    const ys = corners.map((q) => q.y)
    const px = { x: rect.left + Math.min(...xs), y: rect.top + Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
    return { atoms, bonds, lobes, dots, lift: this.liftRaw, ringed: this.ringed, dipoles: this.dipolesShown, draw: { kind: this.input.draw?.kind ?? null, ...this.drawnShown }, aims: this.aimsOnPage().map((a, i) => ({ ...a, label: this.aims[i]!.label })), board: { halfW: this.halfW, halfH: this.halfH, px } }
  }
  /** For tests: the angle in degrees between two bonded atoms as seen from the center, in the 3D model. */
  debugAngles(): number[] {
    const out: number[] = []
    const b = this.doms.filter((d) => !d.lone)
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) out.push((v3(b[i]!.dir).angleTo(v3(b[j]!.dir)) * 180) / Math.PI)
    return out
  }
}

