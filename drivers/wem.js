'use strict';

var http = require('http');
var dgram = require('dgram');

function http_get(host, port, path, callback) {
    var request = http.get({
        host: host,
        port: port,
        path: path,
        agent: false
    }, function (response) {
        var data = '';

        response.on('data', function (chunk) {
            data += chunk;
        });

        response.on('end', function () {
            var json = {};
            var error = null;

            try {
                json = JSON.parse(data);
            } catch (e) {
                error = e;
            }

            callback(error, json);
        });

        response.on('error', function (error) {
            callback(error);
        });
    });

    request.setTimeout(2500, function () {
        request.abort();
    });

    request.on('error', function (error) {
        callback(error);
    });
}

WEM.prototype.GetSettings = function (device, callback) {
    http_get(device.ip, this.port, '/api/settings/get?api_key=' + device.apikey, function (error, response) {
        if (error) {
            return callback(error, null);
        }

        response.type = 'other';

        if (!response.uart_debug && response.uart_baudrate == 9600 && response.uart_databits == 2 && response.uart_parity == 0) {
            response.type = 'dsmr2';
        } else if (!response.uart_debug && response.uart_baudrate == 115200 && response.uart_databits == 3 && response.uart_parity == 2) {
            response.type = 'dsmr4';
        }

        callback(null, response);
    });
};

WEM.prototype.GetData = function (device, callback) {
    http_get(device.ip, this.port, '/api/' + device.type + '/data?api_key=' + device.apikey, callback);
};

WEM.prototype.Discover = function (callback) {
    var devices = [];

    var client = dgram.createSocket('udp4');
    var data = new Buffer('Discover_WEM');

    client.bind(function () {
        client.setBroadcast(true);
    });

    client.send(data, 0, data.length, this.discover_port, '255.255.255.255');

    client.on('message', function (data) {
        try {
            var obj = JSON.parse(data);

            if ((obj.name).indexOf('WEM') > -1) {
                devices.push(obj);
            }
        } catch (error) {
            Homey.log('Discovery parse error: ' + error);
        }
    });

    client.on('error', function (err) {
        Homey.log('Discover network error: ' + err);
        client.close();
    });

    setTimeout(function () {
        client.close();
        callback(devices);
    }, this.discover_timeout);
};

function parse_opt(opts, name, defaultvalue) {
    return opts && opts[name] !== undefined ? opts[name] : defaultvalue;
}

function WEM(opts) {
    this.port = parse_opt(opts, 'port', 80);
    this.discover_port = parse_opt(opts, 'discover_port', 6467);
    this.discover_timeout = parse_opt(opts, 'discover_timeout', 1000);
}

module.exports = WEM;
