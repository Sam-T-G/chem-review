// app.json holds the app's settings. This file adds one thing on top of it: the folder the web
// build is served from. GitHub Pages serves this app from /chem-review, so that build sets
// WEB_BASE_URL=/chem-review (scripts/deploy-pages.mjs does it). Every other build leaves it unset
// and is served from the root of its site.
module.exports = ({ config }) => {
  const baseUrl = process.env.WEB_BASE_URL
  return baseUrl ? { ...config, experiments: { ...config.experiments, baseUrl } } : config
}
