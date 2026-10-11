import MarkdownIt from 'markdown-it'
import { bundledLanguages, createHighlighter } from 'shiki'
import { renderToString } from './jsx-runtime.js'

const THEMES = { light: 'github-light', dark: 'github-dark' }

/** Language aliases that aren't Shiki ids. */
const ALIASES = /** @type {Record<string, string>} */ ({ htm: 'html', markup: 'html', sh: 'bash', shell: 'bash' })

/**
 * @typedef {object} Renderer
 * @property {(code: string, lang?: string) => Promise<string>} highlight
 *   Highlights code as a `<pre class="shiki">` block.
 * @property {(markdown: string) => Promise<string>} renderMarkdown
 *   Renders Markdown to HTML, highlighting fenced code blocks.
 * @property {(file: string, name: string) => Promise<string>} renderMdx
 *   Renders an `.mdx` doc to HTML. `name` labels it in error messages.
 */

/** @param {string} value */
export function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Creates a Markdown and code renderer backed by one Shiki highlighter.
 * The highlighter loads lazily, along with each language the first time it's used.
 *
 * MDX docs load through `loadMdx`. An MDX error doesn't stop the page: the doc
 * shows the error instead, and `onError` hears about it.
 *
 * @param {{
 *   loadMdx?: (file: string) => Promise<(props: object) => unknown>,
 *   onError?: (message: string) => void,
 * }} [options]
 * @returns {Renderer}
 */
export function createRenderer({ loadMdx, onError } = {}) {
  /** @type {Promise<import('shiki').Highlighter> | undefined} */
  let highlighterPromise

  const getHighlighter = () => {
    highlighterPromise ??= createHighlighter({
      themes: Object.values(THEMES),
      langs: ['html'],
    })
    return highlighterPromise
  }

  /** @param {string | undefined} lang */
  const toShikiLang = (lang) => {
    const name = (lang ?? '').trim().toLowerCase()
    const id = ALIASES[name] ?? name
    return id in bundledLanguages ? id : null
  }

  /** @param {Array<string | undefined>} langs */
  const loadLanguages = async (langs) => {
    const highlighter = await getHighlighter()
    const loaded = new Set(highlighter.getLoadedLanguages())
    const missing = [...new Set(langs.map(toShikiLang))].filter(
      (id) => id !== null && !loaded.has(id),
    )
    if (missing.length) await highlighter.loadLanguage(.../** @type {any[]} */ (missing))
    return highlighter
  }

  /**
   * @param {import('shiki').Highlighter} highlighter
   * @param {string} code
   * @param {string | undefined} lang
   */
  const highlightSync = (highlighter, code, lang) =>
    highlighter.codeToHtml(code, {
      lang: toShikiLang(lang) ?? 'text',
      themes: THEMES,
      defaultColor: false,
    })

  const md = new MarkdownIt({ html: true, linkify: true })

  return {
    async highlight(code, lang = 'html') {
      const highlighter = await loadLanguages([lang])
      return highlightSync(highlighter, code, lang)
    },

    async renderMarkdown(markdown) {
      const env = {}
      const tokens = md.parse(markdown, env)
      const langs = tokens
        .filter((token) => token.type === 'fence')
        .map((token) => token.info.trim().split(/\s+/)[0])
      const highlighter = await loadLanguages(langs)

      // markdown-it uses the returned string as-is when it starts with `<pre`.
      md.set({ highlight: (code, lang) => highlightSync(highlighter, code.replace(/\n$/, ''), lang) })
      return md.renderer.render(tokens, md.options, env)
    },

    async renderMdx(file, name) {
      try {
        if (!loadMdx) throw new Error('MDX docs need an MDX loader.')
        const Doc = await loadMdx(file)
        return renderToString(Doc({}))
      } catch (error) {
        const message = `MDX error in ${name}: ${/** @type {Error} */ (error).message}`
        onError?.(message)
        return `<pre class="sg-error">${escapeHtml(message)}</pre>`
      }
    },
  }
}
