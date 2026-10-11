Style Guide Boilerplate
=======================

A starting point for crafting living style guides.

Style Guide Boilerplate is a [Vite](https://vite.dev) plugin. It turns a folder
of HTML examples and Markdown docs, styled by your project's real CSS, into a
browsable style guide. In development you edit, save and see it. `vite build`
gives you a fully static site you can host anywhere.

If you want a full component workbench, look at
[Storybook](https://storybook.js.org).

> **v3 (PHP) is end of life.** The final version is tagged
> [`v3-final`](https://github.com/bjankord/style-guide-boilerplate/tree/v3-final).
> See [Migrating from v3](#migrating-from-v3).

## Requirements

- Node 22 or newer
- Vite 8

## Getting started

Install the plugin and Vite:

```bash
npm install --save-dev vite @bjankord/style-guide-boilerplate
```

Add it to `vite.config.js`:

```js
import { defineConfig } from 'vite'
import styleGuide from '@bjankord/style-guide-boilerplate'

export default defineConfig({
  plugins: [
    styleGuide({
      styles: ['./src/styles/main.css'],
      title: 'My Style Guide',
    }),
  ],
})
```

Add some content:

```text
style-guide/
├── 01-getting-started/
│   └── index.md
├── 02-colors/
│   └── brand/
│       └── index.md
├── 03-fonts/
│   └── index.md
├── 04-base/
│   ├── index.md
│   ├── headings/
│   │   ├── index.md
│   │   ├── 01-sizes/
│   │   │   ├── index.md
│   │   │   └── sizes.html
│   │   └── 02-with-links/
│   │       └── with-links.html
│   └── lists/
│       └── lists.html
└── 05-components/
    └── buttons/
        ├── index.md
        └── buttons.html
```

Then run Vite:

```bash
npx vite
```

```bash
npx vite build
```

There's no `index.html` to maintain: the plugin generates the page.

## Options

| Option    | Default           | Description |
| --------- | ----------------- | ----------- |
| `content` | `'./style-guide'` | Folder of examples and docs, relative to the Vite root. |
| `styles`  | `[]`              | Your stylesheets. Local paths go through Vite, so Sass, PostCSS and hot reload all work. URLs (`https://…`, `//…`) are linked as-is, which suits PHP, Rails and other setups where the asset pipeline lives elsewhere. |
| `scripts` | `[]`              | Scripts loaded once on the page. Local paths go through Vite; URLs become `<script>` tags. |
| `title`   | `'Style Guide'`   | The page and header title. |
| `path`    | `'/'`             | Where the guide is served, under Vite's `base`. Use something like `'/style-guide/'` to mount it in an existing app. |
| `build`   | `true`            | Set to `false` to leave the guide out of production builds. |
| `nav`     | `{ depth: 3 }`    | How deep the sidebar goes: `1` lists sections, `2` adds their patterns, and `3` adds the variants of patterns that have more than one. |

## Content

The content folder has three levels:

- **Sections.** Each top-level folder is a section, like `04-base/` or
  `05-components/`. A section's `index.md` is enough on its own, which suits
  a page like `01-getting-started/`.
- **Patterns.** Each folder inside a section is a pattern, like `headings/` or
  `buttons/`.
- **Variants.** Inside a pattern folder, each example file or folder is a
  variant, like `01-sizes/` or `02-with-links.html`. A pattern with one variant
  shows it directly; with several, each variant gets its own heading.

The sidebar lists sections, their patterns, and the variants of patterns that
have more than one. Set `nav.depth` to `2` or `1` to stop at patterns or
sections.

A **variant folder** holds one `.html` example and an optional `.md` doc, with
any file names (`index.md` reads well for the doc). Its title and order come
from the folder name. Variant files and folders can sit side by side in a
pattern, and they sort together. A variant folder with more than one `.html`
or `.md` file, or with folders inside it, is skipped with a warning.

Examples always live in a pattern folder, even when there's only one, like
`04-base/lists/lists.html`. An `.html` or `.md` file directly in a section
folder (other than `index.md`) or in the content root is skipped with a
warning that suggests where to move it.

- **Each `.html` file is an example.** It's shown rendered, followed by its
  source in a **View source** panel with a **Copy** button.
- **Docs are sibling `.md` files.** `02-with-links.md` documents
  `02-with-links.html`, and in a variant folder the `.md` file documents the
  `.html` file. A `.md` file without an example is shown as a doc on its own.
  Markdown can include raw HTML.
- **`index.md`** documents its section or pattern folder. It's shown under the
  folder's heading.
- **Titles come from file and folder names.** `form-buttons` becomes "Form
  buttons".
- **Ordering:** a number prefix like `01-` sets the order and is removed from
  the title. Everything without one sorts alphabetically, after the numbered
  entries. This applies at every level.
- **Front matter** overrides the title and order. Use it in a variant's `.md`
  file (including in a variant folder), or in `index.md` for a section or
  pattern folder:

  ```md
  ---
  title: Button styles
  order: 1
  ---
  Use `.button` for actions.
  ```

### Colors and fonts

Add `colors` or `fonts` to the front matter of any `index.md` or variant `.md`
file, and the guide renders swatches or font samples under its doc. Values can
be CSS variables, so swatches render through your real CSS.

```md
---
colors:
  - name: Primary
    value: var(--brand-primary)
  - name: Accent
    value: "#e67e22"
fonts:
  - name: Body
    value: '"Inter", sans-serif'
  - name: Body bold
    value: '"Inter", sans-serif'
    weight: 700
---
Use Primary for actions and links.
```

Each list can also be an object of `name: value` pairs, or a path to a `.json`
file with either shape, relative to the `.md` file. That lets you keep one list
of tokens for your project and the guide:

```md
---
colors: ../../src/tokens/neutrals.json
---
```

```json
{
  "Gray 100": "var(--gray-100)",
  "Gray 900": "var(--gray-900)"
}
```

Colors take `name` and `value`. Fonts take `name` and a `font-family` `value`,
plus optional `weight` and `style`. Entries without a `name` or `value` are
skipped with a warning.

## Search

The guide has a search box in the header, which moves to the top of the
sidebar on small screens. It suggests every item in the sidebar using the
browser's native `<datalist>`. Picking a suggestion, or pressing Enter, jumps
to that item; Enter also accepts part of a title, like "link" for "With
links". When two items share a title, the suggestion adds its path, like
"Primary (Forms › Buttons)". Search needs JavaScript, so it's hidden without
it.

## Two ways to set it up

**A dedicated project.** Keep the default `path: '/'`. `vite build` writes the
guide to `dist/index.html` with relative URLs, so `dist/` works from any
folder.

**Mounted in an existing Vite app.** Set `path: '/style-guide/'`. The guide is
served at `/style-guide/` in development, under your app's `base`. By default
`vite build` writes it to `dist/style-guide/` alongside the app. Set
`build: false` to keep it development-only.

## Development

- Edits to your CSS hot reload in place.
- Adding, changing or removing `.html` and `.md` files reloads the page, and
  so does editing a `.json` file that front matter points at.
- Changes to the plugin options in `vite.config.js` restart the dev server.

## Theming

The guide's own CSS is a separate file, and every selector uses the `sg-`
prefix, so your CSS stays in charge of the examples. Set `title` in the
options, and override these custom properties in one of your `styles`:

```css
:root {
  --sg-accent: #e67e22;
  --sg-font: "Inter", system-ui, sans-serif;
  --sg-mono-font: "JetBrains Mono", monospace;
  --sg-sidebar-width: 20rem;
  --sg-header-bg: #111;
  --sg-header-color: #fff;
  --sg-sidebar-bg: #2b2b2b;
  --sg-sidebar-color: #fff;
}
```

The header, sidebar and code panels follow the visitor's light or dark mode.
The main area keeps your project's colors, since your examples are styled for
them.

## Migrating from v3

1. Install the plugin and add it to `vite.config.js` (see [Getting started](#getting-started)).
2. Move `markup/*` into `style-guide/`, giving each example its own pattern
   folder. For example, `markup/base/blockquote.html` becomes
   `style-guide/base/blockquote/blockquote.html`. Add number prefixes like
   `01-base` to control the order, and group related examples into one
   pattern folder as variants.
3. Move each doc in `doc/` next to its example as a sibling `.md` file. For
   example, `doc/patterns/breadcrumbs.md` becomes
   `style-guide/patterns/breadcrumbs/breadcrumbs.md`. HTML docs are no longer
   supported; convert them to Markdown, which can contain raw HTML.
4. Move the "Getting Started" text from `index.php` into a section's
   `index.md`, such as `style-guide/01-getting-started/index.md`.
5. Move your colors and font stacks from `index.php` into `colors` and `fonts`
   front matter, for example in `style-guide/02-colors/index.md` and
   `style-guide/03-fonts/index.md`. See [Colors and fonts](#colors-and-fonts).
6. Replace the `css/style.css` link with the `styles` option.
7. Delete the PHP files. `npx vite` replaces `php -S`, and `npx vite build`
   replaces `php index.php > index.html`.

## Additional resources

- [Styleguides.io](https://styleguides.io)
- [Front-end Style Guides](https://24ways.org/2011/front-end-style-guides/)
- [Jeremy Keith's Pattern Primer](https://adactio.com/journal/5028/)

## Credit

Thanks to Jeremy Keith for letting me build on top of
[Pattern Primer](https://github.com/adactio/Pattern-Primer).

## Contributing to this project

Please take a moment to review the [guidelines for contributing](CONTRIBUTING.md).

- [Bug reports](CONTRIBUTING.md#bugs)
- [Feature requests](CONTRIBUTING.md#features)
- [Pull requests](CONTRIBUTING.md#pull-requests)

To work on the plugin itself:

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm test
```

```bash
npm run test:e2e
```

`npm run fixture:dev` serves the test fixture in `test/fixture/`.

## License

**Style Guide Boilerplate** is licensed under the [MIT License](LICENSE.txt).
