/**
 * @typedef {object} StyleGuideOptions
 * @property {string} [content] Folder of `.html` examples and `.md` docs, relative to the Vite root. Default `'./style-guide'`.
 * @property {string[]} [styles] Project stylesheets. Local paths go through Vite; `http(s)://` and `//` URLs become `<link>` tags.
 * @property {string[]} [scripts] Project scripts loaded once on the page. Local paths go through Vite; URLs become `<script>` tags.
 * @property {string} [title] Page and header title. Default `'Style Guide'`.
 * @property {string} [path] Where the guide is served, under Vite's `base`. Default `'/'`.
 * @property {boolean} [build] Include the guide in `vite build`. Default `true`.
 * @property {NavOptions} [nav] Sidebar navigation settings.
 */

/**
 * @typedef {object} NavOptions
 * @property {1 | 2 | 3} [depth] How deep the sidebar goes: `1` lists sections,
 *   `2` adds their patterns, and `3` adds the variants of patterns that have
 *   more than one. Default `3`.
 */

/**
 * @typedef {object} ResolvedOptions
 * @property {string} content
 * @property {string[]} styles
 * @property {string[]} scripts
 * @property {string} title
 * @property {string} path Always starts and ends with `/`.
 * @property {boolean} build
 * @property {{ depth: 1 | 2 | 3 }} nav
 */

/** @param {string} value */
export function isUrl(value) {
  return /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(value) || value.startsWith('data:')
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizePath(value) {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/` : '/'
}

/**
 * @param {unknown} depth
 * @returns {1 | 2 | 3}
 */
function resolveDepth(depth) {
  if (depth === undefined) return 3
  if (depth === 1 || depth === 2 || depth === 3) return depth
  throw new TypeError(`[style-guide] nav.depth must be 1, 2 or 3, not ${JSON.stringify(depth)}.`)
}

/**
 * @param {StyleGuideOptions} [options]
 * @returns {ResolvedOptions}
 */
export function resolveOptions(options = {}) {
  return {
    content: options.content ?? './style-guide',
    styles: options.styles ?? [],
    scripts: options.scripts ?? [],
    title: options.title ?? 'Style Guide',
    path: normalizePath(options.path ?? '/'),
    build: options.build ?? true,
    nav: { depth: resolveDepth(options.nav?.depth) },
  }
}
