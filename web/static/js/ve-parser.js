/**
 * ve-parser.js — HudHudScript Code → Visual Editor Graph Parser
 * Parses HudHudScript source code (any supported language) and converts
 * it into a node graph structure compatible with visual-editor.js importGraph().
 *
 * Uses the KW map from ve-defs.js to support multi-language parsing.
 */
(function() {
'use strict';

// ── Reverse Keyword Map ─────────────────────────────────────────────────────
// Build a map: keyword_string → concept  (e.g. "tanım" → "let", "eğer" → "if")
// Populated on first use from the global KW object defined in ve-defs.js.
let _reverseKW = null;

function getReverseKW() {
  if (_reverseKW) return _reverseKW;
  _reverseKW = {};
  if (typeof KW === 'undefined') return _reverseKW;
  Object.keys(KW).forEach(concept => {
    const entry = KW[concept];
    Object.values(entry).forEach(keyword => {
      if (keyword) _reverseKW[keyword] = concept;
    });
  });
  // Also add non-KW structural keywords that appear in codegen
  ['subject', 'relation', 'effect', 'spawn', 'store', 'remember', 'recall',
   'forget', 'mcp', 'server'].forEach(k => {
    if (!_reverseKW[k]) _reverseKW[k] = k;
  });
  return _reverseKW;
}

// ── Tokenizer ───────────────────────────────────────────────────────────────
// Splits source code into tokens for easier parsing.

function tokenize(source) {
  const tokens = [];
  let i = 0;
  const len = source.length;

  while (i < len) {
    // Skip whitespace (but track newlines)
    if (/\s/.test(source[i])) {
      if (source[i] === '\n') {
        tokens.push({ type: 'newline', value: '\n', pos: i });
      }
      i++;
      continue;
    }

    // Single-line comment
    if (source[i] === '/' && source[i + 1] === '/') {
      let start = i;
      i += 2;
      while (i < len && source[i] !== '\n') i++;
      tokens.push({ type: 'comment', value: source.slice(start + 2, i).trim(), pos: start });
      continue;
    }

    // Multi-line comment
    if (source[i] === '/' && source[i + 1] === '*') {
      let start = i;
      i += 2;
      while (i < len - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++;
      if (i < len - 1) i += 2;
      tokens.push({ type: 'comment', value: source.slice(start + 2, i - 2).trim(), pos: start });
      continue;
    }

    // String literals
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      let start = i;
      i++;
      while (i < len && source[i] !== quote) {
        if (source[i] === '\\') i++; // skip escaped char
        i++;
      }
      if (i < len) i++; // skip closing quote
      tokens.push({ type: 'string', value: source.slice(start + 1, i - 1), pos: start });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(source[i]) || (source[i] === '-' && i + 1 < len && /[0-9]/.test(source[i + 1]))) {
      let start = i;
      if (source[i] === '-') i++;
      while (i < len && /[0-9.]/.test(source[i])) i++;
      tokens.push({ type: 'number', value: source.slice(start, i), pos: start });
      continue;
    }

    // Punctuation / operators
    if ('{}()[];:,=<>!+-*/&|.'.includes(source[i])) {
      // Handle multi-char operators
      const two = source.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '&&', '||', '->'].includes(two)) {
        tokens.push({ type: 'punct', value: two, pos: i });
        i += 2;
        continue;
      }
      tokens.push({ type: 'punct', value: source[i], pos: i });
      i++;
      continue;
    }

    // Identifiers / keywords (supports Unicode for multi-language keywords)
    if (/[\w\u0080-\uffff]/.test(source[i])) {
      let start = i;
      while (i < len && /[\w\u0080-\uffff]/.test(source[i])) i++;
      const word = source.slice(start, i);
      // Check if it's a known keyword (in any language)
      const rkw = getReverseKW();
      const concept = rkw[word];
      if (concept) {
        tokens.push({ type: 'keyword', value: word, concept, pos: start });
      } else {
        tokens.push({ type: 'ident', value: word, pos: start });
      }
      continue;
    }

    // Multi-word keywords: some languages have space-separated keywords
    // (e.g. "không thì" for else in Vietnamese, "ji bo" for for in Kurdish)
    // We handle these by checking 2-word combos
    // Skip unknown characters
    i++;
  }

  return tokens;
}

