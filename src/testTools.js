define(function(require, exports, module) {
  "use strict";

  var assert = require("chai").assert;
  var cc = require("./cc/cc");
  
  var defineProperty = function(object, selector, value) {
    var ret = object[selector];
    Object.defineProperty(object, selector, {
      configurable: true,
      enumerable  : false,
      writable    : true,
      value       : value
    });
    return ret;
  };
  
  var _saved = {};
  var replaceTempNumberPrototype = function(selector, hack, callback) {
    _saved[selector] = defineProperty(Number.prototype, selector, hack);
    if (callback) {
      callback();
      restoreTempNumberPrototype(selector);
    }
  };
  var restoreTempNumberPrototype = function(selector) {
    var saved = _saved[selector];
    if (saved) {
      defineProperty(Number.prototype, selector, saved);
    } else {
      delete Number.prototype[selector];
    }
  };
  
  var useFourArithmeticOperations = function(func) {
    replaceTempNumberPrototype("__add__", function(b) {
      return this + b;
    }, function() {
      replaceTempNumberPrototype("__sub__", function(b) {
        return this - b;
      }, function() {
        replaceTempNumberPrototype("__mul__", function(b) {
          return this * b;
        }, function() {
          replaceTempNumberPrototype("__div__", function(b) {
            return this / b;
          }, function() {
            func();
          });
        });
      });
    });
  };
  
  
  var unitTestSuite = (function() {
    var parent = {
      controls: new Float32Array(16),
      doneAction: function() {
      }
    };
    
    var a_rate = {
      sampleRate: 44100,
      sampleDur : 1 / 44100,
      radiansPerSample: 2 * Math.PI / 44100,
      bufLength  : 64,
      bufDuration: 64 / 44100,
      bufRate    : 1 / (64 / 44100),
      slopeFactor: 1 / 64,
      filterLoops : (64 / 3)|0,
      filterRemain: (64 % 3)|0,
      filterSlope : 1 / ((64 / 3)|0)
    };
    var k_rate = {
      sampleRate: 689.0625,
      sampleDur : 1 / 689.0625,
      radiansPerSample: 2 * Math.PI / 689.0625,
      bufLength  : 1,
      bufDuration: 1 / 689.0625,
      bufRate    : 1 / (1 / 689.0625),
      slopeFactor: 1 / 1,
      filterLoops : (1 / 3)|0,
      filterRemain: (1 % 3)|0,
      filterSlope : 1 / ((1 / 3)|0)
    };

    var writeScalarValue = function(_in, value) {
      for (var i = _in.length; i--; ) {
        _in[i] = value;
      }
      return _in;
    };
    
    var signal = function(offset) {
      if (Array.isArray(offset)) {
        index   = 0;
        pattern = offset;
        return function(_in) {
          var value = pattern[(index++) % pattern.length];
          writeScalarValue(_in, value);
          return _in;
        };
      } else {
        var index = offset || 0;
        var pattern = [
            +100, 10, 1, 1, 0.5, 0.5, 0, 0, 0, -0.5, -0.5, -1, -1, -10, -100
        ];
        return function(_in) {
          var value = pattern[(index++) % pattern.length];
          writeScalarValue(_in, value);
          return _in;
        };
      }
    };
    
    var inputSpec = function(opts) {
      var rate = (opts.rate === C.AUDIO) ? a_rate : k_rate;
      opts.sampleDur = rate.sampleDur;
      return opts;
    };
    
    var unitTest = function(spec, inputSpecs, opts) {
      opts = opts || {};
      
      cc.getRateInstance = function(rate) {
        return (rate === C.AUDIO) ? a_rate : k_rate;
      };
      
      var i, j, k;
      var u = cc.createUnit(parent, spec);
      for (i = 0; i < u.numOfInputs; ++i) {
        u.inRates[i] = inputSpecs[i].rate;
        switch (u.inRates[i]) {
        case C.AUDIO:
          u.inputs[i]  = new Float32Array(u.rate.bufLength);
          break;
        case C.SCALAR:
          u.inputs[i]  = new Float32Array(1);
          writeScalarValue(u.inputs[i], inputSpecs[i].value || 0);
          break;
        case C.CONTROL:
          u.inputs[i]  = new Float32Array(1);
          break;
        default:
          throw new Error("Invalid rate: " + u.inRates[i]);
        }
      }
      u.init();
      
      var n = ((u.rate.sampleRate * (opts.dur || 1)) / u.rate.bufLength)|0;
      for (i = 0; i < n; ++i) {
        for (j = 0; j < u.numOfInputs; ++j) {
          if (inputSpecs[j].rate !== C.SCALAR) {
            writeScalarValue(u.inputs[j], 0);
            inputSpecs[j].process.call(inputSpecs[j], u.inputs[j], i, n);
          }
        }
        if (opts.preProcess) {
          opts.preProcess.call(u, i, n);
        }
        if (u.process) {
          u.process(u.rate.bufLength, testSuite.instance);
          for (j = u.allOutputs.length; j--; ) {
            var x = u.allOutputs[j];
            if (isNaN(x)) {
              throw new Error("NaN");
            }
            if (Math.abs(x) === Infinity) {
              throw new Error("Infinity");
            }
          }
        }
        if (opts.postProcess) {
          opts.postProcess.call(u, i, n);
        }
      }
      assert.ok(true);
    };
    
    var testSuite = function(name, specs, opts) {
      opts = opts || {};
      var desc = testSuite.desc || "test";
      describe(desc, function() {
        specs.forEach(function(items) {
          var rate = items.rate;
          var numOfInputs  = items.inputs.length;
          var numOfOutputs = items.outputs || 1;

          testSuite.instance = {};
          
          if (opts.before) {
            beforeEach(opts.before);
          }
          if (opts.beforeEach) {
            beforeEach(opts.beforeEach);
          }
          if (opts.after) {
            afterEach(opts.after);
          }
          if (opts.afterEach) {
            afterEach(opts.afterEach);
          }
          
          var inputs = [], outputs = [];
          var i;
          for (i = numOfInputs; i--; ) {
            inputs.push(0, 0);
          }
          for (i = numOfOutputs; i--; ) {
            outputs.push(rate);
          }
          if (!Array.isArray(name)) {
            name = [name];
          }
          name.forEach(function(name) {
            var unitSpec = [ name, rate, 0, inputs, outputs ];
            var testName = name + "." + ["ir","kr","ar"][rate];
            testName += "(" + items.inputs.map(function(_in) {
              return ["ir","kr","ar"][_in.rate];
            }).join(", ") + ")";
            if (opts.verbose) {
              console.log(testName);
            }
            it(testName, (function(items) {
              return function() {
                var inputSpecs = items.inputs.map(function(items) {
                  return inputSpec({
                    rate   : items.rate,
                    process: signal(items.value),
                    value  : items.value
                  });
                });
                unitTest(unitSpec, inputSpecs, opts);
              };
            })(items));
          });
        });
      });
    };

    testSuite.in0   = [ 1, 0.5, 0.25, 0, -0, -0.25, -0.5, -1 ];
    testSuite.in1   = [ -0, -0.25, -0.5, -1, 1, 0.5, 0.25, 0 ];
    testSuite.in2   = [ -0, -0.25, -0.5, -1, 1, 0.5, 0.25    ];
    testSuite.time0 = [ 0, 0, 0.5, 0.5, 1, 1 ];
    testSuite.time1 = [ 0, 0, 0.5, 0.5, 1, 1, -0, -0.5, -1 ];
    testSuite.freq0 = [ 220, 220, 440, 660, 880, 1760, 3520 ];
    testSuite.freq1 = [ 220, 220, 440, 660, 880, 1760, 44100, 0, -44100 ];
    
    return testSuite;
  })();
  
  
  module.exports = {
    replaceTempNumberPrototype : replaceTempNumberPrototype,
    restoreTempNumberPrototype : restoreTempNumberPrototype,
    useFourArithmeticOperations: useFourArithmeticOperations,
    unitTestSuite: unitTestSuite,
  };

});