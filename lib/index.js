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

var duplex = require('./duplex-stream');

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

resized.prototype.describe = function () {
    var resized = this;
    if (!this.src.path) {
        this.emit('error', new Error('Do not know how to describe source stream. Stream should be a readable file stream.'));
    }
    var cmd = child_process.exec('jhead ' + this.src.path, function (err, stdout, stderr, cmd) {
        if (err) {
            resized.emit('error', err);
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

        resized.properties = properties;
        resized.emit('described', properties);
    });
};

resized.prototype.resize = function (options) {
    options = options || {};

    var width   = options.width     || null;
    var height  = options.height    || null;
    var opts    = [];

    if (null != width) {
        opts.push('-width', width);
    }
    if (null != height) {
        opts.push('-height', height);
    }

    var resized = this;
    this.once('described', function (properties) {
        // set up djpeg
        var opts = [];
        var wRatio = width/properties.resolution.width;
        var hRatio = height/properties.resolution.height;

        var ratio = Math.max(wRatio, hRatio).toFixed(3);

        var f = helpers['fraction'](Math.ceil(ratio * 8) / 8);
        resized.decoderOptions.push('-scale', f);
    });
    this.describe();

    this.streamChain.push({command: 'pnmscalefixed', opts: opts});

    return this;
};

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
        opts.push('-right', right);
    }
    if (null != bottom) {
        opts.push('-bottom', bottom);
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

resized.prototype.write = function (dst) {
    var dst_stream;
    if (typeof dst == 'string') {
        dst_stream = fs.createWriteStream(dst);
    } else {
        dst_stream = dst;
    }

    var resized = this;
    this.on('write', function () {
        var cmd, djpeg, cjpeg;
        var command_string = [];

        djpeg = child_process.spawn('djpeg', this.decoderOptions);

        command_string.push('djpeg');
        command_string = command_string.concat(this.decoderOptions);

        cjpeg = child_process.spawn('cjpeg', this.encoderOptions);

        this.src.pipe(djpeg.stdin);
        cjpeg.stdout.pipe(dst_stream);

        if (this.streamChain.length > 0) {
            this.streamChain.forEach(function (processor, i) {
                command_string.push('| ' + processor.command);
                command_string = command_string.concat(processor.opts);

                var cmd = child_process.spawn(processor.command, processor.opts);
                resized.streamChain[i] = cmd;

                if (i) {
                    resized.streamChain[i - 1].stdout.pipe(cmd.stdin);
                }
            });

            command_string.push('| cjpeg');
            command_string = command_string.concat(this.encoderOptions);
            console.log(command_string.join(' '));

            djpeg.stdout.pipe(this.streamChain[0].stdin);
            this.streamChain[this.streamChain.length - 1].stdout.pipe(cjpeg.stdin);
        } else {
            djpeg.stdout.pipe(cjpeg.stdin);
        }

        this.src.resume();
    });

    if (this.listeners('described').length == 0) {
        this.emit('write');
    } else {
        this.once('described', function () {
            resized.emit('write');
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