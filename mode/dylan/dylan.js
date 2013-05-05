CodeMirror.defineMode("dylan", function(config, parserConfig) {
  var indentUnit = config.indentUnit;

  function chain(stream, state, f) {
    state.tokenize = f;
    return f(stream, state);
  }

  // Patterns
  var symbolPattern = "[-_a-zA-Z?!*@<>$%]+";
  var symbol = new RegExp("^" + symbolPattern);
  // Symbols with special syntax
  var patterns = {
    symbolKeyword: symbolPattern + ":",
    symbolClass: "<" + symbolPattern + ">",
    symbolGlobal: "\\*" + symbolPattern + "\\*",
    symbolConstant: "\\$" + symbolPattern
  };

  for (var patternName in patterns)
    if (patterns.hasOwnProperty(patternName))
      patterns[patternName] = new RegExp("^" + patterns[patternName]);

  /*
   * A keyword is a letter, followed by zero or more letters, digits, and
   * hyphens, followed by a colon.
   * A keyword begins on a new line, and cannot be preceded by whitespace.
   */
  function tokenHeader(stream, state) {
    if (stream.sol() && stream.match(/\w[\w\d-]*:/)) {
      stream.next();
      return "header-keyword";
    }
    stream.next();
    return "header-value";
  }

  function tokenBase(stream, state) {
    var ch = stream.peek();
    // String
    if (ch == '"' || ch == "'") {
      stream.next();
      return chain(stream, state, tokenString(ch, "string"));
    }
    // Comment
    else if (ch == "/") {
      stream.next();
      if (stream.eat("*")) {
        return chain(stream, state, tokenComment);
      }
      else if (stream.eat("/")) {
        stream.skipToEnd();
        return "comment";
      }
      else {
        stream.skipTo(" ");
        return "operator";
      }
    }
    // Decimal
    else if (/\d/.test(ch)) {
      stream.match(/^\d*(?:\.\d*)?(?:e[+\-]?\d+)?/);
      return "number";
    }
    // Hash or Number
    else if (ch == "#") {
      stream.next();
      ch = stream.peek();
      // Symbol with string syntax
      if (ch == '"') {
        stream.next();
        return chain(stream, state, tokenString('"', "atom"));
      }
      // Binary Number
      else if (ch == "b") {
        stream.next();
        stream.eatWhile(/[01]/);
        return "number";
      }
      // Hex Number
      else if (ch == "x") {
        stream.next();
        stream.eatWhile(/[\da-f]/i);
        return "number";
      }
      // Octal Number
      else if (ch == "o") {
        stream.next();
        stream.eatWhile(/[0-7]/);
        return "number";
      }
      // Hash symbol
      else {
        stream.eatWhile(/[-a-zA-Z]/);
        return "atom";
      }
    }

    if (stream.match("define"))
      return "def";
    else if (stream.match(symbol))
      return "variable"
    stream.next();
    return null;
  }

  function tokenString(quote, type) {
    return function(stream, state) {
      var next, end = false;
      while ((next = stream.next()) != null) {
        if (next == quote) {
          end = true;
          break;
        }
      }
      if (end)
        state.tokenize = tokenBase;
      return type;
    };
  }

  function tokenComment(stream, state) {
    var maybeEnd = false, ch;
    while (ch = stream.next()) {
      if (ch == "/" && maybeEnd) {
        state.tokenize = tokenBase;
        break;
      }
      maybeEnd = (ch == "*");
    }
    return "comment";
  }

  function Context(indented, column, type, align, prev) {
    this.indented = indented;
    this.column = column;
    this.type = type;
    this.align = align;
    this.prev = prev;
  }

  // Interface
  return {
    startState: function(baseColumn) {
      return {
        tokenize: tokenHeader,
        context: new Context((baseColumn || 0) - indentUnit, 0, "top", false),
        indented: 0
      };
    },

    token: function(stream, state) {
      var ctx = state.context;

      if (stream.eatSpace()) return null;
      return (state.tokenize || tokenBase)(stream, state);
    },

    indent: function(state, textAfter) {
      if (state.tokenize != tokenBase)
        return 0;
      return 0;
    },

    blankLine: function(state) {
      // A blank line defines the end of the file header and the beginning of
      // the code body.
      if (state.tokenize == tokenHeader)
        state.tokenize = tokenBase;
    },

    electricChars: ";"
  };
});

CodeMirror.defineMIME("text/x-dylan", "dylan");
