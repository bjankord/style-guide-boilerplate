// const crypto = require('crypto');
// const fs = require('fs');
// const watch = require('node-watch');
const path = require('path');
const chokidar = require('chokidar');
// const { spawn } = require('child_process');
const spawn = require('cross-spawn');
const config = require('./config');

const watch = () => {
  console.log('start watcher');
  // Watches file, dir, glob, or array
  const sgbConfig = path.join(process.cwd(), 'sgb.config.js');

  function spawnNodemon() {
    console.log(process.env.PATH);
    const cp = spawn('node', [path.join(process.cwd(), 'lib', 'server.js'), '--watch', config.buildDir], {
    // the important part is the 4th option 'ipc'
    // this way `process.send` will be available in the child process (nodemon)
    // so it can communicate back with parent process (through `.on()`, `.send()`)
    // https://nodejs.org/api/child_process.html#child_process_options_stdio
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    return cp;
  }

  const watcher = chokidar.watch(sgbConfig, {
    persistent: true,
  });

  const app = spawnNodemon();
  app.on('message', (event) => {
    if (event.type === 'start') {
      console.log('nodemon started');
    } else if (event.type === 'error') {
      console.log('nodemon error');
    } else if (event.type === 'crash') {
      console.log('script crashed for some reason');
    }
  });

  watcher
    .on('add', (filePath) => console.log(`File ${filePath} has been added`))
    .on('ready', () => {
      console.log('Initial scan complete. Ready for changes');
      console.log('Starting dev server');
      // spawn(
      //   'node',
      //   [path.join(process.cwd(), 'lib', 'server.js')],
      //   {
      //     stdio: 'inherit',
      //   },
      // );
    })
    .on('change', (filePath) => {
      console.log(`File ${filePath} has been changed`);
      app.send('quit');
    })
    .on('unlink', (filePath) => console.log(`File ${filePath} has been removed`));
};

// const watcher = () => {
//   const sgbConfig = path.join(process.cwd(), 'sgb.config.js');
//   console.log(`Watching for changes to ${sgbConfig}`);
//   watch(sgbConfig, { recursive: true }, (evt, name) => {
//     console.log('%s changed.', name);
//   });
// };
/*
const watch = () => {
  const buttonPressesLogFile = path.join(process.cwd(), 'sgb.config.js');
  console.log('Watching files for changes');

  let md5Previous = null;
  let fsWait = false;
  fs.watch(buttonPressesLogFile, (event, filename) => {
    if (filename) {
      if (fsWait) return;
      fsWait = setTimeout(() => {
        fsWait = false;
      }, 100);
      const md5Current = crypto.createHash('md5').update(fs.readFileSync(buttonPressesLogFile)).digest('hex');
      if (md5Current === md5Previous) {
        return;
      }
      md5Previous = md5Current;
      console.log(`${filename} file Changed`);
    }
  });
};
*/

// watch();

module.exports = watch;
