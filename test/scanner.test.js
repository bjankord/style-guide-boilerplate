import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseName, scanContent, titleFromName } from '../src/scanner.js'

const FIXTURE = path.join(import.meta.dirname, 'fixture/style-guide')

/**
 * Sections and patterns as nested titles. Patterns with several variants list
 * their variant titles.
 *
 * @param {import('../src/scanner.js').Section[]} sections
 */
const outline = (sections) =>
  sections.map((section) => ({
    [section.title]: section.patterns.map((pattern) =>
      pattern.variants.length > 1
        ? { [pattern.title]: pattern.variants.map((variant) => variant.title) }
        : pattern.title,
    ),
  }))

/**
 * @param {import('../src/scanner.js').ContentTree} tree
 * @param {string} id
 */
const sectionById = (tree, id) => {
  const section = tree.sections.find((s) => s.id === id)
  if (!section) throw new Error(`No section ${id}`)
  return section
}

describe('parseName', () => {
  it('splits a number prefix off the name', () => {
    expect(parseName('01-headings')).toEqual({ order: 1, name: 'headings' })
    expect(parseName('10_forms')).toEqual({ order: 10, name: 'forms' })
  })

  it('leaves names without a prefix alone', () => {
    expect(parseName('buttons')).toEqual({ order: undefined, name: 'buttons' })
    expect(parseName('404')).toEqual({ order: undefined, name: '404' })
  })
})

describe('titleFromName', () => {
  it('turns file names into sentence-case titles', () => {
    expect(titleFromName('form-buttons')).toBe('Form buttons')
    expect(titleFromName('form_fields--default')).toBe('Form fields default')
  })
})

