import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createRenderer } from '../src/markdown.js'
import { createMdxLoader } from '../src/mdx.js'
import { resolveOptions } from '../src/options.js'
import { renderPage, searchEntries } from '../src/render.js'
import { scanContent } from '../src/scanner.js'
import fixtureOptions from './fixture/options.js'

const FIXTURE = path.join(import.meta.dirname, 'fixture/style-guide')
const mdx = createMdxLoader({ root: path.join(import.meta.dirname, 'fixture') })
const renderer = createRenderer({ loadMdx: (file) => mdx.load(file) })

afterAll(() => mdx.close())

/** @type {import('../src/render.js').PageAssets} */
const assets = {
  head: '<link rel="stylesheet" href="/style-guide.css">',
  entry: '/@style-guide/entry.js',
  urlStyles: ['https://example.com/remote.css'],
  urlScripts: [],
}

describe('renderer', () => {
  it('highlights fenced code in Markdown with both themes', async () => {
    const html = await renderer.renderMarkdown('```css\na { color: red }\n```')
    expect(html).toContain('class="shiki shiki-themes github-light github-dark"')
    expect(html).toContain('--shiki-dark:')
  })

  it('falls back to plain text for unknown languages', async () => {
    const html = await renderer.renderMarkdown('```nope\n<b>x</b>\n```')
    expect(html).toContain('<pre class="shiki')
    expect(html).toContain('&#x3C;b>x&#x3C;/b>')
  })

  it('allows raw HTML in Markdown', async () => {
    expect(await renderer.renderMarkdown('<kbd>Ctrl</kbd>')).toContain('<kbd>Ctrl</kbd>')
  })
})

/**
 * The first element that starts with `open`, up to its first `close`.
 *
 * @param {string} html
 * @param {string} open
 * @param {string} close
 */
const slice = (html, open, close) => {
  const start = html.indexOf(open)
  return start === -1 ? '' : html.slice(start, html.indexOf(close, start) + close.length)
}

