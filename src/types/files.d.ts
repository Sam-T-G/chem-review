// File types the bundler handles that TypeScript does not know about.
declare module '*.css'
declare module '*.woff2' {
  const asset: number
  export default asset
}
