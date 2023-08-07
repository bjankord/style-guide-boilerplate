#!/usr/bin/env node

// require('../lib/cli')(process.argv.slice(2));
const path = require('path');
const spawn = require('cross-spawn');
const { exec } = require('child_process');
const bs = require('browser-sync').create();
const chokidar = require('chokidar');

const watch = require('../lib/watch');

// This file seems to be cached and changes to it are not represented when the watcher runs
// TODO - need to read the file contents of this file instead of requiring it to see if that
// can get around the caching issue

// may need to read the config file on every time it changes to pass in its fresh state to the
// build function
const config = require('../lib/config');
const start = require('../lib/start');
const build = require('../lib/build');

const main = async (argv) => {
  const task = argv[0];
  console.log({ task });

  if (task.toLowerCase() === 'serve') {
    try {
      // const buildStaticSite = await build(config);
      build(config).then(() => {
        // start Server
        console.log('Initial build should be complete, this should be last thing to log');
        // // .init starts the server
        // bs.init({
        //   server: './build',
        // });

        const sgbConfig = path.join(process.cwd(), 'sgb.config.js');

        const watcher = chokidar.watch(sgbConfig, {
          persistent: true,
        });

        watcher.on('change', async (filePath) => {
          console.log(`File changed: ${filePath}`);
          await build(config);
          // await watchRun(filePath);
        });

        watcher.on('add', async (filePath) => {
          console.log(`File added: ${filePath}`);
          await build(config);
          // await watchRun(filePath);
        });

        process.on('SIGINT', () => {
          watcher.close();
          process.exit();
        });
      });

      // serve();
      // this seems to work but the process is never killed
      // spawn(
      //   // 'nodemon server.js -e ejs,js,css,html,jpg,png,scss',
      //   './node_modules/.bin/nodemon',
      //   ['lib/dev-server/server.js'],
      //   // [path.join(process.cwd(), 'lib', 'dev-server', 'server.js')],
      // ).on('error', (err) => { throw err; });

      // watch();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }

  if (task.toLowerCase() === 'build') {
    try {
      await build(config);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }
};

const argv = process.argv.slice(2);
main(argv);

/**
 * Usage
  “scripts”: {
    “dev”: “sgb start”, // this starts the development server
    “build”: “sgb build” // this builds style-guide-boilerplate as a static HTML page
  }
 */

/**
 * @param argv
 * @returns {Promise}
 */
/*
const main = async (argv) => {
  let result;
  const task = argv[0];
  switch (task) {
    case "start": {
      console.info('start');
      try {
        // await build(config);
        watch();
      } catch (err) {
        throw new Error(err);
      }
      // result = spawn.sync(
      //   "webpack-dev-server",
      //   ["--config", devConfig, "--progress"],
      //   { stdio: "inherit" }
      // );
      break;
    }
    case "build": {
      try {
        await build(config);
      } catch (err) {
        throw new Error(err);
      }
      break;
    }
    default:
      console.warn(`Unknown script "${task}".`);
  }

  if (result?.signal) {
    process.exit(1);
  }

  process.exit(result?.status);
};

const arg = process.argv.slice(2)
main(arg);
*/
