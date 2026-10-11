import path from 'node:path'
import { escapeHtml } from './markdown.js'

/** @typedef {import('./scanner.js').ContentTree} ContentTree */
/** @typedef {import('./scanner.js').Section} Section */
/** @typedef {import('./scanner.js').Pattern} Pattern */
/** @typedef {import('./scanner.js').Variant} Variant */
/** @typedef {import('./options.js').ResolvedOptions} ResolvedOptions */
/** @typedef {import('./markdown.js').Renderer} Renderer */

/**
 * @typedef {object} PageAssets
 * @property {string} head  Tags placed first in `<head>` (the guide's own CSS).
 * @property {string} entry URL of the module script that loads project CSS and JS.
 * @property {string[]} urlStyles Stylesheet URLs linked as-is, after the guide's CSS.
 * @property {string[]} urlScripts Script URLs loaded as-is at the end of `<body>`.
 */

/** Marks where the guide's stylesheet goes in a production build. */
export const STYLE_PLACEHOLDER = '<!--style-guide:style-->'

/**
 * @param {string} id
 * @param {string} title
 * @param {string} [children] A nested list.
 * @param {string} [className]
 */
const navItem = (id, title, children = '', className = '') =>
  `<li${className ? ` class="${className}"` : ''}><a href="#${id}">${escapeHtml(title)}</a>${children}</li>`

/** @param {string[]} items */
const navList = (items) => (items.length ? `<ul class="sg-nav-list">${items.join('')}</ul>` : '')

/**
 * @param {Pattern} pattern
 * @param {1 | 2 | 3} depth
 */
function renderNavPattern(pattern, depth) {
  const variants =
    depth >= 3 && pattern.variants.length > 1
      ? navList(pattern.variants.map((variant) => navItem(variant.id, variant.title)))
      : ''
  return navItem(pattern.id, pattern.title, variants)
}

/**
 * @param {ContentTree} tree
 * @param {ResolvedOptions} options
 */
function renderNav(tree, options) {
  const { depth } = options.nav
  return navList(
    tree.sections.map((section) =>
      navItem(
        section.id,
        section.title,
        depth >= 2 ? navList(section.patterns.map((pattern) => renderNavPattern(pattern, depth))) : '',
        'sg-nav-group',
      ),
    ),
  )
}

const SEARCH_LIST_ID = 'sg-search-list'

/**
 * The search options: every nav item, in nav order. A title shared by several
 * items gets its path added, like "Primary (Forms › Buttons)", so each option
 * names one place.
 *
 * @param {ContentTree} tree
 * @param {ResolvedOptions} options
 * @returns {Array<{ id: string, value: string }>}
 */
export function searchEntries(tree, options) {
  const { depth } = options.nav
  /** @type {Array<{ id: string, title: string, path: string[] }>} */
  const items = []
  for (const section of tree.sections) {
    items.push({ id: section.id, title: section.title, path: [] })
    if (depth < 2) continue
    for (const pattern of section.patterns) {
      items.push({ id: pattern.id, title: pattern.title, path: [section.title] })
      if (depth < 3 || pattern.variants.length < 2) continue
      for (const variant of pattern.variants) {
        items.push({ id: variant.id, title: variant.title, path: [section.title, pattern.title] })
      }
    }
  }

  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const { title } of items) counts.set(title, (counts.get(title) ?? 0) + 1)
  return items.map(({ id, title, path }) => ({
    id,
    value: path.length && (counts.get(title) ?? 0) > 1 ? `${title} (${path.join(' › ')})` : title,
  }))
}

/**
 * The shared `<datalist>` both search inputs suggest from.
 *
 * @param {Array<{ id: string, value: string }>} entries
 */
function renderSearchList(entries) {
  const optionTags = entries.map(
    ({ id, value }) => `<option value="${escapeHtml(value)}" data-sg-target="${id}"></option>`,
  )
  return `<datalist id="${SEARCH_LIST_ID}">\n${optionTags.join('\n')}\n</datalist>`
}

/**
 * A search form. It starts hidden; the guide's script shows it, since it
 * needs JS to jump to a result.
 *
 * @param {'header' | 'sidebar'} place
 */
function renderSearch(place) {
  const id = `sg-search-${place}`
  return `<form class="sg-search sg-search--${place}" role="search" data-sg-search hidden>
<label class="sg-visually-hidden" for="${id}">Search the style guide</label>
<input class="sg-search-input" type="search" id="${id}" list="${SEARCH_LIST_ID}" placeholder="Search" autocomplete="off">
</form>`
}

const BACK_TO_TOP = '<a class="sg-top-link" href="#sg-top">Back to top</a>'

