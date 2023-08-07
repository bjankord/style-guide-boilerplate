const http = require('http');
const fs = require('fs');
const path = require('path');
const nodeStatic = require('node-static');
const config = require('../config');
//
// Create a node-static server instance to serve the './public' folder
//

const port = config.devServerPort || 8080;
const file = new nodeStatic.Server(config.buildDir);

http.createServer((request, response) => {
  request.addListener('end', () => {
    //
    // Serve files!
    //
    file.serve(request, response);
  }).resume();

  // console.log('request ', request.url);

  // let filePath = `.${request.url}`;
  // if (filePath === './') {
  //   filePath = './build/index.html';
  // }

  // const extname = String(path.extname(filePath)).toLowerCase();
  // const mimeTypes = {
  //   '.html': 'text/html',
  //   '.js': 'text/javascript',
  //   '.css': 'text/css',
  //   '.json': 'application/json',
  //   '.png': 'image/png',
  //   '.jpg': 'image/jpg',
  //   '.gif': 'image/gif',
  //   '.svg': 'image/svg+xml',
  //   '.wav': 'audio/wav',
  //   '.mp4': 'video/mp4',
  //   '.woff': 'application/font-woff',
  //   '.ttf': 'application/font-ttf',
  //   '.eot': 'application/vnd.ms-fontobject',
  //   '.otf': 'application/font-otf',
  //   '.wasm': 'application/wasm',
  // };

  // const contentType = mimeTypes[extname] || 'application/octet-stream';

  // fs.readFile(filePath, (error, content) => {
  //   if (error) {
  //     if (error.code === 'ENOENT') {
  //       fs.readFile('./404.html', (error, content) => {
  //         response.writeHead(404, { 'Content-Type': 'text/html' });
  //         response.end(content, 'utf-8');
  //       });
  //     } else {
  //       response.writeHead(500);
  //       response.end(`Sorry, check with the site admin for error: ${error.code} ..\n`);
  //     }
  //   } else {
  //     response.writeHead(200, { 'Content-Type': contentType });
  //     response.end(content, 'utf-8');
  //   }
  // });
}).listen(port);
console.log(`Server running at http://127.0.0.1:${port}/`);
