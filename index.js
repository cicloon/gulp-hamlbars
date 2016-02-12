"use strict";

var fs = require('fs');
var path = require('path');
var Readable = require('stream').Readable;
var assign = require('object-assign');
var convert = require('convert-source-map');
var dargs = require('dargs');
var eachAsync = require('each-async');
var glob = require('glob');
var gutil = require('gulp-util');
var osTmpdir = require('os-tmpdir');
var pathExists = require('path-exists');
var rimraf = require('rimraf');
var spawn = require('cross-spawn-async');
// var logger = require('./lib/logger');
var utils = require('./lib/utils');

var PluginError = gutil.PluginError;


var runHamlbarize = function() {
  let bin = path.join(path.dirname(__dirname), 'gulp-hamlbars', 'bin', 'hamlbars.rb'),
      spawnSync = require('child_process').spawnSync,
      spawn = require('child_process').spawn;

  let child = spawn('bundle' , ['exec', bin], {stdio: 'inherit'});

  return child
}

var globalHamlbarizeTimeout = 1000;
var sep = "$hamlbarsfileend$";

var hamlbarize = (fileContent) => {

  let promise = new Promise( (resolve, reject) => {

    let socket = require("net").Socket({readable: true, writable: true}),
        outputFile = "";

    socket.setKeepAlive(true)
    socket.setNoDelay(true)
    socket.setEncoding("utf8")
    socket.setTimeout(6000, () => {
      reject('timeout')
    })

    socket.on('connect', () => {
      socket.write(fileContent + sep)
    })

    socket.on('data', (data) => {
      outputFile = data
    })

    socket.on('error', (error) => {
      reject(error)
    })

    socket.on("close", (data, something) => {
      resolve(outputFile)
    })
n
    setTimeout( () => { socket.connect(4568)}, globalHamlbarizeTimeout)
    globalHamlbarizeTimeout += 20

  })

  return promise
}



var gulpHamlbars = function(sources, cb){

  var matches = [];
	var bases = [];

  var stream = new Readable({objectMode: true});

  var hamlbarizeProcess = runHamlbarize()

	// redundant but necessary
	stream._read = function () {};

  if (!Array.isArray(sources)) {
		sources = [sources];
	}

	sources.forEach(function (source) {
		matches.push(glob.sync(source));
		bases.push(utils.calculateBase(source));
	});


  // log and return stream if there are no file matches
	if (matches[0].length < 1) {
		gutil.log('No files matched your Hamlbars source.');
		stream.push(null);
		return stream;
	}

  var promises = []

  matches.forEach( function(match, i){
    var base = bases[i];

    match.forEach( function(filePath){
      var buf = fs.readFileSync(filePath, "utf8");
      var promise = hamlbarize(buf);

      promise.then( function(handlebarsOutput){
        try{
          var vinylFile = new gutil.File({
            cwd: process.cwd(),
            base: base,
            path: filePath.replace(".hamlbars", ".hbs"),
            contents: new Buffer(handlebarsOutput, "utf-8")
          });

          stream.push(vinylFile)

        } catch(e){
          gutil.log(e)
        }
      })

      promises.push(promise)
    })
  })

  Promise.all(promises).then( function(){
    hamlbarizeProcess.kill()
    cb(stream);
  })

}


gulpHamlbars.logError = function (err) {
	var message = new gutil.PluginError('gulp-hamlbars', err);
	process.stderr.write(message + '\n');
	this.emit('end');
};

module.exports = gulpHamlbars
