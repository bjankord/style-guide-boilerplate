import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePath } from 'vite'
import { createRenderer } from './markdown.js'
import { createMdxLoader } from './mdx.js'
import { isUrl, resolveOptions } from './options.js'
import { STYLE_PLACEHOLDER, renderPage } from './render.js'
import { scanContent } from './scanner.js'

/** @typedef {import('./options.js').StyleGuideOptions} StyleGuideOptions */

const CLIENT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'client')
const CLIENT_CSS = normalizePath(path.join(CLIENT_DIR, 'style-guide.css'))
const CLIENT_JS = normalizePath(path.join(CLIENT_DIR, 'style-guide.js'))

const ENTRY_URL = '/@style-guide/entry.js'
const ENTRY_ID = '\0style-guide:entry'

/**
 * Builds a living style guide from a folder of HTML examples and Markdown docs.
 *
 * @param {StyleGuideOptions} [userOptions]
 * @returns {import('vite').Plugin}
 */
export default function styleGuide(userOptions = {}) {
  const options = resolveOptions(userOptions)
  /** @type {import('./mdx.js').MdxLoader | undefined} */
  let mdx
  const renderer = createRenderer({
    loadMdx: (file) => {
      mdx ??= createMdxLoader({ root: config.root, alias: config.resolve.alias })
      return mdx.load(file)
    },
    onError: (message) => config.logger.warn(`[style-guide] ${message}`),
  })

  /** @type {import('vite').ResolvedConfig} */
  let config
  /** @type {'serve' | 'build'} */
  let command = 'serve'
  let contentDir = ''
  let htmlId = ''
  /** @type {string | undefined} */
  let styleRef

  /** @param {string} file Relative to the Vite root. */
  const fromRoot = (file) => normalizePath(path.resolve(config.root, file))

  const entryCode = () =>
    [
      ...options.styles.filter((file) => !isUrl(file)).map(fromRoot),
      ...options.scripts.filter((file) => !isUrl(file)).map(fromRoot),
      CLIENT_JS,
    ]
      .map((file) => `import ${JSON.stringify(file)}`)
      .join('\n')

  /** @type {Promise<{ html: string, files: string[] }> | undefined} */
  let page
  /** @type {import('vite').ViteDevServer | undefined} */
  let devServer
  /**
   * Files that MDX docs depend on, like imported JSON, normalized for comparison.
   * @type {Set<string>}
   */
  let mdxFiles = new Set()

  /** Scans and renders the guide, reusing the result until content changes. */
  const generate = () => {
    page ??= scanContent(contentDir).then(async (tree) => {
      for (const warning of tree.warnings) config.logger.warn(`[style-guide] ${warning}`)
      const html = await renderPage(
        tree,
        options,
        {
          head:
            command === 'build'
              ? STYLE_PLACEHOLDER
              : `<link rel="stylesheet" href="/@fs/${CLIENT_CSS.replace(/^\//, '')}">`,
          entry: ENTRY_URL,
          urlStyles: options.styles.filter(isUrl),
          urlScripts: options.scripts.filter(isUrl),
        },
        renderer,
      )
      // MDX imports often live outside the content folder, so watch them too.
      const imported = (await mdx?.files() ?? []).filter((file) => !file.includes('/node_modules/'))
      mdxFiles = new Set(imported.map((file) => normalizePath(file)))
      devServer?.watcher.add(imported)
      return { html, files: [...collectFiles(tree), ...imported] }
    })
    // Let the next request try again after an error.
    page.catch(() => {
      page = undefined
    })
    return page
  }

  return {
    name: 'style-guide-boilerplate',
    enforce: 'pre',

    config(userConfig, env) {
      if (env.command !== 'build' || !options.build) return

      const root = path.resolve(userConfig.root ?? '')
      const html = normalizePath(path.join(root, options.path, 'index.html'))
      const build = (userConfig.build ??= {})
      const key = build.rolldownOptions?.input === undefined && build.rollupOptions?.input !== undefined
        ? 'rollupOptions'
        : 'rolldownOptions'
      const bundler = (build[key] ??= {})
      const input = bundler.input

      if (input === undefined) {
        const index = normalizePath(path.join(root, 'index.html'))
        bundler.input = index !== html && existsSync(index) ? [index, html] : [html]
      } else if (typeof input === 'string') {
        bundler.input = [input, html]
      } else if (Array.isArray(input)) {
        bundler.input = [...input, html]
      } else {
        bundler.input = { ...input, 'style-guide': html }
      }

      // A dedicated guide gets relative URLs so dist/ works from any folder.
      if (options.path === '/' && userConfig.base === undefined) {
        return { base: './' }
      }
    },

    configResolved(resolved) {
      config = resolved
      command = resolved.command
      contentDir = path.resolve(config.root, options.content)
      htmlId = normalizePath(path.join(config.root, options.path, 'index.html'))
      if ((command === 'serve' || options.build) && existsSync(htmlId)) {
        config.logger.warn(
          `[style-guide] ${path.relative(config.root, htmlId)} exists, but the style guide replaces it. ` +
            'Set the `path` option to serve the guide somewhere else.',
        )
      }
    },

    buildStart() {
      if (command !== 'build' || !options.build) return
      styleRef = undefined
      page = undefined
    },

    resolveId(id) {
      const clean = id.split('?')[0]
      if (clean === ENTRY_URL) return ENTRY_ID
      if (command === 'build' && normalizePath(clean) === htmlId) return htmlId
    },

    async load(id) {
      if (id === ENTRY_ID) return entryCode()
      if (id === htmlId && command === 'build') {
        styleRef = this.emitFile({
          type: 'asset',
          name: 'style-guide.css',
          source: await readFile(CLIENT_CSS, 'utf8'),
        })
        const { html, files } = await generate()
        for (const file of files) this.addWatchFile(file)
        return html
      }
    },

    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const fileName = normalizePath(path.relative(config.root, htmlId))
        const asset = bundle[fileName]
        if (!asset || asset.type !== 'asset' || !styleRef) return

        const dir = path.posix.dirname(fileName)
        const relative = (/** @type {string} */ target) => {
          const url = path.posix.relative(dir, target)
          return url.startsWith('.') ? url : `./${url}`
        }

        let html = String(asset.source).replace(
          STYLE_PLACEHOLDER,
          `<link rel="stylesheet" href="${relative(this.getFileName(styleRef))}">`,
        )

        // Point bundled assets at relative URLs, so a mounted guide works too.
        if (config.base.startsWith('/')) {
          html = html.replace(/(\s(?:src|href)=")([^"]+)"/g, (match, attr, url) => {
            if (!url.startsWith(config.base)) return match
            const target = url.slice(config.base.length)
            return target in bundle ? `${attr}${relative(target)}"` : match
          })
        }

        asset.source = html
      },
    },

    async closeBundle() {
      await mdx?.close()
      mdx = undefined
    },

    configureServer(server) {
      devServer = server
      const base = config.base.startsWith('/') ? config.base : '/'
      const pageUrl = base + options.path.slice(1)

      server.watcher.add(contentDir)
      const onChange = async (/** @type {string} */ file) => {
        const relative = path.relative(contentDir, file)
        const inContent = !relative.startsWith('..') && !path.isAbsolute(relative)
        const usedByMdx = mdxFiles.has(normalizePath(file))
        if (!inContent && !usedByMdx) return
        if (usedByMdx) await mdx?.invalidate()
        page = undefined
        server.ws.send({ type: 'full-reload', path: '*' })
      }
      server.watcher.on('add', onChange)
      server.watcher.on('change', onChange)
      server.watcher.on('unlink', onChange)
      server.watcher.on('addDir', onChange)
      server.watcher.on('unlinkDir', onChange)

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        const url = new URL(req.url ?? '/', 'http://localhost')

        if (pageUrl !== '/' && url.pathname === pageUrl.slice(0, -1)) {
          res.statusCode = 302
          res.setHeader('Location', pageUrl + url.search)
          return res.end()
        }
        if (url.pathname !== pageUrl && url.pathname !== `${pageUrl}index.html`) return next()

        try {
          const { html: source } = await generate()
          const html = await server.transformIndexHtml(pageUrl, source, req.originalUrl)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(html)
        } catch (error) {
          next(error)
        }
      })

      const printUrls = server.printUrls.bind(server)
      server.printUrls = () => {
        printUrls()
        const local = server.resolvedUrls?.local[0]
        if (local) {
          config.logger.info(`  ➜  Style guide: ${new URL(options.path.slice(1), local).href}`)
        }
      }
    },
  }
}

/**
 * Every content file the page was built from.
 *
 * @param {import('./scanner.js').ContentTree} tree
 * @returns {string[]}
 */
function collectFiles(tree) {
  /** @type {Array<string | null>} */
  const files = []
  for (const section of tree.sections) {
    files.push(section.docFile)
    for (const pattern of section.patterns) {
      files.push(pattern.docFile)
      for (const variant of pattern.variants) files.push(variant.htmlFile, variant.docFile)
    }
  }
  return files.filter((file) => file !== null)
}
