define(function(require, exports, module) {
  "use strict";

  var assert = require("chai").assert;
  var compiler = require("./compiler");

  describe("compiler.", function() {
    var _ = {};
    describe("findOperandHead:", function() {
      it("with an unaryOperator", function() {
        var tokens = [
          [ "("         , "("   , _ ],
          [ "+"         , "+"   , _ ], // <-- head
          [ "IDENTIFIER", "Math", _ ],
          [ "."         , "."   , _ ],
          [ "IDENTIFIER", "PI"  , _ ],
          [ "MATH"      , "*"   , _ ], // <-- from
          [ "NUMBER"    , 10    , _ ],
          [ ")"         , ")"   , _ ],
          [ "TERMINATOR", "\n"  , _ ],
        ];
        var expected = 1;
        var actual = compiler.findOperandHead(tokens, 5);
        assert.equal(actual, expected);
      });
      it("with a parenthesis", function() {
        var tokens = [
          [ "["         , "["   , _ ],
          [ "("         , "("   , _ ], // <-- head
          [ "IDENTIFIER", "Math", _ ],
          [ "."         , "."   , _ ],
          [ "IDENTIFIER", "PI"  , _ ],
          [ ")"         , ")"   , _ ],
          [ "MATH"      , "*"   , _ ], // <-- from
          [ "NUMBER"    , 10    , _ ],
          [ "]"         , "]"   , _ ],
          [ "TERMINATOR", "\n"  , _ ],
        ];
        var expected = 1;
        var actual = compiler.findOperandHead(tokens, 6);
        assert.equal(actual, expected);
      });
    });
    describe("findOperandTail:", function() {
      it("", function() {
        var tokens = [
          [ "NUMBER"    , 10    , _ ],
          [ "MATH"      , "*"   , _ ], // <-- from
          [ "IDENTIFIER", "Math", _ ],
          [ "."         , "."   , _ ],
          [ "IDENTIFIER", "PI"  , _ ], // <-- tail
          [ "TERMINATOR", "\n"  , _ ],
        ];
        var expected = 4;
        var actual = compiler.findOperandTail(tokens, 1);
        assert.equal(actual, expected);
      });
      it("with a parenthesis", function() {
        var tokens = [
          [ "NUMBER"    , 10    , _ ],
          [ "MATH"      , "*"   , _ ], // <-- from
          [ "("         , "("   , _ ],
          [ "IDENTIFIER", "Math", _ ],
          [ "."         , "."   , _ ],
          [ "IDENTIFIER", "PI"  , _ ],
          [ "MATH"      , "*"   , _ ],
          [ "NUMBER"    , 10    , _ ],
          [ ")"         , ")"   , _ ], // <-- tail
          [ "TERMINATOR", "\n"  , _ ],
        ];
        var expected = 8;
        var actual = compiler.findOperandTail(tokens, 1);
        assert.equal(actual, expected);
      });
      it("with a function", function() {
        var tokens = [
          [ "NUMBER"    , 10    , _ ],
          [ "MATH"      , "*"   , _ ], // <-- from
          [ "IDENTIFIER", "func", _ ],
          [ "CALL_START", "("   , _ ],
          [ "IDENTIFIER", "a"   , _ ],
          [ ","         , ","   , _ ],
          [ "IDENTIFIER", "b"   , _ ],
          [ "CALL_END"  , ")"   , _ ], // <-- tail
          [ "TERMINATOR", "\n"  , _ ],
        ];
        var expected = 7;
        var actual = compiler.findOperandTail(tokens, 1);
        assert.equal(actual, expected);
      });
    });
    describe("replacePi:", function() {
      it("pi => Math.PI", function() {
        var tokens = [
          [ "IDENTIFIER", "pi", _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var expected = [
          [ "IDENTIFIER", "Math", _ ],
          [ "."         , "."   , _ ],
          [ "IDENTIFIER", "PI"  , _ ],
          [ "TERMINATOR", "\n"  , _ ],
        ];
        var actual = compiler.replacePi(tokens);
        assert.deepEqual(actual, expected);
      });
      it("-10pi => (-10 * Math.PI)", function() {
        var tokens = [
          [ "-"         , "-" , _ ],
          [ "NUMBER"    , 10  , _ ],
          [ "IDENTIFIER", "pi", _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var expected = [
          [ "("         , "("   , _ ],
          [ "-"         , "-"   , _ ],
          [ "NUMBER"    , 10    , _ ],
          [ "MATH"      , "*"   , _ ],
          [ "IDENTIFIER", "Math", _ ],
          [ "."         , "."   , _ ],
          [ "IDENTIFIER", "PI"  , _ ],
          [ ")"         , ")"   , _ ],
          [ "TERMINATOR", "\n"  , _ ],
        ];
        var actual = compiler.replacePi(tokens);
        assert.deepEqual(actual, expected);
      });
    });
    describe("replacePrecedence:", function() {
      it("a * b + c => (a * b) + c", function() {
        var tokens = [
          [ "IDENTIFIER", "a" , _ ],
          [ "MATH"      , "*" , _ ],
          [ "IDENTIFIER", "b" , _ ],
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "c" , _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var expected = [
          [ "("         , "(" , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "MATH"      , "*" , _ ],
          [ "IDENTIFIER", "b" , _ ],
          [ ")"         , ")" , _ ],
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "c" , _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var actual = compiler.replacePrecedence(tokens);
        assert.deepEqual(actual, expected);
      });
    });
    describe("replaceBinaryOp:", function() {
      it("a + b => a.__add__(b)", function() {
        var tokens = [
          [ "IDENTIFIER", "a" , _ ],
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "b" , _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var expected = [
          [ "IDENTIFIER", "a"      , _ ],
          [ "."         , "."      , _ ],
          [ "IDENTIFIER", "__add__", _ ],
          [ "CALL_START", "("      , _ ],
          [ "IDENTIFIER", "b"      , _ ],
          [ "CALL_END"  , ")"      , _ ],
          [ "TERMINATOR", "\n"     , _ ],
        ];
        var actual = compiler.replaceBinaryOp(tokens);
        assert.deepEqual(actual, expected);
      });
    });
    describe("replaceUnaryOp:", function() {
      it("+a + a => a + a", function() {
        var tokens = [
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var expected = [
          [ "IDENTIFIER", "a" , _ ],
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var actual = compiler.replaceUnaryOp(tokens);
        assert.deepEqual(actual, expected);
      });
      it("-a + a => a.neg() + a", function() {
        var tokens = [
          [ "-"         , "-" , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var expected = [
          [ "IDENTIFIER", "a"  , _ ],
          [ "."         , "."  , _ ],
          [ "IDENTIFIER", "neg", _ ],
          [ "CALL_START", "("  , _ ],
          [ "CALL_END"  , ")"  , _ ],
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "TERMINATOR", "\n" , _ ],
        ];
        var actual = compiler.replaceUnaryOp(tokens);
        assert.deepEqual(actual, expected);
      });
      it.only("!!a.a => a.a.not().not()", function() {
        var tokens = [
          [ "UNARY"     , "!" , _ ],
          [ "UNARY"     , "!" , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "."         , "." , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var expected = [
          [ "IDENTIFIER", "a"  , _ ],
          [ "."         , "."  , _ ],
          [ "IDENTIFIER", "a"  , _ ],
          [ "."         , "."  , _ ],
          [ "IDENTIFIER", "not", _ ],
          [ "CALL_START", "("  , _ ],
          [ "CALL_END"  , ")"  , _ ],
          [ "."         , "."  , _ ],
          [ "IDENTIFIER", "not", _ ],
          [ "CALL_START", "("  , _ ],
          [ "CALL_END"  , ")"  , _ ],
          [ "TERMINATOR", "\n" , _ ],
        ];
        var actual = compiler.replaceUnaryOp(tokens);
        assert.deepEqual(actual, expected);
      });
    });
    describe("replaceCompoundAssign:", function() {
      it("a.a += b.b => a.a = a.a.__add__(b.b)", function() {
        var tokens = [
          [ "IDENTIFIER"     , "a" , _ ],
          [ "."              , "." , _ ],
          [ "IDENTIFIER"     , "a" , _ ],
          [ "COMPOUND_ASSIGN", "+=", _ ],
          [ "IDENTIFIER"     , "b" , _ ],
          [ "."              , "." , _ ],
          [ "IDENTIFIER"     , "b" , _ ],
          [ "TERMINATOR"     , "\n", _ ],
        ];
        var expected = [
          [ "IDENTIFIER", "a"      , _ ],
          [ "."         , "."      , _ ],
          [ "IDENTIFIER", "a"      , _ ],
          [ "="         , "="      , _ ],
          [ "IDENTIFIER", "a"      , _ ],
          [ "."         , "."      , _ ],
          [ "IDENTIFIER", "a"      , _ ],
          [ "."         , "."      , _ ],
          [ "IDENTIFIER", "__add__", _ ],
          [ "CALL_START", "("      , _ ],
          [ "IDENTIFIER", "b"      , _ ],
          [ "."         , "."      , _ ],
          [ "IDENTIFIER", "b"      , _ ],
          [ "CALL_END"  , ")"      , _ ],
          [ "TERMINATOR", "\n"     , _ ],
        ];
        var actual = compiler.replaceCompoundAssign(tokens);
        assert.deepEqual(actual, expected);
      });
    });
    describe("cleanupParenthesis:", function() {
      it("((a + b)) => (a + b)", function() {
        var tokens = [
          [ "("         , "(" , _ ],
          [ "("         , "(" , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "b" , _ ],
          [ ")"         , ")" , _ ],
          [ ")"         , ")" , _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var expected = [
          [ "("         , "(" , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "b" , _ ],
          [ ")"         , ")" , _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var actual = compiler.cleanupParenthesis(tokens);
        assert.deepEqual(actual, expected);
      });
      it("((a + b) + c) => ((a + b) + c)", function() {
        var tokens = [
          [ "("         , "(" , _ ],
          [ "("         , "(" , _ ],
          [ "IDENTIFIER", "a" , _ ],
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "b" , _ ],
          [ ")"         , ")" , _ ],
          [ "+"         , "+" , _ ],
          [ "IDENTIFIER", "c" , _ ],
          [ ")"         , ")" , _ ],
          [ "TERMINATOR", "\n", _ ],
        ];
        var expected = tokens;
        var actual = compiler.cleanupParenthesis(tokens);
        assert.deepEqual(actual, expected);
      });
    });    
  });

});