describe('scanContent', () => {
  /** @type {string | undefined} */
  let tmp

  afterEach(async () => {
    if (tmp) await rm(tmp, { recursive: true, force: true })
    tmp = undefined
  })

  /** @param {Record<string, string>} files */
  const makeContent = async (files) => {
    tmp = await mkdtemp(path.join(tmpdir(), 'sg-scan-'))
    for (const [file, text] of Object.entries(files)) {
      const full = path.join(tmp, file)
      await mkdir(path.dirname(full), { recursive: true })
      await writeFile(full, text)
    }
    return tmp
  }

  it('builds the fixture tree in display order', async () => {
    const tree = await scanContent(FIXTURE)
    expect(outline(tree.sections)).toEqual([
      { 'Getting started': [] },
      { Colors: ['Brand', 'Neutrals'] },
      { Fonts: [] },
      { Spacing: [] },
      { Guidelines: ['Writing'] },
      { Base: ['Entities', { Headings: ['Sizes', 'With links'] }, 'Lists'] },
      { Components: ['Button styles', 'Alerts'] },
    ])
    expect(tree.warnings).toEqual([])
  })

  it('reads section and pattern docs from index.md', async () => {
    const tree = await scanContent(FIXTURE)
    const base = sectionById(tree, 'sg-base')
    const headings = base.patterns[1]

    expect(base).toMatchObject({
      id: 'sg-base',
      doc: "Plain HTML elements, styled by the project's base CSS.",
    })
    expect(headings).toMatchObject({ id: 'sg-base-headings', doc: 'Use one `h1` per page.' })
    expect(headings.variants[0]).toMatchObject({
      id: 'sg-base-headings-sizes',
      html: '<h1>Heading 1</h1>\n<h2>Heading 2</h2>',
      doc: 'All heading levels, largest first.',
    })
    expect(headings.variants[0].docFile).toMatch(/01-sizes[\\/]index\.md$/)
    expect(headings.variants[1]).toMatchObject({ id: 'sg-base-headings-with-links', doc: null })
  })

  it('reads a pattern folder with a single example file', async () => {
    const tree = await scanContent(FIXTURE)
    expect(sectionById(tree, 'sg-base').patterns[0]).toMatchObject({
      type: 'pattern',
      id: 'sg-base-entities',
      title: 'Entities',
      doc: null,
      variants: [{ html: '<p>Fish &amp; chips &lt;3</p>' }],
    })
  })

  it('keeps a doc-only variant', async () => {
    const tree = await scanContent(FIXTURE)
    expect(sectionById(tree, 'sg-guidelines').patterns[0].variants).toMatchObject([
      { html: null, doc: 'Write in plain language.' },
    ])
  })

  it('sorts numbered entries first, then the rest alphabetically, at every level', async () => {
    const dir = await makeContent({
      'zebra/p/a.html': '',
      '02-second/p/a.html': '',
      'apple/p/a.html': '',
      '10-tenth/p/a.html': '',
      '01-first/item-10/a.html': '',
      '01-first/item-9/a.html': '',
      '01-first/pattern/b.html': '',
      '01-first/pattern/02-two.html': '',
      '01-first/pattern/01-one.html': '',
      '01-first/pattern/a.html': '',
    })
    const tree = await scanContent(dir)
    expect(outline(tree.sections)).toEqual([
      { First: ['Item 9', 'Item 10', { Pattern: ['One', 'Two', 'A', 'B'] }] },
      { Second: ['P'] },
      { Tenth: ['P'] },
      { Apple: ['P'] },
      { Zebra: ['P'] },
    ])
  })

  it('lets index.md and .md front matter override titles and order', async () => {
    const dir = await makeContent({
      'base/index.md': '---\ntitle: Base HTML\n---',
      'base/alpha/a.html': '',
      'base/beta/index.md': '---\ntitle: Beta first\norder: 0\n---\nBeta docs',
      'base/beta/x.html': '',
      'base/beta/y.html': '',
      'base/beta/y.md': '---\ntitle: Why\norder: 1\n---',
    })
    const tree = await scanContent(dir)
    expect(outline(tree.sections)).toEqual([
      { 'Base HTML': [{ 'Beta first': ['Why', 'X'] }, 'Alpha'] },
    ])
    expect(tree.sections[0].doc).toBeNull()
    expect(tree.sections[0].patterns[0].doc).toBe('Beta docs')
  })

  it('warns about example files outside a pattern folder', async () => {
    const dir = await makeContent({
      'intro.md': 'Intro',
      'colors.html': '<p>c</p>',
      'base/index.md': 'Base docs',
      'base/entities.html': '<p>e</p>',
      'base/notes.md': 'Notes',
      'base/notes.txt': 'not an example',
      'base/lists/lists.html': '<ul></ul>',
    })
    const tree = await scanContent(dir)
    expect(tree.warnings).toEqual([
      'Ignoring "base/entities.html": examples go in a pattern folder, like "base/entities/entities.html".',
      'Ignoring "base/notes.md": examples go in a pattern folder, like "base/notes/notes.md".',
      'Ignoring "colors.html": the content folder holds section folders, like "colors/index.md".',
      'Ignoring "intro.md": the content folder holds section folders, like "intro/index.md".',
    ])
    expect(outline(tree.sections)).toEqual([{ Base: ['Lists'] }])
    expect(tree.sections[0].doc).toBe('Base docs')
  })

  describe('MDX docs', () => {
    it('reads .mdx docs from the fixture', async () => {
      const tree = await scanContent(FIXTURE)
      const [brand, neutrals] = sectionById(tree, 'sg-colors').patterns
      expect(brand.docFile).toMatch(/brand[\\/]index\.mdx$/)
      expect(brand.doc).toContain("import brand from '../../../tokens/brand.json'")
      expect(neutrals.docFile).toMatch(/neutrals[\\/]index\.mdx$/)
      expect(sectionById(tree, 'sg-spacing').docFile).toMatch(/04-spacing[\\/]index\.mdx$/)
    })

    it('accepts .mdx wherever .md works, with front matter', async () => {
      const dir = await makeContent({
        'tokens/index.mdx': '---\ntitle: Design tokens\n---\nSection doc',
        'tokens/colors/index.mdx': 'Pattern doc',
        'tokens/colors/brand.html': '<p>b</p>',
        'tokens/colors/brand.mdx': '---\norder: 1\n---\nVariant doc',
        'tokens/colors/02-folder/swatch.html': '<p>s</p>',
        'tokens/colors/02-folder/index.mdx': 'Folder variant doc',
      })
      const tree = await scanContent(dir)
      const section = tree.sections[0]
      expect(section).toMatchObject({ title: 'Design tokens', doc: 'Section doc' })
      expect(section.patterns[0]).toMatchObject({ doc: 'Pattern doc' })
      expect(section.patterns[0].variants).toMatchObject([
        { title: 'Brand', doc: 'Variant doc', html: '<p>b</p>' },
        { title: 'Folder', doc: 'Folder variant doc', html: '<p>s</p>' },
      ])
      expect(tree.warnings).toEqual([])
    })

    it('prefers .mdx over .md for the same example, with a warning', async () => {
      const dir = await makeContent({
        'base/index.md': 'Markdown',
        'base/index.mdx': 'MDX',
        'base/card/card.html': '',
        'base/card/card.md': 'Markdown',
        'base/card/card.mdx': 'MDX',
      })
      const tree = await scanContent(dir)
      expect(tree.sections[0].doc).toBe('MDX')
      expect(tree.sections[0].patterns[0].variants[0].doc).toBe('MDX')
      expect(tree.warnings).toEqual([
        'Ignoring "base/card/card.md": "card.mdx" documents the same example.',
        'Ignoring "base/index.md": "index.mdx" documents the same example.',
      ])
    })
  })

  describe('variant folders', () => {
    it('reads the fixture variant folders with their docs', async () => {
      const tree = await scanContent(FIXTURE)
      const headings = sectionById(tree, 'sg-base').patterns[1]
      expect(headings.variants).toMatchObject([
        { title: 'Sizes', order: 1, doc: 'All heading levels, largest first.' },
        { title: 'With links', order: 2, doc: null, docFile: null },
      ])
      expect(headings.variants[1].htmlFile).toMatch(/02-with-links[\\/]with-links\.html$/)
    })

    it('sorts variant files and folders together, with any file names', async () => {
      const dir = await makeContent({
        'base/buttons/index.md': 'Buttons docs',
        'base/buttons/03-ghost.html': '<button>Ghost</button>',
        'base/buttons/01-primary/button.html': '<button>Primary</button>',
        'base/buttons/01-primary/notes.md': '---\ntitle: Primary button\n---\nUse once per view.',
        'base/buttons/02-secondary/index.html': '<button>Secondary</button>',
      })
      const tree = await scanContent(dir)
      const buttons = sectionById(tree, 'sg-base').patterns[0]

      expect(buttons.doc).toBe('Buttons docs')
      expect(buttons.variants).toMatchObject([
        { id: 'sg-base-buttons-primary', title: 'Primary button', html: '<button>Primary</button>', doc: 'Use once per view.' },
        { id: 'sg-base-buttons-secondary', title: 'Secondary', html: '<button>Secondary</button>' },
        { id: 'sg-base-buttons-ghost', title: 'Ghost' },
      ])
      expect(tree.warnings).toEqual([])
    })

    it('treats a folder with only a .md file as a doc-only variant', async () => {
      const dir = await makeContent({ 'base/voice/01-tone/index.md': 'Be friendly.' })
      const tree = await scanContent(dir)
      expect(sectionById(tree, 'sg-base').patterns[0].variants).toMatchObject([
        { title: 'Tone', html: null, doc: 'Be friendly.' },
      ])
    })

    it('warns about variant folders it can not use', async () => {
      const dir = await makeContent({
        'base/buttons/ok/a.html': '',
        'base/buttons/ok/deeper/b.html': '',
        'base/buttons/two-examples/a.html': '',
        'base/buttons/two-examples/b.html': '',
        'base/buttons/empty/notes.txt': '',
      })
      const tree = await scanContent(dir)
      expect(tree.warnings).toEqual([
        'Ignoring "base/buttons/empty": it has no .html, .md or .mdx file.',
        `Ignoring "base/buttons/ok/deeper": variant folders can't contain folders.`,
        'Ignoring "base/buttons/two-examples": a variant folder holds one .html file and one .md or .mdx file at most.',
      ])
      expect(outline(tree.sections)).toEqual([{ Base: ['Buttons'] }])
    })
  })

  it('makes ids unique and skips dotfiles and other file types', async () => {
    const dir = await makeContent({
      'base/card/a.html': '<p>1</p>',
      'base/01-card/a.md': 'Second card',
      'base/.hidden/a.html': '<p>hidden</p>',
      'base/notes/notes.txt': 'ignored',
    })
    const tree = await scanContent(dir)
    expect(tree.sections[0].patterns.map((pattern) => pattern.id)).toEqual([
      'sg-base-card',
      'sg-base-card-2',
      'sg-base-notes',
    ])
    expect(tree.sections[0].patterns[2].variants).toEqual([])
  })

  it('normalizes line endings and drops trailing whitespace', async () => {
    const dir = await makeContent({ 'base/p/crlf.html': '﻿<p>\r\n  hi\r\n</p>\r\n\r\n' })
    const tree = await scanContent(dir)
    expect(tree.sections[0].patterns[0].variants[0].html).toBe('<p>\n  hi\n</p>')
  })

  it('returns an empty tree when the folder is missing', async () => {
    const tree = await scanContent(path.join(tmpdir(), 'sg-does-not-exist'))
    expect(tree).toMatchObject({ sections: [], warnings: [] })
  })
})
