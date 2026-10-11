import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'

/**
 * @typedef {object} ColorEntry
 * @property {string} name  Label shown under the swatch.
 * @property {string} value Any CSS color, including `var(--token)`.
 */

/**
 * @typedef {object} FontEntry
 * @property {string} name   Label shown above the sample.
 * @property {string} value  A `font-family` value, including `var(--token)`.
 * @property {string | number} [weight] Optional `font-weight` for the sample.
 * @property {string} [style] Optional `font-style` for the sample.
 */

/**
 * Data from a doc's front matter that renders as swatches or samples.
 *
 * @typedef {object} DocData
 * @property {ColorEntry[] | null} colors
 * @property {FontEntry[] | null} fonts
 */

/**
 * One example: an `.html` file and its sibling `.md` doc, or either on its own.
 *
 * @typedef {object} VariantFields
 * @property {'variant'} type
 * @property {string} id      Unique anchor id, e.g. `sg-base-headings-sizes`.
 * @property {string} title
 * @property {number | undefined} order
 * @property {string | null} html    Example markup, or `null` for a doc-only variant.
 * @property {string | null} doc     Markdown body without front matter.
 * @property {string | null} htmlFile
 * @property {string | null} docFile
 *
 * @typedef {VariantFields & DocData} Variant
 */

/**
 * A pattern: a folder of variants.
 *
 * @typedef {object} PatternFields
 * @property {'pattern'} type
 * @property {string} id
 * @property {string} title
 * @property {number | undefined} order
 * @property {string | null} doc      Body of the folder's `index.md`.
 * @property {string | null} docFile
 * @property {Variant[]} variants
 *
 * @typedef {PatternFields & DocData} Pattern
 */

/**
 * A section: a top-level folder of patterns.
 *
 * @typedef {object} SectionFields
 * @property {'section'} type
 * @property {string} id
 * @property {string} title
 * @property {number | undefined} order
 * @property {string | null} doc      Body of the folder's `index.md`.
 * @property {string | null} docFile
 * @property {Pattern[]} patterns
 *
 * @typedef {SectionFields & DocData} Section
 */

/**
 * @typedef {object} ContentTree
 * @property {Section[]} sections
 * @property {string[]} dataFiles JSON files that front matter points at.
 * @property {string[]} warnings Problems worth telling the user about.
 */

/**
 * A scanned node before sorting, with the slug its id is built from.
 *
 * @typedef {object} Found
 * @property {Section | Pattern | Variant} node
 * @property {string} slug
 * @property {Found[]} children
 */

/**
 * Collects warnings and data files while scanning.
 *
 * @typedef {object} ScanContext
 * @property {(file: string) => string} relative
 * @property {string[]} warnings
 * @property {Set<string>} dataFiles
 */

const ORDER_PREFIX = /^(\d+)[-_.\s]+(.+)$/

/** Documents a section or pattern folder. */
const FOLDER_DOC = 'index.md'

/**
 * Splits an optional number prefix off a file or folder name.
 *
 * @param {string} name File or folder name without extension.
 * @returns {{ order: number | undefined, name: string }}
 */
export function parseName(name) {
  const match = ORDER_PREFIX.exec(name)
  return match
    ? { order: Number(match[1]), name: match[2] }
    : { order: undefined, name }
}

/**
 * `form-buttons` → `Form buttons`.
 *
 * @param {string} name
 */
export function titleFromName(name) {
  const words = name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** @param {string} name */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\d]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Numbered entries first (by number), then everything else alphabetically.
 *
 * @param {{ order: number | undefined, title: string }} a
 * @param {{ order: number | undefined, title: string }} b
 */
function compareEntries(a, b) {
  const orderA = a.order ?? Number.POSITIVE_INFINITY
  const orderB = b.order ?? Number.POSITIVE_INFINITY
  if (orderA !== orderB) return orderA - orderB
  return a.title.localeCompare(b.title, 'en', { numeric: true, sensitivity: 'base' })
}

/** @param {string} file */
async function readText(file) {
  const text = await readFile(file, 'utf8')
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
}

/**
 * @param {string} file
 * @returns {Promise<{ data: Record<string, unknown>, body: string }>}
 */
