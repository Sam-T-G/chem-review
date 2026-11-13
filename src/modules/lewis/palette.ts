// Ball colors, shared by the 3D board and the panel so an oxygen looks the same in both.
// `ink` is the label color that reads on that ball.
import type { El } from '../../chem/elements'

export const BALL: Record<El, { color: number; ink: string }> = {
  H: { color: 0xfff6e6, ink: '#3a3358' },
  Be: { color: 0xc8dc9c, ink: '#3a3358' },
  B: { color: 0xf4b9a7, ink: '#3a3358' },
  C: { color: 0x504a6c, ink: '#ffffff' },
  N: { color: 0x7d9cf5, ink: '#232042' },
  O: { color: 0xff8fa3, ink: '#3a2440' },
  F: { color: 0x9fe5c6, ink: '#24453a' },
  Al: { color: 0xcfd1dd, ink: '#3a3358' },
  Si: { color: 0xd3c5a2, ink: '#3a3358' },
  P: { color: 0xffb680, ink: '#4a2c1c' },
  S: { color: 0xdbe06e, ink: '#3d4014' },
  Cl: { color: 0x6fd6a8, ink: '#173d2e' },
  As: { color: 0xcbadda, ink: '#3a2a4a' },
  Se: { color: 0xf3b765, ink: '#4a3410' },
  Br: { color: 0xd48f77, ink: '#3f1f14' },
  Kr: { color: 0xaee3ea, ink: '#1d4047' },
  I: { color: 0xb99cec, ink: '#2e2150' },
  Xe: { color: 0x86d6e2, ink: '#143f47' },
}

/** How much white goes over the ball's color to make the pale patch its face sits on. */
export const FACE_WHITE = 0.72

/** The color of the face patch on a ball of the given color. Mixed channel by channel, the way a browser lays white over a color. */
export function faceColor(ball: number): number {
  const mix = (c: number) => Math.round(c + (255 - c) * FACE_WHITE)
  return (mix((ball >> 16) & 255) << 16) | (mix((ball >> 8) & 255) << 8) | mix(ball & 255)
}

export function ballStyle(el: El): string {
  const b = BALL[el]
  return `background:#${b.color.toString(16).padStart(6, '0')};color:${b.ink}`
}
