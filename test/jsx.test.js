import { describe, expect, it } from 'vitest'
import { Fragment, html, jsx, jsxs, renderToString } from '../src/jsx-runtime.js'

/** @param {unknown} node */
const render = (node) => renderToString(node)

describe('jsx runtime', () => {
  it('renders elements with HTML-style attributes', () => {
    expect(render(jsx('label', { class: 'a', for: 'x', children: 'Name' }))).toBe(
      '<label class="a" for="x">Name</label>',
    )
    expect(render(jsx('label', { className: 'a', htmlFor: 'x', tabIndex: 0 }))).toBe(
      '<label class="a" for="x" tabindex="0"></label>',
    )
  })

  it('renders string and object styles', () => {
    expect(render(jsx('span', { style: 'width: 4px' }))).toBe('<span style="width: 4px"></span>')
    expect(render(jsx('span', { style: { backgroundColor: 'red', '--size': '4px', width: null } }))).toBe(
      '<span style="background-color: red; --size: 4px"></span>',
    )
  })

  it('handles booleans, empty values, void elements and handlers', () => {
    expect(render(jsx('input', { disabled: true, readOnly: false, value: undefined, onClick: () => {} }))).toBe(
      '<input disabled>',
    )
    expect(render(jsx('br', {}))).toBe('<br>')
  })

  it('escapes text and attributes, but not trusted HTML', () => {
    expect(render(jsx('p', { title: '"a" & <b>', children: '<b>bold</b> & co' }))).toBe(
      '<p title="&quot;a&quot; &amp; &lt;b&gt;">&lt;b&gt;bold&lt;/b&gt; &amp; co</p>',
    )
    expect(render(jsx('p', { children: html('<b>bold</b>') }))).toBe('<p><b>bold</b></p>')
    expect(render(jsx('div', { dangerouslySetInnerHTML: { __html: '<i>x</i>' } }))).toBe('<div><i>x</i></div>')
  })

  it('renders fragments, arrays, numbers and components', () => {
    /** @param {{ name: string }} props */
    const Hello = ({ name }) => jsx('b', { children: name })
    const node = jsxs(Fragment, {
      children: [jsx(Hello, { name: 'Ada' }), [1, ' ', 2], null, false, undefined],
    })
    expect(render(node)).toBe('<b>Ada</b>1 2')
  })
})
