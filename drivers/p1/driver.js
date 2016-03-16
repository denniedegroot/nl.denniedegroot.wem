'use strict';

var async = require('async');
var WEM = require('../wem.js');
var pulse = require('../pulse/driver.js');

var wem = new WEM();
var devices = [];
var device_cache = [];

module.exports.init = function (devices_data, callback) {
    async.forEachSeries(devices_data, function (device_data, next) {
        devices.push(device_data);
        next();
    }, function () {
        setTimeout(refresh_data, 2500);
        setTimeout(refresh_settings, 2500);
        setInterval(refresh_data, 10000);
        setInterval(refresh_settings, 1800000);
        callback(null, true);
    });
};

module.exports.pair = function (socket) {
    socket.on('list_devices', function (data, callback) {
        var foundDevices = [];

        wem.Discover(function (discovered_devices) {
            async.forEachSeries(discovered_devices, function (device, next) {
                wem.GetSettings(device, function (error, settings) {
                    if (error) {
                        Homey.log('Get settings error: ' + error);
                        return next();
                    }

                    if (settings.p1_enabled == 1) {
                        var add_device = {
                            name: 'P1 (' + device.name + ')',
                            data: {
                                id: device.name + '_P1',
                                ip: device.ip,
                                type: 'p1',
                                interval: settings.p1_interval,
                                apikey: device.apikey
                            },
                            settings: {
                                id: device.name + '_P1',
                                ip: device.ip,
                                apikey: device.apikey,
                                interval: settings.p1_interval,
                                type: settings.type
                            }
                        };

                        foundDevices.push(add_device);
                    }

                    next();
                });
            }, function () {
                callback(null, foundDevices);
            });
        });
    });

    socket.on('add_device', function (device, callback) {
        devices.push({
            id: device.data.id,
            ip: device.data.ip,
            type: device.data.type,
            interval: device.data.interval,
            apikey: device.data.apikey,
            cache: null
        });

        callback(null, true);
    });
};

module.exports.capabilities = {
    measure_power: {
        get: function (device_data, callback) {
            devices.forEach(function (device) {
                if (device instanceof Error) {
                    return callback(device);
                }

                if (device_data.id == device.id) {
                    if (device_cache[device.id] && (device_cache[device.id].import_watt - device_cache[device.id].export_watt) + device_cache[device.id].pulse_watt >= 0) {
                        return callback(null, (device_cache[device.id].import_watt - device_cache[device.id].export_watt) + device_cache[device.id].pulse_watt);
                    }
                }

                return callback(device);
            });
        }
    },
    meter_power: {
        get: function (device_data, callback) {
            devices.forEach(function (device) {
                if (device instanceof Error) {
                    return callback(device);
                }

                if (device_data.id == device.id) {
                    if (device_cache[device.id]) {
                        return callback(null, ((device_cache[device.id].import_low_wh + device_cache[device.id].import_high_wh) / 1000));
                    }
                }

                return callback(device);
            });
        }
    },
    meter_gas: {
        get: function (device_data, callback) {
            devices.forEach(function (device) {
                if (device instanceof Error) {
                    return callback(device);
                }

                if (device_data.id == device.id) {
                    if (device_cache[device.id]) {
                        return callback(null, (device_cache[device.id].gas_dm3 / 1000));
                    }
                }

                return callback(device);
            });
        }
    }
};

module.exports.settings = function (device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
    // run when the user has changed the device's settings in Homey.
    // changedKeysArr contains an array of keys that have been changed, for your convenience :)

    // always fire the callback, or the settings won't change!
    // if the settings must not be saved for whatever reason:
    // callback( "Your error message", null );
    // else

    callback(null, true);
};

module.exports.deleted = function (device_data) {
    devices.forEach(function (device) {
        if (device_data.id == device.id) {
            var index = devices.indexOf(device);

            devices.splice(index, 1);
        }
    });
};

module.exports.get_devices = function (callback) {
    callback(devices);
};

module.exports.get_device_data = function (device_data, callback) {
    devices.forEach(function (device) {
        if (device instanceof Error) {
            return callback(device);
        }

        if (device_data.id == device.id) {
            if (device_cache[device.id]) {
                return callback(null, device_cache[device.id]);
            }
        }

        return callback(device);
    });
};

function refresh_data() {
    async.forEachSeries(devices, function (device, next) {
        wem.GetData(device, function (error, data) {
            if (error) {
                Homey.log('Refresh data error: ', error);
                return next();
            }

            var paired_meters = Homey.manager('settings').get('paired_meters');

            if (paired_meters == undefined) {
                paired_meters = {};
            }

            data.pulse_kwh = 0;
            data.pulse_watt = 0;

            for (var index in paired_meters) {
                if (index == device.id) {
                    paired_meters[index].forEach(function (entry) {
                        pulse.get_device_data({id: entry}, function (error, device) {
                            if (error) {
                                return;
                            }

                            data.pulse_watt += device.watt;
                            data.pulse_kwh += device.pulse_count / device.pulses_per_kwh;
                        });
                    });
                }
            }

            if (data.import_watt == 0 && data.export_watt == 0 &&
                data.import_low_wh == 0 && data.import_high_wh == 0 &&
                data.export_low_wh == 0 && data.export_high_wh == 0 &&
                data.gas_dm3 == 0) {
                return next();
            }

            if (!device_cache[device.id] || (data.import_watt - data.export_watt) != (device_cache[device.id].import_watt - device_cache[device.id].export_watt) ||
                data.pulse_watt != device_cache[device.id].pulse_watt) {
                if ((data.import_watt - data.export_watt) + data.pulse_watt >= 0) {
                    module.exports.realtime(device, 'measure_power', (data.import_watt - data.export_watt) + data.pulse_watt);
                }
            }
            if (!device_cache[device.id] ||
                ((data.import_low_wh + data.import_high_wh) / 1000).toFixed(2) != ((device_cache[device.id].import_low_wh + device_cache[device.id].import_high_wh) / 1000).toFixed(2) ||
                ((data.export_low_wh + data.export_high_wh) / 1000).toFixed(2) != ((device_cache[device.id].export_low_wh + device_cache[device.id].export_high_wh) / 1000).toFixed(2)) {
                module.exports.realtime(device, 'meter_power', ((data.import_low_wh + data.import_high_wh) / 1000) - ((data.export_low_wh + data.export_high_wh) / 1000));
            }
            if (!device_cache[device.id] || data.gas_dm3 != device_cache[device.id].gas_dm3) {
                module.exports.realtime(device, 'meter_gas', (data.gas_dm3 / 1000));
            }

            device_cache[device.id] = data;

            next();
        });
    });
}

function refresh_settings() {
    async.forEachSeries(devices, function (device, next) {
        wem.GetSettings(device, function (error, settings) {
            if (error) {
                Homey.log('Refresh settings error: ', error);
                return next();
            }

            module.exports.setSettings(device, {
                id: device.id,
                ip: device.ip,
                apikey: settings.http_api_key,
                interval: settings.p1_interval,
                type: settings.type
            });

            next();
        });
    });
}
