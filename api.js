'use strict';

var p1 = require('./drivers/p1/driver.js');
var pulse = require('./drivers/pulse/driver.js');

module.exports = [
    {
        description: 'Get P1 devices',
        method: 'GET',
        path: '/p1_devices',
        requires_authorization: false,
        fn: function (callback, args) {
            p1.get_devices(function (devices) {
                callback(null, devices);
            });
        }
    },
    {
        description: 'Get P1 device data',
        method: 'GET',
        path: '/p1_device_data',
        requires_authorization: false,
        fn: function (callback, args) {
            if (!args.query.id) {
                return callback('wrong api usage', null);
            }

            p1.get_device_data({id: args.query.id}, function (error, devices) {
                if (error) {
                    return callback(error, null);
                }

                callback(null, devices);
            });
        }
    },
    {
        description: 'Get pulse devices',
        method: 'GET',
        path: '/pulse_devices',
        requires_authorization: false,
        fn: function (callback, args) {
            pulse.get_devices(function (devices) {
                callback(null, devices);
            });
        }
    },
    {
        description: 'Get pulse device data',
        method: 'GET',
        path: '/pulse_device_data',
        requires_authorization: false,
        fn: function (callback, args) {
            if (!args.query.id) {
                return callback('wrong api usage', null);
            }

            pulse.get_device_data({id: args.query.id}, function (error, devices) {
                if (error) {
                    return callback(error, null);
                }

                callback(null, devices);
            });
        }
    }
];
