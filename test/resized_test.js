var fs = require('fs');
var resized = require('../lib');

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

var original_filename = './test/original.jpg';

exports.describe = function (test) {
    test.expect(3);

    var r = resized.describe(original_filename, function (err, properties) {
        test.ifError(err);

        test.equal(properties.resolution.width, 1280, 'Width is 1280px');
        test.equal(properties.resolution.height, 800, 'Height is 800px');
        test.done();
    });
};

exports['Resizing'] = {
    'width only': function (test) {
        test.expect(2);

        var filename = 'resized.jpg';
        resized(original_filename).resize({width: 400}).write(filename, function () {
            resized.describe(filename, function (err, properties) {
                test.ifError(err);

                test.equal(properties.resolution.width, 400, 'Width is 400px after resize');
                test.done();
            });
        });
    },

    'height only': function (test) {
        test.expect(2);

        var filename = 'resized.jpg';
        resized(original_filename).resize({height: 400}).write(filename, function () {
            resized.describe(filename, function (err, properties) {
                test.ifError(err);

                test.equal(properties.resolution.height, 400, 'Height is 400px after resize');
                test.done();
            });
        });
    },

    'width and height': function (test) {
        test.expect(3);

        var filename = 'resized.jpg';
        resized(original_filename).resize({width: 1000, height: 400}).write(filename, function () {
            resized.describe(filename, function (err, properties) {
                test.ifError(err);

                test.equal(properties.resolution.width, 640, 'Width is 640px after resize');
                test.equal(properties.resolution.height, 400, 'Height is 400px after resize');
                test.done();
            });
        });
    },

    'width and height ignoring aspec': function (test) {
        test.expect(3);

        var filename = 'resized.jpg';
        resized(original_filename).resize({width: 1000, height: 400, aspect: false}).write(filename, function () {
            resized.describe(filename, function (err, properties) {
                test.ifError(err);

                test.equal(properties.resolution.width, 1000, 'Width is 1000px after resize');
                test.equal(properties.resolution.height, 400, 'Height is 400px after resize');
                test.done();
            });
        });
    },

    'width and height filling to largest boundery': function (test) {
        test.expect(3);

        var filename = 'resized.jpg';
        resized(original_filename).resize({width: 1000, height: 400, fill: true}).write(filename, function () {
            resized.describe(filename, function (err, properties) {
                test.ifError(err);

                test.equal(properties.resolution.width, 1000, 'Width is 1000px after resize');
                test.equal(properties.resolution.height, 625, 'Height is 625px after resize');
                test.done();
            });
        });
    }
};

exports['Cropping'] = {
    'width only': function (test) {
        test.expect(3);

        var filename = 'resized.jpg';
        resized(original_filename).crop({width: 50}).write(filename, function () {
            resized.describe(filename, function (err, properties) {
                test.ifError(err);

                test.equal(properties.resolution.width, 50, 'Width is 50px after resize');
                test.equal(properties.resolution.height, 800, 'Height is 800px after resize');
                test.done();
            });
        });
    },

    'height only': function (test) {
        test.expect(3);

        var filename = 'resized.jpg';
        resized(original_filename).crop({height: 50}).write(filename, function () {
            resized.describe(filename, function (err, properties) {
                test.ifError(err);

                test.equal(properties.resolution.width, 1280, 'Width is 1280px after resize');
                test.equal(properties.resolution.height, 50, 'Height is 50px after resize');
                test.done();
            });
        });
    },

    'width and height': function (test) {
        test.expect(3);

        var filename = 'resized.jpg';
        resized(original_filename).crop({width: 50, height: 50}).write(filename, function () {
            resized.describe(filename, function (err, properties) {
                test.ifError(err);

                test.equal(properties.resolution.width, 50, 'Width is 50px after resize');
                test.equal(properties.resolution.height, 50, 'Height is 50px after resize');
                test.done();
            });
        });
    },

    'width and height': function (test) {
        test.expect(3);

        var filename = 'resized.jpg';
        resized(original_filename).crop({width: 50, height: 50}).write(filename, function () {
            resized.describe(filename, function (err, properties) {
                test.ifError(err);

                test.equal(properties.resolution.width, 50, 'Width is 50px after resize');
                test.equal(properties.resolution.height, 50, 'Height is 50px after resize');
                test.done();
            });
        });
    },

    'top left bottom right': function (test) {
        test.expect(3);

        var filename = 'resized.jpg';
        resized(original_filename).crop({top: 50, right: 50, bottom: 50, left: 50}).write(filename, function () {
            resized.describe(filename, function (err, properties) {
                test.ifError(err);

                test.equal(properties.resolution.width, 1180, 'Width is 1180px after resize');
                test.equal(properties.resolution.height, 700, 'Height is 700px after resize');
                test.done();
            });
        });
    }
};