async function readMarkdown(file) {
  // Pass an options object so gray-matter skips its content-keyed cache.
  const { data, content } = matter(await readText(file), {})
  return { data, body: content.trim() }
}

/**
 * Reads a folder, skipping dotfiles. A missing folder reads as empty.
 *
 * @param {string} folder
 */
async function readFolder(folder) {
  try {
    const entries = await readdir(folder, { withFileTypes: true })
    return entries.filter((entry) => !entry.name.startsWith('.'))
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return []
    throw error
  }
}

/**
 * Title, order and slug from a file or folder name, overridden by front matter.
 *
 * @param {string} name
 * @param {Record<string, unknown>} data
 */
function describeName(name, data) {
  const parsed = parseName(name)
  return {
    title: typeof data.title === 'string' ? data.title : titleFromName(parsed.name),
    order: typeof data.order === 'number' ? data.order : parsed.order,
    slug: slugify(parsed.name),
  }
}

/**
 * Reads a `colors` or `fonts` front matter value: a list of entries, an
 * object of `name: value` pairs, or a path to a `.json` file with either.
 * Bad entries are skipped with a warning.
 *
 * @param {'colors' | 'fonts'} key
 * @param {unknown} raw
 * @param {string} docFile The `.md` file the front matter came from.
 * @param {ScanContext} ctx
 * @returns {Promise<Array<Record<string, unknown>> | null>}
 */
async function readEntries(key, raw, docFile, ctx) {
  if (raw === undefined || raw === null) return null
  const where = ctx.relative(docFile)
  let data = raw

  if (typeof raw === 'string') {
    const file = path.resolve(path.dirname(docFile), raw)
    if (path.extname(file).toLowerCase() !== '.json') {
      ctx.warnings.push(`Ignoring "${key}" in ${where}: "${raw}" isn't a .json file.`)
      return null
    }
    // Watch the file even when it's broken, so fixing it reloads the page.
    ctx.dataFiles.add(file)
    try {
      data = JSON.parse(await readText(file))
    } catch (error) {
      const reason = /** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT'
        ? 'the file doesn\'t exist'
        : /** @type {Error} */ (error).message
      ctx.warnings.push(`Ignoring "${key}" in ${where}: couldn't read "${raw}" (${reason}).`)
      return null
    }
  }

  /** @type {unknown[]} */
  let list
  if (Array.isArray(data)) {
    list = data
  } else if (data && typeof data === 'object') {
    list = Object.entries(data).map(([name, value]) =>
      value && typeof value === 'object' ? { name, ...value } : { name, value },
    )
  } else {
    ctx.warnings.push(`Ignoring "${key}" in ${where}: expected a list, an object or a .json path.`)
    return null
  }

  /** @type {Array<Record<string, unknown>>} */
  const entries = []
  let skipped = 0
  for (const item of list) {
    const entry = /** @type {Record<string, unknown>} */ (item)
    if (entry && typeof entry.name === 'string' && typeof entry.value === 'string') {
      entries.push(entry)
    } else {
      skipped++
    }
  }
  if (skipped) {
    ctx.warnings.push(
      `Skipped ${skipped} "${key}" ${skipped === 1 ? 'entry' : 'entries'} in ${where}: each needs a "name" and a "value" string.`,
    )
  }
  return entries
}

/**
 * Colors and fonts from a doc's front matter.
 *
 * @param {Record<string, unknown>} data
 * @param {string | null} docFile
 * @param {ScanContext} ctx
 * @returns {Promise<DocData>}
 */
async function readDocData(data, docFile, ctx) {
  if (!docFile) return { colors: null, fonts: null }

  const colors = await readEntries('colors', data.colors, docFile, ctx)
  const fonts = await readEntries('fonts', data.fonts, docFile, ctx)
  return {
    colors: colors && colors.map(({ name, value }) => ({ name: String(name), value: String(value) })),
    fonts:
      fonts &&
      fonts.map(({ name, value, weight, style }) => ({
        name: String(name),
        value: String(value),
        ...(typeof weight === 'string' || typeof weight === 'number' ? { weight } : {}),
        ...(typeof style === 'string' ? { style } : {}),
      })),
  }
}

