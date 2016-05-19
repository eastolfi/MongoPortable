/**
 * @file Selector.js - based on Monglo#Selector ({@link https://github.com/Monglo}) by Christian Sullivan <cs@euforic.co> | Copyright (c) 2012
 * @version 0.0.1
 * @ignore
 * 
 * @author Eduardo Astolfi <eduardo.astolfi91@gmail.com>
 * @copyright 2016 Eduardo Astolfi <eduardo.astolfi91@gmail.com>
 * @license MIT Licensed
 */

var Logger = require("./utils/Logger"),
    _ = require("lodash"),
    SelectorMatcher = require("./SelectorMatcher");

var BsonTypes = {
	_types: [
		{ alias: 'minKey', number: -1, order: 1, isType: null },
		{ alias: 'null', number: 10, order: 2, isType: null },
		{ alias: 'int', number: 16, order: 3, isType: _.isInteger },
		{ alias: 'long', number: 18, order: 3, isType: _.isNumber },
		{ alias: 'double', number: 1, order: 3, isType: _.isNumber },
		{ alias: 'number', number: null, order: 3, isType: _.isNumber },
		{ alias: 'symbol', number: 14, order: 4, isType: null },
		{ alias: 'string', number: 2, order: 4, isType: _.isString },
		{ alias: 'object', number: 3, order: 5, isType: _.isPlainObject },
		{ alias: 'array', number: 4, order: 6, isType: _.isArray },
		{ alias: 'binData', number: 5, order: 7, isType: null },
		{ alias: 'objectId', number: 7, order: 8, isTypefnc: null },
		{ alias: 'bool', number: 8, order: 9, isType: _.isBoolean },
		{ alias: 'date', number: 9, order: 10, isTypefnc: _.isDate },         // format
		{ alias: 'timestamp', number: 17, order: 11, isType: _.isDate },   // format
		{ alias: 'regex', number: 11, order: 12, isType: _.isRegExp },
		{ alias: 'maxKey', number: 127, order: 13, isType: null }
		
// 		undefined 6
// 		dbPointer
// 		javascript
// 		javascriptWithScope
// 		function
	],
	
	getByNumber: function(num) {
		for (var i = 0; i < this._types.length; i++) {
			if (this._types[i].number === num) return this._types[i];
		}
		
		throw Error("Unaccepted BSON type number");
	},
	getByAlias: function(alias) {
		for (var i = 0; i < this._types.length; i++) {
			if (this._types[i].alias === alias) return this._types[i];
		}
		
		throw Error("Unaccepted BSON type alias");
	},
	getByValue: function(val) {
	    if (_.isNumber(val)) return this.getByAlias("double");
        
        if (_.isString(val)) return this.getByAlias("string");
        
        if (_.isBoolean(val)) return this.getByAlias("bool");
        
        if (_.isArray(val)) return this.getByAlias("array");
        
        if (_.isNull(val)) return this.getByAlias("null");
        
        if (_.isRegExp(val)) return this.getByAlias("regex");
        
        if (_.isPlainObject(val)) return this.getByAlias("object");
        
        throw Error("Unaccepted BSON type");
        
        // if (_.isFunction(val)) return this.getByAlias("double");
	}
};


/**
 * Selector
 * @ignore
 * 
 * @module Selector
 * @constructor
 * @since 0.0.1
 * 
 * @classdesc Cursor class that maps a MongoDB-like cursor
 * 
 * @param {MongoPortable} db - Additional options
 * @param {Collection} collection - The collection instance
 * @param {Object|Array|String} [selection={}] - The selection for matching documents
 * @param {Object|Array|String} [fields={}] - The fields of the document to show
 * @param {Object} [options] - Database object
 * 
 * @param {Object} [options.pkFactory=null] - Object overriding the basic "ObjectId" primary key generation.
 * 
 */
var Selector = {};

