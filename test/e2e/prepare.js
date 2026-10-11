// Copies the fixture to .tmp/e2e so tests can edit files without touching it.
// The copy sits two levels deep, so its vite.config.js still imports ../../src.
import { cp, rm } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const target = path.join(root, '.tmp/e2e')

await rm(target, { recursive: true, force: true })
await cp(path.join(root, 'test/fixture'), target, {
  recursive: true,
  filter: (source) => !source.includes(`${path.sep}dist`),
})
