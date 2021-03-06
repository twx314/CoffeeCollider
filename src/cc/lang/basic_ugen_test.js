define(function(require, exports, module) {
  "use strict";

  var assert = require("chai").assert;
  var testTools = require("../../testTools");
  
  var cc = require("./cc");
  var slice = [].slice;
  
  var UGen = (function() {
    function UGen(klassName, rate) {
      this.klassName = klassName;
      this.rate = rate;
      this.inputs = [];
    }
    UGen.prototype.init = function(rate) {
      this.rate = rate;
      this.inputs = slice.call(arguments, 1);
      return this;
    };
    return UGen;
  })();
  
  var MultiOutUGen = (function() {
    function MultiOutUGen() {
    }
    return MultiOutUGen;
  })();
  
  describe("lang/basic_ugen.js", function() {
    var actual, expected;
    var basic_ugen;
    var _UGen = cc.UGen;
    var u1, u2, u3, u4;
    testTools.mock("UGen", UGen);
    testTools.mock("MultiOutUGen", MultiOutUGen);
    testTools.mock("instanceOfUGen", function(obj) {
      return obj instanceof UGen || (_UGen && obj instanceof _UGen);
    });
    testTools.mock("Out", UGen);
    
    before(function() {
      basic_ugen = require("./basic_ugen")
      u1 = new UGen("TestUGen", C.SCALAR);
      u2 = new UGen("TestUGen", C.CONTROL);
      u3 = new UGen("TestUGen", C.AUDIO);
      u4 = new UGen("TestUGen", C.DEMAND);
    });
    
    describe("UnaryOpUGen", function() {
      it("create", function() {
        actual = cc.createUnaryOpUGen("neg", u1);
        assert.instanceOf(actual, basic_ugen.UnaryOpUGen);
        assert.deepEqual(actual.inputs, [u1]);
        
        assert.throws(function() {
          cc.createUnaryOpUGen("dummy", u1);
        }, "UnaryOpUGen: unknown operator 'dummy'");
      });
    });
    describe("BinaryOpUGen", function() {
      it("create", function() {
        actual = cc.createBinaryOpUGen("*", u1, u2);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u1, u2]);
        assert.equal(actual.selector, "*");
        assert.equal(actual.rate, C.CONTROL);
        
        actual = cc.createBinaryOpUGen("+", 2, 3);
        assert.equal(actual, 5);
        
        actual = cc.createBinaryOpUGen("-", 2, 3);
        assert.equal(actual, -1);

        actual = cc.createBinaryOpUGen("*", 2, 3);
        assert.equal(actual, 6);

        actual = cc.createBinaryOpUGen("/", 2, 3);
        assert.equal(actual, 2 / 3);

        actual = cc.createBinaryOpUGen("%", 2, 3);
        assert.equal(actual, 2 % 3);

        actual = cc.createBinaryOpUGen("-", u1, 3);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u1, -3]);
        assert.equal(actual.selector, "+");

        actual = cc.createBinaryOpUGen("/", u1, 3);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u1, 1/3]);
        assert.equal(actual.selector, "*");

        actual = cc.createBinaryOpUGen("+", u1, 0);
        assert.equal(actual, u1);
        
        actual = cc.createBinaryOpUGen("+", 0, u2);
        assert.equal(actual, u2);
        
        actual = cc.createBinaryOpUGen("*", u1, 0);
        assert.equal(actual, 0);
        
        actual = cc.createBinaryOpUGen("*", 0, u2);
        assert.equal(actual, 0);
        
        actual = cc.createBinaryOpUGen("*", u1, 1);
        assert.equal(actual, u1);

        actual = cc.createBinaryOpUGen("*", 1, u2);
        assert.equal(actual, u2);
        
        assert.throws(function() {
          cc.createBinaryOpUGen("dummy", u1, u2);
        }, "BinaryOpUGen: unknown operator 'dummy'");
      });
      it("rate", function() {
        actual = cc.createBinaryOpUGen("+", u1, u1);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u1, u1]);
        assert.equal(actual.selector, "+");
        assert.equal(actual.rate, C.SCALAR);

        actual = cc.createBinaryOpUGen("+", u1, u2);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u1, u2]);
        assert.equal(actual.selector, "+");
        assert.equal(actual.rate, C.CONTROL);

        actual = cc.createBinaryOpUGen("+", u3, u2);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u3, u2]);
        assert.equal(actual.selector, "+");
        assert.equal(actual.rate, C.AUDIO);

        actual = cc.createBinaryOpUGen("+", u3, u4);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u3, u4]);
        assert.equal(actual.selector, "+");
        assert.equal(actual.rate, C.DEMAND);
      });      
    });
    describe("MulAdd", function() {
      it("create", function() {
        actual = cc.createMulAdd(1, 2, 3);
        assert.equal(actual, 1 * 2 + 3);

        actual = cc.createMulAdd(1, 2, u3);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u3, 2]);
        assert.equal(actual.selector, "+");

        actual = cc.createMulAdd(2, u2, 2);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u2, 2, 2]);

        actual = cc.createMulAdd(2, u2, u3);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u2, 2, u3]);

        actual = cc.createMulAdd(u1, 2, 3);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u1, 2, 3]);

        actual = cc.createMulAdd(u1, 2, u3);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u1, 2, u3]);

        actual = cc.createMulAdd(u1, u2, 3);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u2, u1, 3]);

        actual = cc.createMulAdd(u1, u2, u3);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u2, u1, u3]);
        
        // * 1
        actual = cc.createMulAdd(u1, 1, 3);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u1, 3]);
        assert.equal(actual.selector, "+");

        // * -1
        actual = cc.createMulAdd(u1, -1, 0);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u1, -1]);
        assert.equal(actual.selector, "*");

        // * -1 + x
        actual = cc.createMulAdd(u1, -1, u2);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u2, u1]);
        assert.equal(actual.selector, "-");
        
        // * 1 + 0
        actual = cc.createMulAdd(u1, 1, 0);
        assert.equal(actual, u1);
        
        // * 0
        actual = cc.createMulAdd(u1, 0, 3);
        assert.equal(actual, 3);

        // + 0
        actual = cc.createMulAdd(u1, 2, 0);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u1, 2]);
        assert.equal(actual.selector, "*");
      });
      it("rate", function() {
        actual = cc.createMulAdd(u1, u1, u1);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u1, u1, u1]);
        assert.equal(actual.rate, C.SCALAR);

        actual = cc.createMulAdd(u1, u2, u1);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u2, u1, u1]);
        assert.equal(actual.rate, C.CONTROL);

        actual = cc.createMulAdd(u1, u2, u3);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u2, u1, u3]);
        assert.equal(actual.rate, C.AUDIO);

        actual = cc.createMulAdd(u4, u2, u3);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u4, u2, u3]);
        assert.equal(actual.rate, C.DEMAND);
      });      
    });
    describe("Sum3", function() {
      it("create", function() {
        actual = cc.createSum3(u1, u2, u3);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u3, u2, u1]);
        
        actual = cc.createSum3(u1, u2, 0);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u1, u2]);
        assert.equal(actual.selector, "+");

        actual = cc.createSum3(u1, 0, u3);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u1, u3]);
        assert.equal(actual.selector, "+");

        actual = cc.createSum3(0, u2, u3);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u2, u3]);
        assert.equal(actual.selector, "+");
      });
      it("rate", function() {
        actual = cc.createSum3(u1, u1, u1);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u1, u1, u1]);
        assert.equal(actual.rate, C.SCALAR);

        actual = cc.createSum3(u1, u1, u2);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u2, u1, u1]);
        assert.equal(actual.rate, C.CONTROL);

        actual = cc.createSum3(u1, u2, u3);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u3, u2, u1]);
        assert.equal(actual.rate, C.AUDIO);
        
        actual = cc.createSum3(u4, u2, u3);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u4, u3, u2]);
        assert.equal(actual.rate, C.DEMAND);
      });      
    });
    describe("Sum4", function() {
      it("create", function() {
        actual = cc.createSum4(u1, u2, u3, u4);
        assert.instanceOf(actual, basic_ugen.Sum4);
        assert.deepEqual(actual.inputs, [u4, u3, u2, u1]);
        
        actual = cc.createSum4(u1, u2, u3, 0);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u3, u2, u1]);

        actual = cc.createSum4(u1, u2, 0, u4);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u4, u2, u1]);

        actual = cc.createSum4(u1, 0, u3, u4);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u4, u3, u1]);

        actual = cc.createSum4(0, u2, u3, u4);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u4, u3, u2]);
      });
      it("rate", function() {
        actual = cc.createSum4(u1, u1, u1, u1);
        assert.instanceOf(actual, basic_ugen.Sum4);
        assert.deepEqual(actual.inputs, [u1, u1, u1, u1]);
        assert.equal(actual.rate, C.SCALAR);

        actual = cc.createSum4(u1, u2, u1, u1);
        assert.instanceOf(actual, basic_ugen.Sum4);
        assert.deepEqual(actual.inputs, [u2, u1, u1, u1]);
        assert.equal(actual.rate, C.CONTROL);

        actual = cc.createSum4(u1, u2, u3, u1);
        assert.instanceOf(actual, basic_ugen.Sum4);
        assert.deepEqual(actual.inputs, [u3, u2, u1, u1]);
        assert.equal(actual.rate, C.AUDIO);

        actual = cc.createSum4(u1, u2, u3, u4);
        assert.instanceOf(actual, basic_ugen.Sum4);
        assert.deepEqual(actual.inputs, [u4, u3, u2, u1]);
        assert.equal(actual.rate, C.DEMAND);
      });
    });
    describe("optimizing", function() {
      it("madd + bop = madd", function() {
        var madd = cc.createMulAdd(u1, u2, 3);
        actual = cc.createBinaryOpUGen("+", madd, 4);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u2, u1, 7]);
      });
      it("madd + bop = bop", function() {
        var madd = cc.createMulAdd(u1, u2, 3);
        actual = cc.createBinaryOpUGen("+", madd, -3);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u2, u1]);
        assert.equal(actual.selector, "*");
      });
      it("madd + bop = bop", function() {
        var madd = cc.createMulAdd(u1, u2, u3);
        actual = cc.createBinaryOpUGen("+", madd, u4);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.equal(actual.inputs[0], u2);
        assert.equal(actual.inputs[1], u1);
        assert.instanceOf(actual.inputs[2], basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs[2].inputs, [u3, u4]);
        assert.equal(actual.inputs[2].selector, "+");
      });
      it("bop + ugen = sum3", function() {
        var bop = cc.createBinaryOpUGen("+", u1, u2);
        actual = cc.createBinaryOpUGen("+", bop, u3);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u3, u2, u1]);
      });
      it("bop + ugen = madd", function() {
        var bop = cc.createBinaryOpUGen("*", u1, u2);
        actual = cc.createBinaryOpUGen("+", bop, u3);
        assert.instanceOf(actual, basic_ugen.MulAdd);
        assert.deepEqual(actual.inputs, [u2, u1, u3]);
      });
      it("sum3 + ugen = sum4", function() {
        var sum3 = cc.createSum3(u1, u2, u3);
        actual = cc.createBinaryOpUGen("+", sum3, u4);
        assert.instanceOf(actual, basic_ugen.Sum4);
        assert.deepEqual(actual.inputs, [u4, u3, u2, u1]);
      });
      it("sum3 - ugen = bop", function() {
        var sum3 = cc.createSum3(u1, u2, 3);
        actual = cc.createBinaryOpUGen("+", sum3, -3);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u2, u1]);
        assert.equal(actual.selector, "+");

        actual = cc.createBinaryOpUGen("-", sum3, 3);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [u2, u1]);
        assert.equal(actual.selector, "+");
      });
      it("sum4 + ugen = bop", function() {
        var sum4 = cc.createSum4(u1, u2, u3, u4);
        var u5   = new UGen(C.SCALAR);
        actual = cc.createBinaryOpUGen("+", sum4, u5);
        assert.instanceOf(actual, basic_ugen.BinaryOpUGen);
        assert.deepEqual(actual.inputs, [sum4, u5]);
      });
      it("sum4 - ugen = sum3", function() {
        var sum4 = cc.createSum4(u1, u2, u3, 4);
        var u5   = new UGen(C.SCALAR);
        actual = cc.createBinaryOpUGen("+", sum4, -4);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u3, u2, u1]);

        actual = cc.createBinaryOpUGen("-", sum4, 4);
        assert.instanceOf(actual, basic_ugen.Sum3);
        assert.deepEqual(actual.inputs, [u3, u2, u1]);
      });
      it("num * ugen * num * ugen = num * ugen * ugen", function() {
        var u5 = cc.createBinaryOpUGen("*", 10, u1);
        var u6 = cc.createBinaryOpUGen("*", 20, u1);
        actual = cc.createBinaryOpUGen("*", u5, u6);
        assert.deepEqual(actual.inputs[1], 200);
      });
      it("big sum", function() {
        var a = u1;
        for (var i = 0; i < 100; ++i) {
          a = cc.createBinaryOpUGen("+", a, u1);
        }
      });
    });
  });
  
  module.exports = {};

});