// helpers used by compiled selector code
Selector._f = {
    // TODO for _all and _in, consider building 'inquery' at compile time..

    _all: function (x, qval) {
        // $all is only meaningful on arrays
        if (!(x instanceof Array)) {
            return false;
        }

        // TODO should use a canonicalizing representation, so that we
        // don't get screwed by key order
        var parts = {};
        var remaining = 0;

        _.forEach(qval, function (q) {
            var hash = JSON.stringify(q);

            if (!(hash in parts)) {
                parts[hash] = true;
                remaining++;
            }
        });

        for (var i = 0; i < x.length; i++) {
            var hash = JSON.stringify(x[i]);
            if (parts[hash]) {
                delete parts[hash];
                remaining--;

                if (0 === remaining) return true;
            }
        }

        return false;
    },

    _in: function (x, qval) {
        if (typeof x !== "object") {
            // optimization: use scalar equality (fast)
            for (var i = 0; i < qval.length; i++) {
                if (x === qval[i]) {
                    return true;
                }
            }

            return false;
        } else {
            // nope, have to use deep equality
            for (var i = 0; i < qval.length; i++) {
                if (Selector._f._equal(x, qval[i])) {
                    return true;
                }
            }

            return false;
        }
    },
    
    /*
        undefined: -1
        null: 0,
        number: 1,
        string: 2,
        object: 3
        array: 4,
        boolean: 7,
        regexp: 9,
        function: 100,
    */
    
    // _type: function (v) {
    //     if (_.isNumber(v)) return {type: 1, order: 1, fnc: _.isNumber};
        
    //     if (_.isString(v)) return {type: 2, order: 2, fnc: _.isString};
        
    //     if (_.isBoolean(v)) return {type: 8, order: 7, fnc: _.isBoolean};
        
    //     if (_.isArray(v)) return {type: 4, order: 4, fnc: _.isArray};
        
    //     if (_.isNull(v)) return {type: 10, order: 0, fnc: _.isNull};
        
    //     if (_.isRegExp(v)) return {type: 11, order: 9, fnc: _.isRegExp};
        
    //     if (_.isFunction(v)) return {type: 13, order: 100, fnc: _.isFunction};
        
    //     if (_.isPlainObject(v)) return {type: 3, order: 3, fnc: _.isPlainObject};
        
    //     throw Error("Unsupported type for sorting");
        
    //     // if (typeof v === "number") return 1;

    //     // if (typeof v === "string") return 2;

    //     // if (typeof v === "boolean") return 8;

    //     // if (v instanceof Array) return 4;

    //     // if (v === null) return 10;

    //     // if (v instanceof RegExp) return 11;

    //     // note that typeof(/x/) === "function"
    //     // if (typeof v === "function") return 13;

    //     // return 3; // object

    //     // TODO support some/all of these:
    //     // 5, binary data
    //     // 7, object id
    //     // 9, date
    //     // 14, symbol
    //     // 15, javascript code with scope
    //     // 16, 18: 32-bit/64-bit integer
    //     // 17, timestamp
    //     // 255, minkey
    //     // 127, maxkey
    // },

    // deep equality test: use for literal document and array matches
    _equal: function (x, qval) {
        var match = function (a, b) {
            // scalars
            if (typeof a === 'number' || typeof a === 'string' || typeof a === 'boolean' || a === undefined || a === null) return a === b;

            if (typeof a === 'function') return false;

            // OK, typeof a === 'object'
            if (typeof b !== 'object') return false;

            // arrays
            if (a instanceof Array) {
                if (!(b instanceof Array)) return false;

                if (a.length !== b.length) return false;

                for (var i = 0; i < a.length; i++) {
                    if (!match(a[i],b[i])) return false;
                }

                return true;
            }

            // objects
            /*
            var unmatched_b_keys = 0;
            for (var x in b)
            unmatched_b_keys++;
            for (var x in a) {
            if (!(x in b) || !match(a[x], b[x]))
            return false;
            unmatched_b_keys--;
            }
            return unmatched_b_keys === 0;
            */
            // Follow Mongo in considering key order to be part of
            // equality. Key enumeration order is actually not defined in
            // the ecmascript spec but in practice most implementations
            // preserve it. (The exception is Chrome, which preserves it
            // usually, but not for keys that parse as ints.)
            var b_keys = [];

            for (var x in b) {
                b_keys.push(b[x]);
            }

            var i = 0;
            for (var x in a) {
                if (i >= b_keys.length) return false;

                if (!match(a[x], b_keys[i])) return false;

                i++;
            }
            if (i !== b_keys.length) return false;

            return true;
        };

        return match(x, qval);
    },

    // if x is not an array, true iff f(x) is true. if x is an array,
    // true iff f(y) is true for any y in x.
    //
    // this is the way most mongo operators (like $gt, $mod, $type..)
    // treat their arguments.
    _matches: function (x, f) {
        if (x instanceof Array) {
            for (var i = 0; i < x.length; i++) {
                if (f(x[i])) return true;
            }

            return false;
        }

        return f(x);
    },

    // like _matches, but if x is an array, it's true not only if f(y)
    // is true for some y in x, but also if f(x) is true.
    //
    // this is the way mongo value comparisons usually work, like {x:
    // 4}, {x: [4]}, or {x: {$in: [1,2,3]}}.
    _matches_plus: function (x, f) {
        if (x instanceof Array) {
            for (var i = 0; i < x.length; i++) {
                if (f(x[i])) return true;
            }

            // fall through!
        }

        return f(x);
    },

    // maps a type code to a value that can be used to sort values of
    // different types
    // _typeorder: function (t) {
    //     // http://www.mongodb.org/display/DOCS/What+is+the+Compare+Order+for+BSON+Types
    //     // TODO what is the correct sort position for Javascript code?
    //     // ('100' in the matrix below)
    //     // TODO minkey/maxkey
    //     return [-1, 1, 2, 3, 4, 5, -1, 6, 7, 8, 0, 9, -1, 100, 2, 100, 1, 8, 1][t];
    // },

    // compare two values of unknown type according to BSON ordering
    // semantics. (as an extension, consider 'undefined' to be less than
    // any other value.)
    // return negative if a is less, positive if b is less, or 0 if equal
    _cmp: function (a, b) {
        if (_.isUndefined(a)) return b === undefined ? 0 : -1;

        if (_.isUndefined(b)) return 1;

        // var ta = Selector._f._type(a);
        // var tb = Selector._f._type(b);
        // var oa = Selector._f._typeorder(ta);
        // var ob = Selector._f._typeorder(tb);
        var aType = BsonTypes.getByValue(a);
        var bType = BsonTypes.getByValue(b);

        if (aType.order !== bType.order) return aType.order < bType.order ? -1 : 1;

        if (aType.number !== bType.number) {
            // TODO need to implement this once we implement Symbol or
            // integers, or once we implement both Date and Timestamp
            throw Error("Missing type coercion logic in _cmp");
        }
        
        if (_.isNumber(a)) return a - b;
        
        if (_.isString(a)) return a < b ? -1 : (a === b ? 0 : 1);
        
        if (_.isBoolean(a)) {
            if (a) return b ? 0 : 1;

            return b ? -1 : 0;
        }
        
        if (_.isArray(a)) {
            for (var i = 0; ; i++) {
                if (i === a.length) return (i === b.length) ? 0 : -1;

                if (i === b.length) return 1;
                
                if (a.length !== b.length) return a.length - b.length;

                var s = Selector._f._cmp(a[i], b[i]);

                if (s !== 0) return s;
            }
        }
        
        if (_.isNull(a)) return 0;
        
        if (_.isRegExp(a)) throw Error("Sorting not supported on regular expression"); // TODO
        
        // if (_.isFunction(a)) return {type: 13, order: 100, fnc: _.isFunction};
        
        if (_.isPlainObject(a)) {
            var to_array = function (obj) {
                var ret = [];

                for (var key in obj) {
                    ret.push(key);
                    ret.push(obj[key]);
                }

                return ret;
            };

            return Selector._f._cmp(to_array(a), to_array(b));
        }

        // double
        // if (ta === 1)  return a - b;

        // string
        // if (tb === 2) return a < b ? -1 : (a === b ? 0 : 1);

        // Object
        // if (ta === 3) {
        //     // this could be much more efficient in the expected case ...
        //     var to_array = function (obj) {
        //         var ret = [];

        //         for (var key in obj) {
        //             ret.push(key);
        //             ret.push(obj[key]);
        //         }

        //         return ret;
        //     };

        //     return Selector._f._cmp(to_array(a), to_array(b));
        // }

        // Array
        // if (ta === 4) {
        //     for (var i = 0; ; i++) {
        //         if (i === a.length) return (i === b.length) ? 0 : -1;

        //         if (i === b.length) return 1;
                
        //         if (a.length !== b.length) return a.length - b.length;

        //         var s = Selector._f._cmp(a[i], b[i]);

        //         if (s !== 0) return s;
        //     }
        // }

        // 5: binary data
        // 7: object id

        // boolean
        // if (ta === 8) {
        //     if (a) return b ? 0 : 1;

        //     return b ? -1 : 0;
        // }

        // 9: date

        // null
        // if (ta === 10) return 0;

        // regexp
        // if (ta === 11) {
        //     throw Error("Sorting not supported on regular expression"); // TODO
        // }

        // 13: javascript code
        // 14: symbol
        // 15: javascript code with scope
        // 16: 32-bit integer
        // 17: timestamp
        // 18: 64-bit integer
        // 255: minkey
        // 127: maxkey

        // javascript code
        // if (ta === 13) {
        //     throw Error("Sorting not supported on Javascript code"); // TODO
        // }
    }
};

