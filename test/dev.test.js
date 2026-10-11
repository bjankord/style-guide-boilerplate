import path from 'node:path'
import { createServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import styleGuide from '../src/index.js'

const FIXTURE = path.join(import.meta.dirname, 'fixture')

describe('dev server mounted under a base', () => {
  /** @type {import('vite').ViteDevServer} */
  let server
  /** @type {string} */
  let origin

  beforeAll(async () => {
    server = await createServer({
      root: FIXTURE,
      configFile: false,
      logLevel: 'silent',
      base: '/app/',
      server: { port: 0, strictPort: false },
      plugins: [styleGuide({ styles: ['./styles/main.css'], path: 'style-guide' })],
    })
    await server.listen()
    const address = server.httpServer?.address()
    origin = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
  })

  afterAll(async () => {
    await server?.close()
  })

  it('redirects the path without a trailing slash', async () => {
    const response = await fetch(`${origin}/app/style-guide?x=1`, { redirect: 'manual' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/app/style-guide/?x=1')
  })

  it('serves the guide with base-prefixed asset URLs', async () => {
    const response = await fetch(`${origin}/app/style-guide/`)
    expect(response.status).toBe(200)
    const html = await response.text()

    expect(html).toContain('<script type="module" src="/app/@vite/client"></script>')
    expect(html).toContain('src="/app/@style-guide/entry.js"')
    const cssHref = html.match(/<link rel="stylesheet" href="([^"]+)"/)?.[1] ?? ''
    expect(cssHref).toMatch(/^\/app\/@fs\/.+\/src\/client\/style-guide\.css$/)

    const css = await fetch(origin + cssHref, { headers: { accept: 'text/css,*/*;q=0.1' } })
    expect(css.headers.get('content-type')).toMatch(/text\/css/)
    expect(await css.text()).toContain('.sg-layout')
  })

  it('serves the virtual entry that imports project CSS and the guide script', async () => {
    const code = await (await fetch(`${origin}/app/@style-guide/entry.js`)).text()
    expect(code).toMatch(/styles\/main\.css/)
    expect(code).toMatch(/client\/style-guide\.js/)
  })

  it('leaves other URLs to Vite', async () => {
    const response = await fetch(`${origin}/app/`)
    expect(await response.text()).not.toContain('sg-layout')
  })
})
