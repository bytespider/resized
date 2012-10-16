/*
 * resized
 * https://github.com/bytespider/resized
 *
 * Copyright (c) 2012 Rob Griffiths
 * Licensed under the MIT license.
 */

var util = require('util');
var child_process = require('child_process');
var fs = require('fs');

var EventEmitter = require('events').EventEmitter;

/*
exports.filter = function (type) {};
exports.flip = function (direction) {};
exports.quality = function (quality) {};
exports.rotate = function (degrees) {};
exports.scale = function (width, height) {};
exports.sepia = function () {};
exports.sharpen = function (radius, sigma) {};
exports.unsharp = function (radius, sigma, amount, threshold) {};

exports.size = function () {};
*/

function resized(src) {    
    if (!(this instanceof resized)) {
        return new resized(src);
    }

    var src_stream;
    if (typeof src == 'string') {
        src_stream = fs.createReadStream(src);
    } else {
        src_stream = src;
    }

    src_stream.pause();

    this.src = src_stream;
    this.stream = null;
    this.streamChain = [];
    this.properties = {};

    this.decoderOptions = [];
    this.encoderOptions = ['-quality', 90];
};

util.inherits(resized, EventEmitter);

resized.prototype.src = null;
resized.prototype.stream = null;
resized.prototype.properties = null;

resized.prototype.decoderOptions = null;
resized.prototype.encoderOptions = null;

resized.describe = function (filename, callback) {
    var cmd = child_process.exec('jhead ' + filename, function (err, stdout, stderr, cmd) {
        if (err) {
            callback(err, null);
        }
        
        var properties = {};
        var lines = (stdout || '').trim(' ').split("\n");
        
        lines = lines.forEach(function (i) {
            var key_value = i.replace(/ +: +/g, '|').split('|');

            var property = key_value[0].toLowerCase();
            var value = key_value[1];
            
            if (property in helpers) {
                value = helpers[property](value);
            }

            properties[property] = value;
        });

        callback(null, properties);
    });
};

resized.prototype.describe = function () {
    var self = this;
    var filename = this.src.path;

    if (!filename) {
        this.emit('error', new Error('Do not know how to describe source stream. Stream should be a readable file stream.'));
    }

    resized.describe(filename, function (err, properties) {
        if (err) {
            self.emit('error', err);
            return;
        }

        self.properties = properties;
        self.emit('described', properties);
    });

    return this;
};

resized.prototype.resize = function (options) {
    options = options || {};

    var width   = parseInt(options.width)   || null;
    var height  = parseInt(options.height)  || null;
    var aspect  = null != options.aspect ? options.aspect : true;
    var fill    = null != options.fill ? options.fill : false;
    var filter  = options.filter            || null;
    var opts    = [];

    if (width && height && (aspect || fill)) {
        if (fill) {
            opts.push('-xyfill');
        } else if (aspect) {
            opts.push('-xysize');
        }
        opts.push(width, height);
    } else {
        if (null != height) {
            opts.push('-height', height);
        }
        if (null != width) {
            opts.push('-width', width);
        }
    }

    if (filter) {
        opts.push('-filter', filter);
    }

    var self = this;
    this.once('described', function (properties) {
        // set up djpeg
        var opts = [];
        var wRatio = width/properties.resolution.width;
        var hRatio = height/properties.resolution.height;

        var ratio = Math.max(wRatio, hRatio).toFixed(3);

        var f = helpers['fraction'](Math.ceil(ratio * 8) / 8);
        self.decoderOptions.push('-scale', f);
    });
    this.describe();

    this.streamChain.push({command: 'pamscale', opts: opts});

    return this;
};