Selector.isCompiled = function (selector) {
    if (_.isNil(selector)) return false;
    
    if (selector instanceof SelectorMatcher) return true;
    
    return false;
};

// True if the given document matches the given selector.
Selector._matches = function (selector, doc) {
    return Selector._compileSelector(selector).test(doc);
};

Selector._compileSelector = function(selector) {
    var _selector = new SelectorMatcher(this);

    if (_.isNil(selector)) {
        Logger.debug('selector -> null');
        
        selector = {};
    } else {
        Logger.debug('selector -> not null');
        
        if (!selector || _.hasIn(selector, '_id')) {
            Logger.debug('selector -> false value || { _id: false value }');
            
            if (!selector._id) {
                Logger.debug('selector -> false value');
                
                selector = {
                    _id: false
                };
            } else {
                Logger.debug('selector -> { _id: false value }');
                
                selector = {
                    _id: _.toString(selector)
                };
            }
        }
    }
    
    if (_.isFunction(selector)) {
        Logger.debug('selector -> function(doc) { ... }');
        
        _initFunction.call(_selector, selector);
    } else if (_.isString(selector) || _.isNumber(selector)) {
        Logger.debug('selector -> "123456789" || 123456798');
        
        selector = {
            _id: selector
        };
        
        _initObject.call(_selector, selector);
    } else {
        Logger.debug('selector -> { field: value }');
        
        _initObject.call(_selector, selector);
    }
    
    return _selector;
};

