/**
 * Convenience: run the e2e suite with a unique dev-server port so
 * the spawned `next dev` doesn't collide with whatever's holding
 * 3000 on the developer's machine.
 *
 * Usage:
 *   node scripts/run-e2e.mjs [args...]
 *
 * Examples:
 *   node scripts/run-e2e.mjs                   # full suite, port 3010
 *   node scripts/run-e2e.mjs 01-anonymous     # just the landing spec
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const port = process.env.PLAYWRIGHT_DEV_PORT ?? '3010'
const cli = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@playwright',
  'test',
  'cli.js'
)
const args = process.argv.slice(2)

const child = spawn(process.execPath, [cli, 'test', ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_DEV_PORT: port,
    PLAYWRIGHT_BASE_URL: `http://localhost:${port}`,
  },
})
child.on('exit', (code) => process.exit(code ?? 1))