/**
 * Reads a folder's `index.md`, if it has one.
 *
 * @param {string} folder
 * @param {import('node:fs').Dirent[]} entries
 * @param {ScanContext} ctx
 */
async function readFolderDoc(folder, entries, ctx) {
  const entry = entries.find((e) => e.isFile() && e.name.toLowerCase() === FOLDER_DOC)
  if (!entry) return { data: {}, doc: null, docFile: null, colors: null, fonts: null }
  const file = path.join(folder, entry.name)
  const { data, body } = await readMarkdown(file)
  return { data, doc: body || null, docFile: file, ...(await readDocData(data, file, ctx)) }
}

/**
 * Pairs each `.html` file with its sibling `.md` doc, and reads them as variants.
 *
 * @param {string} folder
 * @param {import('node:fs').Dirent[]} entries
 * @param {ScanContext} ctx
 * @returns {Promise<Found[]>}
 */
async function readVariants(folder, entries, ctx) {
  /** @type {Map<string, { html?: string, md?: string }>} */
  const pairs = new Map()
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.toLowerCase() === FOLDER_DOC) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (ext !== '.html' && ext !== '.md') continue
    const base = entry.name.slice(0, -ext.length)
    const pair = pairs.get(base) ?? {}
    pair[ext === '.html' ? 'html' : 'md'] = path.join(folder, entry.name)
    pairs.set(base, pair)
  }

  return Promise.all([...pairs].map(([base, pair]) => readVariant(base, pair, ctx)))
}

/**
 * Reads one variant from its example and doc files.
 *
 * @param {string} name The file or folder name its title and order come from.
 * @param {{ html?: string, md?: string }} pair
 * @param {ScanContext} ctx
 * @returns {Promise<Found>}
 */
async function readVariant(name, pair, ctx) {
  const { data, body } = pair.md ? await readMarkdown(pair.md) : { data: {}, body: '' }
  const { title, order, slug } = describeName(name, data)
  return {
    node: {
      type: 'variant',
      id: '',
      title,
      order,
      html: pair.html ? (await readText(pair.html)).replace(/\s+$/, '') : null,
      doc: body || null,
      htmlFile: pair.html ?? null,
      docFile: pair.md ?? null,
      ...(await readDocData(data, pair.md ?? null, ctx)),
    },
    slug,
    children: [],
  }
}

/**
 * Reads a variant folder: one `.html` example and an optional `.md` doc, with
 * any file names. Its title and order come from the folder name.
 *
 * @param {string} folder
 * @param {ScanContext} ctx
 * @returns {Promise<Found | null>} `null` when the folder isn't a usable variant.
 */
async function readVariantFolder(folder, ctx) {
  const entries = await readFolder(folder)
  const where = ctx.relative(folder)
  /** @param {string} ext */
  const filesWith = (ext) =>
    entries
      .filter((e) => e.isFile() && path.extname(e.name).toLowerCase() === ext)
      .map((e) => path.join(folder, e.name))

  for (const entry of entries.filter((e) => e.isDirectory())) {
    ctx.warnings.push(
      `Ignoring "${ctx.relative(path.join(folder, entry.name))}": variant folders can't contain folders.`,
    )
  }

  const html = filesWith('.html')
  const md = filesWith('.md')
  if (html.length > 1 || md.length > 1) {
    ctx.warnings.push(`Ignoring "${where}": a variant folder holds one .html file and one .md file at most.`)
    return null
  }
  if (!html.length && !md.length) {
    ctx.warnings.push(`Ignoring "${where}": it has no .html or .md file.`)
    return null
  }
  return readVariant(path.basename(folder), { html: html[0], md: md[0] }, ctx)
}

/**
 * Warns about example files outside a pattern folder, which aren't shown.
 *
 * @param {string} folder
 * @param {import('node:fs').Dirent[]} entries
 * @param {ScanContext} ctx
 * @param {'root' | 'section'} where
 */
