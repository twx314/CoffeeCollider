define(function(require, exports, module) {
  "use strict";

  var cc = require("../cc");
  
  var pan2_ctor = function(rate) {
    return function(_in, pos, level) {
      this.init.call(this, rate, _in, pos, level);
      this.channels = [
        cc.createOutputProxy(this.rate, this, 0),
        cc.createOutputProxy(this.rate, this, 1),
      ];
      this.numOfOutputs = 2;
      return this.channels;
    };
  };
  
  var iPan2 = {
    ar: {
      defaults: "in=0,pos=0,level=1",
      ctor: pan2_ctor(C.AUDIO),
      Klass: cc.MultiOutUGen
    },
    kr: {
      defaults: "in=0,pos=0,level=1",
      ctor: pan2_ctor(C.CONTROL),
      Klass: cc.MultiOutUGen
    },
  };

  var use = function() {
  };
  
  module.exports = {
    use:use,
    exports: function() {
      cc.registerUGen("Pan2", iPan2);
    }
  };

});