// ── Parser ──────────────────────────────────────────────────────────────────
// Parses token stream into a list of parsed statements (AST-lite).

function Parser(tokens) {
  let pos = 0;

  function peek() { return tokens[pos] || null; }
  function advance() { return tokens[pos++] || null; }
  function skipNewlines() {
    while (pos < tokens.length && tokens[pos].type === 'newline') pos++;
  }

  // Read until we hit a matching closing brace, tracking depth
  function readBlock() {
    let depth = 0;
    const blockTokens = [];
    if (peek() && peek().value === '{') {
      advance(); // skip opening {
      depth = 1;
    }
    while (pos < tokens.length && depth > 0) {
      const t = advance();
      if (t.value === '{') depth++;
      else if (t.value === '}') { depth--; if (depth === 0) break; }
      blockTokens.push(t);
    }
    return blockTokens;
  }

  // Read tokens until semicolon or newline (for simple statements)
  function readUntilEnd() {
    const result = [];
    while (pos < tokens.length) {
      const t = peek();
      if (!t || t.type === 'newline' || t.value === ';') {
        if (t && t.value === ';') advance();
        break;
      }
      result.push(advance());
    }
    return result;
  }

  // Extract key-value properties from a block (e.g. { model: "gpt-4", timeout: 30 })
  function parseBlockProps(blockTokens) {
    const props = {};
    let i = 0;
    while (i < blockTokens.length) {
      // skip newlines
      if (blockTokens[i].type === 'newline') { i++; continue; }
      // Look for key: value patterns
      if ((blockTokens[i].type === 'ident' || blockTokens[i].type === 'keyword') &&
          i + 1 < blockTokens.length && blockTokens[i + 1].value === ':') {
        const key = blockTokens[i].value;
        i += 2; // skip key and colon
        // Collect value tokens until newline, comma, or end
        const valueParts = [];
        while (i < blockTokens.length && blockTokens[i].type !== 'newline' &&
               blockTokens[i].value !== ',') {
          valueParts.push(blockTokens[i].value);
          i++;
        }
        props[key] = valueParts.join(' ').replace(/^"|"$/g, '');
        if (i < blockTokens.length && blockTokens[i].value === ',') i++;
      } else {
        i++;
      }
    }
    return props;
  }

  // Collect remaining expression tokens as a string
  function tokensToString(toks) {
    return toks.map(t => {
      if (t.type === 'string') return '"' + t.value + '"';
      return t.value;
    }).join(' ').trim();
  }

  // ── Statement Parsers ───────────────────────────────────────────────────

  function parseStatement() {
    skipNewlines();
    if (pos >= tokens.length) return null;

    const t = peek();
    if (!t) return null;

    // Comments
    if (t.type === 'comment') {
      advance();
      return { nodeType: 'comment', props: { text: t.value } };
    }

    // Keyword-based statements
    if (t.type === 'keyword') {
      return parseKeywordStatement();
    }

    // Identifier-based: could be function call like print("hello") or remember(...)
    if (t.type === 'ident') {
      return parseIdentStatement();
    }

    // Skip unknown tokens
    advance();
    return null;
  }

  function parseKeywordStatement() {
    const t = peek();
    const concept = t.concept;

    switch (concept) {
      case 'let': return parseVariable(false);
      case 'const': return parseVariable(true);
      case 'function': return parseFunction();
      case 'if': return parseIf();
      case 'while': return parseWhile();
      case 'for': return parseFor();
      case 'return': return parseReturn();
      case 'print': return parsePrint();
      case 'agent': return parseBlockDecl('agent');
      case 'task': return parseBlockDecl('task');
      case 'tool': return parseBlockDecl('tool');
      case 'provider': return parseBlockDecl('provider');
      case 'resource': return parseBlockDecl('resource');
      case 'constitution': return parseBlockDecl('constitution');
      case 'law': return parseBlockDecl('law');
      case 'council': return parseBlockDecl('council');
      case 'swarm': return parseBlockDecl('swarm');
      case 'community': return parseBlockDecl('community');
      case 'role': return parseBlockDecl('role');
      case 'parallel': return parseFlowBlock('parallel');
      case 'sequential': return parseFlowBlock('sequential');
      case 'event': return parseBlockDecl('event');
      case 'async': return parseFlowBlock('async');
      case 'try': return parseTry();
      case 'governance': return parseBlockDecl('governance');
      case 'protocol': return parseBlockDecl('protocol');
      default:
        advance();
        return null;
    }
  }

  function parseIdentStatement() {
    const t = peek();
    const word = t.value;

    // Non-KW structural keywords
    if (word === 'subject') return parseSubject();
    if (word === 'relation') return parseRelation();
    if (word === 'effect') return parseEffect();
    if (word === 'spawn') return parseSpawn();
    if (word === 'store') return parseStore();
    if (word === 'remember') return parseCallStatement('remember');
    if (word === 'recall') return parseRecall();
    if (word === 'forget') return parseCallStatement('forget');
    if (word === 'mcp') return parseMCP();

    // Function call pattern: name(args)
    if (pos + 1 < tokens.length && tokens[pos + 1].value === '(') {
      // Could be a print-like call in a language we don't recognize
      const name = advance().value;
      advance(); // (
      const args = [];
      while (pos < tokens.length && peek().value !== ')') {
        args.push(advance());
      }
      if (peek() && peek().value === ')') advance();
      if (peek() && peek().value === ';') advance();
      // Try to identify as print
      const rkw = getReverseKW();
      if (rkw[name] === 'print') {
        const msg = args.length > 0 ? tokensToString(args).replace(/^"|"$/g, '') : 'Hello!';
        return { nodeType: 'print', props: { msg } };
      }
      // Generic function call — create a custom function node
      return { nodeType: 'custom_function', props: { name, body: name + '(' + tokensToString(args) + ')' } };
    }

    // Unknown identifier — skip
    advance();
    return null;
  }

  // let x = 42;  /  const PI = 3.14;
  function parseVariable(isConst) {
    advance(); // skip let/const keyword
    skipNewlines();
    const nameToken = advance(); // variable name
    const name = nameToken ? nameToken.value : 'x';
    skipNewlines();

    let value = '0';
    if (peek() && peek().value === '=') {
      advance(); // skip =
      skipNewlines();
      const valTokens = readUntilEnd();
      value = tokensToString(valTokens) || '0';
    } else {
      readUntilEnd(); // consume rest of line
    }

    return {
      nodeType: isConst ? 'const' : 'variable',
      props: { name, value }
    };
  }

  // function myFunc(a, b) { ... }
  function parseFunction() {
    advance(); // skip function keyword
    skipNewlines();
    const nameToken = advance();
    const name = nameToken ? nameToken.value : 'myFunc';

    let params = '';
    if (peek() && peek().value === '(') {
      advance(); // skip (
      const paramTokens = [];
      while (pos < tokens.length && peek().value !== ')') {
        paramTokens.push(advance());
      }
      if (peek() && peek().value === ')') advance();
      params = paramTokens.map(t => t.value).filter(v => v !== ',').join(', ');
    }

    // Read body block if present
    skipNewlines();
    if (peek() && peek().value === '{') {
      readBlock(); // consume body (we don't recursively parse for now)
    }

    return { nodeType: 'function', props: { name, params } };
  }

  // if (condition) { ... } else { ... }
  function parseIf() {
    advance(); // skip if keyword
    skipNewlines();

    let cond = 'condition';
    if (peek() && peek().value === '(') {
      advance(); // skip (
      const condTokens = [];
      let depth = 1;
      while (pos < tokens.length && depth > 0) {
        const ct = advance();
        if (ct.value === '(') depth++;
        else if (ct.value === ')') { depth--; if (depth === 0) break; }
        condTokens.push(ct);
      }
      cond = tokensToString(condTokens) || 'condition';
    }

    skipNewlines();
    if (peek() && peek().value === '{') readBlock();

    // Check for else
    skipNewlines();
    if (peek() && peek().type === 'keyword' && peek().concept === 'else') {
      advance(); // skip else
      skipNewlines();
      if (peek() && peek().value === '{') readBlock();
    }

    return { nodeType: 'if', props: { cond } };
  }

  // while (condition) { ... }
  function parseWhile() {
    advance(); // skip while keyword
    skipNewlines();

    let cond = 'i < 10';
    if (peek() && peek().value === '(') {
      advance();
      const condTokens = [];
      let depth = 1;
      while (pos < tokens.length && depth > 0) {
        const ct = advance();
        if (ct.value === '(') depth++;
        else if (ct.value === ')') { depth--; if (depth === 0) break; }
        condTokens.push(ct);
      }
      cond = tokensToString(condTokens) || 'i < 10';
    }

    skipNewlines();
    if (peek() && peek().value === '{') readBlock();

    return { nodeType: 'while', props: { cond } };
  }

  // for (i in items) { ... }
  function parseFor() {
    advance(); // skip for keyword
    skipNewlines();

    let varName = 'i', iter = 'items';
    if (peek() && peek().value === '(') {
      advance(); // skip (
      const forTokens = [];
      let depth = 1;
      while (pos < tokens.length && depth > 0) {
        const ct = advance();
        if (ct.value === '(') depth++;
        else if (ct.value === ')') { depth--; if (depth === 0) break; }
        forTokens.push(ct);
      }
      // Parse "var in iterable"
      const inIdx = forTokens.findIndex(t => t.value === 'in');
      if (inIdx >= 0) {
        varName = forTokens.slice(0, inIdx).map(t => t.value).join(' ').trim() || 'i';
        iter = forTokens.slice(inIdx + 1).map(t => t.value).join(' ').trim() || 'items';
      } else if (forTokens.length > 0) {
        varName = forTokens[0].value;
      }
    }

    skipNewlines();
    if (peek() && peek().value === '{') readBlock();

    return { nodeType: 'for', props: { var: varName, iter } };
  }

  // return value;
  function parseReturn() {
    advance(); // skip return keyword
    skipNewlines();
    const valTokens = readUntilEnd();
    const val = tokensToString(valTokens) || 'result';
    return { nodeType: 'return', props: { val } };
  }

  // print("Hello!");
  function parsePrint() {
    advance(); // skip print keyword
    skipNewlines();

    let msg = 'Hello!';
    if (peek() && peek().value === '(') {
      advance(); // skip (
      const argTokens = [];
      let depth = 1;
      while (pos < tokens.length && depth > 0) {
        const ct = advance();
        if (ct.value === '(') depth++;
        else if (ct.value === ')') { depth--; if (depth === 0) break; }
        argTokens.push(ct);
      }
      msg = argTokens.length > 0 ? tokensToString(argTokens).replace(/^"|"$/g, '') : 'Hello!';
    }
    if (peek() && peek().value === ';') advance();

    return { nodeType: 'print', props: { msg } };
  }

  // Generic block declaration: agent MyAgent: { ... }  or  agent MyAgent { ... }
  function parseBlockDecl(concept) {
    advance(); // skip keyword
    skipNewlines();

    const nameToken = advance();
    const name = nameToken ? nameToken.value : concept;

    // Skip optional colon
    skipNewlines();
    if (peek() && peek().value === ':') advance();
    skipNewlines();

    let blockProps = {};
    if (peek() && peek().value === '{') {
      const blockTokens = readBlock();
      blockProps = parseBlockProps(blockTokens);
    } else {
      // Single-line declaration
      const rest = readUntilEnd();
      if (rest.length > 0) {
        blockProps = { value: tokensToString(rest) };
      }
    }

    // Map concept → node type and extract known properties
    return mapBlockToNode(concept, name, blockProps);
  }

  function mapBlockToNode(concept, name, blockProps) {
    switch (concept) {
      case 'agent':
        return { nodeType: 'agent', props: { name, model: blockProps.model || 'gpt-4' } };
      case 'task':
        return { nodeType: 'task', props: {
          name,
          prompt: blockProps.prompt || 'Analyze the input',
          timeout: blockProps.timeout || '30'
        }};
      case 'tool':
        return { nodeType: 'tool', props: { name, ttype: blockProps.type || 'http' } };
      case 'provider':
        return { nodeType: 'provider', props: {
          name,
          model: blockProps.model || 'gpt-4',
          apikey: blockProps.api_key || '$KEY'
        }};
      case 'resource': {
        const rtype = blockProps.type || 'file';
        if (rtype === 'rest') {
          return { nodeType: 'rest_api', props: {
            name,
            url: blockProps.url || 'https://api.example.com',
            method: blockProps.method || 'GET',
            path: blockProps.path || '/endpoint'
          }};
        }
        if (['postgresql', 'sqlite', 'mysql', 'mongodb'].includes(rtype)) {
          return { nodeType: 'database', props: {
            name,
            dbtype: rtype,
            conn: blockProps.connection || ''
          }};
        }
        return { nodeType: 'resource', props: {
          name,
          rtype,
          path: blockProps.path || './data.json'
        }};
      }
      case 'constitution':
        return { nodeType: 'constitution', props: { name, enforcement: blockProps.enforcement || 'mandatory' } };
      case 'law':
        return { nodeType: 'law', props: {
          name,
          enforcement: blockProps.enforcement || 'mandatory',
          rule: blockProps.rule || 'allow read on Resource'
        }};
      case 'council':
        return { nodeType: 'council', props: { name, model: blockProps.model || 'democracy' } };
      case 'swarm':
        return { nodeType: 'swarm', props: { name, exec: blockProps.execution || 'parallel' } };
      case 'community':
        return { nodeType: 'community', props: { name, culture: blockProps.culture || 'collaborative' } };
      case 'role':
        return { nodeType: 'role', props: { name, perms: blockProps.permissions || 'read,write' } };
      case 'event':
        return { nodeType: 'event', props: { name, trigger: blockProps.trigger || '*' } };
      case 'governance':
        return { nodeType: 'governance', props: { name, gtype: blockProps.value || 'democracy' } };
      case 'protocol':
        return { nodeType: 'protocol', props: {
          name,
          exec: blockProps.execution || 'parallel',
          timeout: blockProps.timeout || '30'
        }};
      default:
        return { nodeType: concept, props: { name } };
    }
  }

  // parallel { ... }  /  sequential { ... }  /  async { ... }
  function parseFlowBlock(concept) {
    advance(); // skip keyword
    skipNewlines();
    if (peek() && peek().value === '{') readBlock();
    return { nodeType: concept, props: {} };
  }

  // try { ... } catch (err) { ... }
  function parseTry() {
    advance(); // skip try keyword
    skipNewlines();
    if (peek() && peek().value === '{') readBlock();

    let errvar = 'err';
    // Check for catch
    skipNewlines();
    if (peek() && peek().value === 'catch') {
      advance();
      if (peek() && peek().value === '(') {
        advance();
        if (peek()) errvar = advance().value;
        if (peek() && peek().value === ')') advance();
      }
      skipNewlines();
      if (peek() && peek().value === '{') readBlock();
    }
    // Check for finally
    skipNewlines();
    if (peek() && peek().value === 'finally') {
      advance();
      skipNewlines();
      if (peek() && peek().value === '{') readBlock();
    }

    return { nodeType: 'try', props: { errvar } };
  }

  // subject Player { roles: [user], state: {} }
  function parseSubject() {
    advance(); // skip 'subject'
    skipNewlines();
    const nameToken = advance();
    const name = nameToken ? nameToken.value : 'Player';
    skipNewlines();
    let blockProps = {};
    if (peek() && peek().value === '{') {
      const blockTokens = readBlock();
      blockProps = parseBlockProps(blockTokens);
    }
    return { nodeType: 'subject', props: {
      name,
      roles: blockProps.roles || 'user',
      state: blockProps.state || '{}'
    }};
  }

  // relation Alice -[knows]-> Bob;
  function parseRelation() {
    advance(); // skip 'relation'
    skipNewlines();
    const rest = readUntilEnd();
    // Parse: SubjectA -[type]-> SubjectB
    const str = tokensToString(rest);
    const match = str.match(/^(\w+)\s*-\[(\w+)\]->\s*(\w+)/);
    if (match) {
      return { nodeType: 'relation', props: { subjectA: match[1], rtype: match[2], subjectB: match[3] } };
    }
    return { nodeType: 'relation', props: { subjectA: 'Alice', rtype: 'knows', subjectB: 'Bob' } };
  }

  // effect onAction { ... }
  function parseEffect() {
    advance(); // skip 'effect'
    skipNewlines();
    const nameToken = advance();
    const name = nameToken ? nameToken.value : 'onAction';
    skipNewlines();
    if (peek() && peek().value === '{') readBlock();
    return { nodeType: 'effect', props: { event_name: name } };
  }

  // spawn Worker;
  function parseSpawn() {
    advance(); // skip 'spawn'
    skipNewlines();
    const rest = readUntilEnd();
    const name = rest.length > 0 ? rest[0].value : 'Worker';
    return { nodeType: 'spawn', props: { subject_name: name } };
  }

  // store knowledge { backend: "faiss", dimensions: 1536, distance: "cosine" }
  function parseStore() {
    advance(); // skip 'store'
    skipNewlines();
    const nameToken = advance();
    const name = nameToken ? nameToken.value : 'knowledge';
    skipNewlines();
    let blockProps = {};
    if (peek() && peek().value === '{') {
      const blockTokens = readBlock();
      blockProps = parseBlockProps(blockTokens);
    }
    return { nodeType: 'store', props: {
      name,
      backend: blockProps.backend || 'faiss',
      dimensions: blockProps.dimensions || '1536',
      distance: blockProps.distance || 'cosine'
    }};
  }

  // remember("content", store: knowledge);  or  forget("target", store: knowledge);
  function parseCallStatement(concept) {
    advance(); // skip keyword
    skipNewlines();
    let content = '';
    let storeName = 'knowledge';

    if (peek() && peek().value === '(') {
      advance(); // skip (
      const argTokens = [];
      let depth = 1;
      while (pos < tokens.length && depth > 0) {
        const ct = advance();
        if (ct.value === '(') depth++;
        else if (ct.value === ')') { depth--; if (depth === 0) break; }
        argTokens.push(ct);
      }
      if (peek() && peek().value === ';') advance();

      // Parse arguments: first string is content/target, store: name is store
      argTokens.forEach((at, idx) => {
        if (at.type === 'string' && !content) {
          content = at.value;
        }
        if (at.value === 'store' && idx + 1 < argTokens.length && argTokens[idx + 1].value === ':') {
          if (idx + 2 < argTokens.length) storeName = argTokens[idx + 2].value;
        }
      });
    }

    if (concept === 'remember') {
      return { nodeType: 'remember', props: { content, store_name: storeName } };
    } else {
      return { nodeType: 'forget', props: { target: content, store_name: storeName } };
    }
  }

  // let results = recall("query", store: knowledge, top_k: 5);
  function parseRecall() {
    advance(); // skip 'recall'
    skipNewlines();
    let query = '';
    let storeName = 'knowledge';
    let topK = '5';

    if (peek() && peek().value === '(') {
      advance();
      const argTokens = [];
      let depth = 1;
      while (pos < tokens.length && depth > 0) {
        const ct = advance();
        if (ct.value === '(') depth++;
        else if (ct.value === ')') { depth--; if (depth === 0) break; }
        argTokens.push(ct);
      }
      if (peek() && peek().value === ';') advance();

      argTokens.forEach((at, idx) => {
        if (at.type === 'string' && !query) query = at.value;
        if (at.value === 'store' && idx + 1 < argTokens.length && argTokens[idx + 1].value === ':') {
          if (idx + 2 < argTokens.length) storeName = argTokens[idx + 2].value;
        }
        if (at.value === 'top_k' && idx + 1 < argTokens.length && argTokens[idx + 1].value === ':') {
          if (idx + 2 < argTokens.length) topK = argTokens[idx + 2].value;
        }
      });
    }

    return { nodeType: 'recall', props: { query, store_name: storeName, top_k: topK } };
  }

  // mcp server MyMCP: { host: "localhost", port: 3000, transport: "stdio" }
  // mcp tool read_file from myMCP
  function parseMCP() {
    advance(); // skip 'mcp'
    skipNewlines();

    if (peek() && peek().value === 'server') {
      advance(); // skip 'server'
      skipNewlines();
      const nameToken = advance();
      const name = nameToken ? nameToken.value : 'myMCP';
      if (peek() && peek().value === ':') advance();
      skipNewlines();
      let blockProps = {};
      if (peek() && peek().value === '{') {
        const blockTokens = readBlock();
        blockProps = parseBlockProps(blockTokens);
      }
      return { nodeType: 'mcp_server', props: {
        name,
        host: blockProps.host || 'localhost',
        port: blockProps.port || '3000',
        transport: blockProps.transport || 'stdio'
      }};
    }

    if (peek() && peek().value === 'tool') {
      advance(); // skip 'tool'
      skipNewlines();
      const nameToken = advance();
      const name = nameToken ? nameToken.value : 'read_file';
      let server = 'myMCP';
      skipNewlines();
      if (peek() && peek().value === 'from') {
        advance();
        skipNewlines();
        if (peek()) server = advance().value;
      }
      readUntilEnd();
      return { nodeType: 'mcp_tool', props: { name, server } };
    }

    readUntilEnd();
    return null;
  }

  // ── Main Parse Loop ─────────────────────────────────────────────────────

  function parse() {
    const statements = [];
    while (pos < tokens.length) {
      const stmt = parseStatement();
      if (stmt) statements.push(stmt);
    }
    return statements;
  }

  return { parse };
}

