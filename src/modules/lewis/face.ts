// A small face for an atom: a pale patch across the upper half of the ball, with two tall dark
// eyes on it, set close together, each with a small glint. The eyes blink on their own, lean
// toward the pointer, grow when the atom is picked up, and close into two arcs for a moment when
// it makes a bond. A bonded atom with a full shell gets a blush. Drawn flat, facing the camera.
import * as THREE from 'three'

import { faceColor } from './palette'

const INK = 0x3a3358

/** A rounded shape between an ellipse (n = 2) and a rectangle (large n): `a` wide and `b` tall, measured from its middle. */
function rounded(a: number, b: number, n: number): THREE.ShapeGeometry {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    pts.push(new THREE.Vector2(a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)))
  }
  return new THREE.ShapeGeometry(new THREE.Shape(pts))
}

// All sizes are in ball radii: the face group is scaled to its ball.
const circle = new THREE.CircleGeometry(1, 20)
const patchGeo = rounded(0.56, 0.27, 3)
const eyeGeo = rounded(0.092, 0.19, 2.7)
// a closed eye: an arc that opens downward
const arcGeo = new THREE.RingGeometry(0.07, 0.118, 18, 1, Math.PI * 0.06, Math.PI * 0.88)
/** How far above the middle of the ball the face sits. */
const FACE_Y = 0.44
/** Each eye's distance from the middle of the face. */
const EYE_X = 0.165

export interface FaceFrame {
  /** Where the ball is and how big (the face is sized to it). */
  center: THREE.Vector3
  radius: number
  /** How far in front of the center the face sits. A squashed or stretched ball bulges past its radius. */
  front: number
  /** Unit vectors of the camera: toward it, its right and its up. */
  toCam: THREE.Vector3
  right: THREE.Vector3
  up: THREE.Vector3
  quat: THREE.Quaternion
  /** A point to look at (the pointer, or an atom being dragged). Null lets the eyes wander. */
  lookAt: THREE.Vector3 | null
  /** Picked up, or startled by a refused move. */
  wide: boolean
  /** Outer shell is full. */
  content: boolean
  /** No blinking, wandering or closing. */
  still: boolean
}

export class Face {
  readonly group = new THREE.Group()
  /** Both eyes. The pair moves a little over the patch, toward what the atom looks at. */
  private readonly pair = new THREE.Group()
  private readonly eyes: THREE.Group[] = []
  private readonly arcs: THREE.Mesh[] = []
  private readonly blush: THREE.Mesh[] = []
  private readonly patchMat: THREE.MeshBasicMaterial
  private readonly blushMat = new THREE.MeshBasicMaterial({ color: 0xff7f96, transparent: true, opacity: 0, depthWrite: false })
  private readonly white = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false })
  private readonly ink = new THREE.MeshBasicMaterial({ color: INK, depthWrite: false })
  private readonly look = new THREE.Vector2()
  private readonly phase = Math.random() * 20
  private untilBlink = 1 + Math.random() * 4
  private blink = 0
  private open = 1
  private size = 1
  /** Seconds of closed, happy eyes left (set when the atom makes a bond). */
  joy = 0

  /** `ball` is the color of the ball the face sits on: the patch is a pale tint of it. */
  constructor(ball: number) {
    // Nothing here writes depth, so the layers are drawn in a set order: patch, blush, eyes, glint.
    // The groups carry the order that puts the whole face after the balls.
    this.patchMat = new THREE.MeshBasicMaterial({ color: faceColor(ball), depthWrite: false })
    const patch = new THREE.Mesh(patchGeo, this.patchMat)
    patch.position.set(0, FACE_Y, 0)
    patch.renderOrder = 1
    this.pair.position.set(0, FACE_Y, 0.004)
    this.group.add(patch, this.pair)

    for (const side of [-1, 1]) {
      const eye = new THREE.Group()
      eye.position.set(side * EYE_X, 0, 0)
      const dark = new THREE.Mesh(eyeGeo, this.ink)
      dark.renderOrder = 3
      const glint = new THREE.Mesh(circle, this.white)
      glint.scale.setScalar(0.036)
      glint.position.set(0.022, 0.1, 0.004)
      glint.renderOrder = 4
      eye.add(dark, glint)
      this.pair.add(eye)
      this.eyes.push(eye)

      const arc = new THREE.Mesh(arcGeo, this.ink)
      arc.position.set(side * EYE_X, -0.05, 0)
      arc.renderOrder = 3
      arc.visible = false
      this.pair.add(arc)
      this.arcs.push(arc)

      const cheek = new THREE.Mesh(circle, this.blushMat)
      cheek.scale.set(0.085, 0.055, 1)
      cheek.position.set(side * 0.4, FACE_Y - 0.1, 0.002)
      cheek.renderOrder = 2
      this.group.add(cheek)
      this.blush.push(cheek)
    }
    this.group.renderOrder = 4
    this.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) o.renderOrder = 4
    })
  }

  update(dt: number, time: number, f: FaceFrame) {
    this.group.position.copy(f.center).addScaledVector(f.toCam, f.front)
    this.group.quaternion.copy(f.quat)
    this.group.scale.setScalar(f.radius)

    // where the eyes lean
    let lx = 0
    let ly = 0
    if (f.lookAt) {
      const v = f.lookAt.clone().sub(f.center)
      const x = v.dot(f.right)
      const y = v.dot(f.up)
      const len = Math.hypot(x, y)
      if (len > 1e-3) {
        const reach = Math.min(1, len / (f.radius * 2.5))
        lx = (x / len) * reach * 0.075
        ly = (y / len) * reach * 0.04
      }
    } else if (!f.still) {
      lx = Math.sin(time * 0.7 + this.phase) * 0.035
      ly = Math.sin(time * 0.9 + this.phase * 1.7) * 0.015
    }
    this.look.lerp(new THREE.Vector2(lx, ly), 1 - Math.exp(-10 * dt))
    this.pair.position.set(this.look.x, FACE_Y + this.look.y, 0.004)

    // blinking
    if (!f.still) {
      this.untilBlink -= dt
      if (this.untilBlink <= 0 && this.blink <= 0) {
        this.blink = 0.17
        // now and then, two blinks close together
        this.untilBlink = Math.random() < 0.2 ? 0.28 : 2.2 + Math.random() * 4
      }
    }
    let lid = 1
    if (this.blink > 0) {
      this.blink -= dt
      lid = 1 - Math.sin(Math.PI * Math.max(0, Math.min(1, 1 - this.blink / 0.17))) * 0.92
    }
    const happy = this.joy > 0
    if (happy) this.joy -= dt
    this.open += (lid - this.open) * (1 - Math.exp(-30 * dt))
    this.size += ((f.wide ? 1.2 : 1) - this.size) * (1 - Math.exp(-16 * dt))
    for (const eye of this.eyes) {
      eye.visible = !happy
      eye.scale.set(this.size, this.size * this.open, 1)
    }
    for (const arc of this.arcs) arc.visible = happy

    const want = f.content ? 0.55 : happy ? 0.45 : 0
    this.blushMat.opacity += (want - this.blushMat.opacity) * (1 - Math.exp(-6 * dt))
    for (const cheek of this.blush) cheek.visible = this.blushMat.opacity > 0.02
  }

  dispose() {
    this.patchMat.dispose()
    this.blushMat.dispose()
    this.white.dispose()
    this.ink.dispose()
  }
}
