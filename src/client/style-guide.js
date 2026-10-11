// Style Guide Boilerplate

const root = document.documentElement
const toggle = /** @type {HTMLButtonElement | null} */ (document.querySelector('.sg-nav-toggle'))

/** Opens or closes the sidebar on small screens. */
const setNavOpen = (/** @type {boolean} */ open) => {
  root.classList.toggle('sg-nav-open', open)
  toggle?.setAttribute('aria-expanded', String(open))
}

if (toggle) {
  toggle.hidden = false
  toggle.addEventListener('click', () => setNavOpen(!root.classList.contains('sg-nav-open')))
  document.querySelector('.sg-sidebar')?.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) setNavOpen(false)
  })
}

// Search: both inputs suggest nav items from one <datalist>. Picking a
// suggestion, or pressing Enter, jumps to the matching item.
const searchOptions = [...document.querySelectorAll('#sg-search-list option')].map((option) => ({
  value: /** @type {HTMLOptionElement} */ (option).value,
  target: option.getAttribute('data-sg-target') ?? '',
}))

/**
 * An exact match first, then the first suggestion containing the text.
 *
 * @param {string} text
 */
const findTarget = (text) => {
  const query = text.trim().toLowerCase()
  if (!query) return null
  const match =
    searchOptions.find((option) => option.value.toLowerCase() === query) ??
    searchOptions.find((option) => option.value.toLowerCase().includes(query))
  return match ? document.getElementById(match.target) : null
}

/** @param {HTMLInputElement} input */
const jumpTo = (input) => {
  const target = findTarget(input.value)
  input.setAttribute('aria-invalid', String(!target && input.value.trim() !== ''))
  if (!target) return

  setNavOpen(false)
  history.pushState(null, '', `#${target.id}`)
  target.scrollIntoView()
  // Move focus too, so keyboard and screen reader users land on the result.
  target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  input.value = ''
}

for (const form of document.querySelectorAll('form[data-sg-search]')) {
  const input = /** @type {HTMLInputElement | null} */ (form.querySelector('input'))
  if (!input) continue

  form.removeAttribute('hidden')
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    jumpTo(input)
  })
  input.addEventListener('input', (event) => {
    input.removeAttribute('aria-invalid')
    // Picking a <datalist> suggestion fires an input event without a typing
    // inputType (Chrome) or with insertReplacementText (Firefox).
    const { inputType } = /** @type {InputEvent} */ (event)
    if (!inputType || inputType === 'insertReplacementText') jumpTo(input)
  })
}

if (navigator.clipboard) {
  for (const button of document.querySelectorAll('[data-sg-copy]')) {
    const label = button.textContent
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer

    button.removeAttribute('hidden')
    button.addEventListener('click', async () => {
      const code = button.closest('.sg-source-code')?.querySelector('pre')?.textContent ?? ''
      try {
        await navigator.clipboard.writeText(code)
        button.textContent = 'Copied'
      } catch {
        button.textContent = 'Copy failed'
      }
      clearTimeout(timer)
      timer = setTimeout(() => {
        button.textContent = label
      }, 2000)
    })
  }
}
