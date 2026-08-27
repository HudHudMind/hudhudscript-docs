/**
 * ve-defs.js — HudHudScript Visual Editor Node Definitions
 * Node palette, port types, and keyword map
 */

// ── Port type colors (must match CSS .ve-port.TYPE) ──────────────────────────
const PORT_COLORS = {
  exec: '#e2e8f0', data: '#3b82f6', agent: '#7c3aed', governance: '#d97706',
  event: '#ea580c', bool: '#16a34a', string: '#db2777', number: '#0891b2',
  vector: '#8b5cf6', tensor: '#0d9488', mcp: '#dc2626', db: '#0369a1', rest: '#059669',
};

// ── SOV (Subject-Object-Verb) languages — loaded from /api/visual-editor/keywords
// Condition/keyword order is reversed: "(x > 0) if" instead of "if (x > 0)"
let SOV_LANGS = new Set(['tr','ja','ku','hi','bn','fa','ar']); // fallback, overwritten by loadKeywords()

// ── Keyword map — loaded from /api/visual-editor/keywords (single source of truth) ─
let KW = {};

async function loadKeywords() {
  try {
    const res = await fetch('/api/visual-editor/keywords');
    const data = await res.json();
    if (data.success && data.keywords) {
      KW = data.keywords;
    }
    if (data.sov_langs) {
      SOV_LANGS = new Set(data.sov_langs);
    }
  } catch (e) {
    console.warn('Keyword map yüklenemedi, English fallback kullanılıyor:', e);
  }
}

function kw(concept, lang) {
  const e = KW[concept] || {};
  return e[lang] || e['en'] || concept;
}

// ── Node Definitions ─────────────────────────────────────────────────────────
// Each entry: { type, label, icon, category, ports, props, codegen(p,lang) }

