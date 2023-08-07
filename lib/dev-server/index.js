const express = require('express');

const app = express();
const chokidar = require('chokidar');

const watcher = chokidar.watch('./dev-server');
watcher.on('ready', () => {
  watcher.on('all', () => {
    console.log('Clearing /dist/ module cache from server');
    Object.keys(require.cache).forEach((id) => {
      if (/[\/\\]app[\/\\]/.test(id)) delete require.cache[id];
    });
  });
});
app.use((req, res, next) => {
  require('./routes')(req, res, next);
});
app.listen(9000);