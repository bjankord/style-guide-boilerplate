import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'

/**
 * One example: an `.html` file and its sibling doc, or either on its own.
 *
 * @typedef {object} Variant
 * @property {'variant'} type
 * @property {string} id      Unique anchor id, e.g. `sg-base-headings-sizes`.
 * @property {string} title
 * @property {number | undefined} order
 * @property {string | null} html    Example markup, or `null` for a doc-only variant.
 * @property {string | null} doc     The doc's body without front matter.
 * @property {string | null} htmlFile
 * @property {string | null} docFile A `.md` or `.mdx` file.
 */

/**
 * A pattern: a folder of variants.
 *
 * @typedef {object} Pattern
 * @property {'pattern'} type
 * @property {string} id
 * @property {string} title
 * @property {number | undefined} order
 * @property {string | null} doc      Body of the folder's `index.md` or `index.mdx`.
 * @property {string | null} docFile
 * @property {Variant[]} variants
 */

/**
 * A section: a top-level folder of patterns.
 *
 * @typedef {object} Section
 * @property {'section'} type
 * @property {string} id
 * @property {string} title
 * @property {number | undefined} order
 * @property {string | null} doc      Body of the folder's `index.md` or `index.mdx`.
 * @property {string | null} docFile
 * @property {Pattern[]} patterns
 */

/**
 * @typedef {object} ContentTree
 * @property {string} dir The content folder.
 * @property {Section[]} sections
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
 * @typedef {object} ScanContext
 * @property {(file: string) => string} relative
 * @property {string[]} warnings
 */

const ORDER_PREFIX = /^(\d+)[-_.\s]+(.+)$/

/** Doc file types. When both exist for the same example, `.mdx` wins. */
const DOC_EXTENSIONS = ['.mdx', '.md']

/** Documents a section or pattern folder. */
const FOLDER_DOCS = DOC_EXTENSIONS.map((ext) => `index${ext}`)

/** @param {string} name */
const extensionOf = (name) => path.extname(name).toLowerCase()

/** @param {string} name */
const isDoc = (name) => DOC_EXTENSIONS.includes(extensionOf(name))

/** @param {string} name */
const isExample = (name) => extensionOf(name) === '.html' || isDoc(name)

/** @param {string} name */
const isFolderDoc = (name) => FOLDER_DOCS.includes(name.toLowerCase())

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
 * Reads a `.md` or `.mdx` doc's front matter and body.
 *
 * @param {string} file
 * @returns {Promise<{ meta: Record<string, unknown>, body: string }>}
 */
