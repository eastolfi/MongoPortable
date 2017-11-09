"use strict";
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsw_logger_1 = require("jsw-logger");
var _ = require("lodash");
var SelectorMatcher_1 = require("./SelectorMatcher");
var index_1 = require("../document/index");
var Selector = /** @class */ (function () {
    function Selector(selector, type) {
        if (type === void 0) { type = Selector.MATCH_SELECTOR; }
        this.logger = jsw_logger_1.JSWLogger.instance;
        this.selectorCompiled = null;
        if (type === Selector.MATCH_SELECTOR) {
            this.selectorCompiled = this.compile(selector);
        }
        else if (type === Selector.SORT_SELECTOR) {
            return this.compileSort(selector);
        }
        else if (type === Selector.FIELD_SELECTOR) {
            return this.compileFields(selector, false);
        }
        else if (type === Selector.AGG_FIELD_SELECTOR) {
            return this.compileFields(selector, true);
        }
        else {
            this.logger.throw("You need to specify the selector type");
        }
    }
    Selector.prototype.test = function (doc) {
        return this.selectorCompiled.test(doc);
    };
    Selector.prototype.compile = function (selector) {
        if (_.isNil(selector)) {
            this.logger.debug("selector -> null");
            selector = {};
        }
        else {
            this.logger.debug("selector -> not null");
            if (!selector || (_.hasIn(selector, "_id") && !selector._id)) {
                this.logger.debug("selector -> false value || { _id: false value }");
                selector = {
                    _id: false
                };
            }
        }
        if (_.isFunction(selector)) {
            this.logger.debug("selector -> function(doc) { ... }");
            // _initFunction.call(matcher, selector);
            this.clauses = [{
                    kind: "function",
                    value: selector
                }];
            this.logger.debug("clauses created: " + JSON.stringify(this.clauses));
        }
        else if (_.isString(selector) || _.isNumber(selector)) {
            this.logger.debug("selector -> \"123456789\" || 123456798");
            selector = {
                _id: selector
            };
            // _initObject.call(matcher, selector);
            this.clauses = this.__buildSelector(selector);
            this.logger.debug("clauses created: " + JSON.stringify(this.clauses));
        }
        else {
            this.logger.debug("selector -> { field: value }");
            // _initObject.call(matcher, selector);
            this.clauses = this.__buildSelector(selector);
            this.logger.debug("clauses created: " + JSON.stringify(this.clauses));
        }
        var matcher = new SelectorMatcher_1.SelectorMatcher(this);
        return matcher;
    };
    Selector.prototype.compileSort = function (spec) {
        if (_.isNil(spec)) {
            return function () {
                return 0;
            };
        }
        var keys = [];
        var asc = [];
        if (_.isString(spec)) {
            spec = spec.replace(/( )+/ig, " ").trim();
            if (spec.indexOf(",") !== -1) {
                // Replace commas by spaces, and treat it as a spaced-separated string
                return this.compileSort(spec.replace(/,/ig, " "));
            }
            else if (spec.indexOf(" ") !== -1) {
                var fields = spec.split(" ");
                for (var i = 0; i < fields.length; i++) {
                    var field = fields[i].trim();
                    if ((field === "desc" || field === "asc") ||
                        (field === "-1" || field === "1") ||
                        (field === "false" || field === "true")) {
                        this.logger.throw("Bad sort specification: %s", JSON.stringify(spec));
                    }
                    else {
                        var next = _.toString(fields[i + 1]);
                        if (next === "desc" || next === "asc") {
                            keys.push(field);
                            asc.push((next === "asc") ? true : false);
                            i++;
                        }
                        else if (next === "-1" || next === "1") {
                            keys.push(field);
                            asc.push((next === "1") ? true : false);
                            i++;
                        }
                        else if (next === "false" || next === "true") {
                            keys.push(field);
                            asc.push((next === "true") ? true : false);
                            i++;
                        }
                        else {
                            keys.push(field);
                            asc.push(true); // Default sort
                        }
                    }
                }
            }
            else {
                // .sort("field1")
                keys.push(spec);
                asc.push(true);
            }
        }
        else if (_.isArray(spec)) {
            // Join the array with spaces, and treat it as a spaced-separated string
            return this.compileSort(spec.join(" "));
            // for (var i = 0; i < spec.length; i++) {
            // 	 if (_.isString(spec[i])) {
            // 		 keys.push(spec[i]);
            // 		 asc.push(true);
            // 	 } else {
            // 		 keys.push(spec[i][0]);
            // 		 asc.push(spec[i][1] !== "desc");
            // 	 }
            // }
        }
        else if (_.isPlainObject(spec)) {
            // TODO Nested path -> .sort({ "field1.field12": "asc" })
            var _spec = [];
            for (var key in spec) {
                if (_.hasIn(spec, key)) {
                    _spec.push(key);
                    _spec.push(spec[key]);
                }
            }
            return this.compileSort(_spec);
        }
        else {
            this.logger.throw("Bad sort specification: %s", JSON.stringify(spec));
        }
        // return {keys: keys, asc: asc};
        return function (a, b) {
            var x = 0;
            for (var i = 0; i < keys.length; i++) {
                if (i !== 0 && x !== 0) {
                    return x;
                } // Non reachable?
                // x = Selector._f._cmp(a[JSON.stringify(keys[i])], b[JSON.stringify(keys[i])]);
                x = SelectorMatcher_1.SelectorMatcher.cmp(a[keys[i]], b[keys[i]]);
                if (!asc[i]) {
                    x *= -1;
                }
            }
            return x;
        };
        // eval() does not return a value in IE8, nor does the spec say it
        // should. Assign to a local to get the value, instead.
        // var _func;
        // var code = "_func = (function(c){return function(a,b){var x;";
        // for (var i = 0; i < keys.length; i++) {
        // 	 if (i !== 0) {
        // 		 code += "if(x!==0)return x;";
        // 	 }
        // 	 code += "x=" + (asc[i] ? "" : "-") + "c(a[" + JSON.stringify(keys[i]) + "],b[" + JSON.stringify(keys[i]) + "]);";
        // }
        // code += "return x;};})";
        // eval(code);
        // return _func(Selector._f._cmp);
    };
    Selector.prototype.compileFields = function (spec, aggregation) {
        var projection = {};
        if (_.isNil(spec)) {
            return projection;
        }
        if (_.isString(spec)) {
            // trim surrounding and inner spaces
            spec = spec.replace(/( )+/ig, " ").trim();
            // Replace the commas by spaces
            if (spec.indexOf(",") !== -1) {
                // Replace commas by spaces, and treat it as a spaced-separated string
                return this.compileFields(spec.replace(/,/ig, " "), aggregation);
            }
            else if (spec.indexOf(" ") !== -1) {
                var fields = spec.split(" ");
                for (var i = 0; i < fields.length; i++) {
                    // Get the field from the spec (we will be working with pairs)
                    var field = fields[i].trim();
                    // If the first is not a field, throw error
                    if ((field === "-1" || field === "1") ||
                        (field === "false" || field === "true")) {
                        this.logger.throw("Bad fields specification: %s", JSON.stringify(spec));
                    }
                    else {
                        // Get the next item of the pair
                        var next = _.toString(fields[i + 1]);
                        if (next === "-1" || next === "1") {
                            if (next === "-1") {
                                for (var _key in projection) {
                                    if (field !== "_id" && projection[_key] === 1) {
                                        this.logger.throw("A projection cannot contain both include and exclude specifications");
                                    }
                                }
                                projection[field] = -1;
                            }
                            else {
                                projection[field] = 1;
                            }
                            i++;
                        }
                        else if (next === "false" || next === "true") {
                            if (next === "false") {
                                if (field === "_id") {
                                    projection[field] = -1;
                                }
                                else {
                                    this.logger.throw("A projection cannot contain both include and exclude specifications");
                                }
                            }
                            else {
                                projection[field] = 1;
                            }
                            i++;
                        }
                        else if (aggregation && next.indexOf("$") === 0) {
                            projection[field] = next.replace("$", "");
                            i++;
                        }
                        else {
                            projection[field] = 1;
                        }
                    }
                }
            }
            else if (spec.length > 0) {
                // .find({}, "field1")
                projection[spec] = 1;
            }
        }
        else if (_.isArray(spec)) {
            // Join the array with spaces, and treat it as a spaced-separated string
            return this.compileFields(spec.join(" "), aggregation);
        }
        else if (_.isPlainObject(spec)) {
            // TODO Nested path -> .find({}, { "field1.field12": "asc" })
            var _spec = [];
            for (var key in spec) {
                if (_.hasIn(spec, key)) {
                    _spec.push(key);
                    _spec.push(spec[key]);
                }
            }
            return this.compileFields(_spec, aggregation);
        }
        else {
            this.logger.throw("Bad fields specification: %s", JSON.stringify(spec));
        }
        return projection;
    };
    Selector.prototype.createClause = function () {
        return {
            key: null,
            kind: null,
            type: null,
            value: null
        };
    };
    Selector.prototype.__buildSelector = function (selector) {
        this.logger.debug("Called: __buildSelector");
        var clauses = [];
        try {
            for (var _a = __values(Object.keys(selector)), _b = _a.next(); !_b.done; _b = _a.next()) {
                var key = _b.value;
                var value = selector[key];
                if (key.charAt(0) === "$") {
                    this.logger.debug("selector -> operator => { $and: [{...}, {...}] }");
                    clauses.push(this.buildDocumentSelector(key, value));
                }
                else {
                    this.logger.debug("selector -> plain => { field1: <value> }");
                    clauses.push(this.buildKeypathSelector(key, value));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return clauses;
        var e_1, _c;
    };
    Selector.prototype.buildDocumentSelector = function (key, value) {
        var clause = this.createClause();
        switch (key) {
            case "$or":
            // falls through
            case "$and":
            // falls through
            case "$nor":
                clause.key = key.replace(/\$/, "");
            // falls through
            // The rest will be handled by "_operator_"
            case "_operator_":
                // Generic handler for operators ($or, $and, $nor)
                clause.kind = "operator";
                clause.type = "array";
                clause.value = [];
                try {
                    for (var value_1 = __values(value), value_1_1 = value_1.next(); !value_1_1.done; value_1_1 = value_1.next()) {
                        var item = value_1_1.value;
                        clause.value = _.union(clause.value, this.__buildSelector(item));
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (value_1_1 && !value_1_1.done && (_a = value_1.return)) _a.call(value_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                break;
            default:
                this.logger.throw("Unrecogized key in selector: %s", key);
        }
        // TODO cases: $where, $elemMatch
        this.logger.debug("clause created: " + JSON.stringify(clause));
        return clause;
        var e_2, _a;
    };
    Selector.prototype.buildKeypathSelector = function (keypath, value) {
        this.logger.debug("Called: buildKeypathSelector");
        var clause = this.createClause();
        clause.value = value;
        if (_.isNil(value)) {
            this.logger.debug("clause of type null");
            clause.type = "null";
        }
        else if (_.isRegExp(value)) {
            this.logger.debug("clause of type RegExp");
            clause.type = "regexp";
            var source = value.toString().split("/");
            clause.value = {
                $regex: source[1] // The first item splitted is an empty string
            };
            if (source[2] !== "") {
                clause.value.$options = source[2];
            }
        }
        else if (_.isArray(value)) {
            this.logger.debug("clause of type Array");
            clause.type = "array";
        }
        else if (_.isString(value)) {
            this.logger.debug("clause of type String");
            clause.type = "string";
        }
        else if (_.isNumber(value)) {
            this.logger.debug("clause of type Number");
            clause.type = "number";
        }
        else if (_.isBoolean(value)) {
            this.logger.debug("clause of type Boolean");
            clause.type = "boolean";
        }
        else if (_.isFunction(value)) {
            this.logger.debug("clause of type Function");
            clause.type = "function";
        }
        else if (_.isPlainObject(value)) {
            var literalObject = true;
            for (var key in value) {
                if (key.charAt(0) === "$") {
                    literalObject = false;
                    break;
                }
            }
            if (literalObject) {
                this.logger.debug("clause of type Object => { field: { field_1: <value>, field_2: <value> } }");
                clause.type = "literal_object";
            }
            else {
                this.logger.debug("clause of type Operator => { field: { $gt: 2, $lt 5 } }");
                clause.type = "operator_object";
            }
        }
        else if (value instanceof index_1.ObjectId) {
            this.logger.debug("clause of type ObjectId -> String");
            clause.type = "string";
            clause.value = value.toString();
        }
        else {
            clause.type = "__invalid__";
        }
        var parts = keypath.split(".");
        if (parts.length > 1) {
            this.logger.debug("clause over Object field => { \"field1.field1_2\": <value> }");
            clause.kind = "object";
            clause.key = parts;
        }
        else {
            this.logger.debug("clause over Plain field => { \"field\": <value> }");
            clause.kind = "plain";
            clause.key = parts[0];
        }
        this.logger.debug("clause created: " + JSON.stringify(clause));
        return clause;
    };
    /* STATIC METHODS */
    Selector.isSelectorCompiled = function (selector) {
        if (!_.isNil(selector) && (selector instanceof SelectorMatcher_1.SelectorMatcher || (selector instanceof Selector &&
            selector.selectorCompiled instanceof SelectorMatcher_1.SelectorMatcher))) {
            return true;
        }
        else {
            return false;
        }
    };
    Selector.matches = function (selector, doc) {
        return (new Selector(selector)).test(doc);
    };
    Selector.MATCH_SELECTOR = "match";
    Selector.SORT_SELECTOR = "sort";
    Selector.FIELD_SELECTOR = "field";
    Selector.AGG_FIELD_SELECTOR = "project";
    return Selector;
}());
exports.Selector = Selector;
//# sourceMappingURL=Selector.js.map