describe('renderPage', () => {
  it('matches the snapshot for the fixture', async () => {
    const tree = await scanContent(FIXTURE)
    const html = await renderPage(tree, resolveOptions(fixtureOptions), assets, renderer)
    await expect(html).toMatchFileSnapshot('__snapshots__/fixture.html')
  })

  it('renders an empty guide with an escaped title', async () => {
    const html = await renderPage(
      { dir: '', sections: [], warnings: [] },
      resolveOptions({ title: 'Empty <Guide>' }),
      { ...assets, urlStyles: [] },
      renderer,
    )
    expect(html).not.toContain('sg-nav-list')
    expect(html).toContain('<title>Empty &lt;Guide&gt;</title>')
    expect(html).toContain('<a class="sg-brand" href="#sg-top">Empty &lt;Guide&gt;</a>')
  })

  describe('nav depth', () => {
    /** @param {1 | 2 | 3 | undefined} depth */
    const navLinks = async (depth) => {
      const tree = await scanContent(FIXTURE)
      const html = await renderPage(tree, resolveOptions({ nav: { depth } }), assets, renderer)
      const nav = slice(html, '<nav', '</nav>')
      return [...nav.matchAll(/href="#([^"]+)"/g)].map((match) => match[1])
    }

    it('lists sections, patterns and variants by default', async () => {
      const links = await navLinks(undefined)
      expect(links).toEqual(await navLinks(3))
      expect(links).toEqual([
        'sg-getting-started',
        'sg-colors', 'sg-colors-brand', 'sg-colors-neutrals',
        'sg-fonts',
        'sg-spacing',
        'sg-guidelines', 'sg-guidelines-writing',
        'sg-base', 'sg-base-entities',
        'sg-base-headings', 'sg-base-headings-sizes', 'sg-base-headings-with-links',
        'sg-base-lists',
        'sg-components', 'sg-components-buttons', 'sg-components-alerts',
      ])
    })

    it('stops at patterns at depth 2', async () => {
      const links = await navLinks(2)
      expect(links).toContain('sg-base-headings')
      expect(links).not.toContain('sg-base-headings-sizes')
    })

    it('lists only sections at depth 1', async () => {
      expect(await navLinks(1)).toEqual([
        'sg-getting-started', 'sg-colors', 'sg-fonts', 'sg-spacing', 'sg-guidelines', 'sg-base', 'sg-components',
      ])
    })

    it('rejects other depths', () => {
      // @ts-expect-error Testing an invalid value.
      expect(() => resolveOptions({ nav: { depth: 4 } })).toThrow('nav.depth must be 1, 2 or 3')
    })
  })

  it('shows variant headings only for patterns with several variants', async () => {
    const tree = await scanContent(FIXTURE)
    const html = await renderPage(tree, resolveOptions({}), assets, renderer)
    const pattern = (/** @type {string} */ id) =>
      slice(html, `<article class="sg-pattern" id="${id}">`, '</article>')

    expect(pattern('sg-base-headings').match(/sg-variant-title/g)).toHaveLength(2)
    expect(pattern('sg-base-headings')).toContain('<h4 class="sg-title sg-variant-title">With links</h4>')
    expect(pattern('sg-base-lists')).not.toContain('sg-variant')
  })

  describe('MDX docs', () => {
    it('renders the project markup built from imported JSON', async () => {
      const tree = await scanContent(FIXTURE)
      const html = await renderPage(tree, resolveOptions({}), assets, renderer)

      const brand = slice(html, '<article class="sg-pattern" id="sg-colors-brand">', '</article>')
      expect(brand).toContain('<p>Brand colors for actions and links.</p>')
      expect(brand).toContain('<div class="swatch-color" style="background: var(--brand)"></div>')

      const neutrals = slice(html, '<article class="sg-pattern" id="sg-colors-neutrals">', '</article>')
      expect(neutrals).toContain('<div class="swatch-name">Gray 900</div>')

      const fonts = slice(html, '<section class="sg-group" id="sg-fonts">', '</section>')
      expect(fonts).toContain('<dd class="font-sample-text" style="font-family: Georgia, serif">')
      expect(fonts).toContain('style="font-family: Georgia, serif; font-weight: 700">The quick brown fox jumps over the lazy dog</dd>')

      const spacing = slice(html, '<section class="sg-group" id="sg-spacing">', '</section>')
      expect(spacing).toContain('<span class="spacing-bar" style="width: var(--space-3)"></span><code>--space-3</code> 1rem')
      // A project component (test/fixture/components/TokenTable.jsx), imported by the doc.
      expect(spacing).toContain('<tr><td><code>--space-4</code></td><td>2rem</td></tr>')
    })

    it('shows an MDX error in place of the doc and reports it', async () => {
      /** @type {string[]} */
      const errors = []
      const failing = createRenderer({
        loadMdx: async () => {
          throw new Error('Unexpected end of file')
        },
        onError: (message) => errors.push(message),
      })
      const html = await renderPage(
        {
          dir: path.resolve('/content'),
          sections: [{
            type: 'section',
            id: 'sg-x',
            title: 'X',
            order: undefined,
            doc: 'Broken <',
            docFile: path.resolve('/content/x/index.mdx'),
            patterns: [],
          }],
          warnings: [],
        },
        resolveOptions({}),
        assets,
        failing,
      )
      expect(errors).toEqual(['MDX error in x/index.mdx: Unexpected end of file'])
      expect(html).toContain('<div class="sg-doc"><pre class="sg-error">MDX error in x/index.mdx: Unexpected end of file</pre></div>')
    })
  })

  describe('search', () => {
    it('renders two hidden search forms sharing one datalist', async () => {
      const tree = await scanContent(FIXTURE)
      const html = await renderPage(tree, resolveOptions({}), assets, renderer)
      const header = slice(html, '<header', '</header>')
      const sidebar = slice(html, '<div class="sg-sidebar-inner">', '</form>')

      for (const [part, id] of [[header, 'sg-search-header'], [sidebar, 'sg-search-sidebar']]) {
        expect(part).toContain('<form class="sg-search sg-search--')
        expect(part).toContain('role="search" data-sg-search hidden>')
        expect(part).toContain(`<label class="sg-visually-hidden" for="${id}">Search the style guide</label>`)
        expect(part).toContain(`id="${id}" list="sg-search-list"`)
      }
      expect(html.match(/<datalist id="sg-search-list">/g)).toHaveLength(1)
      expect(html).toContain('<option value="With links" data-sg-target="sg-base-headings-with-links"></option>')
    })

    it('lists nav items in nav order, following nav.depth', async () => {
      const tree = await scanContent(FIXTURE)
      const all = searchEntries(tree, resolveOptions({}))
      expect(all.map((entry) => entry.value)).toEqual([
        'Getting started',
        'Colors', 'Brand', 'Neutrals',
        'Fonts',
        'Spacing',
        'Guidelines', 'Writing',
        'Base', 'Entities', 'Headings', 'Sizes', 'With links', 'Lists',
        'Components', 'Button styles', 'Alerts',
      ])
      expect(searchEntries(tree, resolveOptions({ nav: { depth: 1 } })).map((entry) => entry.id)).toEqual([
        'sg-getting-started', 'sg-colors', 'sg-fonts', 'sg-spacing', 'sg-guidelines', 'sg-base', 'sg-components',
      ])
    })

    it('adds the path to titles used more than once', async () => {
      /** @param {string} id @param {string} title @param {string[]} variants */
      const pattern = (id, title, variants) => ({
        type: /** @type {const} */ ('pattern'), id, title, order: undefined, doc: null, docFile: null,
        variants: variants.map((v) => ({
          type: /** @type {const} */ ('variant'), id: `${id}-${v.toLowerCase()}`, title: v, order: undefined,
          html: '', doc: null, htmlFile: null, docFile: null,
        })),
      })
      /** @param {string} id @param {string} title @param {ReturnType<typeof pattern>[]} patterns */
      const section = (id, title, patterns) => ({
        type: /** @type {const} */ ('section'), id, title, order: undefined, doc: null, docFile: null, patterns,
      })
      const tree = {
        dir: '',
        sections: [
          section('sg-forms', 'Forms', [pattern('sg-forms-buttons', 'Buttons', ['Primary', 'Small'])]),
          section('sg-links', 'Links', [pattern('sg-links-buttons', 'Buttons', ['Primary', 'Large'])]),
        ],
        warnings: [],
      }
      expect(searchEntries(tree, resolveOptions({})).map((entry) => entry.value)).toEqual([
        'Forms', 'Buttons (Forms)', 'Primary (Forms › Buttons)', 'Small',
        'Links', 'Buttons (Links)', 'Primary (Links › Buttons)', 'Large',
      ])
    })
  })
})
