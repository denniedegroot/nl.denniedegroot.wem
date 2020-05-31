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

                            if (settings.p1_enabled == 1) {
                                foundDevices.push({
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
