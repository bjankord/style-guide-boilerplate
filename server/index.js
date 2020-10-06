const express = require('express')
const path = require('path')
const fs = require('fs');
const es6Renderer = require('express-es6-template-engine')
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

  const generatePartialData = (type, files) => {
    return files.map((currentFile) => {
      const docsFile = `${currentFile.split('.', 1)[0]}.md`
      return {
        title: currentFile.split('.', 1)[0],
        fileName: currentFile,
        content: fs.readFileSync(path.join(__dirname, '..', 'markup', type, currentFile)),
        documentation: fs.readFileSync(path.join(__dirname, '..', 'doc', type, docsFile))
      };
    });
  }
  const baseData = generatePartialData(base, baseFiles);
  const patternsData = generatePartialData(patterns, patternFiles);

  console.log(base);

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