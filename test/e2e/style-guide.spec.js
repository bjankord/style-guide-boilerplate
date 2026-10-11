import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const FIXTURE = path.resolve(import.meta.dirname, '../../.tmp/e2e')
const CSS_FILE = path.join(FIXTURE, 'styles/main.css')
const NEW_EXAMPLE = path.join(FIXTURE, 'style-guide/06-components/cards/cards.html')
const NEUTRALS_FILE = path.join(FIXTURE, 'tokens/neutrals.json')

test('renders the guide with the project CSS and script', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Style Guide Boilerplate')
  await expect(page.locator('.sg-brand')).toHaveText('Style Guide Boilerplate')
  await expect(page.getByRole('navigation', { name: 'Style guide' }).getByRole('link')).toHaveText([
    'Getting started',
    'Colors', 'Brand', 'Neutrals',
    'Fonts',
    'Guidelines', 'Writing',
    'Base', 'Entities', 'Headings', 'Sizes', 'With links', 'Lists',
    'Components', 'Button styles', 'Alerts',
  ])
  await expect(page.locator('#sg-components-buttons .sg-preview button')).toHaveCSS(
    'background-color',
    'rgb(26, 188, 156)',
  )
  await expect(page.locator('#sg-colors-brand .sg-color-swatch').first()).toHaveCSS(
    'background-color',
    'rgb(26, 188, 156)',
  )
  await expect(page.locator('html')).toHaveAttribute('data-project-script', 'loaded')
})

test('copies an example source to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')

  const example = page.locator('#sg-base-entities')
  await example.getByText('View source').click()
  // Locate by attribute: the button's accessible name changes to "Copied".
  const copy = example.locator('[data-sg-copy]')
  await copy.click()

  await expect(copy).toHaveText('Copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '<p>Fish &amp; chips &lt;3</p>',
  )
})

test('searches from the header on wide screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const search = page.locator('.sg-header').getByRole('combobox', { name: 'Search the style guide' })
  await expect(search).toBeVisible()
  await expect(page.locator('#sg-search-sidebar')).toBeHidden()

  await search.fill('With links')
  await search.press('Enter')
  await expect(page).toHaveURL(/#sg-base-headings-with-links$/)
  await expect(page.locator('#sg-base-headings-with-links')).toBeFocused()
  await expect(page.locator('#sg-base-headings-with-links')).toBeInViewport()
  await expect(search).toHaveValue('')

  // A partial match jumps to the first suggestion containing it.
  await search.fill('neutr')
  await search.press('Enter')
  await expect(page).toHaveURL(/#sg-colors-neutrals$/)

  // Picking a <datalist> suggestion fires a plain input event, with no typing
  // inputType, and jumps right away without Enter.
  await search.evaluate((input) => {
    /** @type {HTMLInputElement} */ (input).value = 'Sizes'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page).toHaveURL(/#sg-base-headings-sizes$/)

  await search.fill('nothing like this')
  await search.press('Enter')
  await expect(search).toHaveAttribute('aria-invalid', 'true')
  await expect(page).toHaveURL(/#sg-base-headings-sizes$/)
})

test('searches from the sidebar on small screens and closes the nav', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await page.goto('/')

  await expect(page.locator('#sg-search-header')).toBeHidden()
  await page.getByRole('button', { name: 'Menu' }).click()

  const search = page.locator('#sg-nav').getByRole('combobox', { name: 'Search the style guide' })
  await expect(search).toBeVisible()
  await search.fill('alerts')
  await search.press('Enter')

  await expect(page).toHaveURL(/#sg-components-alerts$/)
  await expect(page.locator('#sg-nav')).toBeHidden()
  await expect(page.locator('#sg-components-alerts')).toBeInViewport()
})

test('opens and closes the nav on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await page.goto('/')

  const toggle = page.getByRole('button', { name: 'Menu' })
  const nav = page.locator('#sg-nav')
  await expect(nav).toBeHidden()
  await toggle.click()
  await expect(nav).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await nav.getByRole('link', { name: 'Alerts' }).click()
  await expect(nav).toBeHidden()
})

test('hot reloads project CSS without reloading the page', async ({ page }) => {
  const original = await readFile(CSS_FILE, 'utf8')
  try {
    await page.goto('/')
    await page.evaluate(() => {
      window.notReloaded = true
    })

    await writeFile(CSS_FILE, original.replace('rgb(26, 188, 156)', 'rgb(231, 76, 60)'))

    await expect(page.locator('#sg-colors-brand .sg-color-swatch').first()).toHaveCSS(
      'background-color',
      'rgb(231, 76, 60)',
    )
    expect(await page.evaluate(() => window.notReloaded)).toBe(true)
  } finally {
    await writeFile(CSS_FILE, original)
  }
})

test('reloads the page when content changes', async ({ page }) => {
  try {
    await page.goto('/')
    await page.evaluate(() => {
      window.notReloaded = true
    })

    await mkdir(path.dirname(NEW_EXAMPLE), { recursive: true })
    await writeFile(NEW_EXAMPLE, '<div class="card">A card</div>\n')

    await expect(page.locator('#sg-components-cards')).toContainText('A card')
    expect(await page.evaluate(() => window.notReloaded)).toBeUndefined()
  } finally {
    await rm(path.dirname(NEW_EXAMPLE), { recursive: true, force: true })
  }
})

test('reloads the page when a front matter JSON file changes', async ({ page }) => {
  const original = await readFile(NEUTRALS_FILE, 'utf8')
  try {
    await page.goto('/')
    const names = page.locator('#sg-colors-neutrals .sg-color-name')
    await expect(names).toHaveText(['Gray 100', 'Gray 900'])

    await writeFile(NEUTRALS_FILE, JSON.stringify({ 'Gray 500': '#808080' }))

    await expect(names).toHaveText(['Gray 500'])
  } finally {
    await writeFile(NEUTRALS_FILE, original)
  }
})