/**
 * .sort("field1") -> field1 asc
 * .sort("field1 desc") -> field1 desc
 * .sort("field1 field2") -> field1 asc, field2 asc
 * .sort("field1 -1") -> field1 desc
 * .sort("field1 -1, field2 desc") -> field1 desc, field2 desc
 * .sort("field1 true, field2 false") -> field1 asc, field2 desc
 * 
 * .sort(["field1"]) -> field1 asc
 * .sort(["field1", "field2 desc"]) -> field1 asc, field2 desc
 * .sort([["field1", -1], ["field2", "asc"]]) -> field1 desc, field2 asc
 * 
 * .sort({"field1": -1, "field2": "asc"}) -> field1 desc, field2 asc
 * 
 */
//arr.sort(function(a, b, c, d) { console.log(a, b, c, d); return a < b;})
Selector._compileSort = function (spec) {
    if (_.isNil(spec))  {
        return function () {
            return 0;
        };
    }
    
    var keys = [];
    var asc = [];
    
    if (_.isString(spec)) {
        spec = spec.replace(/( )+/ig, ' ').trim();
        
        if (spec.indexOf(',') !== -1) {
            // Replace commas by spaces, and treat it as a spaced-separated string
            return Selector._compileSort(spec.replace(/,/ig, ' '));
        } else if (spec.indexOf(' ') !== -1) {
            var fields = spec.split(' ');
            
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i].trim();
                
                if ((field === 'desc'  || field === 'asc') ||
                    (field === '-1'    || field === '1') ||
                    (field === 'false' || field === 'true')) {
                        
                    throw Error("Bad sort specification: ", JSON.stringify(spec));
                } else {
                    var next = _.toString(fields[i+1]);
                    
                    if (next === 'desc' || next === 'asc') {
                        keys.push(field);
                        asc.push((next === 'asc') ? true : false);
                        
                        i++;
                    } else if (next === '-1' || next === '1') {
                        keys.push(field);
                        asc.push((next === '1') ? true : false);
                        
                        i++;
                    } else if (next === 'false' || next === 'true') {
                        keys.push(field);
                        asc.push((next === 'true') ? true : false);
                        
                        i++;
                    } else {
                        keys.push(field);
                        asc.push(true); // Default sort
                    }
                }
            }
        } else {
            //.sort("field1")
            
            keys.push(spec);
            asc.push(true);
        }
    } else if (_.isArray(spec)) {
        // Join the array with spaces, and treat it as a spaced-separated string
        return Selector._compileSort(spec.join(' '));
        // for (var i = 0; i < spec.length; i++) {
        //     if (_.isString(spec[i])) {
        //         keys.push(spec[i]);
        //         asc.push(true);
        //     } else {
        //         keys.push(spec[i][0]);
        //         asc.push(spec[i][1] !== "desc");
        //     }
        // }
    } else if (_.isPlainObject(spec)) {
        // TODO Nested path -> .sort({ "field1.field12": "asc" })
        var _spec = [];
        for (var key in spec) {
            if (_.hasIn(spec, key)) {
                _spec.push(key);
                _spec.push(spec[key]);
            }
        }
        
        return Selector._compileSort(_spec);
    } else {
        throw Error("Bad sort specification: ", JSON.stringify(spec));
    }

    if (keys.length === 0) {
        return function () {
            return 0;
        };
    }
    
    // return {keys: keys, asc: asc};
    return function(a, b) {
        var x = 0;
        
        for (var i = 0; i < keys.length; i++) {
            if (i !== 0 && x !== 0) return x;   // Non reachable?
            
            
            // x = Selector._f._cmp(a[JSON.stringify(keys[i])], b[JSON.stringify(keys[i])]);
            x = Selector._f._cmp(a[keys[i]], b[keys[i]]);
            
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
    //     if (i !== 0) {
    //         code += "if(x!==0)return x;";
    //     }

    //     code += "x=" + (asc[i] ? "" : "-") + "c(a[" + JSON.stringify(keys[i]) + "],b[" + JSON.stringify(keys[i]) + "]);";
    // }

    // code += "return x;};})";

    // eval(code);

    // return _func(Selector._f._cmp);
};

Selector._compileFields = function (spec) {
    var projection = {};
    
    if (_.isString(spec)) {
        spec = spec.replace(/( )+/ig, ' ').trim();
        
        if (spec.indexOf(',') !== -1) {
            // Replace commas by spaces, and treat it as a spaced-separated string
            return Selector._compileFields(spec.replace(/,/ig, ' '));
        } else if (spec.indexOf(' ') !== -1) {
            var fields = spec.split(' ');
            
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i].trim();
                
                if ((field === '-1'    || field === '1') ||
                    (field === 'false' || field === 'true')) {
                        
                    throw Error("Bad fields specification: ", JSON.stringify(spec));
                } else {
                    var next = _.toString(fields[i+1]);
                    
                    if (next === '-1' || next === '1') {
                        if (next === '-1') {
                            if (field === '_id') {
                                projection[field] = -1;
                            } else {
                                throw new Error("A projection cannot contain both include and exclude specifications");
                            }
                        } else {
                            projection[field] = 1;
                        }
                        
                        i++;
                    } else if (next === 'false' || next === 'true') {
                        if (next === 'false') {
                            if (field === '_id') {
                                projection[field] = -1;
                            } else {
                                throw new Error("A projection cannot contain both include and exclude specifications");
                            }
                        } else {
                            projection[field] = 1;
                        }
                        
                        i++;
                    } else {
                        projection[field] = 1;
                    }
                }
            }
        } else if (spec.length > 0) {
            //.find({}, "field1")
            
            projection[spec] = 1;
        }
    } else if (_.isArray(spec)) {
        // Join the array with spaces, and treat it as a spaced-separated string
        return Selector._compileFields(spec.join(' '));
    } else if (_.isPlainObject(spec)) {
        // TODO Nested path -> .sort({ "field1.field12": "asc" })
        var _spec = [];
        for (var key in spec) {
            if (_.hasIn(spec, key)) {
                _spec.push(key);
                _spec.push(spec[key]);
            }
        }
        
        return Selector._compileFields(_spec);
    } else {
        throw Error("Bad sort specification: ", JSON.stringify(spec));
    }
    
    return projection;
};

