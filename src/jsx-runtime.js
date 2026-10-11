// A tiny JSX runtime that renders straight to HTML strings, for MDX docs and
// any components they use. Nothing here runs in the browser.
//
// It reads like HTML: `class` and `for` work (as do `className` and
// `htmlFor`), and `style` can be a string or an object.

// Symbol.for, not a class, because the plugin and Vite's module loader can
// each end up with their own copy of this module.
const HTML = Symbol.for('style-guide-boilerplate.html')

export const Fragment = Symbol.for('style-guide-boilerplate.fragment')

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
])

/** React-style prop names (which MDX also produces) and their HTML attributes. */
const ATTRIBUTE_NAMES = /** @type {Record<string, string>} */ ({
  className: 'class',
  htmlFor: 'for',
  tabIndex: 'tabindex',
  readOnly: 'readonly',
  maxLength: 'maxlength',
  minLength: 'minlength',
  colSpan: 'colspan',
  rowSpan: 'rowspan',
  srcSet: 'srcset',
  crossOrigin: 'crossorigin',
  autoComplete: 'autocomplete',
  autoFocus: 'autofocus',
  charSet: 'charset',
  contentEditable: 'contenteditable',
  spellCheck: 'spellcheck',
  accessKey: 'accesskey',
  encType: 'enctype',
  noValidate: 'novalidate',
  hrefLang: 'hreflang',
  dateTime: 'datetime',
  xlinkHref: 'xlink:href',
  xmlLang: 'xml:lang',
})

/**
 * Trusted HTML that's inserted as-is.
 *
 * @typedef {{ [HTML]: true, value: string }} Html
 */

/**
 * Marks a string as trusted HTML, so it isn't escaped.
 *
 * @param {string} value
 * @returns {Html}
 */
export function html(value) {
  return { [HTML]: true, value: String(value) }
}

/** @param {unknown} value */
const isHtml = (value) =>
  !!value && typeof value === 'object' && /** @type {any} */ (value)[HTML] === true

/** @param {string} value */
export function escapeText(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** @param {string} value */
const escapeAttribute = (value) => escapeText(value).replace(/"/g, '&quot;')

/**
 * Renders anything JSX can produce to an HTML string.
 *
 * @param {unknown} node
 * @returns {string}
 */
export function renderToString(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (Array.isArray(node)) return node.map(renderToString).join('')
  if (isHtml(node)) return /** @type {Html} */ (node).value
  return escapeText(String(node))
}

/** @param {Record<string, unknown>} style */
function styleToString(style) {
  return Object.entries(style)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([name, value]) => {
      const property = name.startsWith('--') ? name : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
      return `${property}: ${value}`
    })
    .join('; ')
}

/** @param {Record<string, unknown>} props */
function attributesToString(props) {
  let out = ''
  for (const [name, value] of Object.entries(props)) {
    if (name === 'children' || name === 'key' || name === 'dangerouslySetInnerHTML') continue
    if (value === null || value === undefined || value === false || typeof value === 'function') continue
    const attribute = ATTRIBUTE_NAMES[name] ?? name
    if (value === true) {
      out += ` ${attribute}`
      continue
    }
    const text =
      attribute === 'style' && typeof value === 'object'
        ? styleToString(/** @type {Record<string, unknown>} */ (value))
        : String(value)
    out += ` ${attribute}="${escapeAttribute(text)}"`
  }
  return out
}

/**
 * Creates an element. Components are called right away with their props.
 *
 * @param {string | symbol | ((props: any) => unknown)} type
 * @param {Record<string, unknown>} props
 * @returns {Html}
 */
export function jsx(type, props) {
  if (typeof type === 'function') return html(renderToString(type(props)))

  const inner = /** @type {{ __html?: string } | undefined} */ (props.dangerouslySetInnerHTML)
  const children = inner ? (inner.__html ?? '') : renderToString(props.children)
  if (type === Fragment) return html(children)

  const tag = String(type)
  const attributes = attributesToString(props)
  if (VOID_ELEMENTS.has(tag)) return html(`<${tag}${attributes}>`)
  return html(`<${tag}${attributes}>${children}</${tag}>`)
}

export const jsxs = jsx
export const jsxDEV = jsx
