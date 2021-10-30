const express = require('express')
const path = require('path')
const fs = require('fs');
const es6Renderer = require('express-es6-template-engine')
const marked = require('marked');

const app = express()
const port = process.env.PORT || 9001

// Serve files in public directory as static assets except for index.html
// index.html will run through the ES6 template engine
app.use('/', express.static(path.join(__dirname, '..', 'public'), {
  index: false,
}));

// Set up ES6 template engine
app.engine('html', es6Renderer);
app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'html');

// Serve index.html
app.get('/', function (req, res) {
  const base = 'base';
  const patterns = 'patterns';

  const baseFiles = fs.readdirSync(path.join(__dirname, '..', 'markup', base));
  const patternFiles = fs.readdirSync(path.join(__dirname, '..', 'markup', patterns));

  const escapeHtml = (unsafe) => {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const generatePartialData = (type, files) => {
    return files.map((currentFile) => {
      const currentFilePath = path.join(__dirname, '..', 'markup', type, currentFile);
      const markdownDocPath = path.join(__dirname, '..', 'doc', type, `${currentFile.split('.', 1)[0]}.md`);
      const htmlDocPath = path.join(__dirname, '..', 'doc', type, currentFile);
      let markdownDocs;
      let htmlDocs;

      /**
       * Try to load optional markdown docs, if they don't exist, try to load optional HTML docs
       */
      try {
        const markdownDocFile = fs.readFileSync(markdownDocPath, 'utf8');
        markdownDocs = marked(markdownDocFile);
      } catch (err) {
        try {
          htmlDocs = fs.readFileSync(htmlDocPath, 'utf8')
        } catch (e) {}
      }

      return {
        title: currentFile.split('.', 1)[0].replace(/-/g, ' '),
        fileName: currentFile,
        content: fs.readFileSync(currentFilePath, 'utf-8'),
        escapedContent: escapeHtml(fs.readFileSync(currentFilePath, 'utf-8')),
        documentation: markdownDocs || htmlDocs,
      };
    });
  }
  const baseData = generatePartialData(base, baseFiles);
  const patternsData = generatePartialData(patterns, patternFiles);

  res.render('index', {
    locals: {
      base: baseData,
      patterns: patternsData,
    }
  });
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})