// ── Graph Builder ───────────────────────────────────────────────────────────
// Converts parsed statements to a visual editor graph structure.

function buildGraph(statements) {
  const nodes = {};
  const wires = [];
  let nodeCounter = 0;

  // Layout constants
  const COL_WIDTH = 240;
  const ROW_HEIGHT = 140;
  const NODES_PER_COL = 6;
  const START_X = 80;
  const START_Y = 80;

  statements.forEach((stmt, idx) => {
    const id = 'n' + (++nodeCounter);

    // Calculate grid position
    const col = Math.floor(idx / NODES_PER_COL);
    const row = idx % NODES_PER_COL;
    const x = START_X + col * COL_WIDTH;
    const y = START_Y + row * ROW_HEIGHT;

    nodes[id] = {
      id,
      type: stmt.nodeType,
      x,
      y,
      props: stmt.props || {},
      collapsed: false
    };
  });

  return { nodes, wires, nodeCounter, wireCounter: 0 };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse HudHudScript source code and return a graph structure
 * compatible with visual-editor.js importGraph().
 *
 * @param {string} source - HudHudScript source code (any supported language)
 * @returns {{ nodes: Object, wires: Array, nodeCounter: number, wireCounter: number }}
 */
function parseHudHudScript(source) {
  if (!source || typeof source !== 'string') {
    return { nodes: {}, wires: [], nodeCounter: 0, wireCounter: 0 };
  }

  const tokens = tokenize(source);
  const parser = Parser(tokens);
  const statements = parser.parse();
  return buildGraph(statements);
}

/**
 * Import code into the visual editor.
 * Parses the source and calls VE's importGraph.
 *
 * @param {string} source - HudHudScript source code
 */
function importFromCode(source) {
  const graph = parseHudHudScript(source);

  if (Object.keys(graph.nodes).length === 0) {
    if (typeof VE !== 'undefined' && VE._log) {
      VE._log('No parseable statements found in code', 'warning');
    }
    return graph;
  }

  // Use VE's importGraph if available
  if (typeof VE !== 'undefined' && typeof VE.importGraph === 'function') {
    VE.importGraph(graph);
  }

  return graph;
}

/**
 * Show the "Import from Code" modal dialog.
 */
function showImportCodeDialog() {
  // Remove existing dialog if any
  let existing = document.getElementById('ve-import-code-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 've-import-code-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;';

  const dialog = document.createElement('div');
  dialog.style.cssText = 'background:#1a1b2e;border:1px solid #0f3460;border-radius:8px;padding:20px;width:600px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

  dialog.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <h3 style="margin:0;color:#e2e8f0;font-size:14px;">📥 Import from Code</h3>
      <button id="ve-import-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:2px 6px;" title="Close">&times;</button>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:11px;">Paste HudHudScript code below. Supports all languages (English, Turkish, Arabic, etc.). The parser will detect keywords automatically and create visual nodes.</p>
    <textarea id="ve-import-code-input" spellcheck="false"
      style="width:100%;height:300px;background:#0d1117;color:#e2e8f0;border:1px solid #1e293b;border-radius:4px;padding:10px;font-family:'Fira Code',monospace;font-size:12px;resize:vertical;box-sizing:border-box;tab-size:4;outline:none;"
      placeholder="// Paste HudHudScript code here...
let x = 42;
function myFunc(a, b) {
    // ...
}
agent MyAgent: {
    model: &quot;gpt-4&quot;
}
print(&quot;Hello!&quot;);"></textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button id="ve-import-cancel" style="padding:6px 14px;background:#334155;color:#e2e8f0;border:1px solid #475569;border-radius:4px;cursor:pointer;font-size:12px;">Cancel</button>
      <button id="ve-import-append" style="padding:6px 14px;background:#1e40af;color:#e2e8f0;border:1px solid #2563eb;border-radius:4px;cursor:pointer;font-size:12px;" title="Add parsed nodes to existing graph">+ Append</button>
      <button id="ve-import-replace" style="padding:6px 14px;background:#059669;color:#fff;border:1px solid #10b981;border-radius:4px;cursor:pointer;font-size:12px;" title="Replace current graph with parsed nodes">Import &amp; Replace</button>
    </div>
  `;

  modal.appendChild(dialog);
  document.body.appendChild(modal);

  // Event handlers
  const closeModal = () => modal.remove();

  document.getElementById('ve-import-close').addEventListener('click', closeModal);
  document.getElementById('ve-import-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.getElementById('ve-import-replace').addEventListener('click', () => {
    const code = document.getElementById('ve-import-code-input').value;
    const graph = parseHudHudScript(code);
    if (Object.keys(graph.nodes).length === 0) {
      alert('No parseable HudHudScript statements found. Make sure the code uses valid HudHudScript syntax.');
      return;
    }
    if (typeof VE !== 'undefined' && typeof VE.importGraph === 'function') {
      VE.importGraph(graph);
    }
    closeModal();
  });

  document.getElementById('ve-import-append').addEventListener('click', () => {
    const code = document.getElementById('ve-import-code-input').value;
    const graph = parseHudHudScript(code);
    if (Object.keys(graph.nodes).length === 0) {
      alert('No parseable HudHudScript statements found. Make sure the code uses valid HudHudScript syntax.');
      return;
    }
    if (typeof VE !== 'undefined' && typeof VE.appendNodes === 'function') {
      VE.appendNodes(graph);
    }
    closeModal();
  });

  // Focus the textarea
  document.getElementById('ve-import-code-input').focus();

  // Escape key to close
  const escHandler = e => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}

// ── Export ───────────────────────────────────────────────────────────────────
window.VEParser = {
  tokenize,
  parseHudHudScript,
  importFromCode,
  showImportCodeDialog,
};

})();
