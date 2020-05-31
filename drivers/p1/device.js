'use strict';

const Homey = require('homey');
const WEM = require('../wem.js');

class Device extends Homey.Device {

    onInit () {
        this.log('onInit');
        this.setUnavailable();

        this.onRefreshData();
        this.onRefreshSettings();
        this.intervalFunction = setInterval(this.onRefreshData.bind(this), (this.getSettings().interval * 1000) || 10000);
        setInterval(this.onRefreshSettings.bind(this), 1800000);
    }

    onAdded () {
        this.log('onAdded');
    }

    onDeleted () {
        this.log('onDeleted');
    }

    onRenamed () {
        this.log('onRenamed');
    }

    onSettings (oldSettingsObj, newSettingsObj, changedKeysArr) {
        this.log('onSettings', changedKeysArr);

        if (changedKeysArr['interval']) {
            clearInterval(this.intervalFunction);
            this.intervalFunction = setInterval(this.onRefreshData.bind(this), newSettingsObj.interval * 1000);
        }

        return Promise.resolve();
    }

    onRefreshData () {
        this.log('onRefreshData')
        const wem = new WEM();

        wem.GetData(this.getData(), (error, data) => {
            if (error) {
                this.log('Refresh data error: ', error);
                this.setUnavailable();
                return;
            }

            this.setAvailable();

            if (data.import_watt == 0 && data.export_watt == 0 &&
                data.import_low_wh == 0 && data.import_high_wh == 0 &&
                data.export_low_wh == 0 && data.export_high_wh == 0 &&
                data.gas_dm3 == 0) {
                return;
            }

            const measure_power_value = (data.import_watt - data.export_watt);
            const meter_power_value = Math.round(((data.import_low_wh + data.import_high_wh) / 1000) - ((data.export_low_wh + data.export_high_wh) / 1000));
            const meter_gas_value = Math.round((data.gas_dm3 / 1000));

            if (this.getCapabilityValue('measure_power') != measure_power_value) {
                this.setCapabilityValue('measure_power', measure_power_value).catch(error => {
                    this.error(error);
                });
            }

            if (this.getCapabilityValue('meter_power') != meter_power_value) {
                this.setCapabilityValue('meter_power', meter_power_value).catch(error => {
                    this.error(error);
                });
            }

            if (this.getCapabilityValue('meter_gas') != meter_gas_value) {
                this.setCapabilityValue('meter_gas', meter_gas_value).catch(error => {
                    this.error(error);
                });
            }

            // var paired_meters = Homey.manager('settings').get('paired_meters');

            // if (paired_meters == undefined) {
            //     paired_meters = {};
            // }

            // data.pulse_kwh = 0;
            // data.pulse_watt = 0;

            // for (var index in paired_meters) {
            //     if (index == device.id) {
            //         paired_meters[index].forEach(function (entry) {
            //             pulse.get_device_data({id: entry}, function (error, device) {
            //                 if (error) {
            //                     return;
            //                 }

            //                 data.pulse_watt += device.watt;
            //                 data.pulse_kwh += device.pulse_count / device.pulses_per_kwh;
            //             });
            //         });
            //     }
            // }

            // this.log(data);
        });
    }

    onRefreshSettings () {
        this.log('onRefreshSettings');
        const wem = new WEM();

        wem.GetSettings(this.getData(), (error, settings) => {
            if (error) {
                this.error('Refresh settings error: ', error);
                return;
            }

            const oldSettingsObj = this.getSettings();

            if (oldSettingsObj.apikey != settings.http_api_key ||
                oldSettingsObj.interval != settings.p1_interval ||
                oldSettingsObj.type != settings.type) {
                this.log('Update settings');

                if (oldSettingsObj.interval != settings.p1_interval) {            
                    clearInterval(this.intervalFunction);
                    this.intervalFunction = setInterval(this.onRefreshData.bind(this), settings.p1_interval * 1000);
                }

                this.setSettings({
                    apikey: settings.http_api_key,
                    interval: settings.p1_interval,
                    type: settings.type
                });
            }
        });
    }

}

module.exports = Device;
