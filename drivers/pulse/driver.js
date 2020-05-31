'use strict';

const Homey = require('homey');
const WEM = require('../wem.js');

class Driver extends Homey.Driver {

    onInit () {
        this.log('onInit');
    }

    async onPair (socket) {
        socket.on('list_devices', async (data, callback) => {
            const wem = new WEM();
            let foundDevices = [];

            wem.Discover(async (discovered_devices) => {
                await Promise.all(discovered_devices.map((device) => {
                    return new Promise((resolve, reject) => {
                        wem.GetSettings(device, (error, settings) => {
                            if (error) {
                                this.error('Get settings error: ' + error);
                                reject();
                            }

                            if (settings.s0_enabled == 1) {
                                foundDevices.push({
                                    name: 'S0 (' + device.name + ')',
                                    data: {
                                        id: device.name + '_S0',
                                        ip: device.ip,
                                        type: 's0',
                                        pulses_per_unit: settings.s0_pulses_per_unit,
                                        debounce: settings.s0_debounce,
                                        apikey: device.apikey
                                    },
                                    settings: {
                                        id: device.name + '_S0',
                                        ip: device.ip,
                                        apikey: device.apikey,
                                        pulses_per_unit: settings.s0_pulses_per_unit,
                                        debounce: settings.s0_debounce
                                    }
                                });
                            }

                            if (settings.s1_enabled == 1) {
                                foundDevices.push({
                                    name: 'S1 (' + device.name + ')',
                                    data: {
                                        id: device.name + '_S1',
                                        ip: device.ip,
                                        type: 's1',
                                        pulses_per_unit: settings.s1_pulses_per_unit,
                                        debounce: settings.s1_debounce,
                                        apikey: device.apikey
                                    },
                                    settings: {
                                        id: device.name + '_S1',
                                        apikey: device.apikey,
                                        pulses_per_unit: settings.s1_pulses_per_unit,
                                        debounce: settings.s1_debounce
                                    }
                                });
                            }

                            resolve();
                        });
                    });
                }));

                callback(null, foundDevices);
            });
        });
    }

}

module.exports = Driver;
