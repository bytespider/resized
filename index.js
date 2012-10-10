/*
 * resized
 * https://github.com/bytespider/resized
 *
 * Copyright (c) 2012 Rob Griffiths
 * Licensed under the MIT license.
 */

var util = require('util');
var Stream = require('stream');
var child_process = require('child_process');

function Resized(options) {
    Stream.call(this);

    var djpeg = child_process.spawn('djpeg', ['-scale', '1/8']);
    var cjpeg = child_process.spawn('cjpeg', []);
    djpeg.stdout.pipe(cjpeg.stdin);

    var stream = this;

    this.pause = function () {
        cjpeg.stdout.pause();
    };

    this.write = function (data) {
        return djpeg.stdin.write(data);
    };

    this.resume = function () {
        cjpeg.stdout.resume();  
    };

    this.end = function () {
        djpeg.stdin.end();
    };

    djpeg.stdin.on('end', function (data) {
        if (data) {
            stream.write(data);
        }

        djpeg.stdin.end();
    });

    djpeg.stdin.on('drain', function () {
        stream.emit('drain');
    });

    cjpeg.stdout.on('data', function (data) {
        stream.emit('data', data);
    });


    return this;
};

util.inherits(Resized, Stream);

Resized.prototype.readable = true;
Resized.prototype.writable = true;

exports.Resized = Resized;