import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from '@mdx-js/mdx'
import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import remarkFrontmatter from 'remark-frontmatter'
import { createHighlighter } from 'shiki'
import { createServer, normalizePath } from 'vite'

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE = '@bjankord/style-guide-boilerplate'

/**
 * Compiled MDX and JSX import the runtime by package name (the dev variant in
 * development). Aliasing it means it resolves the same way however the package
 * is installed, including from its own fixture.
 */
const RUNTIME = normalizePath(path.join(SRC_DIR, 'jsx-runtime.js'))
const PACKAGE_ALIASES = [
  { find: `${PACKAGE}/jsx-runtime`, replacement: RUNTIME },
  { find: `${PACKAGE}/jsx-dev-runtime`, replacement: RUNTIME },
]

/**
 * Compiles `.mdx` files to modules whose default export renders the doc with
 * the guide's string JSX runtime. Front matter is skipped (the scanner reads
 * it), and fenced code is highlighted with Shiki like Markdown docs.
 *
 * @returns {import('vite').Plugin}
 */
export function mdxPlugin() {
  // Start with no languages and load each on first use. The default
  // @shikijs/rehype setup loads every language up front, which takes seconds.
  /** @type {Promise<import('shiki').Highlighter> | undefined} */
  let highlighter

  return {
    name: 'style-guide-boilerplate:mdx',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.split('?')[0].endsWith('.mdx')) return
      highlighter ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: [] })
      const compiled = await compile(code, {
        jsxImportSource: PACKAGE,
        development: false,
        remarkPlugins: [remarkFrontmatter],
        rehypePlugins: [[
          rehypeShikiFromHighlighter,
          await highlighter,
          {
            themes: { light: 'github-light', dark: 'github-dark' },
            defaultColor: false,
            lazy: true,
            fallbackLanguage: 'text',
          },
        ]],
      })
      return { code: String(compiled), map: null }
    },
  }
}

/**
 * @typedef {object} MdxLoader
 * @property {(file: string) => Promise<(props: object) => unknown>} load
 *   Loads an `.mdx` file and returns its component.
 * @property {() => Promise<string[]>} files Every file the loaded docs depend on.
 * @property {() => Promise<void>} invalidate Forgets loaded modules, so the
 *   next load picks up changes.
 * @property {() => Promise<void>} close
 */

/**
 * Loads MDX docs through a small internal Vite server, so their imports (JSON,
 * components, aliases) resolve the way they do in the project.
 *
 * @param {{ root: string, alias?: import('vite').Alias[] }} options
 * @returns {MdxLoader}
 */
export function createMdxLoader({ root, alias = [] }) {
  /** @type {Promise<import('vite').ViteDevServer> | undefined} */
  let serverPromise

  const start = () => {
    serverPromise ??= createServer({
      configFile: false,
      root,
      logLevel: 'error',
      appType: 'custom',
      server: { middlewareMode: true, hmr: false, watch: null },
      resolve: { alias: [...PACKAGE_ALIASES, ...alias] },
      // Components that MDX docs import (.jsx, .tsx) render with the guide's
      // runtime too. This only affects this internal server, not the project.
      oxc: { jsx: { runtime: 'automatic', importSource: PACKAGE } },
      optimizeDeps: { noDiscovery: true, include: [] },
      plugins: [mdxPlugin()],
    })
    return serverPromise
  }

  /** @param {import('vite').ViteDevServer} server */
  const ssrGraph = (server) => server.environments.ssr.moduleGraph

  return {
    async load(file) {
      const server = await start()
      // An absolute path, so the doc's own relative imports resolve.
      const module = await server.ssrLoadModule(normalizePath(path.resolve(file)))
      return module.default
    },

    async files() {
      const server = await serverPromise
      return server ? [...ssrGraph(server).fileToModulesMap.keys()] : []
    },

    async invalidate() {
      const server = await serverPromise
      if (server) ssrGraph(server).invalidateAll()
    },

    async close() {
      const server = await serverPromise
      serverPromise = undefined
      await server?.close()
    },
  }
}
