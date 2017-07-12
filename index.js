'use strict';

const cloneDeep = require('lodash.clonedeep');
const influxdb = require('influx');
const os = require('os');
const util = require('util');
const winston = require('winston');

var InfluxDB = exports.InfluxDB = function(opts){
    opts = cloneDeep(opts || {});
    if (!opts.database) opts.database = 'log';

    this.measurement = opts.measurement || 'request';
    this.app = opts.app || 'nodejs';
    this.region = opts.region || 'de';
    this.environment = opts.environment || 'dev';

    this.ready = false;

    this.dbClient = new influxdb.InfluxDB(opts);
    this.dbClient.getDatabaseNames()
        .then(names => {
            if (!names.includes(opts.database)) {
                return this.dbClient.createDatabase(opts.database);
            }
        })
        .then(() => {
            this.ready = true;
        })
        .catch(err => {
            console.log(err);
            console.error('Error booting influx client');
        });
};

util.inherits(InfluxDB, winston.Transport);

InfluxDB.prototype.log = function (level, msg, meta, callback) {
    if (this.ready) {         // It's only analytics. Don't beat self up if influx isn't there. Drop messages
        this.dbClient.writePoints([
            {
                measurement: this.measurement,
                tags: {
                    app: this.app,
                    environment: this.environment,
                    host: os.hostname(),
                    region: this.region,
                    requestID: meta['requestID'],
                    route: msg,                   // This feels fragile
                    status: meta['rsp.status']
                },
                fields: {
                    duration: meta['rsp.duration'],
                    size: meta['rsp.size']
                }
            }
        ]).catch(err => {
            console.error(err)
        })
    }

    callback(null, true);
};
