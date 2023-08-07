const fs = require('fs').promises;
const path = require('path');
const escapeHtml = require('escape-html');
const marked = require('marked');
const exists = require('../utils/exists');

const generatedMarkup = async (config, type) => {
  const renderTitleFromPath = (filePath) => {
    // Match with separators on *nix
    const unixFileMatch = filePath.match(/markup\/(.*)/);
    // todo check if this works on windows
    const windowsFileMatch = filePath.match(/markup\\(.*)/);
    const relativeMarkupPath = unixFileMatch || windowsFileMatch;
    const id = relativeMarkupPath[1]
      .replace('.html', '')
      .replace(/\//g, '')
      .replace(/\\/g, '')
      .replace('base', '')
      .replace('patterns', '');
    const title = id.replace(/-/g, ' ')
      .replace(/_/g, ' ');
      // todo figure out how to cross OS determine subsection
      // windows may not return / in file path string
    let subSection;
    if (relativeMarkupPath[1].includes('base/')) {
      subSection = 'base';
    }

    if (relativeMarkupPath[1].includes('patterns/')) {
      subSection = 'patterns';
    }

    return `<h2 id="${subSection}-${id}" class="sg-h2 sg-title">${title}</h2>`;
  };

  const renderMarkdownDoc = async (filePath) => {
    const strippedFilePath = filePath.replace('/', '').replace('\\', '');
    const strippedBaseDocsDir = config.baseDocsDir.replace('/', '').replace('\\', '');
    const strippedPatternsDocsDir = config.patternsDocsDir.replace('/', '').replace('\\', '');

    const isBaseDoc = strippedFilePath.includes(strippedBaseDocsDir);
    const isPatternsDoc = strippedFilePath.includes(strippedPatternsDocsDir);
    const baseDocPath = config.baseDocsDir;
    const patternsDocPath = config.patternsDocsDir;

    const markdownMarkup = (markdownContent) => `<div class="sg-sub-section sg-doc">
<div class="markdown-body">
    ${markdownContent}</div>
</div>`;

    if (isBaseDoc && exists(config.baseDocsDir)) {
      try {
        const relativeMarkupPath = filePath.match(/markup\/(.*)/);
        const fileName = relativeMarkupPath[1]
          .replace('.html', '.md')
          .replace(/\//g, '')
          .replace(/\\/g, '')
          .replace('base', '');

        const markdownDocPath = path.join(baseDocPath, fileName);

        const fileData = await fs.readFile(markdownDocPath, 'utf8');

        // sanitize incoming MD files
        // const sanitizedFileData = sanitizeHtml(fileData);
        return markdownMarkup(marked.parse(fileData));
      } catch (err) {
        throw new Error(err);
      }
    }

    if (isPatternsDoc && exists(config.patternsDocsDir)) {
      try {
        const relativeMarkupPath = filePath.match(/markup\/(.*)/);
        const fileName = relativeMarkupPath[1]
          .replace('.html', '.md')
          .replace(/\//g, '')
          .replace(/\\/g, '')
          .replace('patterns', '');

        const markdownDocPath = path.join(patternsDocPath, fileName);
        const fileData = await fs.readFile(markdownDocPath, 'utf8');

        // sanitize incoming MD files
        // const sanitizedFileData = sanitizeHtml(fileData);
        return markdownMarkup(marked.parse(fileData));
      } catch (err) {
        throw new Error(err);
      }
    }
  };

  const renderHtmlMarkup = async (filePath) => {
    try {
      const fileData = await fs.readFile(filePath, 'utf8');
      const fileExt = filePath.split('.').pop();

      if (fileExt === 'html') {
        // sanitize incoming HTML files
        // const sanitizedFileData = sanitizeHtml(fileData);

        return `<div class="sg-sub-section sg-example">
        <h3 class="sg-h3 sg-title">Example</h3>
        ${fileData}
      </div>`;
      }
    } catch (err) {
      throw new Error(err);
    }
  };

  const renderHtmlSource = async (filePath) => {
    try {
      const fileData = await fs.readFile(filePath, 'utf8');
      const fileExt = filePath.split('.').pop();

      if (fileExt === 'html') {
        // escape incoming HTML files
        const escapedHtml = escapeHtml(fileData);

        return `<div class="sg-sub-section">
    <div class="sg-markup-controls">
      <button type="button" class="sg-btn sg-btn--source">View Source</button>
      <a class="sg-btn--top" href="#top">Back to Top</a>
    </div>
    <div class="sg-source">
    <button type="button" class="sg-btn sg-btn--select">Copy Source</button>
    <pre class="line-numbers language-markup">${escapedHtml}</pre>
    </div>
  </div>`;
      }
    } catch (err) {
      throw new Error(err);
    }
  };

  const renderMarkupSection = async (filePath) => {
    try {
      const markupSection = `<div class="sg-section">
      ${renderTitleFromPath(filePath)}
      ${await renderMarkdownDoc(filePath)}
      ${await renderHtmlMarkup(filePath)}
      ${await renderHtmlSource(filePath)}
      </div>`;

      return markupSection;
    } catch (err) {
      throw new Error(err);
    }
  };

  /**
 * Takes options directory path and returns an object to be used for navigation link structure
 * @param {Object} options
 * @returns {Object}
 */
  const buildDataFromFileNames = async (options) => {
    let fileNames;
    try {
    // Get file names from directory
      fileNames = await fs.readdir(options.dir);

      // Generate full path of file name
      const fullPaths = fileNames.map((fileName) => path.join(options.dir, fileName));

      // Generate array of markup from files in directory
      const fileMarkup = await Promise.all(
        fullPaths.map(async (filePath) => {
          const result = await renderMarkupSection(filePath);
          return result;
        }),
      );

      // Convert markup array into string
      const fileMarkupString = fileMarkup.join('');
      return fileMarkupString;
    } catch (err) {
      throw new Error(err);
    }
  };

  // Markup string to be used in HTML template
  let markup = '';

  if (type === 'base') {
    if (exists(config.baseExamplesDir)) {
      const baseOptions = {
        name: 'base',
        dir: config.baseExamplesDir,
      };
      // Append base markup to existing markup string
      markup += `<h1 id="sg-markup-patterns" class="sg-h1 sg-title">Base</h1>
    <div class="sg-section-group">${await buildDataFromFileNames(baseOptions)}</div>`;
    } else {
      console.error('No base directory found inside of the markup directory in root directory of the project');
    }
  }

  if (type === 'patterns') {
    if (exists(config.patternsExamplesDir)) {
      const patternsOptions = {
        name: 'patterns',
        dir: config.patternsExamplesDir,
      };

      // Append patterns markup to existing markup string
      markup += `<h1 id="sg-markup-patterns" class="sg-h1 sg-title">Patterns</h1>
    <div class="sg-section-group">${await buildDataFromFileNames(patternsOptions)}</div>`;
    }
  }

  return `<div class="sg-section-group">
${markup}
</div>`;
};

module.exports = generatedMarkup;
