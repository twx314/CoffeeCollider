define(function(require, exports, module) {
  "use strict";

  var CoffeeScript = global.CoffeeScript || global.require("coffee-script");
  
  var cc = require("../../cc");
  var timevalue = require("../../common/timevalue").calc;
  
  // CoffeeScript tags
  // IDENTIFIER
  // NUMBER
  // STRING
  // REGEX
  // BOOL
  // NULL
  // UNDEFINED
  // COMPOUND_ASSIGN -=, +=, div=, *=, %=, ||=, &&=, ?=, <<=, >>=, >>>=, &=, ^=, |=
  // UNARY           !, ~, new, typeof, delete, do
  // LOGIC           &&, ||, &, |, ^
  // SHIFT           <<, >>, >>>
  // COMPARE         ==, !=, <, >, <=, >=
  // MATH            *, div, %, 
  // RELATION        in, of, instanceof
  // =
  // +
  // -
  // ..
  // ...
  // ++
  // --
  // (
  // )
  // [
  // ]
  // {
  // }
  // ?
  // ::
  // @
  // IF
  // ELSE
  // WHILE
  // LOOP
  // SWITCH
  // LEADING_WHEN
  // THIS
  // SUPER
  // INDENT
  // OUTDENT
  // RETURN
  // TERMINATOR
  // HERECOMMENT

  var TAG   = 0;
  var VALUE = 1;
  var _     = {}; // empty location

  var detectPlusMinusOperator = function(tokens) {
    if (tokens.cc_plusminus) {
      return tokens;
    }
    var prevTag = "";
    for (var i = 0, imax = tokens.length; i < imax; ++i) {
      var tag = tokens[i][TAG];
      if (tag === "+" || tag === "-") {
        switch (prevTag) {
        case "IDENTIFIER": case "NUMBER": case "STRING": case "BOOL":
        case "REGEX": case "NULL": case "UNDEFINED": case "]": case "}": case ")":
        case "CALL_END": case "INDEX_END":
          tokens[i][TAG] = "MATH";
          break;
        default:
          tokens[i][TAG] = "UNARY";
        }
      }
      prevTag = tag;
    }
    tokens.cc_plusminus = true;
    return tokens;
  };
  
  var revertPlusMinusOperator = function(tokens) {
    if (!tokens.cc_plusminus) {
      for (var i = 0, imax = tokens.length; i < imax; ++i) {
        var val = tokens[i][VALUE];
        if (val === "+" || val === "-") {
          tokens[i][TAG] = val;
        }
      }
      return tokens;
    }
    delete tokens.cc_plusminus;
    return tokens;
  };
  
  var getPrevOperand = function(tokens, index) {
    tokens = detectPlusMinusOperator(tokens);
    
    var bracket = 0;
    var indent  = 0;
    var end = index;
    while (1 < index) {
      switch (tokens[index][TAG]) {
      case "(": case "[": case "{":
      case "PARAM_START": case "CALL_START": case "INDEX_START":
        bracket -= 1;
        break;
      case "}": case "]": case ")":
      case "PARAM_END": case "CALL_END": case "INDEX_END":
        bracket += 1;
        break;
      case "OUTDENT":
        indent += 1;
        break;
      case "INDENT":
        indent -= 1;
        break;
      }
      switch (tokens[index - 1][TAG]) {
      case "PARAM_END": case "CALL_END": case "INDEX_END":
      case ".": case "@":
        index -= 1;
        continue;
      }
      switch (tokens[index][TAG]) {
      case "(": case "[": case "{": case "PARAM_START":
      case "IDENTIFIER": case "NUMBER": case "BOOL": case "STRING": case "REGEX":
      case "UNDEFINED": case "NULL": case "@": case "THIS": case "SUPER":
      case "->": case "=>":
        if (bracket === 0 && indent === 0) {
          var prev;
          while ((prev = tokens[index-1]) && prev[TAG] === "UNARY") {
            index -= 1;
          }
          return {tokens:tokens, begin:index, end:end};
        }
        break;
      }
      index -= 1;
    }
    return {tokens:tokens, begin:0, end:end};
  };
  
  var getNextOperand = function(tokens, index) {
    tokens = detectPlusMinusOperator(tokens);
    var bracket = 0;
    var indent  = 0;
    var begin = index;
    var imax = tokens.length - 2;

    if (tokens[index] && tokens[index][TAG] === "@") {
      if (tokens[index+1][TAG] !== "IDENTIFIER") {
        return {tokens:tokens, begin:index, end:index};
      }
    }
    
    while (index < imax) {
      var tag = tokens[index][TAG];
      
      switch (tag) {
      case "(": case "[": case "{":
      case "PARAM_START":
        bracket += 1;
        break;
      case "}": case "]": case ")":
      case "PARAM_END": case "CALL_END": case "INDEX_END":
        bracket -= 1;
        break;
      case "INDENT":
        indent += 1;
        break;
      case "OUTDENT":
        indent -= 1;
        break;
      }
      
      switch (tokens[index + 1][TAG]) {
      case "CALL_START": case "INDEX_START":
        bracket += 1;
        index += 1;
        continue;
      case ".": case "@": case "ELSE":
        index += 1;
        continue;
      }
      
      switch (tag) {
      case "}": case "]": case ")": case "CALL_END": case "INDEX_END":
      case "IDENTIFIER": case "NUMBER": case "BOOL": case "STRING": case "REGEX":
      case "UNDEFINED": case "NULL": case "OUTDENT":
        if (bracket === 0 && indent === 0) {
          return {tokens:tokens, begin:begin, end:index};
        }
        break;
      }
      index += 1;
    }
    return {tokens:tokens, begin:begin, end:Math.max(0,tokens.length-2)};
  };

  var isDot = function(token) {
    return !!token && (token[TAG] === "." || token[TAG] === "@");
  };

  var setVariables = function(stack) {
    var ignored = [
      "cc", "global", "console",
      "setInterval", "setTimeout", "clearInterval", "clearTimeout"
    ];
    return function(name) {
      if (ignored.indexOf(name) !== -1) {
        return;
      }
      if (stack.peek.declared.indexOf(name) === -1) {  // not declared yet
        if (stack.peek.args.indexOf(name) === -1) {    // not function parameters
          if (stack.peek.local.indexOf(name) === -1) { //   when a local variable (set)
            stack.peek.local.push(name);
          }
        }
        return;
      }
      
      // when not a local variable
      if (stack.peek.outer.indexOf(name) !== -1) {
        return;
      }
      
      // outer variable
      stack.peek.outer.push(name);
      for (var i = stack.length - 2; i >= 0; i--) {
        if (stack[i].local.indexOf(name) !== -1) {
          return;
        }
        if (stack[i].outer.indexOf(name) === -1) {
          stack[i].outer.push(name);
        }
      }
    };
  };
  
  var detectFunctionParameters = function(tokens) {
    if (tokens.cc_funcParams) {
      return tokens;
    }
    var stack = [
      { declared:[], args:[], local:[], outer:[] }
    ];
    stack.setVariables = setVariables(stack);
    
    var indent = 0;
    var args = [];
    var vars = [];
    for (var i = 0, imax = tokens.length; i < imax; ++i) {
      var op, token = tokens[i];
      stack.peek = stack[stack.length-1];
      switch (token[TAG]) {
      case "PARAM_START":
        args = getInfoOfArguments(tokens, i);
        i    = args.end + 1;
        vars = args.vars;
        args = args.args;
        /* falls through */
      case "->": case "=>":
        var scope = {
          declared: stack.peek.declared.concat(stack.peek.local),
          args:vars.splice(0), local:[], outer:[], indent:indent
        };
        tokens[i].cc_funcParams = {
          args:args.splice(0), local:scope.local, outer:scope.outer
        };
        token.cc_funcRef = tokens[i];
        stack.push(scope);
        break;
      case "FOR":
        do {
          op = getNextOperand(tokens, i+1);
          getVariables(op).forEach(stack.setVariables);
          i = op.end + 1;
        } while (i < imax && tokens[i][TAG] === ",");
        break;
      case "INDENT":
        indent += 1;
        break;
      case "OUTDENT":
        indent -= 1;
        if (stack.peek.indent === indent) {
          stack.pop();
        }
        break;
      default:
        op = getNextOperand(tokens, i);
        if (tokens[op.begin][TAG] === "IDENTIFIER") {
          if (tokens[op.end+1][TAG] !== ":") {
            getVariables(op).forEach(stack.setVariables);
          }
        }
      }
    }
    tokens.cc_funcParams = {
      local: stack[0].local
    };
    return tokens;
  };
  
  var getInfoOfArguments = function(tokens, index) {
    var begin = index;
    var end  = indexOfParamEnd(tokens, index);
    var vars = [];
    var args = [];
    for (var i = begin+1; i < end; ++i) {
      var op = getNextOperand(tokens, i);
      args.push(formatArgument(op));
      vars = getVariables(op, vars);
      i += op.end - op.begin + 1;
      if (tokens[i][TAG] === "=") {
        op = getNextOperand(tokens, i+1);
        args.push(formatArgument(op));
        i += op.end - op.begin + 1;
      } else {
        args.push(null);
      }
      if (tokens[i][TAG] !== ",") {
        i += 1;
      }
    }
    return {vars:vars, args:args, end:end};
  };
  var getVariables = function(op, list) {
    var tokens = op.tokens;
    list = list || [];
    if (tokens[op.begin][TAG] === "[" && tokens[op.end][TAG] === "]") {
      for (var i = op.begin+1, imax = op.end; i < imax; ++i) {
        var _op = getNextOperand(tokens, i);
        list = getVariables(_op, list);
        i += _op.end - _op.begin + 1;
        if (tokens[i][TAG] !== ",") {
          i += 1;
        }
      }
    } else {
      if (!isDot(tokens[op.begin-1])) {
        if (/^[a-z][a-zA-Z0-9_$]*$/.test(tokens[op.begin][VALUE])) {
          list.push(tokens[op.begin][VALUE]);
        }
      }
    }
    return list;
  };
  var indexOfParamEnd = function(tokens, index) {
    var bracket = 0;
    for (var i = index, imax = tokens.length; i < imax; ++i) {
      switch (tokens[i][TAG]) {
      case "PARAM_START":
        bracket += 1;
        break;
      case "PARAM_END":
        bracket -= 1;
        if (bracket === 0) {
          return i;
        }
      }
    }
    return -1;
  };
  var formatArgument = function(op) {
    return op.tokens.slice(op.begin, op.end+1).map(function(token, index) {
      if (token[TAG] === "STRING" && token[VALUE].charAt(0) === "'") {
        return "\"" + token[VALUE].substr(1, token[VALUE].length-2) + "\"";
      } else if (token[TAG] === "IDENTIFIER" && op.tokens[op.begin+index+1][TAG] === ":") {
        return "\"" + token[VALUE] + "\"";
      }
      return token[VALUE];
    }).join("");
  };
  
  var replaceFixedTimeValue = function(tokens) {
    for (var i = 0, imax = tokens.length; i < imax; ++i) {
      var token = tokens[i];
      if (token[TAG] === "STRING" && token[VALUE].charAt(0) === "\"") {
        var time = timevalue(token[VALUE].substr(1, token[VALUE].length-2));
        if (typeof time === "number") {
          token[TAG] = "NUMBER";
          token[VALUE] = time.toString();
        }
      }
    }
    return tokens;
  };
  
  var replaceStrictlyPrecedence = function(tokens) {
    tokens = detectPlusMinusOperator(tokens);
    for (var i = tokens.length-1; i > 0; i--) {
      var token = tokens[i];
      if (token[TAG] === "MATH" && (token[VALUE] !== "+" && token[VALUE] !== "-")) {
        var prev = getPrevOperand(tokens, i);
        var next = getNextOperand(tokens, i);
        tokens.splice(next.end + 1, 0, [")", ")" , _]);
        tokens.splice(prev.begin  , 0, ["(", "(" , _]);
      }
    }
    return tokens;
  };
  
  var unaryOperatorDict = {
    "+": "__plus__", "-": "__minus__"
  };
  var replaceUnaryOperator = function(tokens) {
    tokens = detectPlusMinusOperator(tokens);
    for (var i = tokens.length-1; i >= 0; i--) {
      var token = tokens[i];
      if (token[TAG] === "UNARY" && unaryOperatorDict.hasOwnProperty(token[VALUE])) {
        var selector = unaryOperatorDict[token[VALUE]];
        var next = getNextOperand(tokens, i);
        tokens.splice(next.end+1, 0, ["."         , "."     , _]);
        tokens.splice(next.end+2, 0, ["IDENTIFIER", selector, _]);
        tokens.splice(next.end+3, 0, ["CALL_START", "("     , _]);
        tokens.splice(next.end+4, 0, ["CALL_END"  , ")"     , _]);
        tokens.splice(i, 1);
      }
    }
    return tokens;
  };
  
  var binaryOperatorDict = {
    "+": "__add__", "-": "__sub__", "*": "__mul__", "/": "__div__", "%": "__mod__"
  };
  var binaryOperatorAdverbs = {
    W:"WRAP", S:"SHORT", C:"CLIP", F:"FOLD", T:"TABLE", X:"FLAT",
    WRAP:"WRAP", SHORT:"SHORT", CLIP:"CLIP", FOLD:"FOLD", TABLE:"TABLE", FLAT:"FLAT"
  };
  var replaceTextBinaryAdverb = function(code) {
    Object.keys(binaryOperatorAdverbs).forEach(function(key) {
      var a = new RegExp("([+\\-*/%])(" + key + ")\\1", "g");
      var b = "$1 " + "\"#!" + key.charAt(0) + "\"" + " $1";
      code = code.replace(a, b);
    });
    return code;
  };
  var checkAdvarb = function(tokens, index) {
    var t0 = tokens[index  ];
    var t1 = tokens[index-1];
    var t2 = tokens[index-2];
    if (t0 && t1 && t2) {
      if (/^"#![WSCFTX]"$/.test(t1[VALUE])) {
        var key = t1[VALUE].charAt(3);
        if (t0[VALUE] === t2[VALUE] && binaryOperatorAdverbs.hasOwnProperty(key)) {
          return binaryOperatorAdverbs[key];
        }
      }
    }
  };
  var replaceBinaryOperator = function(tokens) {
    tokens = detectPlusMinusOperator(tokens);
    for (var i = tokens.length-1; i >= 0; i--) {
      var token = tokens[i];
      if (token[TAG] === "MATH" && binaryOperatorDict.hasOwnProperty(token[VALUE])) {
        var selector = binaryOperatorDict[token[VALUE]];
        var adverb   = checkAdvarb(tokens, i);
        var next = getNextOperand(tokens, i);
        if (adverb) {
          i -= 2;
          tokens.splice(i  , 1, ["."         , "."     , _]);
          tokens.splice(i+1, 1, ["IDENTIFIER", selector, _]);
          tokens.splice(i+2, 1, ["CALL_START", "("     , _]);
          tokens.splice(next.end+1, 0, [","         , ","   , _]);
          tokens.splice(next.end+2, 0, ["IDENTIFIER", adverb, _]);
          tokens.splice(next.end+3, 0, ["CALL_END"  , ")"   , _]);
        } else {
          tokens.splice(i  , 1, ["."         , "."     , _]);
          tokens.splice(i+1, 0, ["IDENTIFIER", selector, _]);
          tokens.splice(i+2, 0, ["CALL_START", "("     , _]);
          tokens.splice(next.end+3, 0, ["CALL_END", ")", _]);
        }
      }
    }
    return tokens;
  };
  
  var compoundAssignOperatorDict = {
    "+=": "__add__",
    "-=": "__sub__",
    "*=": "__mul__",
    "/=": "__div__",
    "%=": "__mod__",
  };
  var replaceCompoundAssign = function(tokens) {
    for (var i = tokens.length; --i > 0; ) {
      var token = tokens[i];
      if (compoundAssignOperatorDict.hasOwnProperty(token[VALUE])) {
        var selector = compoundAssignOperatorDict[token[VALUE]];
        var prev = getPrevOperand(tokens, i);
        var next = getNextOperand(tokens, i);
        tokens.splice(i  , 1, ["="         , "="     , _]);
        tokens.splice(i+1, 0, ["."         , "."     , _]);
        tokens.splice(i+2, 0, ["IDENTIFIER", selector, _]);
        tokens.splice(i+3, 0, ["CALL_START", "("     , _]);
        tokens.splice(next.end+4, 0, ["CALL_END", ")", _]);
        for (var j = prev.begin; j < i; ++j) {
          tokens.splice(i+1, 0, tokens[j]);
        }
      }
    }
    return tokens;
  };
  
  var logicOperatorDict = {
    "&&": "__and__", "||": "__or__"
  };
  var replaceLogicOperator = function(tokens) {
    var replaceable = false;
    for (var i = 1; i < tokens.length; ++i) {
      var token = tokens[i];
      if (token[VALUE] === "wait" && tokens[i-1][TAG] === "@") {
        replaceable = true;
        continue;
      }
      if (token[TAG] === ",") {
        replaceable = false;
        continue;
      }
      if (replaceable) {
        if (token[TAG] === "LOGIC" && logicOperatorDict.hasOwnProperty(token[VALUE])) {
          var selector = logicOperatorDict[token[VALUE]];
          var next = getNextOperand(tokens, i);
          tokens.splice(i  , 1, ["."         , "."     , _]);
          tokens.splice(i+1, 0, ["IDENTIFIER", selector, _]);
          tokens.splice(i+2, 0, ["CALL_START", "("     , _]);
          tokens.splice(next.end+3, 0, ["CALL_END", ")", _]);
          i = next.end+3; // skip
        }
      }
    }
    return tokens;
  };
  
  var indexOfFunctionStart = function(tokens, index) {
    for (var i = index, imax = tokens.length; i < imax; ++i) {
      if (tokens[i][TAG] === "TERMINATOR" || tokens[i][TAG] === ".") {
        break;
      }
      if (tokens[i][TAG] === "->" ||
          tokens[i][TAG] === "=>" ||
          tokens[i][TAG] === "PARAM_START") {
        return i;
      }
    }
    return -1;
  };
  var indexOfFunctionBody = function(tokens, index) {
    var bracket = 0;
    for (var i = index, imax = tokens.length; i < imax; ++i) {
      switch (tokens[i][TAG]) {
      case "PARAM_START":
        bracket += 1;
        break;
      case "PARAM_END":
        bracket -= 1;
        break;
      case "->": case "=>":
        if (bracket === 0) {
          return i + 2;
        }
      }
    }
    return -1;
  };
  var getLine = function(tokens, index) {
    var depth = 0;
    var result = { tokens:tokens, begin:index, end:-1, isLastLine:false };
    LOOP:
    for (var i = index, imax = tokens.length; i < imax; ++i) {
      switch (tokens[i][VALUE]) {
      case "(": case "{": case "[":
        depth += 1;
        break;
      case "]": case "}": case ")":
        depth -= 1;
        break;
      }
      switch (tokens[i][TAG]) {
      case "TERMINATOR":
        if (depth === 0) {
          result.end = i;
        }
        break;
      case "INDENT":
        depth += 1;
        break;
      case "OUTDENT":
        depth -= 1;
        if (depth === -1) {
          result.end = i - 1;
          result.isLastLine = true;
        }
        break;
      }
      if (result.end !== -1) {
        break;
      }
    }
    return result;
  };
  var getLastLine = function(tokens, index) {
    while (index < tokens.length) {
      var op = getLine(tokens, index);
      if (op.isLastLine) {
        return op;
      }
      index = op.end + 1;
    }
    return {begin:tokens.length};
  };
  
  var replaceSynthDefinition = function(tokens) {
    tokens = detectFunctionParameters(tokens);
    for (var i = tokens.length - 4; i--; ) {
      if (i && tokens[i-1][TAG] === ".") {
        continue;
      }
      var index, outer_index, inner_index = -1;
      if (tokens[i][VALUE] === "SynthDef") {
        outer_index = indexOfFunctionStart(tokens, i + 2);
        inner_index = outer_index;
      } else if (tokens[i][VALUE] === "SynthDefTemplate") {
        outer_index = indexOfFunctionStart(tokens, i + 2);
        if (outer_index !== -1 && (index = indexOfFunctionBody(tokens, outer_index)) !== -1) {
          inner_index = indexOfFunctionStart(tokens, getLastLine(tokens, index).begin);
        }
      }
      if (inner_index === -1) {
        continue;
      }
      var args;
      if (tokens[inner_index].cc_funcRef) {
        args = tokens[inner_index].cc_funcRef.cc_funcParams.args;
      } else {
        args = [];
      }
      replaceSynthDefDefaultArguments(tokens, inner_index, args);
      
      index = getNextOperand(tokens, outer_index).end + 1;
      insertSynthDefArgumentsToAfterFunction(tokens, index, args);
    }
    return tokens;
  };
  var replaceSynthDefDefaultArguments = function(tokens, index, args) {
    if (args.length) {
      // remove
      tokens.splice(index, indexOfParamEnd(tokens, index) - index + 1);
      
      // insert
      tokens.splice(index++, 0, ["PARAM_START", "(", _]);
      for (var i = 0, imax = args.length; i < imax; i += 2) {
        if (i) {
          tokens.splice(index++, 0, [",", ",", _]);
        }
        tokens.splice(index++, 0, ["IDENTIFIER", args[i], _]);
      }
      tokens.splice(index++, 0, ["PARAM_END"  , ")", _]);
    }
  };
  var insertSynthDefArgumentsToAfterFunction = function(tokens, index, args) {
    tokens.splice(index++, 0, [",", ",", _]);
    tokens.splice(index++, 0, ["[", "[", _]);
    for (var j = 0, jmax = args.length; j < jmax; ++j) {
      if (j) {
        tokens.splice(index++, 0, [",", ",", _]);
      }
      tokens.splice(index++, 0, ["STRING", "'" + (args[j]||0) + "'", _]);
    }
    tokens.splice(index++, 0, ["]", "]", _]);
  };
  
  var getIdentifier = function(token) {
    var val = token[VALUE];
    if (val.reserved) {
      return val[0] + val[1] + (val[2]||"") + (val[3]||"") + (val[4]||"") +
        (val[5]||"") + (val[6]||"") + (val[7]||"");
    }
    return val;
  };
  
  var taskContextMethods = [
    "wait", "break", "continue", "redo"
  ];
  var replaceTaskFunction = function(tokens) {
    tokens = detectFunctionParameters(tokens);
    for (var i = tokens.length - 3; i--; ) {
      if ((i && tokens[i-1][TAG] === ".") || tokens[i][VALUE] !== "Task") {
        continue;
      }
      var index = indexOfFunctionStart(tokens, i + 2);
      if (index === -1) {
        continue;
      }
      makeSegmentedFunction(getNextOperand(tokens, index), taskContextMethods);
    }
    return tokens;
  };
  
  var insertClosureFuction = function(tokens, index, t, body) {
    var outerVars = t.cc_funcParams.outer;
    if (outerVars && outerVars.length) {
      var offset = 0;
      if (tokens[index-2][TAG] !== "PARAM_END") {
        offset = 1;
      } else {
        var bracket = 0;
        while ((t = tokens[index - offset]) !== undefined) {
          if (t[TAG] === "PARAM_END") {
            bracket += 1;
          } else if (t[TAG] === "PARAM_START") {
            bracket -=1;
            if (bracket === 0) {
              break;
            }
          }
          offset += 1;
        }
      }
      
      index -= offset;
      tokens.splice(index++, 0, ["UNARY"      , "do", _]);
      tokens.splice(index++, 0, ["PARAM_START", "(" , _]);
      for (var i = 0, imax = outerVars.length; i < imax; ++i) {
        if (i) {
          tokens.splice(index++, 0, [",", ",", _]);
        }
        tokens.splice(index++, 0, ["IDENTIFIER", outerVars[i], _]);
      }
      tokens.splice(index++, 0, ["PARAM_END"  , ")" , _]);
      tokens.splice(index++, 0, ["->"         , "->", _]);
      tokens.splice(index++, 0, ["INDENT" , 2   , _]);
      index += offset;
    }
    
    var indent = 0;
    LOOP:
    while ((t = body.shift()) !== undefined) {
      tokens.splice(index++, 0, t);
      switch (t[TAG]) {
      case "INDENT":
        indent += 1;
        break;
      case "->": case "=>":
        index = insertClosureFuction(tokens, index, t, body);
        break;
      case "OUTDENT":
        indent -= 1;
        break LOOP;
      }
    }
    if (outerVars && outerVars.length) {
      tokens.splice(index++, 0, ["OUTDENT", 2  , _]);
    }
    return index;
  };
  
  var makeSegmentedFunction = function(op, controlMethods) {
    var tokens = op.tokens;
    var index  = op.begin;
    var begin  = index;
    var body = tokens.splice(op.begin, op.end-op.begin+1);
    var t, bracket, indent;
    var localVars, outerVars, controlMethodCalled, numOfSegments;
    var i, imax;
    
    var params = [];
    for (bracket = 0; (t = body.shift()) !== undefined; ) {
      if (t[TAG] === "PARAM_START") {
        bracket += 1;
      } else if (t[TAG] === "PARAM_END") {
        bracket -= 1;
      } else if (t[TAG] === "->" || t[TAG] === "=>") {
        if (bracket === 0) {
          break;
        }
      }
      params.push(t);
    }
    localVars = t.cc_funcParams.local;
    outerVars = t.cc_funcParams.outer;
    body.shift(); // remove INDENT
    body.pop();   // remove OUTDENT
    
    // replace function
    if (outerVars.length) {
      tokens.splice(index++, 0, ["UNARY"      , "do", _]);
      tokens.splice(index++, 0, ["PARAM_START", "(" , _]);
      for (i = 0, imax = outerVars.length; i < imax; ++i) {
        if (i) {
          tokens.splice(index++, 0, [",", ",", _]);
        }
        tokens.splice(index++, 0, ["IDENTIFIER", outerVars[i], _]);
      }
      tokens.splice(index++, 0, ["PARAM_END"  , ")" , _]);
      tokens.splice(index++, 0, ["->"         , "->", _]);
      tokens.splice(index++, 0, ["INDENT" , 2   , _]);
    }
    
    tokens.splice(index++, 0, ["->"     , "->", _]);
    tokens.splice(index++, 0, ["INDENT" , 2   , _]);
    
    // declare local variables
    if (localVars.length) {
      for (i = 0, imax = localVars.length; i < imax; i++) {
        tokens.splice(index++, 0, ["IDENTIFIER", localVars[i], _]);
        tokens.splice(index++, 0, ["="         , "="         , _]);
      }
      tokens.splice(index++, 0, ["UNDEFINED" , "undefined", _]);
      tokens.splice(index++, 0, ["TERMINATOR", "\n", _]);
    }
    
    // return an array of function segments
    tokens.splice(index++, 0, ["["      , "[" , _]);
    tokens.splice(index++, 0, ["INDENT" , 2   , _]);
    
    numOfSegments = 0;
    
    NEXT_SEGMENTS:
    while (body.length) {
      if (numOfSegments) {
        tokens.splice(index++, 0, ["TERMINATOR", "\n", _]);
      }
      numOfSegments += 1;

      // insert arguments
      for (i = 0, imax = params.length; i < imax; ++i) {
        tokens.splice(index++, 0, params[i]);
      }
      tokens.splice(index++, 0, ["->"    , "->", _]);
      tokens.splice(index++, 0, ["INDENT", 2   , _]);
      
      controlMethodCalled = 0;
      for (bracket = indent = 0; (t = body.shift()) !== undefined; ) {
        tokens.splice(index++, 0, t);
        if (t.cc_tasked) {
          continue;
        }
        switch (t[TAG]) {
        case "CALL_START":
          bracket += 1;
          continue;
        case "CALL_END":
          bracket -= 1;
          continue;
        case "INDENT":
          indent += 1;
          continue;
        case "OUTDENT":
          indent -= 1;
          continue;
        case "->": case "=>":
          index = insertClosureFuction(tokens, index, t, body);
          continue;
        case "TERMINATOR":
          if (bracket === 0 && indent === 0 && controlMethodCalled) {
            tokens.splice(index++, 0, ["OUTDENT", 2  , _]);
            continue NEXT_SEGMENTS;
          }
          break;
        }
        if (bracket === 0 && t[TAG] === "@" && body[0] &&
            controlMethods.indexOf(getIdentifier(body[0])) !== -1) {
          controlMethodCalled = 1;
        }
      }
      tokens.splice(index++, 0, ["OUTDENT", 2, _]);
    }
    tokens.splice(index++, 0, ["OUTDENT", 2  , _]);
    tokens.splice(index++, 0, ["]"      , "]", _]);
    tokens.splice(index++, 0, ["OUTDENT", 2  , _]);
    if (outerVars.length) {
      tokens.splice(index++, 0, ["OUTDENT", 2  , _]);
    }
    
    for (i = index - 1; i >= begin; --i) {
      tokens[i].cc_tasked = true;
    }
  };
  
  var replaceGlobalVariables = function(tokens) {
    for (var i = tokens.length - 1; i--; ) {
      var token = tokens[i];
      if (token[TAG] !== "IDENTIFIER") {
        continue;
      }
      if (/^\$[a-z][a-zA-Z0-9_]*$/.test(token[VALUE])) {
        if (tokens[i+1][TAG] === ":") {
          continue; // { NotGlobal:"dict key is not global" }
        }
        if (isDot(tokens[i-1])) {
          continue; // this.is.NotGlobal, @isNotGlobal
        }
        tokens.splice(i  , 0, ["IDENTIFIER", "global", _]);
        tokens.splice(i+1, 0, ["."         , "."     , _]);
        tokens.splice(i+2, 1, ["IDENTIFIER", token[VALUE].substr(1), _]);
      }
    }
    return tokens;
  };
  
  var replaceCCVariables = function(tokens) {
    for (var i = tokens.length - 1; i--; ) {
      var token = tokens[i];
      if (token[TAG] !== "IDENTIFIER") {
        continue;
      }
      if (cc.global.hasOwnProperty(token[VALUE])) {
        if (tokens[i+1][TAG] === ":") {
          continue;
        }
        if (isDot(tokens[i-1])) {
          continue;
        }
        tokens.splice(i  , 0, ["IDENTIFIER", "cc", _]);
        tokens.splice(i+1, 0, ["."         , "." , _]);
      }
    }
    return tokens;
  };
  
  var finalize = function(tokens) {
    tokens.splice(0, 0, ["("          , "("        , _]);
    tokens.splice(1, 0, ["PARAM_START", "("        , _]);
    tokens.splice(2, 0, ["IDENTIFIER" , "global"   , _]);
    tokens.splice(3, 0, ["PARAM_END"  , ")"        , _]);
    tokens.splice(4, 0, ["->"         , "->"       , _]);
    tokens.splice(5, 0, ["INDENT"     , 2          , _]);
    
    var i = tokens.length - 1;
    tokens.splice(i++, 0, ["OUTDENT"   , 2            , _]);
    tokens.splice(i++, 0, [")"         , ")"          , _]);
    tokens.splice(i++, 0, ["."         , "."          , _]);
    tokens.splice(i++, 0, ["IDENTIFIER", "call"       , _]);
    tokens.splice(i++, 0, ["CALL_START", "("          , _]);
    tokens.splice(i++, 0, ["IDENTIFIER", "cc"         , _]);
    tokens.splice(i++, 0, ["."         , "."          , _]);
    tokens.splice(i++, 0, ["IDENTIFIER", "__context__", _]);
    tokens.splice(i++, 0, [","         , ","          , _]);
    tokens.splice(i++, 0, ["THIS"      , "this"       , _]);
    tokens.splice(i++, 0, ["."         , "."          , _]);
    tokens.splice(i++, 0, ["IDENTIFIER", "self"       , _]);
    tokens.splice(i++, 0, ["LOGIC"     , "||"         , _]);
    tokens.splice(i++, 0, ["IDENTIFIER", "global"     , _]);
    tokens.splice(i++, 0, ["CALL_END"  , ")"          , _]);
    return tokens;
  };

  var tab = function(n) {
    var t = "";
    for (var i = 0; i < n; ++i) {
      t += "  ";
    }
    return t;
  };
  var prettyPrint = function(tokens) {
    var indent = 0;
    tokens = detectPlusMinusOperator(tokens);
    return tokens.map(function(token) {
      switch (token[TAG]) {
      case "TERMINATOR":
        return "\n" + tab(indent);
      case "INDENT":
        indent += 1;
        return "\n" + tab(indent);
      case "OUTDENT":
        indent -= 1;
        return "\n" + tab(indent);
      case "RETURN":
        return "return ";
      case "UNARY":
        return token[VALUE] + (token[VALUE].length > 1 ? " " : "");
      case "{":
        return "{";
      case ",": case "RELATION": case "IF": case "SWITCH": case "LEADING_WHEN":
        return token[VALUE] + " ";
      case "=": case "COMPARE": case "MATH": case "LOGIC":
        return " " + token[VALUE] + " ";
      case "HERECOMMENT":
        return "/* " + token[VALUE] + " */";
      default:
        return token[VALUE];
      }
    }).join("").split("\n").filter(function(line) {
      return !(/^\s*$/.test(line));
    }).join("\n").trim();
  };
  
  var CoffeeCompiler = (function() {
    function CoffeeCompiler() {
    }
    CoffeeCompiler.prototype.tokens = function(code) {
      var data = [];
      code = replaceTextBinaryAdverb(code);
      var tokens = CoffeeScript.tokens(code);
      if (tokens.length) {
        tokens.forEach(function(token) {
          if (token[TAG] === "HERECOMMENT") {
            data.push(token[VALUE].trim());
          }
        });
        tokens = replaceGlobalVariables(tokens);
        tokens = replaceFixedTimeValue(tokens);
        tokens = replaceStrictlyPrecedence(tokens);
        tokens = replaceUnaryOperator(tokens);
        tokens = replaceBinaryOperator(tokens);
        tokens = replaceCompoundAssign(tokens);
        tokens = replaceLogicOperator(tokens);
        tokens = replaceSynthDefinition(tokens);
        tokens = replaceTaskFunction(tokens);
        tokens = replaceCCVariables(tokens);
        tokens = finalize(tokens);
      }
      this.code = code;
      this.data = data;
      return tokens;
    };
    CoffeeCompiler.prototype.compile = function(code) {
      var tokens = this.tokens(code);
      return CoffeeScript.nodes(tokens).compile({bare:true}).trim();
    };
    CoffeeCompiler.prototype.toString = function(tokens) {
      if (typeof tokens === "string") {
        tokens = this.tokens(tokens);
      }
      return prettyPrint(tokens);
    };
    return CoffeeCompiler;
  })();
  
  var use = function() {
    cc.createCoffeeCompiler = function() {
      return new CoffeeCompiler();
    };
  };
  
  module.exports = {
    CoffeeCompiler: CoffeeCompiler,
    
    detectPlusMinusOperator : detectPlusMinusOperator,
    revertPlusMinusOperator : revertPlusMinusOperator,
    getPrevOperand          : getPrevOperand,
    getNextOperand          : getNextOperand,
    detectFunctionParameters: detectFunctionParameters,

    replaceTextBinaryAdverb  : replaceTextBinaryAdverb,
    replaceFixedTimeValue    : replaceFixedTimeValue,
    replaceStrictlyPrecedence: replaceStrictlyPrecedence,
    replaceUnaryOperator     : replaceUnaryOperator,
    replaceBinaryOperator    : replaceBinaryOperator,
    replaceCompoundAssign    : replaceCompoundAssign,
    replaceLogicOperator     : replaceLogicOperator,
    replaceSynthDefinition   : replaceSynthDefinition,
    replaceTaskFunction      : replaceTaskFunction,
    replaceGlobalVariables   : replaceGlobalVariables,
    replaceCCVariables       : replaceCCVariables,
    finalize                 : finalize,
    prettyPrint              : prettyPrint,
    
    use: use,
  };

  module.exports.use();

});