// TODO implement ordinal indexing: 'people.2.name'

Selector._exprForSelector = function (selector) {
    Logger.debug('Called: _exprForSelector');
    
    var clauses = [];
    
    for (var key in selector) {
        var value = selector[key];
        
        if (key.charAt(0) === '$') {
            Logger.debug('selector -> operator => { $and: [{...}, {...}] }');
            
            clauses.push(Selector._exprForDocumentPredicate(key, value));
        } else {
            Logger.debug('selector -> plain => { field1: <value> }');
            
            clauses.push(Selector._exprForKeypathPredicate(key, value));
        }
    }
    
    return clauses;
};

Selector._exprForDocumentPredicate = function(key, value) {
    var clause = {};
    
    switch (key) {
        case '$or':
            clause.key = 'or';
            
            // The rest will be handled by '_operator_'
        case '$and':
            clause.key = 'and';
            
            // The rest will be handled by '_operator_'
        case '$nor':
            clause.key = 'nor';
            
            // The rest will be handled by '_operator_'
        case '_operator_':
            // Generic handler for operators ($or, $and, $nor)
            
            clause.kind = 'operator';
            clause.type = 'array';
            
            var clauses = [];
            
            _.forEach(value, function(_val) {
                clauses.push(Selector._exprForSelector(_val));
            });
            
            clause.value = clauses;
            
            break;
        default:
            throw Error("Unrecogized key in selector: ", key);
    }
    
    // TODO cases: $where, $elemMatch
    
    Logger.debug('clause created: ' + JSON.stringify(clause));
    
    return clause;
};