/**
 * @typedef {object} RenderContext
 * @property {Renderer} renderer
 * @property {string} dir The content folder, so errors can name docs relative to it.
 */

/**
 * A node's doc: Markdown, or MDX rendered from its file.
 *
 * @param {{ doc: string | null, docFile: string | null }} node
 * @param {RenderContext} ctx
 */
async function renderDoc(node, ctx) {
  if (!node.doc || !node.docFile) return ''
  const html = node.docFile.toLowerCase().endsWith('.mdx')
    ? await ctx.renderer.renderMdx(
        node.docFile,
        path.relative(ctx.dir, node.docFile).replaceAll(path.sep, '/'),
      )
    : await ctx.renderer.renderMarkdown(node.doc)
  return `<div class="sg-doc">${html}</div>`
}

/**
 * A variant's doc, rendered example and source panel.
 *
 * @param {Variant} variant
 * @param {RenderContext} ctx
 */
async function renderVariantBody(variant, ctx) {
  const parts = [await renderDoc(variant, ctx)]
  if (variant.html !== null) {
    parts.push(
      `<div class="sg-preview">
${variant.html}
</div>`,
      '<details class="sg-source">',
      '<summary class="sg-source-toggle">View source</summary>',
      '<div class="sg-source-code">',
      '<button type="button" class="sg-btn sg-copy" data-sg-copy hidden>Copy</button>',
      await ctx.renderer.highlight(variant.html, 'html'),
      '</div>',
      '</details>',
    )
  }
  return parts.filter(Boolean).join('\n')
}

/**
 * A pattern with one variant shows it directly. With several, each variant
 * gets its own heading.
 *
 * @param {Pattern} pattern
 * @param {RenderContext} ctx
 */
async function renderPattern(pattern, ctx) {
  const parts = [
    `<h3 class="sg-title sg-pattern-title">${escapeHtml(pattern.title)}</h3>`,
    await renderDoc(pattern, ctx),
  ]

  if (pattern.variants.length === 1) {
    parts.push(await renderVariantBody(pattern.variants[0], ctx))
  } else {
    for (const variant of pattern.variants) {
      parts.push(
        `<div class="sg-variant" id="${variant.id}">`,
        `<h4 class="sg-title sg-variant-title">${escapeHtml(variant.title)}</h4>`,
        await renderVariantBody(variant, ctx),
        '</div>',
      )
    }
  }

  parts.push(BACK_TO_TOP)
  return `<article class="sg-pattern" id="${pattern.id}">
${parts.filter(Boolean).join('\n')}
</article>`
}

/**
 * @param {Section} section
 * @param {RenderContext} ctx
 */
async function renderSection(section, ctx) {
  const parts = [
    `<h2 class="sg-title sg-group-title">${escapeHtml(section.title)}</h2>`,
    await renderDoc(section, ctx),
  ]
  for (const pattern of section.patterns) parts.push(await renderPattern(pattern, ctx))
  return `<section class="sg-group" id="${section.id}">
${parts.filter(Boolean).join('\n')}
</section>`
}

/**
 * Renders the whole style guide page.
 *
 * @param {ContentTree} tree
 * @param {ResolvedOptions} options
 * @param {PageAssets} assets
 * @param {Renderer} renderer
 * @returns {Promise<string>}
 */
export async function renderPage(tree, options, assets, renderer) {
  const title = escapeHtml(options.title)
  /** @type {string[]} */
  const main = []

  const ctx = { renderer, dir: tree.dir }
  for (const section of tree.sections) main.push(await renderSection(section, ctx))

  const styleLinks = assets.urlStyles.map(
    (href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`,
  )
  const scriptTags = assets.urlScripts.map(
    (src) => `<script src="${escapeHtml(src)}"></script>`,
  )

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script>document.documentElement.classList.add('sg-js')</script>
${assets.head}
${styleLinks.join('\n')}
<script type="module" src="${escapeHtml(assets.entry)}"></script>
</head>
<body class="sg-body">
<a class="sg-skip-link" href="#sg-main">Skip to main content</a>
<div class="sg-layout">
<header class="sg-header" id="sg-top">
<a class="sg-brand" href="#sg-top">${title}</a>
${renderSearch('header')}
<button type="button" class="sg-nav-toggle" aria-expanded="false" aria-controls="sg-nav" hidden>Menu</button>
</header>
${renderSearchList(searchEntries(tree, options))}
<nav class="sg-sidebar" id="sg-nav" aria-label="Style guide">
<div class="sg-sidebar-inner">
${renderSearch('sidebar')}
${renderNav(tree, options)}
</div>
</nav>
<main class="sg-main" id="sg-main">
${main.join('\n')}
</main>
</div>
${scriptTags.join('\n')}
</body>
</html>
`
}
