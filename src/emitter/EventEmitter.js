"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var Promise = require("promise");
var jsw_logger_1 = require("jsw-logger");
var core_1 = require("../core");
var EventEmitter = /** @class */ (function () {
    function EventEmitter(options) {
        options = options || new core_1.Options();
        this.logger = jsw_logger_1.JSWLogger.getInstance(options.log || {});
    }
    EventEmitter.prototype.emit = function (event, args, stores) {
        if (_.isNil(event) || !_.isString(event)) {
            throw new Error("Parameter \"event\" must be an string");
        }
        if (_.isNil(args)) {
            args = {};
            stores = [];
        }
        if (_.isArray(args)) {
            stores = args;
            args = {};
        }
        this.logger.info("Emitting store event \"" + event + "\"");
        this.logger.debug(JSON.stringify(args));
        var storesToEmit = stores.length;
        return new Promise(function (resolve, reject) {
            var storesEmitted = 0;
            // add to options
            var timeout = setTimeout(function () {
                reject();
            }, 60000);
            // Send event to all the stores registered
            _.forEach(stores, function (store) {
                // Watch out
                if (_.isFunction(store[event])) {
                    store[event](args).then(function () {
                        storesEmitted++;
                        // Watch out
                        if (storesEmitted === storesToEmit) {
                            clearTimeout(timeout);
                            resolve();
                        }
                    });
                }
            });
        });
    };
    return EventEmitter;
}());
exports.EventEmitter = EventEmitter;
//# sourceMappingURL=EventEmitter.js.map