'use strict';

const Homey = require('homey');


class App extends Homey.App {

    log() {
        console.log.bind(this, '[log]').apply(this, arguments);
    }

    error() {
        console.error.bind(this, '[error]').apply(this, arguments);
    }

    onInit() {
        console.log(`${Homey.manifest.id} running...`);
    }

}

module.exports = App;