async function readDoc(file) {
  // Pass an options object so gray-matter skips its content-keyed cache.
  const { data, content } = matter(await readText(file), {})
  return { meta: data, body: content.trim() }
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
 * @param {Record<string, unknown>} meta The front matter.
 */
function describeName(name, meta) {
  const parsed = parseName(name)
  return {
    title: typeof meta.title === 'string' ? meta.title : titleFromName(parsed.name),
    order: typeof meta.order === 'number' ? meta.order : parsed.order,
    slug: slugify(parsed.name),
  }
}

/**
 * Picks the doc from candidate files for one example or folder: `.mdx` over
 * `.md`, with a warning about the one that's skipped.
 *
 * @param {string[]} files
 * @param {ScanContext} ctx
 */
function pickDoc(files, ctx) {
  const sorted = [...files].sort(
    (a, b) => DOC_EXTENSIONS.indexOf(extensionOf(a)) - DOC_EXTENSIONS.indexOf(extensionOf(b)),
  )
  for (const skipped of sorted.slice(1)) {
    ctx.warnings.push(
      `Ignoring "${ctx.relative(skipped)}": "${path.basename(sorted[0])}" documents the same example.`,
    )
  }
  return sorted[0]
}

/**
 * Reads a folder's `index.md` or `index.mdx`, if it has one.
 *
 * @param {string} folder
 * @param {import('node:fs').Dirent[]} entries
 * @param {ScanContext} ctx
 */
async function readFolderDoc(folder, entries, ctx) {
  const candidates = entries
    .filter((e) => e.isFile() && isFolderDoc(e.name))
    .map((e) => path.join(folder, e.name))
  if (!candidates.length) return { meta: {}, doc: null, docFile: null }
  const file = pickDoc(candidates, ctx)
  const { meta, body } = await readDoc(file)
  return { meta, doc: body || null, docFile: file }
}

/**
 * Pairs each `.html` file with its sibling doc, and reads them as variants.
 *
 * @param {string} folder
 * @param {import('node:fs').Dirent[]} entries
 * @param {ScanContext} ctx
 * @returns {Promise<Found[]>}
 */
async function readVariants(folder, entries, ctx) {
  /** @type {Map<string, { html?: string, docs: string[] }>} */
  const pairs = new Map()
  for (const entry of entries) {
    if (!entry.isFile() || isFolderDoc(entry.name) || !isExample(entry.name)) continue
    const ext = extensionOf(entry.name)
    const base = entry.name.slice(0, -ext.length)
    const pair = pairs.get(base) ?? { docs: [] }
    const file = path.join(folder, entry.name)
    if (ext === '.html') pair.html = file
    else pair.docs.push(file)
    pairs.set(base, pair)
  }

  return Promise.all(
    [...pairs].map(([base, { html, docs }]) =>
      readVariant(base, { html, doc: docs.length ? pickDoc(docs, ctx) : undefined }),
    ),
  )
}

/**
 * Reads one variant from its example and doc files.
 *
 * @param {string} name The file or folder name its title and order come from.
 * @param {{ html?: string, doc?: string }} files
 * @returns {Promise<Found>}
 */
async function readVariant(name, files) {
  const { meta, body } = files.doc ? await readDoc(files.doc) : { meta: {}, body: '' }
  const { title, order, slug } = describeName(name, meta)
  return {
    node: {
      type: 'variant',
      id: '',
      title,
      order,
      html: files.html ? (await readText(files.html)).replace(/\s+$/, '') : null,
      doc: body || null,
      htmlFile: files.html ?? null,
      docFile: files.doc ?? null,
    },
    slug,
    children: [],
  }
}

/**
 * Reads a variant folder: one `.html` example and an optional `.md` or `.mdx`
 * doc, with any file names. Its title and order come from the folder name.
 *
 * @param {string} folder
 * @param {ScanContext} ctx
 * @returns {Promise<Found | null>} `null` when the folder isn't a usable variant.
 */
async function readVariantFolder(folder, ctx) {
  const entries = await readFolder(folder)
  const where = ctx.relative(folder)
  const files = entries.filter((e) => e.isFile()).map((e) => path.join(folder, e.name))

  for (const entry of entries.filter((e) => e.isDirectory())) {
    ctx.warnings.push(
      `Ignoring "${ctx.relative(path.join(folder, entry.name))}": variant folders can't contain folders.`,
    )
  }

  const html = files.filter((file) => extensionOf(file) === '.html')
  const docs = files.filter((file) => isDoc(file))
  if (html.length > 1 || docs.length > 1) {
    ctx.warnings.push(
      `Ignoring "${where}": a variant folder holds one .html file and one .md or .mdx file at most.`,
    )
    return null
  }
  if (!html.length && !docs.length) {
    ctx.warnings.push(`Ignoring "${where}": it has no .html, .md or .mdx file.`)
    return null
  }
  return readVariant(path.basename(folder), { html: html[0], doc: docs[0] })
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
    if (!entry.isFile() || !isExample(entry.name)) continue
    if (where === 'section' && isFolderDoc(entry.name)) continue
    const file = ctx.relative(path.join(folder, entry.name))
    const base = entry.name.slice(0, -extensionOf(entry.name).length)
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
 *   folder holds one `.html` file and an optional doc.
 * - Docs are `.md` or `.mdx`. `index.md` or `index.mdx` documents its section
 *   or pattern folder, and its front matter can set the folder's `title` and
 *   `order`.
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
  }

  /**
   * @param {string} folder
   * @returns {Promise<Found>}
   */
  async function scanPattern(folder) {
    const entries = await readFolder(folder)
    const { meta, ...docs } = await readFolderDoc(folder, entries, ctx)
    const { title, order, slug } = describeName(path.basename(folder), meta)

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
    const { meta, ...docs } = await readFolderDoc(folder, entries, ctx)
    const { title, order, slug } = describeName(path.basename(folder), meta)

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
  // Folders are read in parallel, so sort the warnings for stable output.
  return { dir, sections, warnings: ctx.warnings.sort() }
}