resized.RESIZE_FILTER_POINT     = 'point';
resized.RESIZE_FILTER_BOX       = 'box';
resized.RESIZE_FILTER_TRIANGLE  = 'triangle';
resized.RESIZE_FILTER_QUADRATIC = 'quadratic';
resized.RESIZE_FILTER_CUBIC     = 'cubic';
resized.RESIZE_FILTER_CATROM    = 'catrom';
resized.RESIZE_FILTER_MITCHELL  = 'mitchell';
resized.RESIZE_FILTER_GAUSS     = 'gauss';
resized.RESIZE_FILTER_SINC      = 'sinc';
resized.RESIZE_FILTER_BESSEL    = 'bessel';
resized.RESIZE_FILTER_HANNING   = 'hanning';
resized.RESIZE_FILTER_HAMMING   = 'hamming';
resized.RESIZE_FILTER_BLACKMAN  = 'blackman';
resized.RESIZE_FILTER_KAISER    = 'kaiser';
resized.RESIZE_FILTER_NORMAL    = 'normal';
resized.RESIZE_FILTER_HERMITE   = 'hermite';
resized.RESIZE_FILTER_LANCZOS   = 'lanczos';

resized.prototype.crop = function (options) {
    options = options || {};

    var width   = options.width     || null;
    var height  = options.height    || null;
    var top     = options.top       || options.y    || null;
    var right   = options.right     || null;
    var bottom  = options.bottom    || null;
    var left    = options.left      || options.x    || null;
    var pad     = options.pad != null ? options.pad : false;
    var opts    = [];

    if (null != width) {
        opts.push('-width', width);
    }
    if (null != height) {
        opts.push('-height', height);
    }

    if (null != top) {
        opts.push('-top', top);
    }
    if (null != right) {
        opts.push('-right', -(right + 1));
    }
    if (null != bottom) {
        opts.push('-bottom', -(bottom + 1));
    }
    if (null != left) {
        opts.push('-left', left);
    }
    if (false != pad) {
        opts.push('-pad');
    }

    this.streamChain.push({command: 'pamcut', opts: opts});

    return this;
};

resized.prototype.flip = function (direction) {
    var opts    = [];

    switch (direction) {
        case 'horizontal':
            opts.push('-leftright');
            break;

        case 'vertical':
            opts.push('-topbottom');
            break;
    }

    this.streamChain.push({command: 'pamflip', opts: opts});

    return this;
};

resized.prototype.write = function (dst, callback) {
    var dst_stream;
    if (typeof dst == 'string') {
        dst_stream = fs.createWriteStream(dst);
    } else {
        dst_stream = dst;
    }

    dst_stream.on('close', callback || function () {});

    var self = this;
    this.on('write', function () {
        var djpeg = child_process.spawn('djpeg', self.decoderOptions);
        var cjpeg = child_process.spawn('cjpeg', self.encoderOptions);

        self.src.pipe(djpeg.stdin);
        cjpeg.stdout.pipe(dst_stream);

        if (self.streamChain.length > 0) {
            self.streamChain.forEach(function (processor, i) {
                var cmd = child_process.spawn(processor.command, processor.opts);
                self.streamChain[i] = cmd;

                if (i) {
                    self.streamChain[i - 1].stdout.pipe(cmd.stdin);
                }
            });
            djpeg.stdout.pipe(self.streamChain[0].stdin);
            self.streamChain[self.streamChain.length - 1].stdout.pipe(cjpeg.stdin);
        } else {
            djpeg.stdout.pipe(cjpeg.stdin);
        }

        self.src.resume();
    });

    if (this.listeners('described').length == 0) {
        this.emit('write');
    } else {
        this.once('described', function () {
            self.emit('write');
        });
    }
};

var helpers = {};
helpers['resolution'] = function resolution(string) {
    var size = string.split(' x ');
    return {width: size[0], height: size[1]};
};
helpers['fraction'] = function fraction(decimal) {
    function gcd(a, b) {
        var tmp;

        while (b) {
            tmp = a;
            a = b;
            b = tmp%b;
        }

        return a
    }

    decimal = parseFloat(decimal).toFixed(3);

    var lUpperPart = decimal*1000;
    var lLowerPart = 1000;

    var cf = gcd(lUpperPart, lLowerPart);

    while(cf !== 1) {
        lUpperPart /= cf;
        lLowerPart /= cf;

        cf = gcd(lUpperPart, lLowerPart);
    }

    return lUpperPart + '/' + lLowerPart;
};

module.exports = resized;