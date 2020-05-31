'use strict';

const Homey = require('homey');
const WEM = require('../wem.js');

class Device extends Homey.Device {

    onInit () {
        this.log('onInit');
        this.setUnavailable();

        this.onRefreshData();
        this.onRefreshSettings();
        setInterval(this.onRefreshData.bind(this), 10000);
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

        return Promise.resolve();
    }

    onRefreshData () {
        this.log('onRefreshData')
        const wem = new WEM();

        wem.GetData(this.getData(), (error, data) => {
            if (error) {
                this.error('Refresh data error: ', error);
                this.setUnavailable();
                return;
            }

            this.setAvailable();

            if (data.watt == 0 && data.pulse_count == 0) {
                return;
            }

            const measure_power_value = data.watt;
            const meter_power_value = (data.pulse_count / this.getData().pulses_per_unit);

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

            if (this.getData().type === 's0') {
                if (oldSettingsObj.apikey != settings.http_api_key ||
                    oldSettingsObj.pulses_per_unit != settings.s0_pulses_per_unit ||
                    oldSettingsObj.debounce != settings.s0_debounce) {
                    this.log('Update settings');

                    this.setSettings({
                        apikey: settings.http_api_key,
                        interval: settings.p1_interval,
                        type: settings.type
                    });
                }
            } else if (this.getData().type === 's1') {
                if (oldSettingsObj.apikey != settings.http_api_key ||
                    oldSettingsObj.pulses_per_unit != settings.s1_pulses_per_unit ||
                    oldSettingsObj.debounce != settings.s1_debounce) {
                    this.log('Update settings');

                    this.setSettings({
                        apikey: settings.http_api_key,
                        interval: settings.p1_interval,
                        type: settings.type
                    });
                }
            } else {
                this.error('Refresh settings unknown device');
                return;
            }
        });
    }

}

module.exports = Device;
