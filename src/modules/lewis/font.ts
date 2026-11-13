// The module's typefaces, each as one variable font file so the CSS can ask for any weight by
// number: Nunito (200 to 1000) for reading, Fredoka (300 to 700) for titles, formulas and numbers.
// Registered by hand because the bundler does not follow the font URLs inside a CSS package.
import { Asset } from 'expo-asset'

let registered = false

export function registerFonts(): void {
  if (registered || typeof document === 'undefined') return
  registered = true
  /* eslint-disable @typescript-eslint/no-require-imports */
  const nunito = Asset.fromModule(require('@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2')).uri
  const fredoka = Asset.fromModule(require('@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2')).uri
  /* eslint-enable @typescript-eslint/no-require-imports */
  const face = (family: string, weights: string, uri: string) => `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weights};src:url("${uri}") format('woff2-variations')}`
  const style = document.createElement('style')
  style.setAttribute('data-font', 'chem-review')
  style.textContent = face('Nunito Variable', '200 1000', nunito) + face('Fredoka Variable', '300 700', fredoka)
  document.head.appendChild(style)
}
