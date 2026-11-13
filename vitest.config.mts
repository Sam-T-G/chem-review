import { defineConfig } from 'vitest/config'

// The unit tests cover src/chem and the Lewis module's guide and store. None of that touches
// React, React Native or Three.js, so the suite runs in plain Node.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
