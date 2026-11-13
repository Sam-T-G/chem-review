// The module's typeface: Nunito as one variable font file, so the CSS can ask for any weight
// from 200 to 1000 by number. Registered by hand because the bundler does not follow the font
// URLs inside a CSS package.
import { Asset } from 'expo-asset'

let registered = false

export function registerNunito(): void {
  if (registered || typeof document === 'undefined') return
  registered = true
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const uri = Asset.fromModule(require('@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2')).uri
  const style = document.createElement('style')
  style.setAttribute('data-font', 'nunito-variable')
  style.textContent = `@font-face{font-family:'Nunito Variable';font-style:normal;font-display:swap;font-weight:200 1000;src:url("${uri}") format('woff2-variations')}`
  document.head.appendChild(style)
}