Selector._exprForKeypathPredicate = function (keypath, value) {
    Logger.debug('Called: _exprForKeypathPredicate');
    
    var clause = {};
    
    clause.value = value;
    
    if (_.isNil(value)) {
        Logger.debug('clause of type null');
        
        clause.type = 'null';
    } else if (_.isRegExp(value)) {
        Logger.debug('clause of type RegExp');
        
        clause.type = 'regexp';
    } else if (_.isArray(value)) {
        Logger.debug('clause of type Array');
        
        clause.type = 'array';
    } else if (_.isString(value)) {
        Logger.debug('clause of type String');
        
        clause.type = 'string';
    } else if (_.isNumber(value)) {
        Logger.debug('clause of type Number');
        
        clause.type = 'number';
    } else if (_.isBoolean(value)) {
        Logger.debug('clause of type Boolean');
        
        clause.type = 'boolean';
    } else if (_.isFunction(value)) {
        Logger.debug('clause of type Function');
        
        throw Error("Bad value type in query");
    } else if (_.isPlainObject(value)) {
        var literalObject = true;
        for (var key in value) {
            if (key.charAt(0) === '$') {
                literalObject = false;
                break;
            }
        }
        
        if (literalObject) {
            Logger.debug('clause of type Object => { field: { field_1: <value>, field_2: <value> } }');
            
            clause.type = 'literal_object';
        } else {
            Logger.debug('clause of type Operator => { field: { $gt: 2, $lt 5 } }');
            
            clause.type = 'operator_object';
        }
    }
    
    var parts = keypath.split('.');
    if (parts.length > 1) {
        Logger.debug('clause over Object field => { "field1.field1_2": <value> }');
        
        clause.kind = 'object';
        clause.key = parts;
    } else {
        Logger.debug('clause over Plain field => { "field": <value> }');
        
        clause.kind = 'plain';
        clause.key = parts[0];
    }
    
    Logger.debug('clause created: ' + JSON.stringify(clause));
    
    return clause;
};

/**
 * @ignore
 */
var _initObject = function(selector) {
    Logger.debug('Called: _initObject');
    
    this.clauses = Selector._exprForSelector(selector);
    
    Logger.debug('clauses created: ' + JSON.stringify(this.clauses));
};

/**
 * @ignore
 */
var _initFunction = function(selector) {
    this.clauses.push({
        kind: 'function',
        value: selector
    });
};

module.exports = Selector;