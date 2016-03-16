'use strict';

var async = require('async');
var WEM = require('../wem.js');

var wem = new WEM();
var devices = [];

module.exports.init = function (devices_data, callback) {
    async.forEachSeries(devices_data, function (device_data, next) {
        devices.push(device_data);
        next();
    }, function () {
        refresh_data();
        refresh_settings();
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

                    var add_device;

                    if (settings.s0_enabled == 1) {
                        add_device = {
                            name: 'S0 (' + device.name + ')',
                            data: {
                                id: device.name + '_S0',
                                ip: device.ip,
                                type: 's0',
                                pulses_per_kwh: settings.s0_pulses_per_kwh,
                                debounce: settings.s0_debounce,
                                apikey: device.apikey
                            },
                            settings: {
                                id: device.name + '_S0',
                                ip: device.ip,
                                apikey: device.apikey,
                                pulses_per_kwh: settings.s0_pulses_per_kwh,
                                debounce: settings.s0_debounce
                            }
                        };

                        foundDevices.push(add_device);
                    }

                    if (settings.s1_enabled == 1) {
                        add_device = {
                            name: 'S1 (' + device.name + ')',
                            data: {
                                id: device.name + '_S1',
                                ip: device.ip,
                                type: 's1',
                                pulses_per_kwh: settings.s1_pulses_per_kwh,
                                debounce: settings.s1_debounce,
                                apikey: device.apikey
                            },
                            settings: {
                                id: device.name + '_S1',
                                apikey: device.apikey,
                                pulses_per_kwh: settings.s1_pulses_per_kwh,
                                debounce: settings.s1_debounce
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
            pulses_per_kwh: device.data.pulses_per_kwh,
            debounce: device.data.debounce,
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
                    if (device.cache) {
                        return callback(null, device.cache.watt);
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
                    if (device.cache) {
                        return callback(null, (device.cache.pulse_count / device.pulses_per_kwh));
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
            if (device.cache) {
                return callback(null, device.cache);
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

            if (data.watt == 0 && data.pulse_count == 0) {
                return next();
            }

            if (!device.cache || data.watt != device.cache.watt) {
                module.exports.realtime(device, 'measure_power', data.watt);
            }
            if (!device.cache || data.pulse_count != device.cache.pulse_count) {
                module.exports.realtime(device, 'meter_power', (data.pulse_count / device.pulses_per_kwh));
            }

            device.cache = data;

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

            if (device.type == 's0') {
                module.exports.setSettings(device, {
                    id: device.id,
                    ip: device.ip,
                    apikey: settings.http_api_key,
                    pulses_per_kwh: settings.s0_pulses_per_kwh,
                    debounce: settings.s0_debounce
                });

                device.pulses_per_kwh = settings.s0_pulses_per_kwh;
            } else if (device.type == 's1') {
                module.exports.setSettings(device, {
                    id: device.id,
                    ip: device.ip,
                    apikey: settings.http_api_key,
                    pulses_per_kwh: settings.s1_pulses_per_kwh,
                    debounce: settings.s1_debounce
                });

                device.pulses_per_kwh = settings.s1_pulses_per_kwh;
            } else {
                Homey.log('Refresh settings error: unknown device type');
            }

            next();
        });
    });
}