const NODE_DEFS = [
  // ── Core Syntax ────────────────────────────────────────────────────────────
  { type:'variable',  label:'Variable',  icon:'📦', cat:'Core Syntax',
    ports:{ in:[{id:'value',type:'data',label:'='}], out:[{id:'val',type:'data',label:'▶'}] },
    props:[{id:'name',label:'Name',val:'x'},{id:'value',label:'Value',val:'0'}],
    codegen:(p,L)=>`${kw('let',L)} ${p.name||'x'} = ${p.value||'0'};` },

  { type:'const',     label:'Constant',  icon:'🔒', cat:'Core Syntax',
    ports:{ in:[{id:'value',type:'data',label:'='}], out:[{id:'val',type:'data',label:'▶'}] },
    props:[{id:'name',label:'Name',val:'MAX'},{id:'value',label:'Value',val:'100'}],
    codegen:(p,L)=>`${kw('const',L)} ${p.name||'MAX'} = ${p.value||'100'};` },

  { type:'function',  label:'Def Func',  icon:'⚡', cat:'Core Syntax',
    container: true, childTypes: ['variable','const','if','while','for','c_for','return','print','print_string','array','loop','break','continue','chain','pipe','object','scalar_num','scalar_str','scalar_bool','op_add','op_sub','op_mul','op_div','op_mod','op_pow','op_eq','op_neq','op_gt','op_lt','op_gte','op_lte','op_and','op_or','op_not','op_concat'],
    ports:{ in:[{id:'exec',type:'exec',label:'▶'}], out:[{id:'exec',type:'exec',label:'▶'},{id:'ret',type:'data',label:'↩'}] },
    props:[{id:'name',label:'Name',val:'myFunc'},{id:'params',label:'Params (comma-sep)',val:''}],
    codegen:(p,L)=>{ var pl = p.paramsList ? p.paramsList.join(', ') : (p.params || ''); return `${kw('function',L)} ${p.name||'myFunc'}(${pl}) {\n}`; } },

  { type:'call',      label:'Call Func', icon:'📞', cat:'Core Syntax',
    ports:{ in:[{id:'exec',type:'exec',label:'▶'},{id:'arg0',type:'data',label:'a'},{id:'arg1',type:'data',label:'b'}], out:[{id:'exec',type:'exec',label:'▶'},{id:'ret',type:'data',label:'↩'}] },
    props:[{id:'name',label:'Function',val:'myFunc'},{id:'args',label:'Args (comma-sep)',val:''}],
    codegen:(p,L)=>`${p.name||'myFunc'}(${p.args||''})` },

  { type:'if',        label:'If / Else', icon:'🔀', cat:'Core Syntax',
    ports:{ in:[{id:'cond',type:'bool',label:'?'}], out:[{id:'then',type:'exec',label:'T'},{id:'else',type:'exec',label:'F'}] },
    props:[{id:'cond',label:'Condition',val:'x > 0'}],
    container: true, childTypes:['variable','const','if','while','for','c_for','print','print_string','return','array','break','continue','loop','op_add','op_sub','op_mul','op_div','op_mod','op_pow','op_eq','op_neq','op_gt','op_lt','op_gte','op_lte','op_and','op_or','op_not','op_concat'],
    codegen:(p,L)=>`${(SOV_LANGS.has(L)?`(${p.cond||'condition'}) ${kw('if',L)}`:`${kw('if',L)} (${p.cond||'condition'})`)} {\n    // true\n} ${kw('else',L)} {\n    // false\n}` },

  { type:'while',     label:'While',     icon:'🔁', cat:'Core Syntax',
    ports:{ in:[{id:'cond',type:'bool',label:'?'}], out:[{id:'body',type:'exec',label:'loop'}] },
    props:[{id:'cond',label:'Condition',val:'i < 10'}],
    container: true, childTypes:['variable','const','if','while','for','c_for','print','print_string','return','array','break','continue','scalar_num','scalar_str','scalar_bool','op_add','op_sub','op_mul','op_div','op_mod','op_pow','op_eq','op_neq','op_gt','op_lt','op_gte','op_lte','op_and','op_or','op_not','op_concat'],
    codegen:(p,L)=>`${(SOV_LANGS.has(L)?`(${p.cond||'condition'}) ${kw('while',L)}`:`${kw('while',L)} (${p.cond||'condition'})`)} {\n    // loop body\n}` },

  { type:'for',       label:'For Each',  icon:'🔄', cat:'Core Syntax',
    ports:{ in:[{id:'iter',type:'data',label:'in'}], out:[{id:'item',type:'data',label:'each'}] },
    props:[{id:'var',label:'Variable',val:'i'},{id:'iter',label:'Iterable',val:'items'}],
    container: true, childTypes:['variable','const','if','while','for','c_for','print','print_string','return','array','break','continue','scalar_num','scalar_str','scalar_bool','op_add','op_sub','op_mul','op_div','op_mod','op_pow','op_eq','op_neq','op_gt','op_lt','op_gte','op_lte','op_and','op_or','op_not','op_concat'],
    codegen:(p,L)=>`${kw('for',L)} (${p.var||'i'} in ${p.iter||'items'}) {\n    // body\n}` },

  { type:'c_for',     label:'For (C-style)', icon:'🔢', cat:'Core Syntax',
    ports:{ out:[{id:'idx',type:'data',label:'i'}] },
    props:[{id:'var',label:'Variable',val:'i'},{id:'start',label:'Start',val:'0'},{id:'end',label:'End',val:'10'},{id:'step',label:'Step',val:'1'}],
    container: true, childTypes:['variable','const','if','while','for','c_for','print','print_string','return','array','loop','break','continue','chain','pipe','object','scalar_num','scalar_str','scalar_bool','op_add','op_sub','op_mul','op_div','op_mod','op_pow','op_eq','op_neq','op_gt','op_lt','op_gte','op_lte','op_and','op_or','op_not','op_concat'],
    codegen:(p,L)=>`${kw('for',L)} (${p.var||'i'} = ${p.start||'0'}; ${p.var||'i'} < ${p.end||'10'}; ${p.var||'i'} += ${p.step||'1'}) {\n    // body\n}` },

  { type:'array',     label:'Array',     icon:'📋', cat:'Core Syntax',
    ports:{ out:[{id:'arr',type:'data',label:'[ ]'}] },
    props:[{id:'items',label:'Items (comma-separated)',val:'a, b, c'}],
    codegen:(p)=>`[${p.itemsList ? p.itemsList.join(', ') : (p.items||'a, b, c')}]` },

  { type:'return',    label:'Return',    icon:'↩', cat:'Core Syntax',
    ports:{ in:[{id:'val',type:'data',label:'val'}] },
    props:[{id:'val',label:'Value',val:'result'}],
    codegen:(p,L)=>`${kw('return',L)} ${p.val||'result'};` },

  { type:'print_string',label:'Print String',icon:'🖨', cat:'Core Syntax',
    ports:{ in:[{id:'msg',type:'data',label:'msg'}] },
    props:[{id:'msg',label:'Message',val:'Hello!'}],
    codegen:(p,L)=>`${kw('print',L)}("${p.msg||'Hello!'}");` },

  { type:'print',     label:'Print',     icon:'📤', cat:'Core Syntax',
    ports:{ in:[{id:'msg',type:'data',label:'msg'}] },
    props:[{id:'msg',label:'Expression',val:'x'}],
    codegen:(p,L)=>`${kw('print',L)}(${p.msg||'x'});` },

  { type:'comment',   label:'Comment',   icon:'💬', cat:'Core Syntax',
    ports:{},
    props:[{id:'text',label:'Text',val:'comment',multiline:true}],
    codegen:(p)=>`// ${p.text||'comment'}` },

  // ── Agent System ───────────────────────────────────────────────────────────
  { type:'agent',     label:'Agent',     icon:'🤖', cat:'Agent System',
    container: true, childTypes: ['action','tool','resource'],
    ports:{ in:[{id:'prov',type:'agent',label:'prov'}], out:[{id:'ref',type:'agent',label:'ref'}] },
    props:[{id:'name',label:'Name',val:'MyAgent'},{id:'model',label:'Model',val:'gpt-4'}],
    codegen:(p,L)=>`${kw('agent',L)} ${p.name||'MyAgent'}: {\n    model: "${p.model||'gpt-4'}"\n}` },

  { type:'action',    label:'Action',    icon:'⚡', cat:'Agent System',
    ports:{ in:[{id:'agent',type:'agent',label:'agent'}], out:[{id:'out',type:'data',label:'out'}] },
    props:[{id:'name',label:'Name',val:'myAction'},{id:'prompt',label:'Prompt',val:'Analyze the input'},{id:'timeout',label:'Timeout',val:'30'}],
    codegen:(p,L)=>`${kw('action',L)} ${p.name||'myAction'}: {\n    prompt: "${p.prompt||'Analyze'}"\n    timeout: ${p.timeout||30}\n}` },

  { type:'tool',      label:'Tool',      icon:'🔧', cat:'Agent System',
    ports:{ in:[{id:'agent',type:'agent',label:'agent'}], out:[{id:'result',type:'data',label:'out'}] },
    props:[{id:'name',label:'Name',val:'myTool'},{id:'ttype',label:'Type',val:'http',opts:['http','file','db','mcp']}],
    codegen:(p,L)=>`${kw('tool',L)} ${p.name||'myTool'}: {\n    type: "${p.ttype||'http'}"\n}` },

  { type:'provider',  label:'Provider',  icon:'🌐', cat:'Agent System',
    ports:{ out:[{id:'ref',type:'agent',label:'provider_ref'}] },
    props:[{id:'name',label:'Name',val:'myProvider'},{id:'model',label:'Model',val:'gpt-4'},{id:'apikey',label:'API Key',val:'$OPENAI_KEY'}],
    codegen:(p,L)=>`${kw('provider',L)} ${p.name||'myProvider'} {\n    model: "${p.model||'gpt-4'}"\n    api_key: "${p.apikey||'$KEY'}"\n}` },

  { type:'resource',  label:'Resource',  icon:'📁', cat:'Agent System',
    ports:{ out:[{id:'ref',type:'data',label:'resource_ref'}] },
    props:[{id:'name',label:'Name',val:'myResource'},{id:'rtype',label:'Type',val:'file',opts:['file','db','rest','mcp']},{id:'path',label:'Path/URL',val:'./data.json'}],
    codegen:(p,L)=>`${kw('resource',L)} ${p.name||'myResource'}: {\n    type: "${p.rtype||'file'}"\n    path: "${p.path||'./data.json'}"\n}` },

  { type:'mcp_server',label:'MCP Server',icon:'🔌', cat:'Agent System',
    ports:{ out:[{id:'ref',type:'mcp',label:'server_ref'}] },
    props:[{id:'name',label:'Name',val:'myMCP'},{id:'host',label:'Host',val:'localhost'},{id:'port',label:'Port',val:'3000'},{id:'transport',label:'Transport',val:'stdio',opts:['stdio','http','ws']}],
    codegen:(p)=>`mcp server ${p.name||'myMCP'}: {\n    host: "${p.host||'localhost'}"\n    port: ${p.port||3000}\n    transport: "${p.transport||'stdio'}"\n}` },

  { type:'rest_api',  label:'REST API',  icon:'🌍', cat:'Agent System',
    ports:{ out:[{id:'ref',type:'rest',label:'api_ref'}] },
    props:[{id:'name',label:'Name',val:'MyAPI'},{id:'url',label:'Base URL',val:'https://api.example.com'},{id:'method',label:'Method',val:'GET',opts:['GET','POST','PUT','DELETE','PATCH']},{id:'path',label:'Path',val:'/endpoint'}],
    codegen:(p,L)=>`${kw('resource',L)} ${p.name||'MyAPI'}: {\n    type: "rest"\n    url: "${p.url||'https://api.example.com'}"\n    method: "${p.method||'GET'}"\n    path: "${p.path||'/endpoint'}"\n}` },

  { type:'database',  label:'Database',  icon:'🗄', cat:'Agent System',
    ports:{ out:[{id:'ref',type:'db',label:'db_ref'}] },
    props:[{id:'name',label:'Name',val:'MyDB'},{id:'dbtype',label:'Type',val:'postgresql',opts:['postgresql','sqlite','mysql','mongodb']},{id:'conn',label:'Connection',val:'postgresql://localhost/mydb'}],
    codegen:(p,L)=>`${kw('resource',L)} ${p.name||'MyDB'}: {\n    type: "${p.dbtype||'postgresql'}"\n    connection: "${p.conn||'postgresql://localhost/mydb'}"\n}` },

  // ── Governance ─────────────────────────────────────────────────────────────
  { type:'governance',label:'Governance',icon:'⚖️', cat:'Governance',
    container: true, childTypes: ['constitution','law','council','role','protocol','swarm','community'],
    ports:{ out:[{id:'ref',type:'governance',label:'gov_ref'}] },
    props:[{id:'name',label:'Name',val:'MyGov'},{id:'gtype',label:'Type',val:'democracy',opts:['democracy','monarchy','republic','theocracy','technocracy','meritocracy','oligarchy','anarchy','parliamentary','autocracy','consensus','hybrid']}],
    codegen:(p,L)=>`${kw('governance',L)} ${p.name||'MyGov'}: ${p.gtype||'democracy'} {\n}` },

  { type:'constitution',label:'Constitution',icon:'📜', cat:'Governance',
    container: true, childTypes: ['law'],
    ports:{ in:[{id:'gov',type:'governance',label:'gov'}], out:[{id:'ref',type:'governance',label:'const_ref'}] },
    props:[{id:'name',label:'Name',val:'SystemGov'},{id:'enforcement',label:'Enforcement',val:'mandatory',opts:['mandatory','advisory','optional']}],
    codegen:(p,L)=>`${kw('constitution',L)} ${p.name||'SystemGov'}: {\n    enforcement: ${p.enforcement||'mandatory'}\n}` },

  { type:'law',       label:'Law',       icon:'⚖', cat:'Governance',
    ports:{ in:[{id:'const',type:'governance',label:'const'}], out:[{id:'ref',type:'governance',label:'law_ref'}] },
    props:[{id:'name',label:'Name',val:'DataLaw'},{id:'enforcement',label:'Enforcement',val:'mandatory',opts:['mandatory','advisory','optional']},{id:'rule',label:'Rule',val:'allow read on Resource'}],
    codegen:(p,L)=>`${kw('law',L)} ${p.name||'DataLaw'}: {\n    enforcement: ${p.enforcement||'mandatory'}\n    rule: "${p.rule||'allow read'}"\n}` },

  { type:'council',   label:'Council',   icon:'🏛', cat:'Governance',
    container: true, childTypes: ['role','agent','protocol'],
    ports:{ in:[{id:'gov',type:'governance',label:'gov'},{id:'agents',type:'agent',label:'agents'}], out:[{id:'ref',type:'agent',label:'council_ref'}] },
    props:[{id:'name',label:'Name',val:'Oversight'},{id:'model',label:'Model',val:'democracy',opts:['democracy','monarchy','consensus','meritocracy']}],
    codegen:(p,L)=>`${kw('council',L)} ${p.name||'Oversight'}: {\n    model: ${p.model||'democracy'}\n}` },

  { type:'swarm',     label:'Swarm',     icon:'🐝', cat:'Governance',
    container: true, childTypes: ['agent','action'],
    ports:{ in:[{id:'agents',type:'agent',label:'agents'}], out:[{id:'ref',type:'agent',label:'swarm_ref'}] },
    props:[{id:'name',label:'Name',val:'WorkSwarm'},{id:'exec',label:'Execution',val:'parallel',opts:['parallel','sequential','competitive','roundRobin']}],
    codegen:(p,L)=>`${kw('swarm',L)} ${p.name||'WorkSwarm'}: {\n    execution: ${p.exec||'parallel'}\n}` },

  { type:'community', label:'Community', icon:'👥', cat:'Governance',
    container: true, childTypes: ['agent','council','swarm','role'],
    ports:{ in:[{id:'members',type:'agent',label:'agents'},{id:'councils',type:'agent',label:'council'}] },
    props:[{id:'name',label:'Name',val:'LocalCommunity'},{id:'culture',label:'Culture',val:'collaborative'}],
    codegen:(p,L)=>`${kw('community',L)} ${p.name||'LocalCommunity'}: {\n    culture: "${p.culture||'collaborative'}"\n}` },

  { type:'role',      label:'Role',      icon:'🎭', cat:'Governance',
    ports:{ in:[{id:'agent',type:'agent',label:'agent'}], out:[{id:'ref',type:'governance',label:'role_ref'}] },
    props:[{id:'name',label:'Name',val:'Manager'},{id:'perms',label:'Permissions',val:'read,write'}],
    codegen:(p,L)=>`${kw('role',L)} ${p.name||'Manager'}: {\n    permissions: "${p.perms||'read,write'}"\n}` },

  { type:'protocol',  label:'Protocol',  icon:'📡', cat:'Governance',
    ports:{ in:[{id:'gov',type:'governance',label:'gov'}], out:[{id:'ref',type:'governance',label:'proto_ref'}] },
    props:[{id:'name',label:'Name',val:'MeetingProto'},{id:'exec',label:'Execution',val:'parallel',opts:['parallel','sequential','competitive','roundRobin']},{id:'timeout',label:'Timeout',val:'30'}],
    codegen:(p,L)=>`${kw('protocol',L)} ${p.name||'MeetingProto'}: {\n    execution: ${p.exec||'parallel'}\n    timeout: ${p.timeout||30}\n}` },

  // ── Flow & Orchestration ───────────────────────────────────────────────────
  { type:'parallel',  label:'Parallel',  icon:'⇉', cat:'Flow',
    ports:{ in:[{id:'in',type:'exec',label:'▶'}], out:[{id:'out1',type:'exec',label:'1'},{id:'out2',type:'exec',label:'2'}] },
    props:[],
    codegen:(p,L)=>`${kw('parallel',L)} {\n    // branch 1\n    // branch 2\n}` },

  { type:'sequential',label:'Sequential',icon:'→', cat:'Flow',
    ports:{ in:[{id:'in',type:'exec',label:'▶'}], out:[{id:'out',type:'exec',label:'▶'}] },
    props:[],
    codegen:(p,L)=>`${kw('sequential',L)} {\n    // step 1\n    // step 2\n}` },

  { type:'event',     label:'Event',     icon:'⚡', cat:'Flow',
    ports:{ out:[{id:'trigger',type:'event',label:'⚡'}] },
    props:[{id:'name',label:'Name',val:'onData'},{id:'trigger',label:'Trigger',val:'*'}],
    codegen:(p,L)=>`${kw('event',L)} ${p.name||'onData'} {\n    trigger: "${p.trigger||'*'}"\n}` },

  { type:'async',     label:'Async',     icon:'⏳', cat:'Flow',
    ports:{ in:[{id:'in',type:'exec',label:'▶'}], out:[{id:'out',type:'exec',label:'▶'}] },
    props:[],
    codegen:(p,L)=>`${kw('async',L)} {\n    // awaited operation\n}` },

  { type:'try',       label:'Try/Catch', icon:'🛡', cat:'Flow',
    ports:{ in:[{id:'in',type:'exec',label:'▶'}], out:[{id:'ok',type:'exec',label:'✓'},{id:'err',type:'exec',label:'✗'}] },
    props:[{id:'errvar',label:'Error Var',val:'err'}],
    codegen:(p,L)=>`${kw('try',L)} {\n    // try body\n} catch (${p.errvar||'err'}) {\n    // handle error\n}` },

  // ── Math / Data ────────────────────────────────────────────────────────────
  { type:'vector2d',  label:'Vector 2D', icon:'↗', cat:'Math',
    ports:{ out:[{id:'vec',type:'vector',label:'v'}] },
    props:[{id:'name',label:'Name',val:'v'},{id:'x',label:'X',val:'0.0'},{id:'y',label:'Y',val:'0.0'}],
    codegen:(p,L)=>`${kw('let',L)} ${p.name||'v'} = [${p.x||0}, ${p.y||0}];` },

  { type:'vector3d',  label:'Vector 3D', icon:'↗', cat:'Math',
    ports:{ out:[{id:'vec',type:'vector',label:'v'}] },
    props:[{id:'name',label:'Name',val:'v'},{id:'x',label:'X',val:'0.0'},{id:'y',label:'Y',val:'0.0'},{id:'z',label:'Z',val:'0.0'}],
    codegen:(p,L)=>`${kw('let',L)} ${p.name||'v'} = [${p.x||0}, ${p.y||0}, ${p.z||0}];` },

  { type:'tensor',    label:'Tensor',    icon:'🧮', cat:'Math',
    ports:{ out:[{id:'t',type:'tensor',label:'T'}] },
    props:[{id:'name',label:'Name',val:'t'},{id:'shape',label:'Shape',val:'[3,3]'},{id:'dtype',label:'DType',val:'f32',opts:['f32','f64','i32','i64']}],
    codegen:(p,L)=>`// tensor not yet available in linalg\n${kw('let',L)} ${p.name||'t'} = [];` },

  { type:'vector4d',  label:'Vector 4D', icon:'↗', cat:'Math',
    ports:{ out:[{id:'vec',type:'vector',label:'v'}] },
    props:[{id:'name',label:'Name',val:'v'},{id:'x',label:'X',val:'0.0'},{id:'y',label:'Y',val:'0.0'},{id:'z',label:'Z',val:'0.0'},{id:'w',label:'W',val:'0.0'}],
    codegen:(p,L)=>`${kw('let',L)} ${p.name||'v'} = [${p.x||0}, ${p.y||0}, ${p.z||0}, ${p.w||0}];` },

  { type:'vec_break', label:'Break Vector', icon:'💔', cat:'Math',
    ports:{ in:[{id:'vec',type:'vector',label:'V'}], out:[{id:'x',type:'data',label:'X'},{id:'y',type:'data',label:'Y'},{id:'z',type:'data',label:'Z'},{id:'w',type:'data',label:'W'}] },
    props:[{id:'dim',label:'Dimension',type:'select',opts:['2D','3D','4D'],val:'2D'}],
    codegen:(p)=>{ var d=p.dim||'2D'; var v=p.vec||'v'; if(d==='2D')return v+'[0], '+v+'[1]'; if(d==='3D')return v+'[0], '+v+'[1], '+v+'[2]'; return v+'[0], '+v+'[1], '+v+'[2], '+v+'[3]'; } },

  { type:'vec_make',  label:'Make Vector', icon:'💚', cat:'Math',
    ports:{ in:[{id:'x',type:'data',label:'X'},{id:'y',type:'data',label:'Y'},{id:'z',type:'data',label:'Z'},{id:'w',type:'data',label:'W'}], out:[{id:'vec',type:'vector',label:'V'}] },
    props:[{id:'dim',label:'Dimension',type:'select',opts:['2D','3D','4D'],val:'2D'}],
    codegen:(p)=>{ var d=p.dim||'2D'; if(d==='2D')return '['+(p.x||'0')+', '+(p.y||'0')+']'; if(d==='3D')return '['+(p.x||'0')+', '+(p.y||'0')+', '+(p.z||'0')+']'; return '['+(p.x||'0')+', '+(p.y||'0')+', '+(p.z||'0')+', '+(p.w||'0')+']'; } },

  // ── Scalar Values (literal constants, not variables) ────────────────────
  { type:'scalar_num', label:'Number',   icon:'🔢', cat:'Math',
    ports:{ out:[{id:'val',type:'data',label:'N'}] },
    props:[{id:'value',label:'Value',val:'0'}],
    codegen:(p)=>`${p.value||'0'}` },

  { type:'scalar_str', label:'String',   icon:'📝', cat:'Math',
    ports:{ out:[{id:'val',type:'data',label:'S'}] },
    props:[{id:'value',label:'Value',val:'hello'}],
    codegen:(p)=>`"${p.value||'hello'}"` },

  { type:'scalar_bool',label:'Boolean',  icon:'✅', cat:'Math',
    ports:{ out:[{id:'val',type:'bool',label:'B'}] },
    props:[{id:'value',label:'Value',type:'select',opts:['true','false'],val:'true'}],
    codegen:(p)=>`${p.value||'true'}` },

  // ── Operators (Blueprint-style: 2 inputs → 1 output) ────────────────────
  { type:'op_add',    label:'Add (+)',     icon:'➕', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'data',label:'A + B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'0')} + ${(p.b||'0')})` },

  { type:'op_sub',    label:'Subtract (−)', icon:'➖', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'data',label:'A − B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'0')} - ${(p.b||'0')})` },

  { type:'op_mul',    label:'Multiply (×)', icon:'✖', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'data',label:'A × B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'1')} * ${(p.b||'1')})` },

  { type:'op_div',    label:'Divide (÷)', icon:'➗', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'data',label:'A ÷ B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'0')} / ${(p.b||'1')})` },

  { type:'op_mod',    label:'Modulo (%)', icon:'🔢', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'data',label:'A % B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'0')} % ${(p.b||'1')})` },

  { type:'op_pow',    label:'Power (^)', icon:'📈', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'data',label:'A ^ B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'0')} ** ${(p.b||'1')})` },

  { type:'op_eq',     label:'Equal (==)', icon:'🟰', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'bool',label:'A == B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'0')} == ${(p.b||'0')})` },

  { type:'op_neq',    label:'Not Equal (!=)', icon:'≠', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'bool',label:'A != B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'0')} != ${(p.b||'0')})` },

  { type:'op_gt',     label:'Greater (>)', icon:'▶', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'bool',label:'A > B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'0')} > ${(p.b||'0')})` },

  { type:'op_lt',     label:'Less (<)', icon:'◀', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'bool',label:'A < B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'0')} < ${(p.b||'0')})` },

  { type:'op_gte',    label:'Greater/Equal (>=)', icon:'⏩', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'bool',label:'A >= B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'0')} >= ${(p.b||'0')})` },

  { type:'op_lte',    label:'Less/Equal (<=)', icon:'⏪', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'bool',label:'A <= B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'0')} <= ${(p.b||'0')})` },

  { type:'op_and',    label:'AND (&&)', icon:'🔗', cat:'Operators',
    ports:{ in:[{id:'a',type:'bool',label:'A'},{id:'b',type:'bool',label:'B'}], out:[{id:'out',type:'bool',label:'A && B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'true')} && ${(p.b||'true')})` },

  { type:'op_or',     label:'OR (||)', icon:'🔀', cat:'Operators',
    ports:{ in:[{id:'a',type:'bool',label:'A'},{id:'b',type:'bool',label:'B'}], out:[{id:'out',type:'bool',label:'A || B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'false')} || ${(p.b||'false')})` },

  { type:'op_not',    label:'NOT (!)', icon:'🚫', cat:'Operators',
    ports:{ in:[{id:'a',type:'bool',label:'A'}], out:[{id:'out',type:'bool',label:'!A'}] },
    props:[{id:'a',label:'A',val:'false'}], codegen:(p)=>`!(${p.a||'false'})` },

  { type:'op_concat', label:'Concat', icon:'📎', cat:'Operators',
    ports:{ in:[{id:'a',type:'data',label:'A'},{id:'b',type:'data',label:'B'}], out:[{id:'out',type:'data',label:'A + B'}] },
    props:[{id:'a',label:'A',val:'0'},{id:'b',label:'B',val:'0'}], codegen:(p)=>`(${(p.a||'""')} + ${(p.b||'""')})` },

  // ── SOP (Subject-Oriented Programming) ────────────────────────────────────
  { type:'subject',   label:'Subject',   icon:'🧑', cat:'SOP',
    ports:{ out:[{id:'data',type:'data',label:'▶'},{id:'ref',type:'agent',label:'ref'}] },
    props:[{id:'name',label:'Name',val:'Player'},{id:'roles',label:'Roles',val:'user'},{id:'state',label:'State',val:'{}'}],
    codegen:(p,L)=>`subject ${p.name||'Player'} {\n    roles: [${p.roles||'user'}]\n    state: ${p.state||'{}'}\n}` },

  { type:'relation',  label:'Relation',  icon:'🔗', cat:'SOP',
    ports:{ in:[{id:'subA',type:'agent',label:'A'},{id:'subB',type:'agent',label:'B'}], out:[{id:'ref',type:'data',label:'rel'}] },
    props:[{id:'subjectA',label:'Subject A',val:'Alice'},{id:'subjectB',label:'Subject B',val:'Bob'},{id:'rtype',label:'Relation',val:'knows',opts:['knows','owns','manages','trusts','blocks']}],
    codegen:(p,L)=>`relation ${p.subjectA||'Alice'} -[${p.rtype||'knows'}]-> ${p.subjectB||'Bob'};` },

  { type:'effect',    label:'Effect',    icon:'💥', cat:'SOP',
    ports:{ in:[{id:'trigger',type:'event',label:'⚡'}], out:[{id:'exec',type:'exec',label:'▶'}] },
    props:[{id:'event_name',label:'Event Name',val:'onAction'}],
    codegen:(p,L)=>`effect ${p.event_name||'onAction'} {\n    // statements\n}` },

  { type:'spawn',     label:'Spawn',     icon:'🌱', cat:'SOP',
    ports:{ in:[{id:'exec',type:'exec',label:'▶'}], out:[{id:'ref',type:'agent',label:'new'}] },
    props:[{id:'subject_name',label:'Subject',val:'Worker'}],
    codegen:(p,L)=>`spawn ${p.subject_name||'Worker'};` },

  // ── RAG (Retrieval-Augmented Generation) ──────────────────────────────────
  { type:'store',     label:'Store',     icon:'🗃', cat:'RAG',
    ports:{ out:[{id:'ref',type:'data',label:'ref'}] },
    props:[{id:'name',label:'Name',val:'knowledge'},{id:'backend',label:'Backend',val:'faiss',opts:['faiss','pinecone','weaviate','qdrant','chroma','milvus']},{id:'dimensions',label:'Dimensions',val:'1536'},{id:'distance',label:'Distance',val:'cosine',opts:['cosine','euclidean','dot_product']}],
    codegen:(p,L)=>`store ${p.name||'knowledge'} {\n    backend: "${p.backend||'faiss'}"\n    dimensions: ${p.dimensions||1536}\n    distance: "${p.distance||'cosine'}"\n}` },

  { type:'remember',  label:'Remember',  icon:'📝', cat:'RAG',
    ports:{ in:[{id:'content',type:'data',label:'data'},{id:'store',type:'data',label:'db'}], out:[{id:'id',type:'data',label:'id'}] },
    props:[{id:'content',label:'Content',val:''},{id:'store_name',label:'Store',val:'knowledge'}],
    codegen:(p,L)=>`remember("${p.content||''}", store: ${p.store_name||'knowledge'});` },

  { type:'recall',    label:'Recall',    icon:'🔎', cat:'RAG',
    ports:{ in:[{id:'query',type:'data',label:'q'},{id:'store',type:'data',label:'db'}], out:[{id:'results',type:'data',label:'res'}] },
    props:[{id:'query',label:'Query',val:''},{id:'store_name',label:'Store',val:'knowledge'},{id:'top_k',label:'Top K',val:'5'}],
    codegen:(p,L)=>`${kw('let',L)} results = recall("${p.query||''}", store: ${p.store_name||'knowledge'}, top_k: ${p.top_k||5});` },

  { type:'forget',    label:'Forget',    icon:'🧹', cat:'RAG',
    ports:{ in:[{id:'target',type:'data',label:'id'},{id:'store',type:'data',label:'db'}], out:[{id:'ok',type:'bool',label:'✓'}] },
    props:[{id:'target',label:'Target',val:''},{id:'store_name',label:'Store',val:'knowledge'}],
    codegen:(p,L)=>`forget("${p.target||''}", store: ${p.store_name||'knowledge'});` },

  // ── Loop Engineering ──────────────────────────────────────────────────────
  { type:'loop',      label:'Loop',      icon:'🔁', cat:'Loop Engineering',
    ports:{ out:[{id:'body',type:'exec',label:'loop'}] },
    props:[{id:'label',label:'Label',val:'main_loop'},{id:'cond',label:'Condition',val:'true'}],
    container: true, childTypes:['variable','const','if','while','for','c_for','print','print_string','return','array','break','continue','chain','pipe','object','scalar_num','scalar_str','scalar_bool','op_add','op_sub','op_mul','op_div','op_mod','op_pow','op_eq','op_neq','op_gt','op_lt','op_gte','op_lte','op_and','op_or','op_not','op_concat'],
    codegen:(p,L)=>`${kw('loop',L)} ${p.label||'main'} (${p.cond||'true'}) {\n    // loop body\n}` },

  { type:'break',     label:'Break',     icon:'⏹', cat:'Loop Engineering',
    ports:{ in:[{id:'exec',type:'exec',label:'▶'}] },
    props:[{id:'label',label:'Loop Label',val:'main_loop'}],
    codegen:(p,L)=>`${kw('break',L)} ${p.label||''};` },

  { type:'continue',  label:'Continue',  icon:'⏭', cat:'Loop Engineering',
    ports:{ in:[{id:'exec',type:'exec',label:'▶'}] },
    props:[{id:'label',label:'Loop Label',val:'main_loop'}],
    codegen:(p,L)=>`${kw('continue',L)} ${p.label||''};` },

  // ── Chain / Pipeline ─────────────────────────────────────────────────────
  { type:'chain',     label:'Chain',     icon:'🔗', cat:'Chain',
    ports:{ in:[{id:'input',type:'data',label:'in'}], out:[{id:'output',type:'data',label:'out'}] },
    props:[{id:'name',label:'Name',val:'pipeline'},{id:'steps',label:'Steps (comma-sep)',val:'step1, step2, step3'}],
    container: true, childTypes:['variable','print','print_string','return','array'],
    codegen:(p,L)=>`${kw('chain',L)} ${p.name||'pipeline'} {\n    steps: [${p.steps||'step1, step2'}]\n}` },

  { type:'pipe',      label:'Pipe',      icon:'⏐', cat:'Chain',
    ports:{ in:[{id:'data',type:'data',label:'▶'},{id:'fn',type:'data',label:'fn'}], out:[{id:'result',type:'data',label:'▶'}] },
    props:[{id:'data',label:'Data',val:'input'},{id:'fn',label:'Function',val:'transform'}],
    codegen:(p,L)=>`${p.data||'input'} |> ${p.fn||'transform'};` },

  // ── SOP Extended ─────────────────────────────────────────────────────────
  { type:'message',   label:'Message',   icon:'💬', cat:'SOP',
    ports:{ in:[{id:'from',type:'agent',label:'←'},{id:'to',type:'agent',label:'→'}], out:[{id:'msg',type:'data',label:'msg'}] },
    props:[{id:'from',label:'From',val:'Alice'},{id:'to',label:'To',val:'Bob'},{id:'body',label:'Body',val:'Hello!'}],
    codegen:(p,L)=>`${kw('send',L)} "${p.body||'Hello!'}" ${kw('from',L)} ${p.from||'Alice'} ${kw('to',L)} ${p.to||'Bob'};` },

  { type:'observer',  label:'Observer',  icon:'👁', cat:'SOP',
    ports:{ in:[{id:'subject',type:'agent',label:'subj'},{id:'event',type:'event',label:'event'}], out:[{id:'exec',type:'exec',label:'▶'}] },
    props:[{id:'subject',label:'Subject',val:'Player'},{id:'event',label:'Event',val:'onChange'}],
    codegen:(p,L)=>`${kw('observe',L)} ${p.subject||'Player'}.${p.event||'onChange'} {\n    // handler\n}` },

  // ── OOP (Object-Oriented Programming) ────────────────────────────────────
  { type:'class',     label:'Class',     icon:'🏛', cat:'OOP',
    ports:{ out:[{id:'ref',type:'data',label:'ref'}] },
    props:[{id:'name',label:'Name',val:'MyClass'},{id:'extends',label:'Extends',val:''}],
    container: true, childTypes:['field','method','constructor'],
    codegen:(p,L)=>{ const ext = p.extends ? ` ${kw('extends',L)} ${p.extends}` : ''; return `${kw('class',L)} ${p.name||'MyClass'}${ext} {\n    // body\n}`; } },

  { type:'constructor',label:'Constructor',icon:'🏗', cat:'OOP',
    ports:{ out:[{id:'exec',type:'exec',label:'▶'}] },
    props:[{id:'name',label:'Name',val:'MyClass'},{id:'params',label:'Parameters',val:'x, y'}],
    container: true, childTypes:['variable','print','print_string','return','array'],
    codegen:(p,L)=>`${kw('constructor',L)} ${p.name||'MyClass'}(${p.params||''}) {\n    // init\n}` },

  { type:'field',     label:'Field',     icon:'📌', cat:'OOP',
    ports:{ out:[{id:'val',type:'data',label:'val'}] },
    props:[{id:'name',label:'Name',val:'field'},{id:'type',label:'Type',val:'string',opts:['string','number','bool','array','object','any']},{id:'value',label:'Default',val:''}],
    codegen:(p,L)=>`${kw('let',L)} ${p.name||'field'}: ${p.type||'string'}${p.value ? ' = '+p.value : ''};` },

  { type:'method',    label:'Method',    icon:'⚙', cat:'OOP',
    ports:{ in:[{id:'self',type:'data',label:'self'}], out:[{id:'result',type:'data',label:'↩'},{id:'exec',type:'exec',label:'▶'}] },
    props:[{id:'name',label:'Name',val:'doSomething'},{id:'params',label:'Params',val:''},{id:'returnType',label:'Return',val:'void'}],
    container: true, childTypes:['variable','if','while','for','c_for','print','return','array'],
    codegen:(p,L)=>`${kw('method',L)} ${p.name||'method'}(${p.params||''}): ${p.returnType||'void'} {\n    // body\n}` },

  { type:'object',    label:'Object',    icon:'📦', cat:'OOP',
    ports:{ out:[{id:'ref',type:'data',label:'ref'}] },
    props:[{id:'name',label:'Variable',val:'obj'},{id:'class',label:'Class',val:'MyClass'},{id:'args',label:'Args',val:''}],
    codegen:(p,L)=>`${kw('let',L)} ${p.name||'obj'} = ${kw('new',L)} ${p.class||'MyClass'}(${p.args||''});` },

  { type:'interface', label:'Interface', icon:'📜', cat:'OOP',
    ports:{ out:[{id:'ref',type:'data',label:'ref'}] },
    props:[{id:'name',label:'Name',val:'MyInterface'},{id:'methods',label:'Methods (comma-sep)',val:'doA, doB'}],
    container: true, childTypes:['method'],
    codegen:(p,L)=>`${kw('interface',L)} ${p.name||'MyInterface'} {\n    // methods: ${p.methods||'doA, doB'}\n}` },
];

// Build lookup map
const NODE_DEF_MAP = {};
NODE_DEFS.forEach(d => { NODE_DEF_MAP[d.type] = d; });

// ── Palette categories ────────────────────────────────────────────────────────
const PALETTE_CATS = ['Core Syntax', 'Agent System', 'Governance', 'Flow', 'Loop Engineering', 'Chain', 'Operators', 'Math', 'SOP', 'OOP', 'RAG'];

// ── Example graphs ────────────────────────────────────────────────────────────
const EXAMPLES = {
  hello: {
    nodes: {
      n1: { id:'n1', type:'variable', x:100, y:100, props:{name:'greeting', value:'"Hello, World!"'} },
      n2: { id:'n2', type:'print', x:100, y:220, props:{msg:'greeting'} },
    },
    wires: [{ from:'n1', fromPort:'val', to:'n2', toPort:'msg' }]
  },
  variables: {
    nodes: {
      n1: { id:'n1', type:'variable', x:80, y:80, props:{name:'x', value:'42'} },
      n2: { id:'n2', type:'const', x:80, y:200, props:{name:'PI', value:'3.14159'} },
      n3: { id:'n3', type:'print', x:80, y:320, props:{msg:'x'} },
    },
    wires: []
  },
  agent: {
    nodes: {
      n1: { id:'n1', type:'provider', x:60, y:80, props:{name:'openai', model:'gpt-4', apikey:'$OPENAI_KEY'} },
      n2: { id:'n2', type:'agent', x:320, y:80, props:{name:'Analyst', model:'gpt-4'} },
      n3: { id:'n3', type:'action', x:320, y:260, props:{name:'analyze', prompt:'Analyze the data', timeout:'30'} },
    },
    wires: [{ from:'n1', fromPort:'ref', to:'n2', toPort:'prov' }]
  },
  governance: {
    nodes: {
      n1: { id:'n1', type:'governance', x:60, y:80, props:{name:'DemoGov', gtype:'democracy'} },
      n2: { id:'n2', type:'constitution', x:320, y:80, props:{name:'SystemConst', enforcement:'mandatory'} },
      n3: { id:'n3', type:'law', x:320, y:260, props:{name:'DataLaw', enforcement:'mandatory', rule:'allow read on Resource'} },
      n4: { id:'n4', type:'council', x:600, y:80, props:{name:'Oversight', model:'democracy'} },
    },
    wires: [
      { from:'n1', fromPort:'ref', to:'n2', toPort:'gov' },
      { from:'n2', fromPort:'ref', to:'n3', toPort:'const' },
      { from:'n1', fromPort:'ref', to:'n4', toPort:'gov' },
    ]
  },
  multi_agent: {
    nodes: {
      n1: { id:'n1', type:'provider', x:60, y:80, props:{name:'gpt4', model:'gpt-4', apikey:'$KEY'} },
      n2: { id:'n2', type:'agent', x:300, y:60, props:{name:'Researcher', model:'gpt-4'} },
      n3: { id:'n3', type:'agent', x:300, y:200, props:{name:'Writer', model:'gpt-4'} },
      n4: { id:'n4', type:'swarm', x:560, y:130, props:{name:'ResearchSwarm', exec:'parallel'} },
    },
    wires: [
      { from:'n1', fromPort:'ref', to:'n2', toPort:'prov' },
      { from:'n1', fromPort:'ref', to:'n3', toPort:'prov' },
      { from:'n2', fromPort:'ref', to:'n4', toPort:'agents' },
      { from:'n3', fromPort:'ref', to:'n4', toPort:'agents' },
    ]
  },

  // ── Operators ─────────────────────────────────────────────────────────────
  operators: {
    nodes: {
      n1: { id:'n1', type:'variable', x:50, y:50, props:{name:'a', value:'10'} },
      n2: { id:'n2', type:'variable', x:50, y:180, props:{name:'b', value:'5'} },
      n3: { id:'n3', type:'variable', x:50, y:310, props:{name:'result', value:'0'} },
      n4: { id:'n4', type:'op_add', x:280, y:120, props:{} },
      n5: { id:'n5', type:'op_mul', x:280, y:280, props:{} },
      n6: { id:'n6', type:'print', x:520, y:120, props:{msg:'result'} },
      n7: { id:'n7', type:'print_string', x:520, y:280, props:{msg:'Done!'} },
    },
    wires: [
      { from:'n1', fromPort:'val', to:'n4', toPort:'a' },
      { from:'n2', fromPort:'val', to:'n4', toPort:'b' },
      { from:'n4', fromPort:'out', to:'n3', toPort:'value' },
      { from:'n1', fromPort:'val', to:'n5', toPort:'a' },
      { from:'n2', fromPort:'val', to:'n5', toPort:'b' },
      { from:'n3', fromPort:'val', to:'n6', toPort:'msg' },
    ]
  },

  // ── OOP ───────────────────────────────────────────────────────────────────
  oop_basics: {
    nodes: {
      n1: { id:'n1', type:'class', x:60, y:60, props:{name:'Calculator', extends:''} },
      n2: { id:'n2', type:'field', x:60, y:220, props:{name:'value', type:'number', value:'0'} },
      n3: { id:'n3', type:'method', x:340, y:60, props:{name:'add', params:'x, y', returnType:'number'} },
      n4: { id:'n4', type:'method', x:340, y:240, props:{name:'reset', params:'', returnType:'void'} },
      n5: { id:'n5', type:'object', x:620, y:140, props:{name:'calc', class:'Calculator', args:''} },
    },
    wires: [
      { from:'n2', fromPort:'val', to:'n3', toPort:'self' },
      { from:'n2', fromPort:'val', to:'n4', toPort:'self' },
    ]
  },

  // ── SOP ───────────────────────────────────────────────────────────────────
  sop_messaging: {
    nodes: {
      n1: { id:'n1', type:'subject', x:50, y:50, props:{name:'Alice', roles:'user', state:'{}'} },
      n2: { id:'n2', type:'subject', x:50, y:220, props:{name:'Bob', roles:'admin', state:'{}'} },
      n3: { id:'n3', type:'message', x:340, y:50, props:{from:'Alice', to:'Bob', body:'Hello Bob!'} },
      n4: { id:'n4', type:'relation', x:340, y:220, props:{subjectA:'Alice', subjectB:'Bob', rtype:'knows'} },
      n5: { id:'n5', type:'observer', x:600, y:130, props:{subject:'Bob', event:'onMessage'} },
    },
    wires: [
      { from:'n1', fromPort:'ref', to:'n3', toPort:'from' },
      { from:'n2', fromPort:'ref', to:'n3', toPort:'to' },
      { from:'n1', fromPort:'ref', to:'n4', toPort:'subA' },
      { from:'n2', fromPort:'ref', to:'n4', toPort:'subB' },
      { from:'n2', fromPort:'ref', to:'n5', toPort:'subject' },
    ]
  },

  // ── Loops ─────────────────────────────────────────────────────────────────
  loop_engineering: {
    nodes: {
      n1: { id:'n1', type:'c_for', x:50, y:50, props:{var:'i', start:'0', end:'5', step:'1'} },
      n2: { id:'n2', type:'variable', x:50, y:240, props:{name:'sum', value:'0'} },
      n3: { id:'n3', type:'op_add', x:300, y:140, props:{} },
      n4: { id:'n4', type:'print', x:540, y:50, props:{msg:'i'} },
      n5: { id:'n5', type:'print', x:540, y:220, props:{msg:'sum'} },
    },
    wires: [
      { from:'n1', fromPort:'idx', to:'n4', toPort:'msg' },
      { from:'n1', fromPort:'idx', to:'n3', toPort:'a' },
      { from:'n2', fromPort:'val', to:'n3', toPort:'b' },
      { from:'n2', fromPort:'val', to:'n5', toPort:'msg' },
    ]
  },

  // ── Array ─────────────────────────────────────────────────────────────────
  array_demo: {
    nodes: {
      n1: { id:'n1', type:'array', x:50, y:80, props:{items:'red, green, blue', itemsList:['red','green','blue']} },
      n2: { id:'n2', type:'for', x:280, y:80, props:{var:'color', iter:'colors'} },
      n3: { id:'n3', type:'print', x:540, y:80, props:{msg:'color'} },
    },
    wires: [
      { from:'n1', fromPort:'arr', to:'n2', toPort:'iter' },
      { from:'n2', fromPort:'item', to:'n3', toPort:'msg' },
    ]
  },

  // ── Chain ─────────────────────────────────────────────────────────────────
  chain_pipeline: {
    nodes: {
      n1: { id:'n1', type:'chain', x:50, y:60, props:{name:'dataPipeline', steps:'fetch, validate, transform, store'} },
      n2: { id:'n2', type:'pipe', x:340, y:40, props:{data:'raw', fn:'fetch'} },
      n3: { id:'n3', type:'pipe', x:340, y:160, props:{data:'fetched', fn:'validate'} },
      n4: { id:'n4', type:'pipe', x:340, y:280, props:{data:'validated', fn:'transform'} },
      n5: { id:'n5', type:'print_string', x:600, y:160, props:{msg:'Pipeline complete!'} },
    },
    wires: [
      { from:'n2', fromPort:'result', to:'n3', toPort:'data' },
      { from:'n3', fromPort:'result', to:'n4', toPort:'data' },
    ]
  },

  // ── Conditions ────────────────────────────────────────────────────────────
  conditions: {
    nodes: {
      n1: { id:'n1', type:'variable', x:50, y:50, props:{name:'score', value:'85'} },
      n2: { id:'n2', type:'variable', x:50, y:180, props:{name:'threshold', value:'70'} },
      n3: { id:'n3', type:'op_gt', x:280, y:115, props:{} },
      n4: { id:'n4', type:'if', x:510, y:50, props:{cond:'score > threshold'} },
      n5: { id:'n5', type:'print_string', x:510, y:240, props:{msg:'Passed!'} },
      n6: { id:'n6', type:'print_string', x:510, y:360, props:{msg:'Failed!'} },
    },
    wires: [
      { from:'n1', fromPort:'val', to:'n3', toPort:'a' },
      { from:'n2', fromPort:'val', to:'n3', toPort:'b' },
    ]
  },

  // ── Function ──────────────────────────────────────────────────────────────
  function_demo: {
    nodes: {
      n1: { id:'n1', type:'function', x:80, y:40, props:{name:'add', params:'a, b'}, children:['n2','n3','n4'] },
      n2: { id:'n2', type:'op_add', x:120, y:120, props:{a:'a', b:'b'}, parentId:'n1' },
      n3: { id:'n3', type:'variable', x:120, y:240, props:{name:'result', value:'0'}, parentId:'n1' },
      n4: { id:'n4', type:'return', x:120, y:360, props:{val:'result'}, parentId:'n1' },
    },
    wires: [
      { from:'n2', fromPort:'out', to:'n3', toPort:'value' },
      { from:'n3', fromPort:'val', to:'n4', toPort:'val' },
    ]
  },

  // ── Quick stubs for existing dropdown entries ────────────────────────────
  loops: {
    nodes: {
      n1: { id:'n1', type:'c_for', x:60, y:60, props:{var:'i', start:'0', end:'10', step:'1'} },
      n2: { id:'n2', type:'print', x:300, y:60, props:{msg:'i'} },
    },
    wires: [{ from:'n1', fromPort:'idx', to:'n2', toPort:'msg' }]
  },
  functions: {
    nodes: {
      n1: { id:'n1', type:'function', x:60, y:60, props:{name:'greet', params:'name'}, children:['n2'] },
      n2: { id:'n2', type:'print_string', x:80, y:160, props:{msg:'Hello from function!'}, parentId:'n1' },
    },
    wires: []
  },
  mcp_agent: {
    nodes: {
      n1: { id:'n1', type:'mcp_server', x:60, y:60, props:{name:'myMCP', host:'localhost', port:'3000', transport:'stdio'} },
      n2: { id:'n2', type:'agent', x:340, y:60, props:{name:'MCPAgent', model:'gpt-4'} },
    },
    wires: [{ from:'n1', fromPort:'ref', to:'n2', toPort:'prov' }]
  },
  rest_agent: {
    nodes: {
      n1: { id:'n1', type:'rest_api', x:60, y:60, props:{name:'MyAPI', url:'https://api.example.com', method:'GET', path:'/endpoint'} },
      n2: { id:'n2', type:'agent', x:340, y:60, props:{name:'RestAgent', model:'gpt-4'} },
    },
    wires: [{ from:'n1', fromPort:'ref', to:'n2', toPort:'prov' }]
  },
  db_agent: {
    nodes: {
      n1: { id:'n1', type:'database', x:60, y:60, props:{name:'MyDB', dbtype:'postgresql', conn:'postgresql://localhost/mydb'} },
      n2: { id:'n2', type:'agent', x:340, y:60, props:{name:'DBAgent', model:'gpt-4'} },
    },
    wires: [{ from:'n1', fromPort:'ref', to:'n2', toPort:'prov' }]
  },
  council_vote: {
    nodes: {
      n1: { id:'n1', type:'governance', x:60, y:60, props:{name:'VoteGov', gtype:'democracy'} },
      n2: { id:'n2', type:'council', x:320, y:60, props:{name:'VotingCouncil', model:'democracy'} },
      n3: { id:'n3', type:'role', x:580, y:60, props:{name:'Voter', perms:'vote'} },
    },
    wires: [
      { from:'n1', fromPort:'ref', to:'n2', toPort:'gov' },
      { from:'n2', fromPort:'ref', to:'n3', toPort:'gov' },
    ]
  },
  law_enforcement: {
    nodes: {
      n1: { id:'n1', type:'constitution', x:60, y:60, props:{name:'LegalConst', enforcement:'mandatory'} },
      n2: { id:'n2', type:'law', x:340, y:60, props:{name:'PrivacyLaw', enforcement:'mandatory', rule:'deny read on UserData'} },
    },
    wires: [{ from:'n1', fromPort:'ref', to:'n2', toPort:'const' }]
  },
  package: {
    nodes: {
      n1: { id:'n1', type:'function', x:60, y:60, props:{name:'utilFunc', params:'x'} },
      n2: { id:'n2', type:'const', x:60, y:240, props:{name:'VERSION', value:'"1.0.0"'} },
    },
    wires: []
  },
  code_org: {
    nodes: {
      n1: { id:'n1', type:'function', x:60, y:60, props:{name:'init', params:''} },
      n2: { id:'n2', type:'function', x:60, y:240, props:{name:'main', params:''} },
    },
    wires: []
  },
  vector_math: {
    nodes: {
      n1: { id:'n1', type:'vector2d', x:60, y:60, props:{name:'v1', x:'1.0', y:'2.0'} },
      n2: { id:'n2', type:'vector2d', x:60, y:220, props:{name:'v2', x:'3.0', y:'4.0'} },
      n3: { id:'n3', type:'op_add', x:300, y:140, props:{} },
      n4: { id:'n4', type:'vec_break', x:520, y:60, props:{dim:'2D'} },
      n5: { id:'n5', type:'print', x:750, y:60, props:{msg:'x'} },
      n6: { id:'n6', type:'print', x:750, y:160, props:{msg:'y'} },
    },
    wires: [
      { from:'n1', fromPort:'vec', to:'n3', toPort:'a' },
      { from:'n2', fromPort:'vec', to:'n3', toPort:'b' },
      { from:'n3', fromPort:'out', to:'n4', toPort:'vec' },
      { from:'n4', fromPort:'x', to:'n5', toPort:'msg' },
      { from:'n4', fromPort:'y', to:'n6', toPort:'msg' },
    ]
  },
  tensor_ops: {
    nodes: {
      n1: { id:'n1', type:'tensor', x:60, y:60, props:{name:'t1', shape:'[2,2]', dtype:'f32'} },
      n2: { id:'n2', type:'tensor', x:60, y:240, props:{name:'t2', shape:'[2,2]', dtype:'f32'} },
    },
    wires: []
  },
  async_flow: {
    nodes: {
      n1: { id:'n1', type:'async', x:60, y:60, props:{} },
      n2: { id:'n2', type:'print_string', x:60, y:220, props:{msg:'Async done!'} },
    },
    wires: []
  },
  event_system: {
    nodes: {
      n1: { id:'n1', type:'event', x:60, y:60, props:{name:'onData', trigger:'*'} },
      n2: { id:'n2', type:'effect', x:340, y:60, props:{event_name:'onData'} },
      n3: { id:'n3', type:'print_string', x:600, y:60, props:{msg:'Event fired!'} },
    },
    wires: [
      { from:'n1', fromPort:'trigger', to:'n2', toPort:'trigger' },
    ]
  },
};
