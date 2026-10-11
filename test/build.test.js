import { existsSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import styleGuide from '../src/index.js'

const FIXTURE = path.join(import.meta.dirname, 'fixture')

const NAMED = /** @type {Record<string, string>} */ ({ lt: '<', gt: '>', quot: '"', amp: '&' })

/** Strips tags and decodes entities in one pass, like a browser's textContent. */
const decode = (/** @type {string} */ html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:#x([\da-f]+)|(lt|gt|quot|amp));/gi, (_, hex, name) =>
      hex ? String.fromCodePoint(parseInt(hex, 16)) : NAMED[name],
    )

/** @param {string} dir */
const listFiles = async (dir) =>
  (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
    .sort()

/** @type {string[]} */
const tmpDirs = []
const makeTmp = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sg-build-'))
  tmpDirs.push(dir)
  return dir
}

afterAll(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('vite build on the fixture', () => {
  /** @type {string} */
  let outDir
  /** @type {string[]} */
  let files
  /** @type {string} */
  let html

  beforeAll(async () => {
    outDir = await makeTmp()
    await build({
      configFile: path.join(FIXTURE, 'vite.config.js'),
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
    })
    files = await listFiles(outDir)
    html = await readFile(path.join(outDir, 'index.html'), 'utf8')
  })

  it('writes a static page with separate guide and project CSS', async () => {
    const css = files.filter((file) => file.endsWith('.css'))
    expect(files).toContain('index.html')
    expect(css).toHaveLength(2)

    const guide = css.find((file) => file.includes('style-guide'))
    const project = css.find((file) => file !== guide)
    expect(guide).toBeDefined()
    expect(project).toBeDefined()

    const guideCss = await readFile(path.join(outDir, String(guide)), 'utf8')
    const projectCss = await readFile(path.join(outDir, String(project)), 'utf8')
    expect(guideCss).toContain('.sg-layout')
    expect(guideCss).not.toContain('--brand')
    expect(projectCss).toContain('--brand')
    expect(projectCss).not.toContain('.sg-')
  })

  it('links the guide CSS before the project CSS, with relative URLs', () => {
    const hrefs = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1])
    expect(hrefs[0]).toMatch(/^\.\/assets\/style-guide-[\w-]+\.css$/)
    expect(hrefs).toContain('https://example.com/remote.css')
    expect(hrefs.at(-1)).toMatch(/^\.\/assets\/.+\.css$/)
    expect(html).toMatch(/<script type="module" crossorigin src="\.\/assets\/[\w-]+\.js"><\/script>/)
    expect(html).not.toContain('@style-guide')
  })

  it('bundles the project script and the guide script', async () => {
    const js = files.filter((file) => file.endsWith('.js'))
    const code = (await Promise.all(js.map((file) => readFile(path.join(outDir, file), 'utf8')))).join('\n')
    expect(code).toContain('projectScript')
    expect(code).toContain('data-sg-copy')
  })

  it('renders examples raw and escapes their source', () => {
    const article = html.match(/<article class="sg-pattern" id="sg-base-entities">[\s\S]*?<\/article>/)?.[0] ?? ''
    expect(article).toContain('<div class="sg-preview">\n<p>Fish &amp; chips &lt;3</p>\n</div>')

    const pre = article.match(/<pre[\s\S]*?<\/pre>/)?.[0] ?? ''
    expect(pre).not.toContain('<p>')
    expect(decode(pre)).toBe('<p>Fish &amp; chips &lt;3</p>')
  })
})

describe('vite build mounted in an app', () => {
  /** @type {string} */
  let appRoot

  beforeAll(async () => {
    appRoot = await makeTmp()
    await writeFile(
      path.join(appRoot, 'index.html'),
      '<!doctype html><title>App</title><script type="module" src="/main.js"></script>',
    )
    await writeFile(path.join(appRoot, 'main.js'), 'document.title = "App"')
  })

  /** @param {Partial<import('../src/options.js').StyleGuideOptions>} options */
  const buildApp = async (options) => {
    const outDir = path.join(appRoot, 'dist')
    await build({
      root: appRoot,
      configFile: false,
      logLevel: 'silent',
      base: '/app/',
      build: { outDir, emptyOutDir: true },
      plugins: [
        styleGuide({
          content: path.join(FIXTURE, 'style-guide'),
          styles: [path.join(FIXTURE, 'styles/main.css')],
          path: '/style-guide/',
          ...options,
        }),
      ],
    })
    return outDir
  }

  it('ships the guide in a sub-folder next to the app', async () => {
    const outDir = await buildApp({})
    const files = await listFiles(outDir)
    expect(files).toContain('index.html')
    expect(files).toContain('style-guide/index.html')

    const app = await readFile(path.join(outDir, 'index.html'), 'utf8')
    expect(app).toMatch(/src="\/app\/assets\//)

    const guide = await readFile(path.join(outDir, 'style-guide/index.html'), 'utf8')
    expect(guide).toMatch(/href="\.\.\/assets\/style-guide-[\w-]+\.css"/)
    expect(guide).toMatch(/src="\.\.\/assets\/[\w-]+\.js"/)
    expect(guide).not.toMatch(/(?:src|href)="\/app\/assets\//)
  })

  it('leaves the guide out when build is false', async () => {
    const outDir = await buildApp({ build: false })
    expect(existsSync(path.join(outDir, 'index.html'))).toBe(true)
    expect(existsSync(path.join(outDir, 'style-guide'))).toBe(false)
  })
})
