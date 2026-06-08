// Builds the app once before the e2e suite so specs run against the real out/ bundle. Skipped when
// PLAYWRIGHT_SKIP_BUILD is set (e.g. when out/ is already fresh) to keep the iterate loop fast.

import { execSync } from 'node:child_process'

const globalSetup = (): void => {
  if (process.env.PLAYWRIGHT_SKIP_BUILD === '1') return
  execSync('npm run build', { stdio: 'inherit' })
}

export default globalSetup
