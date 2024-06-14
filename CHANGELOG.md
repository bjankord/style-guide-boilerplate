4.0.0-alphas
==================
* Renamed `markup` directory to `components`
* Renamed `base` directory to `core`
3.3.2 / 2018-10-6
==================
* Added package.json file to help deploy to gh-pages

3.3.1 / 2018-10-6
==================
* Fixed broken padding values on navigation sidebar

3.3.0 / 2015-12-24
==================

* Fixed issue with scandir picking up hidden system files where the filename starts with a dot [\#30](https://github.com/bjankord/Style-Guide-Boilerplate/issues/30)
* Added :visited and :focus styles to nav links [\#31](https://github.com/bjankord/Style-Guide-Boilerplate/issues/31)

3.2.0 / 2015-10-03
==================

* Added markdown support for docs
* Added markdown styling via [github-markdown.css](https://github.com/sindresorhus/github-markdown-css)
* Increased .sg-h2 and .sg-h3 font size to better align with github markdown heading sizes
* Converted sample documentation .html files to .md files
* Removed "Usage" heading that appeared above docs

3.1.0 / 2015-07-27
==================

* Updated CONTRIBUTING.md broken link fix (#25, @mixedrays)
* Added automatic project structuring based on markup/ directory (#25, @mixedrays)
 * Updated functions.php, index.php, sg-scripts.js, and sg-styles.css (#25, @mixedrays)

3.0.0 / 2015-06-16
==================

* Added 'no-js' class to HTML element to help with progressive enhancement
* Added meta theme-color tag
* Added minor accessibility improvements
* Added picture element to media.html example file
* Changed nav toggle element to button
* Changed "View Source" and "Copy Source" actions to button elements
* Cleaned up spacing and comment wording in functions.php
* Cleaned up sg-scripts.js
* Cleaned up sg-style.css
* Removed global form navigation
* Removed example of fieldset with large amount of text
* Removed code-prettify (prettyprint) styles
* Reworked listMarkupAsOptions function into listMarkupAsListItems function
* Reworked layout template and styles to be more responsive
* Updated README.md
* Updated media query breakpoints
* Updated wording in "Getting Started" section
* Updated meta viewport tag
* Updated font stack markup and styling
* Updated color swatch markup and styling
* Updated JavaScript syntax highlighter to prism.js

2.6.1 / 2015-03-26
==================

* Improved accessibility of form, media, and table markup examples
* Added skip to main content link
* Added .sg-visually-hidden and .sg-visually-hidden-focusable to style text intended for screen readers

2.6.0 / 2014-12-18
==================

 * Moved functions in index.php to functions.php
 * Changed Base Styles wording to Base HTML
 * Changed Pattern Styles wording to Patterns
 * Added lang attribute

2.5.2 / 2014-12-16
==================

 * Clean up extra white space in multiple files
 * Minor adjustments to selector formatting

2.5.1 / 2014-03-15
==================

 * Add FILTER_SANITIZE_URL to $pageURL

2.5.0 / 2014-03-14
==================

 * Add ability to add personalized doc for each markup snippet

2.4.0 / 2014-02-24
==================

 * Update Style Guide Boilerplate to use box-sizing border-box globally

2.3.0 / 2013-08-24
==================

 * Update address markup to more neutral base

2.2.0 / 2013-08-24
==================

 * Update wording on button that selects sample markup to be copied
 * Add tooltip to copy source button

2.1.0 / 2013-07-13
==================

 * Add button that selects sample markup to be copied
 * Resolves issue #4 and issue #6

2.0.2 / 2013-07-09
==================

 * Resolved issue #3

2.0.1 / 2013-07-09
==================

 * Removed custom scrollbar styles

2.0.0 / 2013-06-18
==================

 * Reworked navigation
 * Reworked layout
 * Added hex values to color swatches
 * Added ability to toggle code snippets
 * Switched to placehold.it for images
 * Switched to prettify.js for code highlighting
 * Improved usability across mobile and legacy browsers
 * Normalized time element formatting

1.9.0 / 2013-06-07
==================

 * Normalize formatting for all markup snippets
 * Update tabular data example

1.8.1 / 2013-05-29
==================

 * Update sources for video and audio elements

1.8.0 / 2013-05-29
==================

 * Reworked Media section
 * Add Audio example
 * Add Video example
 * Reworked preformatted text
 * Reworked tabular data
 * Add table with side headings

1.7.1 / 2013-05-28
==================

 * Fix dynamic output value on range slider

1.7.0 / 2013-05-24
==================

 * Add datalist fields

1.6.0 / 2013-05-24
==================

 * Reworked Form Buttons section
 * Add disabled buttons
 * Add fieldset examples
 * Reworked Form Fields
 * Add speech recognition input
 * Add time input
 * Add disabled fields
 * Add readonly fields

1.5.0 / 2013-05-24
==================

 * Add meter element
 * Add progress element

1.4.0 / 2013-05-24
==================

 * Add details element

1.3.0 / 2013-05-24
==================

 * Remove headings in hgroup
 * Add small text and link in heading examples
 * Add address element
 * Add time element
 * Add q element
 * Add international phone input example
 * Add placeholder example
 * Add required field input
 * Add mulitiple select menu
 * Merge HTML5 Form Fields section into Form Fields section

1.2.0 / 2013-04-02
==================

 * Add media query for small viewports

1.1.0 / 2013-03-22
==================

  * Remove dependancy on jQuery
  * Locally host highlight.js files
  * Use placedog.com instead of lorempixel.com

1.0.0 / 2013-03-06
==================

  * Initial commit
