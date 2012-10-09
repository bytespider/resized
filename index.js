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

    this.readable = true;
    this.writable = true;

    this.djpeg = child_process.spawn('djpeg', ['-dct', 'int', '-scale', '1/4']);
    this.cjpeg = child_process.spawn('cjpeg', ['-quality', '90', '-sample', '1x1']);

    this.djpeg.stdout.pipe(this.cjpeg.stdin);

    var self = this;

    this.djpeg.stdin.on('drain', function () {
        self.emit('drain');
    });

    this.djpeg.stdin.on('error', function (error) {
        self.emit('error', error);
    });

    this.djpeg.stdin.on('close', function () {
        self.emit('close');
    });

    this.djpeg.stdin.on('pipe', function (src) {
        self.emit('pipe', src);
    });

    this.cjpeg.stdout.on('data', function (data) {
        console.log('cjpeg got data for you');
        self.emit('data', data);
    });

    this.cjpeg.stdout.on('error', function (error) {
        self.emit('error', error);
    });

    this.cjpeg.stdout.on('end', function () {
        self.emit('end');
    });

    this.cjpeg.stdout.on('close', function () {
        self.emit('close');
    });


    return this;
};

util.inherits(Resized, Stream);

Resized.prototype.write = function (data) {
    //this.emit('data', data);
    console.log('writing');
    return this.djpeg.stdin.write(data);
};

Resized.prototype.end = function (data) {
    if (data) {
        this.write(data);
    }

    console.log('ending');
    return this.djpeg.stdin.end();
};

Resized.prototype.pause = function () {
    console.log('pausing');
    return this.djpeg.stdin.pause();
};

Resized.prototype.destroy = function () {
    console.log('destroying');
    
    this.readable = false;
    this.writable = false;
    return this.djpeg.stdin.close();
};

Resized.prototype.resume = function () {

};

exports.Resized = Resized;