function warnStrayFiles(folder, entries, ctx, where) {
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.toLowerCase() === FOLDER_DOC) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (ext !== '.html' && ext !== '.md') continue
    const file = ctx.relative(path.join(folder, entry.name))
    const base = entry.name.slice(0, -ext.length)
    ctx.warnings.push(
      where === 'root'
        ? `Ignoring "${file}": the content folder holds section folders, like "${base}/index.md".`
        : `Ignoring "${file}": examples go in a pattern folder, like "${ctx.relative(path.join(folder, base, entry.name))}".`,
    )
  }
}

/**
 * Scans a content folder into sections, patterns and variants:
 *
 * - Each top-level folder is a section.
 * - Inside a section, each folder is a pattern.
 * - Inside a pattern, each example file or folder is a variant. A variant
 *   folder holds one `.html` file and an optional `.md` doc.
 * - `index.md` documents its section or pattern folder, and its front matter
 *   can set the folder's `title` and `order`.
 * - `colors` and `fonts` in any front matter render as swatches and samples.
 *
 * Example files anywhere else are skipped with a warning.
 *
 * @param {string} dir Absolute path to the content folder.
 * @returns {Promise<ContentTree>}
 */
export async function scanContent(dir) {
  /** @type {ScanContext} */
  const ctx = {
    relative: (file) => path.relative(dir, file).replaceAll('\\', '/'),
    warnings: [],
    dataFiles: new Set(),
  }

  /**
   * @param {string} folder
   * @returns {Promise<Found>}
   */
  async function scanPattern(folder) {
    const entries = await readFolder(folder)
    const { data, ...docs } = await readFolderDoc(folder, entries, ctx)
    const { title, order, slug } = describeName(path.basename(folder), data)

    // Variants can be loose files or folders, sorted together.
    const folders = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map((e) => readVariantFolder(path.join(folder, e.name), ctx)),
    )
    return {
      node: { type: 'pattern', id: '', title, order, ...docs, variants: [] },
      slug,
      children: [
        ...(await readVariants(folder, entries, ctx)),
        ...folders.filter((found) => found !== null),
      ],
    }
  }

  /**
   * @param {string} folder
   * @returns {Promise<Found>}
   */
  async function scanSection(folder) {
    const entries = await readFolder(folder)
    const { data, ...docs } = await readFolderDoc(folder, entries, ctx)
    const { title, order, slug } = describeName(path.basename(folder), data)

    warnStrayFiles(folder, entries, ctx, 'section')
    const folders = entries.filter((e) => e.isDirectory())
    return {
      node: { type: 'section', id: '', title, order, ...docs, patterns: [] },
      slug,
      children: await Promise.all(folders.map((e) => scanPattern(path.join(folder, e.name)))),
    }
  }

  const entries = await readFolder(dir)
  warnStrayFiles(dir, entries, ctx, 'root')
  const top = await Promise.all(
    entries.filter((e) => e.isDirectory()).map((e) => scanSection(path.join(dir, e.name))),
  )

  /** @type {Set<string>} */
  const usedIds = new Set(['sg-top', 'sg-main', 'sg-nav'])

  /**
   * Sorts each level, then assigns ids in display order so duplicates get
   * predictable suffixes.
   *
   * @param {Found[]} found
   * @param {string[]} parentSlugs
   * @returns {Array<Section | Pattern | Variant>}
   */
  const finalize = (found, parentSlugs) => {
    found.sort((a, b) => compareEntries(a.node, b.node))
    for (const { node, slug, children } of found) {
      const slugs = [...parentSlugs, slug]
      const base = ['sg', ...slugs.filter(Boolean)].join('-')
      let id = base
      for (let i = 2; usedIds.has(id); i++) id = `${base}-${i}`
      usedIds.add(id)
      node.id = id

      const nodes = finalize(children, slugs)
      if (node.type === 'section') node.patterns = /** @type {Pattern[]} */ (nodes)
      if (node.type === 'pattern') node.variants = /** @type {Variant[]} */ (nodes)
    }
    return found.map((item) => item.node)
  }

  const sections = /** @type {Section[]} */ (finalize(top, []))
  // Folders are read in parallel, so sort what they collected for stable output.
  return { sections, dataFiles: [...ctx.dataFiles].sort(), warnings: ctx.warnings.sort() }
}
