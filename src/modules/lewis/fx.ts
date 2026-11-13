// Small effects for the board: sparks when a bond forms, a ring that spreads on the board where
// an atom lands or the board is tapped, and the soft glow picture used around every electron.
import * as THREE from 'three'

/** A round glow as a picture: bright in the middle, fading to nothing. */
export function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 96
  const g = c.getContext('2d')!
  const fade = g.createRadialGradient(48, 48, 0, 48, 48, 48)
  fade.addColorStop(0, 'rgba(255, 255, 255, 1)')
  fade.addColorStop(0.35, 'rgba(255, 255, 255, 0.55)')
  fade.addColorStop(1, 'rgba(255, 255, 255, 0)')
  g.fillStyle = fade
  g.fillRect(0, 0, 96, 96)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface Spark {
  sprite: THREE.Sprite
  vel: THREE.Vector3
  life: number
  span: number
  size: number
}

/** A pool of glowing specks that fly out from a point and fade. */
export class Sparks {
  private readonly pool: Spark[] = []

  constructor(scene: THREE.Scene, glow: THREE.Texture, count = 56) {
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd15c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
      sprite.visible = false
      sprite.renderOrder = 6
      scene.add(sprite)
      this.pool.push({ sprite, vel: new THREE.Vector3(), life: 0, span: 1, size: 0.2 })
    }
  }

  burst(at: THREE.Vector3, color: number, n: number, speed = 2.4) {
    let made = 0
    for (const s of this.pool) {
      if (s.life > 0) continue
      const a = Math.random() * Math.PI * 2
      const up = 0.4 + Math.random() * 0.9
      const v = speed * (0.45 + Math.random() * 0.75)
      s.vel.set(Math.cos(a) * v, up * v * 0.8, Math.sin(a) * v)
      s.span = 0.45 + Math.random() * 0.35
      s.life = s.span
      s.size = 0.16 + Math.random() * 0.2
      s.sprite.position.copy(at)
      s.sprite.material.color.setHex(color)
      s.sprite.visible = true
      if (++made >= n) break
    }
  }

  update(dt: number) {
    for (const s of this.pool) {
      if (s.life <= 0) continue
      s.life -= dt
      if (s.life <= 0) {
        s.sprite.visible = false
        continue
      }
      s.vel.y -= 3.2 * dt
      s.vel.multiplyScalar(1 - 1.6 * dt)
      s.sprite.position.addScaledVector(s.vel, dt)
      const k = s.life / s.span
      s.sprite.scale.setScalar(s.size * (0.4 + 0.6 * k))
      s.sprite.material.opacity = Math.min(1, k * 1.6)
    }
  }
}

interface Ring {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  life: number
  span: number
  from: number
  to: number
  /** Opacity at the start. */
  peak: number
}

/** Rings that spread out flat on the board and fade. */
export class Ripples {
  private readonly pool: Ring[] = []

  constructor(scene: THREE.Scene, count = 10) {
    const geo = new THREE.RingGeometry(0.86, 1, 56)
    geo.rotateX(-Math.PI / 2)
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }))
      mesh.visible = false
      mesh.renderOrder = 1
      scene.add(mesh)
      this.pool.push({ mesh, life: 0, span: 1, from: 0.3, to: 1.5, peak: 0.55 })
    }
  }

  /** `peak` is how solid the ring is when it starts (it fades to nothing as it grows). */
  ping(x: number, z: number, color: number, from: number, to: number, span = 0.65, peak = 0.55) {
    const r = this.pool.find((p) => p.life <= 0)
    if (!r) return
    r.life = r.span = span
    r.from = from
    r.to = to
    r.peak = peak
    r.mesh.position.set(x, 0.02, z)
    r.mesh.material.color.setHex(color)
    r.mesh.visible = true
  }

  update(dt: number) {
    for (const r of this.pool) {
      if (r.life <= 0) continue
      r.life -= dt
      if (r.life <= 0) {
        r.mesh.visible = false
        continue
      }
      const k = 1 - r.life / r.span
      const out = 1 - (1 - k) ** 3
      r.mesh.scale.setScalar(r.from + (r.to - r.from) * out)
      r.mesh.material.opacity = r.peak * (1 - k)
    }
  }
}
