/**
 * visual-editor.js — HudHudScript Visual Editor Core
 * VE global object: canvas, nodes, wires, panels, code gen
 */
(function() {
'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let nodes = {};       // { id: nodeObj }
let wires = [];       // [{ id, from, fromPort, to, toPort, type }]
let selected = new Set();
let lang = 'en';
let undoStack = [], redoStack = [];
let nodeCounter = 0;
let wireCounter = 0;

// Canvas transform
let camX = 0, camY = 0, camZ = 1.0;

// Drag state
let dragging = null;  // { nodeId, startX, startY, origX, origY }
let panning  = null;  // { startX, startY, origCamX, origCamY }
let selBox   = null;  // { startX, startY }
let wirePreview = null; // { fromId, fromPort, portType, x1,y1 }
let ctxPos   = { x:0, y:0 };
let ctxFocusIdx = -1;
let ctxItems = [];

// Tutorial
let tutStep = 0;
const TUT_STEPS = 7;

// Console
let consoleCount = 0;

// Resize handles
let resizingProps = false, resizingCode = false, resizingConsole = false;
let resizeStart = {};

// Generated code cache
let generatedCode = '';

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
let canvas, svg, canvasArea, selBoxEl;

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  canvas    = $('ve-canvas');
  svg       = $('ve-svg');
  canvasArea = $('ve-canvas-area');
  selBoxEl  = $('ve-sel-box');

  // Load keyword map from server (single source of truth) — await before first render
  if (typeof loadKeywords === 'function') await loadKeywords();

  // Read initial language from the select
  const langSel = $('lang-select');
  if (langSel) lang = langSel.value || 'en';

  buildPalette();
  buildCtxMenu();
  buildTutDots();
  bindEvents();
  loadFromStorage();
  log('Visual Editor ready', 'info');
  renderAll();
}

// ── Render All ───────────────────────────────────────────────────────────────
function renderAll() {
  applyTransform();
  Object.values(nodes).forEach(n => renderNode(n));
  renderWires();
  updateMinimap();
}

function applyTransform() {
  if (!canvas) return;
  canvas.style.transform = `translate(${camX}px, ${camY}px) scale(${camZ})`;
  canvas.style.transformOrigin = '0 0';
  // Update background grid
  if (canvasArea) {
    const size = 24 * camZ;
    const ox = camX % size;
    const oy = camY % size;
    canvasArea.style.backgroundSize = `${size}px ${size}px`;
    canvasArea.style.backgroundPosition = `${ox}px ${oy}px`;
  }
}

// ── Palette ──────────────────────────────────────────────────────────────────
function buildPalette(filter) {
  const list = $('ve-palette-list');
  if (!list) return;
  list.innerHTML = '';
  const f = (filter||'').toLowerCase();
  PALETTE_CATS.forEach(cat => {
    const items = NODE_DEFS.filter(d => d.cat === cat && (!f || d.label.toLowerCase().includes(f) || d.type.includes(f)));
    if (!items.length) return;
    const catEl = document.createElement('div');
    catEl.className = 've-palette-cat';
    catEl.textContent = cat;
    list.appendChild(catEl);
    items.forEach(def => {
      const el = document.createElement('div');
      el.className = 've-palette-item';
      el.draggable = true;
      el.innerHTML = `<span class="pi-icon">${def.icon}</span><span>${def.label}</span><span class="pi-kw">${kw(def.type, lang) !== def.type ? kw(def.type, lang) : ''}</span>`;
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('nodeType', def.type);
      });
      el.addEventListener('click', () => {
        const cx = (canvasArea.clientWidth/2 - camX) / camZ;
        const cy = (canvasArea.clientHeight/2 - camY) / camZ;
        addNode(def.type, cx - 95, cy - 40);
      });
      list.appendChild(el);
    });
  });
}

// ── Context Menu ─────────────────────────────────────────────────────────────
function buildCtxMenu(filter) {
  const list = $('ve-ctx-list');
  if (!list) return;
  list.innerHTML = '';
  ctxItems = [];
  const f = (filter||'').toLowerCase();
  PALETTE_CATS.forEach(cat => {
    const items = NODE_DEFS.filter(d => d.cat === cat && (!f || d.label.toLowerCase().includes(f) || d.type.includes(f)));
    if (!items.length) return;
    const sec = document.createElement('div');
    sec.className = 've-ctx-section';
    const catEl = document.createElement('div');
    catEl.className = 've-ctx-cat';
    catEl.textContent = cat;
    sec.appendChild(catEl);
    items.forEach(def => {
      const el = document.createElement('div');
      el.className = 've-ctx-item';
      const kwStr = kw(def.type, lang);
      el.innerHTML = `<span class="ctx-icon">${def.icon}</span><span>${def.label}</span><span class="ctx-kw">${kwStr !== def.type ? kwStr : ''}</span>`;
      el.addEventListener('click', () => {
        const wx = (ctxPos.x - canvasArea.getBoundingClientRect().left - camX) / camZ;
        const wy = (ctxPos.y - canvasArea.getBoundingClientRect().top  - camY) / camZ;
        addNode(def.type, wx - 95, wy - 40);
        hideCtxMenu();
      });
      sec.appendChild(el);
      ctxItems.push({ el, def });
    });
    list.appendChild(sec);
  });
  ctxFocusIdx = -1;
}

function showCtxMenu(x, y) {
  const menu = $('ve-ctx-menu');
  if (!menu) return;
  ctxPos = { x, y };
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'block';
  const search = $('ve-ctx-search');
  if (search) { search.value = ''; search.focus(); }
  buildCtxMenu();
  // Clamp to viewport
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
}

function hideCtxMenu() {
  const menu = $('ve-ctx-menu');
  if (menu) menu.style.display = 'none';
}

function showNodeCtxMenu(e, nodeId) {
  // Simple: select the node and show a delete option via the standard ctx menu
  if (!e.shiftKey) selected.clear();
  selected.add(nodeId);
  refreshSelection();
  showCtxMenu(e.clientX, e.clientY);
}

// ── Node Creation ─────────────────────────────────────────────────────────────
function addNode(type, x, y, overrideProps, overrideId) {
  const def = NODE_DEF_MAP[type];
  if (!def) return null;
  const id = overrideId || ('n' + (++nodeCounter));
  const props = {};
  const allowedPropIds = new Set((def.props||[]).map(p => p.id));
  (def.props||[]).forEach(p => { props[p.id] = p.val; });
  if (overrideProps) {
    Object.keys(overrideProps).forEach(k => {
      if (allowedPropIds.has(k)) props[k] = overrideProps[k];
    });
  }
  const node = { id, type, x: x||0, y: y||0, props, collapsed: false };
  if (def.container) {
    node.children = [];
    node.childrenCollapsed = false;
  }
  nodes[id] = node;
  // Auto-nest if created inside a container
  var container = findContainerAt(x + 95, y + 20, id);
  if (container && canNestIn(type, container)) {
    parentNode(id, container.id);
  }
  pushUndo();
  renderNode(node);
  renderWires();
  updateMinimap();
  return node;
}

function removeNode(id) {
  pushUndo();
  // Unparent: remove this node from any container's children list
  Object.values(nodes).forEach(n => {
    if (n.children) {
      n.children = n.children.filter(cid => cid !== id);
    }
  });
  // If this node is a container, release children (clear their parentId)
  const node = nodes[id];
  if (node && node.children) {
    node.children.forEach(cid => {
      const child = nodes[cid];
      if (child) delete child.parentId;
    });
  }
  wires = wires.filter(w => w.from !== id && w.to !== id);
  const el = document.getElementById('node-' + id);
  if (el) el.remove();
  delete nodes[id];
  selected.delete(id);
  renderWires();
  updateMinimap();
  showProps(null);
}

// ── Node Rendering ────────────────────────────────────────────────────────────
function renderNode(node) {
  let el = document.getElementById('node-' + node.id);
  if (el) el.remove();

  const def = NODE_DEF_MAP[node.type];
  if (!def) return;

  const isContainer = def.container && node.children;

  el = document.createElement('div');
  el.id = 'node-' + node.id;
  el.className = `ve-node node-${node.type}${selected.has(node.id) ? ' selected' : ''}${isContainer ? ' ve-container' : ''}`;
  el.style.left = node.x + 'px';
  el.style.top  = node.y + 'px';

  // Header
  const hdr = document.createElement('div');
  hdr.className = 've-node-header';
  const childCount = isContainer ? ` <span class="ve-child-count">(${node.children.length})</span>` : '';
  hdr.innerHTML = `<span class="node-icon">${def.icon}</span><span class="node-title">${def.label}${childCount}</span><span class="node-collapse">${node.collapsed ? '\u25B6' : '\u25BC'}</span>`;
  hdr.querySelector('.node-collapse').addEventListener('click', e => {
    e.stopPropagation();
    node.collapsed = !node.collapsed;
    renderNode(node);
    renderWires();
  });
  el.appendChild(hdr);

  // Body
  const body = document.createElement('div');
  body.className = 've-node-body' + (node.collapsed ? ' collapsed' : '');

  // Input ports — filter by dimension for vec nodes
  var inPorts = (def.ports.in || []);
  var outPorts = (def.ports.out || []);
  if (node.type === 'vec_break' || node.type === 'vec_make') {
    var dim = (node.props.dim || '2D');
    var maxPorts = dim === '2D' ? 2 : dim === '3D' ? 3 : 4;
    if (node.type === 'vec_break') outPorts = outPorts.slice(0, maxPorts);
    else inPorts = inPorts.slice(0, maxPorts);
  }

  // Render port rows
  // For function nodes, add param output ports dynamically
  var allOutPorts = outPorts.slice();
  if (node.type === 'function') {
    var pl = node.props.paramsList || [];
    if (pl.length === 0 && node.props.params) {
      pl = node.props.params.split(',').map(function(s){return s.trim();}).filter(Boolean);
      node.props.paramsList = pl;
    }
    pl.forEach(function(pname) {
      allOutPorts.push({id:'param_'+pname, type:'data', label:pname});
    });
  }
  const maxRows = Math.max(inPorts.length, allOutPorts.length);
  for (let i = 0; i < maxRows; i++) {
    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.minHeight = '22px';
    if (inPorts[i]) row.appendChild(makePort(node, inPorts[i], 'in'));
    else row.appendChild(document.createElement('div'));
    if (allOutPorts[i]) row.appendChild(makePort(node, allOutPorts[i], 'out'));
    else row.appendChild(document.createElement('div'));
    body.appendChild(row);
  }

  // Inline props (non-comment nodes)
  if (node.type !== 'comment') {
    // ── Function node: params list with + button ─────────────────────────
    if (node.type === 'function') {
      if (!node.props.paramsList) {
        var raw = (node.props.params || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
        node.props.paramsList = raw.length ? raw : [];
      }
      var plContainer = document.createElement('div');
      plContainer.style.padding = '4px 8px';
      // Name prop
      var nameRow = document.createElement('div');
      nameRow.className = 've-prop-row';
      var nameLbl = document.createElement('span');
      nameLbl.className = 've-prop-label'; nameLbl.textContent = 'Name';
      nameRow.appendChild(nameLbl);
      var nameInp = document.createElement('input');
      nameInp.className = 've-prop-input'; nameInp.value = node.props.name || 'myFunc';
      nameInp.addEventListener('input', function(){ node.props.name = nameInp.value; });
      nameInp.addEventListener('mousedown', function(e){ e.stopPropagation(); });
      nameRow.appendChild(nameInp);
      plContainer.appendChild(nameRow);
      // Params label
      var plHdr = document.createElement('div');
      plHdr.style.cssText = 'font-size:9px;color:#64748b;padding:4px 0 2px;';
      plHdr.textContent = 'Parameters';
      plContainer.appendChild(plHdr);
      // Each param
      node.props.paramsList.forEach(function(pname, idx) {
        var itemRow = document.createElement('div');
        itemRow.className = 've-prop-row';
        var lbl = document.createElement('span');
        lbl.className = 've-prop-label'; lbl.textContent = 'param';
        itemRow.appendChild(lbl);
        var inp = document.createElement('input');
        inp.className = 've-prop-input'; inp.value = pname;
        inp.addEventListener('input', function(){
          node.props.paramsList[idx] = inp.value;
          node.props.params = node.props.paramsList.join(', ');
        });
        inp.addEventListener('mousedown', function(e){ e.stopPropagation(); });
        itemRow.appendChild(inp);
        var rmBtn = document.createElement('button');
        rmBtn.textContent = '×';
        rmBtn.style.cssText = 'background:#7f1d1d;color:#fca5a5;border:none;border-radius:3px;cursor:pointer;font-size:10px;padding:0 5px;flex-shrink:0;';
        rmBtn.addEventListener('click', function(e){
          e.stopPropagation();
          node.props.paramsList.splice(idx, 1);
          node.props.params = node.props.paramsList.join(', ');
          renderNode(node); renderWires();
        });
        itemRow.appendChild(rmBtn);
        plContainer.appendChild(itemRow);
      });
      // + button
      var addRow = document.createElement('div');
      addRow.style.cssText = 'display:flex;justify-content:center;padding:2px 8px 6px;';
      var addBtn = document.createElement('button');
      addBtn.textContent = '+ Add Param';
      addBtn.style.cssText = 'background:#065f46;color:#6ee7b7;border:1px solid #047857;border-radius:4px;cursor:pointer;font-size:10px;padding:2px 10px;width:100%;';
      addBtn.addEventListener('click', function(e){
        e.stopPropagation();
        node.props.paramsList.push('p' + (node.props.paramsList.length + 1));
        node.props.params = node.props.paramsList.join(', ');
        renderNode(node); renderWires();
      });
      addRow.appendChild(addBtn);
      plContainer.appendChild(addRow);
      body.appendChild(plContainer);
    } else if (node.type === 'array') {
      if (!node.props.itemsList) {
        // Init from existing comma-separated items or default
        const raw = (node.props.items || 'a, b, c').split(',').map(s => s.trim()).filter(Boolean);
        node.props.itemsList = raw.length ? raw : [''];
      }
      const listContainer = document.createElement('div');
      listContainer.style.padding = '4px 8px';
      // Render each item row
      node.props.itemsList.forEach((item, idx) => {
        const itemRow = document.createElement('div');
        itemRow.className = 've-prop-row';
        const lbl = document.createElement('span');
        lbl.className = 've-prop-label';
        lbl.textContent = '[' + idx + ']';
        itemRow.appendChild(lbl);
        const inp = document.createElement('input');
        inp.className = 've-prop-input';
        inp.value = item;
        inp.addEventListener('input', () => {
          node.props.itemsList[idx] = inp.value;
          node.props.items = node.props.itemsList.join(', ');
        });
        inp.addEventListener('mousedown', e => e.stopPropagation());
        itemRow.appendChild(inp);
        // Remove button
        const rmBtn = document.createElement('button');
        rmBtn.textContent = '×';
        rmBtn.style.cssText = 'background:#7f1d1d;color:#fca5a5;border:none;border-radius:3px;cursor:pointer;font-size:10px;padding:0 5px;line-height:1.4;flex-shrink:0;';
        rmBtn.title = 'Remove item';
        rmBtn.addEventListener('click', e => {
          e.stopPropagation();
          node.props.itemsList.splice(idx, 1);
          if (node.props.itemsList.length === 0) node.props.itemsList.push('');
          node.props.items = node.props.itemsList.join(', ');
          renderNode(node);
        });
        itemRow.appendChild(rmBtn);
        listContainer.appendChild(itemRow);
      });
      // + Add item button
      const addRow = document.createElement('div');
      addRow.style.cssText = 'display:flex;justify-content:center;padding:2px 8px 6px;';
      const addBtn = document.createElement('button');
      addBtn.textContent = '+ Add Item';
      addBtn.style.cssText = 'background:#065f46;color:#6ee7b7;border:1px solid #047857;border-radius:4px;cursor:pointer;font-size:10px;padding:2px 10px;width:100%;';
      addBtn.addEventListener('click', e => {
        e.stopPropagation();
        node.props.itemsList.push('');
        node.props.items = node.props.itemsList.join(', ');
        renderNode(node);
      });
      addRow.appendChild(addBtn);
      listContainer.appendChild(addRow);
      body.appendChild(listContainer);
    } else {
      // Standard inline props
      // Build set of port IDs that have a wire connected
      const wiredPorts = new Set(wires.filter(w => w.to === node.id).map(w => w.toPort));
      (def.props||[]).forEach(p => {
        const row = document.createElement('div');
        row.className = 've-prop-row';
        const lbl = document.createElement('span');
        lbl.className = 've-prop-label';
        lbl.textContent = p.label;
        row.appendChild(lbl);
        // If a wire is connected to this prop's port, show locked value
        if (wiredPorts.has(p.id)) {
          const lockedVal = document.createElement('span');
          lockedVal.className = 've-prop-input';
          lockedVal.style.cssText = 'background:#1e1b4b;color:#a78bfa;font-size:10px;padding:2px 6px;border-radius:3px;display:inline-block;flex:1;cursor:default;border:1px solid #4c1d95;';
          const wire = wires.find(w => w.to === node.id && w.toPort === p.id);
          const srcNode = wire ? nodes[wire.from] : null;
          const srcName = srcNode ? (srcNode.props.name || srcNode.props.msg || srcNode.type) : 'wire';
          lockedVal.textContent = '🔒 ' + srcName;
          lockedVal.title = 'Connected via wire — disconnect to edit manually';
          row.appendChild(lockedVal);
        } else {
          let inp;
          if (p.opts) {
          inp = document.createElement('select');
          inp.className = 've-prop-select';
          p.opts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            if (node.props[p.id] === o) opt.selected = true;
            inp.appendChild(opt);
          });
        } else if (p.multiline) {
          inp = document.createElement('textarea');
          inp.className = 've-prop-input';
          inp.rows = 2;
          inp.value = node.props[p.id] || '';
        } else {
          inp = document.createElement('input');
          inp.className = 've-prop-input';
          inp.type = 'text';
          inp.value = node.props[p.id] || '';
        }
        inp.addEventListener('change', () => {
          node.props[p.id] = inp.value;
          if (p.id === 'dim' && (node.type === 'vec_break' || node.type === 'vec_make')) renderNode(node);
        });
        inp.addEventListener('input',  () => { node.props[p.id] = inp.value; });
        inp.addEventListener('mousedown', e => e.stopPropagation());
        row.appendChild(inp);
        }
        body.appendChild(row);
      });
    }
  } else {
    // Comment node body text
    const txt = document.createElement('div');
    txt.className = 've-node-body';
    txt.textContent = node.props.text || 'comment';
    txt.style.padding = '8px 10px';
    txt.style.fontSize = '11px';
    txt.style.color = '#94a3b8';
    txt.style.whiteSpace = 'pre-wrap';
    body.appendChild(txt);
  }

  // ── Container children area ────────────────────────────────────────────────
  if (isContainer) {
    const childrenArea = document.createElement('div');
    childrenArea.className = 've-container-children' + (node.childrenCollapsed ? ' collapsed' : '');

    // Children header with collapse toggle
    const chdr = document.createElement('div');
    chdr.className = 've-container-children-header';
    chdr.innerHTML = `<span class="ve-container-toggle">${node.childrenCollapsed ? '\u25B6' : '\u25BC'}</span> <span>Children</span> <span class="ve-child-badge">${node.children.length}</span>`;
    chdr.addEventListener('click', e => {
      e.stopPropagation();
      node.childrenCollapsed = !node.childrenCollapsed;
      renderNode(node);
      renderWires();
    });
    childrenArea.appendChild(chdr);

    if (!node.childrenCollapsed) {
      // Render child node summaries inside container
      const childList = document.createElement('div');
      childList.className = 've-container-child-list';
      if (node.children.length === 0) {
        const hint = document.createElement('div');
        hint.className = 've-container-hint';
        const allowedTypes = (def.childTypes || []).map(t => {
          const cd = NODE_DEF_MAP[t];
          return cd ? cd.label : t;
        }).join(', ');
        hint.textContent = 'Drop here: ' + allowedTypes;
        childList.appendChild(hint);
      } else {
        node.children.forEach(childId => {
          const childNode = nodes[childId];
          if (!childNode) return;
          const childDef = NODE_DEF_MAP[childNode.type];
          if (!childDef) return;
          const childEl = document.createElement('div');
          childEl.className = 've-container-child-item';
          childEl.innerHTML = `<span class="ve-cc-icon">${childDef.icon}</span><span class="ve-cc-label">${childDef.label}: ${escHtml(childNode.props.name || childNode.props.msg || childNode.id)}</span>`;
          // Click to select child
          childEl.addEventListener('click', e => {
            e.stopPropagation();
            if (!e.shiftKey) selected.clear();
            selected.add(childId);
            refreshSelection();
            showProps(childNode);
          });
          // Remove button
          const removeBtn = document.createElement('span');
          removeBtn.className = 've-cc-remove';
          removeBtn.textContent = '\u2715';
          removeBtn.title = 'Remove from container';
          removeBtn.addEventListener('click', e => {
            e.stopPropagation();
            unparentNode(childId, node.id);
          });
          childEl.appendChild(removeBtn);
          childList.appendChild(childEl);
        });
      }
      childrenArea.appendChild(childList);
    }

    body.appendChild(childrenArea);
  }

  el.appendChild(body);
  canvas.appendChild(el);

  // Drag
  hdr.addEventListener('mousedown', e => startNodeDrag(e, node.id));
  el.addEventListener('mousedown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.target.classList.contains('ve-port')) return;
    if (e.target.classList.contains('node-collapse')) return;
    if (e.target.classList.contains('ve-cc-remove')) return;
    e.stopPropagation();
    if (!e.shiftKey) { selected.clear(); }
    selected.add(node.id);
    refreshSelection();
    showProps(node);
  });
  el.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    showNodeCtxMenu(e, node.id);
  });
}

// ── Container helpers ──────────────────────────────────────────────────────────
function findContainerAt(x, y, excludeId) {
  let best = null;
  Object.values(nodes).forEach(n => {
    if (n.id === excludeId) return;
    const def = NODE_DEF_MAP[n.type];
    if (!def || !def.container || !n.children) return;
    const el = document.getElementById('node-' + n.id);
    if (!el) return;
    const w = el.offsetWidth;
    const h = Math.max(el.offsetHeight, 300); // containers expand downward for nesting
    if (x >= n.x && x <= n.x + w && y >= n.y && y <= n.y + h) {
      best = n;
    }
  });
  return best;
}

function canNestIn(childType, container) {
  const def = NODE_DEF_MAP[container.type];
  if (!def || !def.container) return false;
  if (def.childTypes && def.childTypes.length > 0) {
    return def.childTypes.includes(childType);
  }
  return true;
}

// Auto-nest on wire connect — tries both directions
function autoNestOnWire(fromId, toId) {
  const src = nodes[fromId], dst = nodes[toId];
  if (!src || !dst) return;
  // Try A: nest source (from) inside target (to) — e.g. variable → function input
  if (canNestIn(src.type, dst) && (!src.parentId || src.parentId !== toId)) {
    parentNode(fromId, toId);
    return;
  }
  // Try B: nest target (to) inside source (from) — e.g. print → for loop body
  if (canNestIn(dst.type, src) && (!dst.parentId || dst.parentId !== fromId)) {
    parentNode(toId, fromId);
    return;
  }
  // Try C: if target has a container parent, nest source inside that parent too
  if (dst.parentId) {
    const parentContainer = nodes[dst.parentId];
    if (parentContainer && canNestIn(src.type, parentContainer) && src.parentId !== dst.parentId) {
      parentNode(fromId, dst.parentId);
    }
  }
  // Try D: if source has a container parent, nest target inside that parent too
  if (src.parentId) {
    const parentContainer = nodes[src.parentId];
    if (parentContainer && canNestIn(dst.type, parentContainer) && dst.parentId !== src.parentId) {
      parentNode(toId, src.parentId);
    }
  }
}

function parentNode(childId, containerId) {
  const child = nodes[childId];
  const container = nodes[containerId];
  if (!child || !container || !container.children) return;
  if (childId === containerId) return;
  if (isDescendantOf(containerId, childId)) return;
  // Remove from old parent if any
  if (child.parentId && nodes[child.parentId]) {
    const oldParent = nodes[child.parentId];
    if (oldParent.children) {
      oldParent.children = oldParent.children.filter(id => id !== childId);
      renderNode(oldParent);
    }
  }
  if (!container.children.includes(childId)) {
    container.children.push(childId);
  }
  child.parentId = containerId;
  renderNode(container);
  renderWires();
  // Cascade: also nest connected nodes into the same container
  wires.forEach(function(w) {
    if (w.from === childId && nodes[w.to] && canNestIn(nodes[w.to].type, container)) {
      parentNode(w.to, containerId);
    }
    if (w.to === childId && nodes[w.from] && canNestIn(nodes[w.from].type, container)) {
      parentNode(w.from, containerId);
    }
  });
  log(`Nested ${child.type} "${child.props.name || child.id}" in ${container.type} "${container.props.name || container.id}"`, 'info');
}

function unparentNode(childId, containerId) {
  const child = nodes[childId];
  const container = nodes[containerId];
  if (!child || !container || !container.children) return;
  pushUndo();
  container.children = container.children.filter(id => id !== childId);
  delete child.parentId;
  renderNode(container);
  renderWires();
  log(`Removed ${child.type} "${child.props.name || child.id}" from container`, 'info');
}

function isDescendantOf(nodeId, potentialAncestorId) {
  const ancestor = nodes[potentialAncestorId];
  if (!ancestor || !ancestor.children) return false;
  for (const cid of ancestor.children) {
    if (cid === nodeId) return true;
    if (isDescendantOf(nodeId, cid)) return true;
  }
  return false;
}

function makePort(node, portDef, dir) {
  const row = document.createElement('div');
  row.className = `ve-port-row ${dir}`;
  const port = document.createElement('div');
  port.className = `ve-port ${portDef.type}`;
  port.dataset.nodeId = node.id;
  port.dataset.portId = portDef.id;
  port.dataset.portType = portDef.type;
  port.dataset.dir = dir;
  const lbl = document.createElement('span');
  lbl.className = 've-port-label';
  lbl.textContent = portDef.label;
  if (dir === 'in') { row.appendChild(port); row.appendChild(lbl); }
  else              { row.appendChild(lbl); row.appendChild(port); }
  port.addEventListener('mousedown', e => { e.stopPropagation(); startWireDrag(e, node.id, portDef.id, portDef.type, dir); });
  return row;
}

// ── Wire Rendering ────────────────────────────────────────────────────────────
function getPortPos(nodeId, portId, dir) {
  const el = document.getElementById('node-' + nodeId);
  if (!el) return null;
  const ports = el.querySelectorAll('.ve-port');
  for (const p of ports) {
    if (p.dataset.portId === portId && p.dataset.dir === dir) {
      const r = p.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      return { x: (r.left + r.width/2 - cr.left) / camZ, y: (r.top + r.height/2 - cr.top) / camZ };
    }
  }
  return null;
}

function renderWires() {
  // Remove old wire paths
  svg.querySelectorAll('.ve-wire').forEach(e => e.remove());
  wires.forEach(w => {
    const p1 = getPortPos(w.from, w.fromPort, 'out');
    const p2 = getPortPos(w.to,   w.toPort,   'in');
    if (!p1 || !p2) return;
    drawWirePath(w.id, p1.x, p1.y, p2.x, p2.y, w.type, false);
  });
}

function drawWirePath(id, x1, y1, x2, y2, type, preview) {
  const dx = Math.abs(x2 - x1) * 0.5 + 40;
  const d = `M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}`;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('class', preview ? 've-wire-preview' : `ve-wire ${type||'data'}`);
  if (id) path.dataset.wireId = id;
  if (!preview) {
    path.style.cursor = 'pointer';
    path.style.pointerEvents = 'stroke';
    path.addEventListener('click', () => { removeWire(id); });
  }
  svg.appendChild(path);
  return path;
}

function removeWire(id) {
  pushUndo();
  wires = wires.filter(w => w.id !== id);
  renderWires();
}

// ── Wire Drag ─────────────────────────────────────────────────────────────────
function startWireDrag(e, nodeId, portId, portType, dir) {
  e.preventDefault();
  const pos = getPortPos(nodeId, portId, dir);
  if (!pos) return;
  wirePreview = { fromId: nodeId, fromPort: portId, portType, dir, x1: pos.x, y1: pos.y };
}

function updateWirePreview(mx, my) {
  svg.querySelectorAll('.ve-wire-preview').forEach(e => e.remove());
  if (!wirePreview) return;
  const cr = canvas.getBoundingClientRect();
  const wx = (mx - cr.left) / camZ;
  const wy = (my - cr.top)  / camZ;
  if (wirePreview.dir === 'out') drawWirePath(null, wirePreview.x1, wirePreview.y1, wx, wy, wirePreview.portType, true);
  else                           drawWirePath(null, wx, wy, wirePreview.x1, wirePreview.y1, wirePreview.portType, true);
}

function finishWireDrop(mx, my) {
  if (!wirePreview) return;
  svg.querySelectorAll('.ve-wire-preview').forEach(e => e.remove());
  // Find port under cursor
  const el = document.elementFromPoint(mx, my);
  if (el && el.classList.contains('ve-port')) {
    const targetNodeId = el.dataset.nodeId;
    const targetPortId = el.dataset.portId;
    const targetDir    = el.dataset.dir;
    const targetType   = el.dataset.portType;
    if (targetNodeId !== wirePreview.fromId && targetDir !== wirePreview.dir) {
      let from, fromPort, to, toPort;
      if (wirePreview.dir === 'out') { from = wirePreview.fromId; fromPort = wirePreview.fromPort; to = targetNodeId; toPort = targetPortId; }
      else                           { from = targetNodeId; fromPort = targetPortId; to = wirePreview.fromId; toPort = wirePreview.fromPort; }
      // Remove existing wire on same input port
      wires = wires.filter(w => !(w.to === to && w.toPort === toPort));
      pushUndo();
      wires.push({ id: 'w' + (++wireCounter), from, fromPort, to, toPort, type: targetType });
      // Auto-nest: if target is a container that accepts the source type, add as child
      autoNestOnWire(from, to);
      renderWires();
    }
  }
  wirePreview = null;
}

// ── Node Drag ─────────────────────────────────────────────────────────────────
function startNodeDrag(e, nodeId) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  if (!selected.has(nodeId)) {
    if (!e.shiftKey) selected.clear();
    selected.add(nodeId);
    refreshSelection();
  }
  const node = nodes[nodeId];
  dragging = {
    nodeId,
    startX: e.clientX,
    startY: e.clientY,
    origPositions: {}
  };
  // Store original positions of all selected nodes
  selected.forEach(id => {
    const n = nodes[id];
    if (n) dragging.origPositions[id] = { x: n.x, y: n.y };
  });
}

// ── Selection ─────────────────────────────────────────────────────────────────
function refreshSelection() {
  canvas.querySelectorAll('.ve-node').forEach(el => {
    const id = el.id.replace('node-', '');
    el.classList.toggle('selected', selected.has(id));
  });
}

function selectAll() {
  Object.keys(nodes).forEach(id => selected.add(id));
  refreshSelection();
}

function deleteSelected() {
  if (selected.size === 0) return;
  pushUndo();
  const ids = [...selected];
  ids.forEach(id => {
    // Clean up container relationships
    const node = nodes[id];
    if (node) {
      // Remove from parent container
      Object.values(nodes).forEach(n => {
        if (n.children) {
          n.children = n.children.filter(cid => cid !== id);
        }
      });
      // Release children
      if (node.children) {
        node.children.forEach(cid => {
          const child = nodes[cid];
          if (child) delete child.parentId;
        });
      }
    }
    wires = wires.filter(w => w.from !== id && w.to !== id);
    const el = document.getElementById('node-' + id);
    if (el) el.remove();
    delete nodes[id];
  });
  selected.clear();
  // Re-render containers that may have had children removed
  Object.values(nodes).forEach(n => {
    if (n.children) renderNode(n);
  });
  renderWires();
  updateMinimap();
  showProps(null);
}

// ── Properties Panel ──────────────────────────────────────────────────────────
function showProps(node) {
  const body = $('ve-props-body');
  if (!body) return;
  if (!node) {
    body.innerHTML = '<div style="color:#475569;font-size:10px;padding:6px;">Select a node to edit properties.</div>';
    return;
  }
  const def = NODE_DEF_MAP[node.type];
  if (!def) return;

  body.innerHTML = '';

  // Node info
  const info = document.createElement('div');
  info.className = 'prop-group';
  info.innerHTML = `<div class="prop-group-title">Node</div>
    <div style="font-size:11px;color:#e2e8f0;padding:2px 4px;">${def.icon} ${def.label} <span style="color:#475569;font-size:9px;">(${node.id})</span></div>`;
  body.appendChild(info);

  // Properties
  if (def.props && def.props.length) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    group.innerHTML = '<div class="prop-group-title">Properties</div>';

    // ── Array node: custom item list with + button ──────────────────────
    if (node.type === 'array') {
      if (!node.props.itemsList) {
        const raw = (node.props.items || 'a, b, c').split(',').map(s => s.trim()).filter(Boolean);
        node.props.itemsList = raw.length ? raw : [''];
      }
      node.props.itemsList.forEach((item, idx) => {
        const field = document.createElement('div');
        field.className = 'prop-field';
        field.style.display = 'flex'; field.style.gap = '4px'; field.style.alignItems = 'center';
        const label = document.createElement('label');
        label.textContent = '[' + idx + ']';
        label.style.minWidth = '22px';
        field.appendChild(label);
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = item;
        inp.style.flex = '1';
        inp.style.background = '#0d1117'; inp.style.border = '1px solid #1e293b'; inp.style.borderRadius = '3px';
        inp.style.color = '#e2e8f0'; inp.style.fontSize = '10px'; inp.style.padding = '3px 6px';
        inp.addEventListener('input', () => {
          node.props.itemsList[idx] = inp.value;
          node.props.items = node.props.itemsList.join(', ');
        });
        field.appendChild(inp);
        const rmBtn = document.createElement('button');
        rmBtn.textContent = '×';
        rmBtn.style.cssText = 'background:#7f1d1d;color:#fca5a5;border:none;border-radius:3px;cursor:pointer;font-size:11px;padding:1px 6px;flex-shrink:0;';
        rmBtn.addEventListener('click', () => {
          node.props.itemsList.splice(idx, 1);
          if (node.props.itemsList.length === 0) node.props.itemsList.push('');
          node.props.items = node.props.itemsList.join(', ');
          renderNode(node); showProps(node);
        });
        field.appendChild(rmBtn);
        group.appendChild(field);
      });
      // + button
      const addField = document.createElement('div');
      addField.className = 'prop-field';
      const addBtn = document.createElement('button');
      addBtn.textContent = '+ Add Item';
      addBtn.style.cssText = 'background:#065f46;color:#6ee7b7;border:1px solid #047857;border-radius:4px;cursor:pointer;font-size:10px;padding:3px 0;width:100%;';
      addBtn.addEventListener('click', () => {
        node.props.itemsList.push('');
        node.props.items = node.props.itemsList.join(', ');
        renderNode(node); showProps(node);
      });
      addField.appendChild(addBtn);
      group.appendChild(addField);
    } else {
      // Standard props
      const wiredPorts = new Set(wires.filter(w => w.to === node.id).map(w => w.toPort));
      def.props.forEach(p => {
        const field = document.createElement('div');
        field.className = 'prop-field';
        const label = document.createElement('label');
        label.textContent = p.label;
        field.appendChild(label);
        if (wiredPorts.has(p.id)) {
          const lockedVal = document.createElement('span');
          lockedVal.style.cssText = 'display:block;background:#1e1b4b;color:#a78bfa;font-size:10px;padding:3px 6px;border-radius:3px;border:1px solid #4c1d95;cursor:default;';
          const wire = wires.find(w => w.to === node.id && w.toPort === p.id);
          const srcNode = wire ? nodes[wire.from] : null;
          const srcName = srcNode ? (srcNode.props.name || srcNode.props.msg || srcNode.type) : 'wire';
          lockedVal.textContent = '🔒 ' + srcName;
          lockedVal.title = 'Connected via wire — disconnect to edit';
          field.appendChild(lockedVal);
        } else {
          let inp;
          if (p.opts) {
            inp = document.createElement('select');
            p.opts.forEach(o => {
              const opt = document.createElement('option');
              opt.value = o; opt.textContent = o;
              if (node.props[p.id] === o) opt.selected = true;
              inp.appendChild(opt);
            });
          } else if (p.multiline) {
            inp = document.createElement('textarea');
            inp.rows = 3;
            inp.value = node.props[p.id] || '';
          } else {
            inp = document.createElement('input');
            inp.type = 'text';
            inp.value = node.props[p.id] || '';
          }
          inp.addEventListener('change', () => {
            node.props[p.id] = inp.value;
            renderNode(node);
            renderWires();
          });
          inp.addEventListener('input', () => {
            node.props[p.id] = inp.value;
          });
          field.appendChild(inp);
        }
        group.appendChild(field);
      });
    }
    body.appendChild(group);
  }

  // Position
  const posGroup = document.createElement('div');
  posGroup.className = 'prop-group';
  posGroup.innerHTML = `<div class="prop-group-title">Position</div>
    <div style="font-size:10px;color:#64748b;padding:2px 4px;">X: ${Math.round(node.x)}, Y: ${Math.round(node.y)}</div>`;
  body.appendChild(posGroup);

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 've-btn danger';
  delBtn.style.width = '100%';
  delBtn.style.marginTop = '8px';
  delBtn.textContent = 'Delete Node';
  delBtn.addEventListener('click', () => removeNode(node.id));
  body.appendChild(delBtn);
}

// ── Undo / Redo ──────────────────────────────────────────────────────────────
function getState() {
  return JSON.stringify({ nodes, wires, nodeCounter, wireCounter });
}

function setState(json) {
  const s = JSON.parse(json);
  // Clear existing DOM nodes
  canvas.querySelectorAll('.ve-node').forEach(el => el.remove());
  nodes = s.nodes || {};
  wires = s.wires || [];
  nodeCounter = s.nodeCounter || 0;
  wireCounter = s.wireCounter || 0;
  selected.clear();
  renderAll();
}

function pushUndo() {
  const state = getState();
  undoStack.push(state);
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
}

function undo() {
  if (undoStack.length === 0) { log('Nothing to undo', 'warn'); return; }
  redoStack.push(getState());
  const prev = undoStack.pop();
  setState(prev);
  log('Undo', 'info');
}

function redo() {
  if (redoStack.length === 0) { log('Nothing to redo', 'warn'); return; }
  undoStack.push(getState());
  const next = redoStack.pop();
  setState(next);
  log('Redo', 'info');
}

// ── Event Binding ────────────────────────────────────────────────────────────
function bindEvents() {
  if (!canvasArea) return;

  // Mouse move (drag nodes, pan, selection box, wire preview)
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // Canvas area events
  canvasArea.addEventListener('mousedown', onCanvasMouseDown, { passive: false });
  canvasArea.addEventListener('contextmenu', onCanvasContext);
  canvasArea.addEventListener('wheel', onWheel, { passive: false });
  canvasArea.addEventListener('auxclick', function(e) { if (e.button === 1) e.preventDefault(); });

  // Drop from palette
  canvasArea.addEventListener('dragover', e => e.preventDefault());
  canvasArea.addEventListener('drop', onDrop);

  // Keyboard
  document.addEventListener('keydown', onKeyDown);

  // Click outside ctx menu
  document.addEventListener('mousedown', e => {
    const menu = $('ve-ctx-menu');
    if (menu && menu.style.display === 'block' && !menu.contains(e.target)) {
      hideCtxMenu();
    }
  });

  // Resize handles
  bindResize('ve-props-resize', 'props');
  bindResize('ve-code-resize', 'code');
  bindResize('ve-console-resize', 'console');

  // ── Toolbar & panel button delegation ────────────────────────────────────
  const actionMap = {
    // Undo/Redo
    've-undo':          () => undo(),
    've-redo':          () => redo(),
    // File
    've-save':          () => saveToStorage(),
    've-load':          () => loadFromFile(),
    've-export':        () => exportGraph(),
    've-clear':         () => clearAll(),
    // Layout
    've-layout':        () => autoLayout(),
    // Code generation
    've-generate':      () => generateCode(),
    've-import':        () => (typeof showImportCodeDialog === 'function' ? showImportCodeDialog() : log('Import not available', 'error')),
    've-comment':       () => commentSelected(),
    've-wrap':          () => wrapInFunction(),
    've-playground':    () => sendToPlayground(),
    've-tutorial':      () => showTutorial(),
    've-debug':         () => showDebugGraph(),
    // Code panel actions
    've-copy':          () => copyCode(),
    've-check':         () => checkSyntax(),
    've-compile':       () => compileCode(),
    've-run':           () => runCode(),
    // Panel toggles
    've-toggle-left':   () => toggleLeft(),
    've-toggle-props':  () => toggleProps(),
    've-toggle-code':   () => toggleCode(),
    've-toggle-console':() => toggleConsole(),
    've-clear-console': () => clearConsole(),
    // Tutorial nav
    've-tut-prev':      () => tutPrev(),
    've-tut-next':      () => tutNext(),
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (actionMap[action]) {
      e.preventDefault();
      actionMap[action]();
    }
  });

  // Select (change) actions
  const langSel = $('lang-select');
  if (langSel) langSel.addEventListener('change', () => setLang(langSel.value));

  const exSel = $('example-select');
  if (exSel) exSel.addEventListener('change', () => {
    if (exSel.value) { loadExample(exSel.value); exSel.value = ''; }
  });

  // Palette search (input)
  const palSearch = $('ve-palette-search');
  if (palSearch) palSearch.addEventListener('input', () => filterPalette(palSearch.value));

  // Context menu search (input + keydown)
  const ctxSearch = $('ve-ctx-search');
  if (ctxSearch) {
    ctxSearch.addEventListener('input', () => filterCtxMenu(ctxSearch.value));
    ctxSearch.addEventListener('keydown', e => ctxKeyNav(e));
  }

  // Close tutorial when clicking outside the box
  const tutOverlay = $('ve-tutorial');
  if (tutOverlay) {
    tutOverlay.addEventListener('click', e => {
      if (e.target === tutOverlay) {
        tutOverlay.style.display = 'none';
        tutOverlay.classList.add('ve-hidden');
      }
    });
  }
}

function onMouseMove(e) {
  // Dragging nodes
  if (dragging) {
    const dx = (e.clientX - dragging.startX) / camZ;
    const dy = (e.clientY - dragging.startY) / camZ;
    // Collect all child node IDs that should move with selected containers
    const childrenToMove = new Set();
    function collectChildren(nodeId) {
      const n = nodes[nodeId];
      if (n && n.children) {
        n.children.forEach(cid => {
          if (!selected.has(cid)) {
            childrenToMove.add(cid);
            // Store original position if not already stored
            if (!dragging.origPositions[cid]) {
              const cn = nodes[cid];
              if (cn) dragging.origPositions[cid] = { x: cn.x, y: cn.y };
            }
          }
          collectChildren(cid);
        });
      }
    }
    selected.forEach(id => collectChildren(id));

    // Move selected nodes
    selected.forEach(id => {
      const orig = dragging.origPositions[id];
      if (!orig) return;
      const n = nodes[id];
      if (!n) return;
      n.x = orig.x + dx;
      n.y = orig.y + dy;
      const el = document.getElementById('node-' + id);
      if (el) {
        el.style.left = n.x + 'px';
        el.style.top  = n.y + 'px';
      }
    });
    // Move children of selected containers
    childrenToMove.forEach(id => {
      const orig = dragging.origPositions[id];
      if (!orig) return;
      const n = nodes[id];
      if (!n) return;
      n.x = orig.x + dx;
      n.y = orig.y + dy;
      const el = document.getElementById('node-' + id);
      if (el) {
        el.style.left = n.x + 'px';
        el.style.top  = n.y + 'px';
      }
    });

    // Highlight container under the dragged node (for nesting feedback)
    clearContainerHighlights();
    if (selected.size === 1) {
      const draggedId = [...selected][0];
      const draggedNode = nodes[draggedId];
      if (draggedNode) {
        const container = findContainerAt(draggedNode.x + 95, draggedNode.y + 40, draggedId);
        if (container && canNestIn(draggedNode.type, container)) {
          const cel = document.getElementById('node-' + container.id);
          if (cel) cel.classList.add('ve-container-highlight');
        }
      }
    }

    renderWires();
    return;
  }

  // Panning
  if (panning) {
    camX = panning.origCamX + (e.clientX - panning.startX);
    camY = panning.origCamY + (e.clientY - panning.startY);
    applyTransform();
    return;
  }

  // Selection box
  if (selBox) {
    const rect = canvasArea.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const x1 = Math.min(selBox.startX, cx);
    const y1 = Math.min(selBox.startY, cy);
    const x2 = Math.max(selBox.startX, cx);
    const y2 = Math.max(selBox.startY, cy);
    selBoxEl.style.display = 'block';
    selBoxEl.style.left   = x1 + 'px';
    selBoxEl.style.top    = y1 + 'px';
    selBoxEl.style.width  = (x2 - x1) + 'px';
    selBoxEl.style.height = (y2 - y1) + 'px';

    // Update selection
    selected.clear();
    Object.values(nodes).forEach(n => {
      const nx = n.x * camZ + camX;
      const ny = n.y * camZ + camY;
      if (nx >= x1 && ny >= y1 && nx <= x2 && ny <= y2) {
        selected.add(n.id);
      }
    });
    refreshSelection();
    return;
  }

  // Wire preview
  if (wirePreview) {
    updateWirePreview(e.clientX, e.clientY);
  }
}

function clearContainerHighlights() {
  canvas.querySelectorAll('.ve-container-highlight').forEach(el => el.classList.remove('ve-container-highlight'));
}

function onMouseUp(e) {
  if (dragging) {
    clearContainerHighlights();
    // Push undo only if actually moved
    const moved = selected.size > 0 && Object.keys(dragging.origPositions).some(id => {
      const n = nodes[id];
      const orig = dragging.origPositions[id];
      return n && orig && (Math.abs(n.x - orig.x) > 1 || Math.abs(n.y - orig.y) > 1);
    });

    // Check if single dragged node was dropped onto a container
    if (moved && selected.size === 1) {
      const draggedId = [...selected][0];
      const draggedNode = nodes[draggedId];
      if (draggedNode) {
        const container = findContainerAt(draggedNode.x + 95, draggedNode.y + 40, draggedId);
        if (container && canNestIn(draggedNode.type, container)) {
          pushUndo();
          parentNode(draggedId, container.id);
        }
      }
    }

    dragging = null;
    if (moved) updateMinimap();
    return;
  }
  if (panning) { panning = null; return; }
  if (selBox) {
    selBox = null;
    selBoxEl.style.display = 'none';
    return;
  }
  if (wirePreview) {
    finishWireDrop(e.clientX, e.clientY);
    return;
  }
}

function onCanvasMouseDown(e) {
  // Middle click = pan
  if (e.button === 1) {
    e.preventDefault();
    e.stopPropagation();
    panning = { startX: e.clientX, startY: e.clientY, origCamX: camX, origCamY: camY };
    return false;
  }
  // Alt + left click = pan
  if (e.button === 0 && e.altKey) {
    e.preventDefault();
    panning = { startX: e.clientX, startY: e.clientY, origCamX: camX, origCamY: camY };
    return;
  }
  // Left click on empty canvas = selection box
  if (e.button === 0 && e.target === canvasArea) {
    const rect = canvasArea.getBoundingClientRect();
    selBox = { startX: e.clientX - rect.left, startY: e.clientY - rect.top };
    if (!e.shiftKey) { selected.clear(); refreshSelection(); }
    return;
  }
  // Left click on canvas background (not on node) = deselect
  if (e.button === 0 && (e.target === canvas || e.target === svg || e.target.id === 've-sel-box')) {
    if (!e.shiftKey) {
      selected.clear();
      refreshSelection();
      showProps(null);
    }
    const rect = canvasArea.getBoundingClientRect();
    selBox = { startX: e.clientX - rect.left, startY: e.clientY - rect.top };
  }
}

function onCanvasContext(e) {
  e.preventDefault();
  showCtxMenu(e.clientX, e.clientY);
}

function onWheel(e) {
  e.preventDefault();
  const rect = canvasArea.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const oldZ = camZ;
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  camZ = Math.min(3.0, Math.max(0.15, camZ * delta));
  // Zoom toward mouse position
  camX = mx - (mx - camX) * (camZ / oldZ);
  camY = my - (my - camY) * (camZ / oldZ);
  applyTransform();
  renderWires();
  updateMinimap();
}

function onDrop(e) {
  e.preventDefault();
  const type = e.dataTransfer.getData('nodeType');
  if (!type) return;
  const rect = canvasArea.getBoundingClientRect();
  const wx = (e.clientX - rect.left - camX) / camZ;
  const wy = (e.clientY - rect.top  - camY) / camZ;
  const newNode = addNode(type, wx - 95, wy - 40);
  // If dropped on a container, auto-nest
  if (newNode) {
    const container = findContainerAt(wx, wy, newNode.id);
    if (container && canNestIn(type, container)) {
      parentNode(newNode.id, container.id);
    }
  }
}

function onKeyDown(e) {
  // Skip if focus is in an input/textarea/select
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  // Ctrl+Z = undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  // Ctrl+Y or Ctrl+Shift+Z = redo
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  // Ctrl+S = save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveToStorage(); return; }
  // Ctrl+G = generate
  if ((e.ctrlKey || e.metaKey) && e.key === 'g') { e.preventDefault(); generateCode(); return; }
  // Ctrl+I = import from code
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); if (typeof VEParser !== 'undefined') VEParser.showImportCodeDialog(); return; }
  // Ctrl+A = select all
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); selectAll(); return; }
  // Delete / Backspace = delete selected
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
  // Escape = deselect or close ctx menu
  if (e.key === 'Escape') {
    hideCtxMenu();
    const tut = $('ve-tutorial');
    if (tut && tut.style.display !== 'none') { tut.style.display = 'none'; return; }
    selected.clear();
    refreshSelection();
    showProps(null);
    return;
  }
}

// ── Resize Handles ────────────────────────────────────────────────────────────
function bindResize(handleId, type) {
  const handle = $(handleId);
  if (!handle) return;
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    resizeStart = { x: e.clientX, y: e.clientY, type };
    if (type === 'props') {
      resizingProps = true;
      resizeStart.origWidth = $('ve-props-panel').offsetWidth;
    } else if (type === 'code') {
      resizingCode = true;
      resizeStart.origWidth = $('ve-code-panel').offsetWidth;
    } else if (type === 'console') {
      resizingConsole = true;
      resizeStart.origHeight = $('ve-console').offsetHeight;
    }
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  });
}

function onResizeMove(e) {
  if (resizingProps) {
    const dx = resizeStart.x - e.clientX;
    const w = Math.max(120, Math.min(600, resizeStart.origWidth + dx));
    $('ve-props-panel').style.width = w + 'px';
  }
  if (resizingCode) {
    const dx = resizeStart.x - e.clientX;
    const w = Math.max(180, Math.min(800, resizeStart.origWidth + dx));
    $('ve-code-panel').style.width = w + 'px';
  }
  if (resizingConsole) {
    const dy = resizeStart.y - e.clientY;
    const h = Math.max(60, Math.min(500, resizeStart.origHeight + dy));
    $('ve-console').style.height = h + 'px';
  }
}

function onResizeEnd() {
  resizingProps = false;
  resizingCode = false;
  resizingConsole = false;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
}

// ── Console Logging ──────────────────────────────────────────────────────────
function log(msg, type) {
  type = type || 'info';
  const body = $('ve-console-body');
  if (!body) return;
  const line = document.createElement('div');
  line.className = 'con-line';
  const now = new Date();
  const ts = now.toLocaleTimeString('en-US', { hour12: false });
  line.innerHTML = `<span class="con-time">${ts}</span><span class="con-${type}">${escHtml(msg)}</span>`;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
  consoleCount++;
  const badge = $('ve-console-badge');
  if (badge) { badge.textContent = consoleCount; badge.style.display = 'inline'; }
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function clearConsole() {
  const body = $('ve-console-body');
  if (body) body.innerHTML = '';
  consoleCount = 0;
  const badge = $('ve-console-badge');
  if (badge) badge.style.display = 'none';
}

// ── Save / Load / Export ─────────────────────────────────────────────────────
function getGraph() {
  return { nodes, wires, nodeCounter, wireCounter, camX, camY, camZ, lang };
}

function saveToStorage() {
  try {
    localStorage.setItem('ve-graph', JSON.stringify(getGraph()));
    log('Graph saved to localStorage', 'success');
  } catch(e) {
    log('Save failed: ' + e.message, 'error');
  }
}

function loadFromStorage() {
  try {
    const data = localStorage.getItem('ve-graph');
    if (!data) return;
    importGraph(JSON.parse(data), true);
    log('Graph loaded from localStorage', 'info');
  } catch(e) {
    // ignore
  }
}

function loadFromFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,.hudhudgraph';
  inp.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        importGraph(data);
        log('Loaded: ' + file.name, 'success');
      } catch(ex) {
        log('Load error: ' + ex.message, 'error');
      }
    };
    reader.readAsText(file);
  });
  inp.click();
}

function exportGraph() {
  const json = JSON.stringify(getGraph(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'graph.hudhudgraph';
  a.click();
  URL.revokeObjectURL(url);
  log('Graph exported', 'success');
}

function importGraph(data, silent) {
  // Clear existing
  canvas.querySelectorAll('.ve-node').forEach(el => el.remove());
  nodes = data.nodes || {};
  wires = data.wires || [];
  nodeCounter = data.nodeCounter || 0;
  wireCounter = data.wireCounter || 0;
  if (data.camX !== undefined) camX = data.camX;
  if (data.camY !== undefined) camY = data.camY;
  if (data.camZ !== undefined) camZ = data.camZ;
  if (data.lang) {
    lang = data.lang;
    const sel = $('lang-select');
    if (sel) sel.value = lang;
  }
  selected.clear();
  // Ensure all node ids have proper defaults
  Object.values(nodes).forEach(n => {
    if (!n.props) n.props = {};
    if (n.collapsed === undefined) n.collapsed = false;
    // Restore container arrays from saved state
    const def = NODE_DEF_MAP[n.type];
    if (def && def.container) {
      if (!n.children) n.children = [];
      if (n.childrenCollapsed === undefined) n.childrenCollapsed = false;
    }
  });
  // Update counters
  Object.keys(nodes).forEach(id => {
    const num = parseInt(id.replace('n', ''));
    if (!isNaN(num) && num > nodeCounter) nodeCounter = num;
  });
  wires.forEach(w => {
    if (!w.id) w.id = 'w' + (++wireCounter);
    const num = parseInt((w.id || '').replace('w', ''));
    if (!isNaN(num) && num > wireCounter) wireCounter = num;
  });
  // Rebuild parent-child nesting from wire data
  wires.forEach(w => {
    autoNestOnWire(w.from, w.to);
  });
  renderAll();
  if (!silent) log('Graph imported', 'success');
}

function clearAll() {
  if (Object.keys(nodes).length === 0) return;
  if (!confirm('Clear all nodes and wires?')) return;
  pushUndo();
  canvas.querySelectorAll('.ve-node').forEach(el => el.remove());
  nodes = {};
  wires = [];
  selected.clear();
  nodeCounter = 0;
  wireCounter = 0;
  renderAll();
  showProps(null);
  log('Canvas cleared', 'info');
}

// ── Code Generation ──────────────────────────────────────────────────────────
function generateCode() {
  const out = $('ve-code-output');
  if (!out) return;

  // Try server-side generation first, fallback to client-side
  const graph = getGraph();

  fetch('/api/visual-editor/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ graph, lang })
  }).then(r => {
    if (!r.ok) throw new Error('Server error ' + r.status);
    return r.json();
  }).then(data => {
    if (!data.success || !data.code) throw new Error(data.error || 'No code returned');
    generatedCode = data.code;
    out.innerHTML = highlightCode(generatedCode);
    log('Code generated (server)', 'success');
  }).catch(() => {
    // Client-side fallback
    generatedCode = generateCodeClient();
    out.innerHTML = highlightCode(generatedCode);
    log('Code generated (client)', 'success');
  });
}

function generateCodeClient() {
  const lines = [
    '// Generated by HudHudScript Visual Editor',
    '// Language: ' + lang,
    ''
  ];
  // Auto-import linalg if dot/cross/norm/normalize/transpose are used (not for basic vectors)
  // (Vectors are native arrays: [x, y], so no import needed)
  // Track which nodes are children (they will be generated inside their parent)
  const childIds = new Set();
  Object.values(nodes).forEach(n => {
    if (n.children) n.children.forEach(cid => childIds.add(cid));
  });

  // Topological sort based on wires (only top-level nodes)
  const visited = new Set();
  const order = [];
  function visit(id) {
    if (visited.has(id)) return;
    visited.add(id);
    // Visit dependencies first (nodes connected to input ports)
    wires.forEach(w => {
      if (w.to === id && nodes[w.from]) visit(w.from);
    });
    order.push(id);
  }
  Object.keys(nodes).forEach(id => {
    if (!childIds.has(id)) visit(id);
  });

  // Resolve output expression for a node+port (e.g. variable name, operator result)
  var _resolveDepth = 0;
  function resolveOutputExpr(nodeId, portId) {
    if (++_resolveDepth > 20) { _resolveDepth--; return nodeId; } // cycle guard
    var result;
    const node = nodes[nodeId];
    if (!node) { result = nodeId; }
    else {
      const def = NODE_DEF_MAP[node.type];
      const props = node.props || {};
      if (node.type === 'variable' || node.type === 'const') {
        result = props.name || nodeId;
      } else if (node.type === 'scalar_num' || node.type === 'scalar_str' || node.type === 'scalar_bool') {
        result = (node.type === 'scalar_str') ? ('"' + (props.value || '') + '"') : (props.value || '0');
      } else if (node.type === 'array') {
        result = '[' + (props.itemsList ? props.itemsList.join(', ') : (props.items || '')) + ']';
      } else if (node.type.startsWith('op_') || node.type === 'vec_make') {
        const opProps = {...props};
        if (def && def.ports && def.ports.in) {
          def.ports.in.forEach(port => {
            const w = wires.find(wr => wr.to === nodeId && wr.toPort === port.id);
            if (w && nodes[w.from]) opProps[port.id] = resolveOutputExpr(w.from, w.fromPort);
          });
        }
        result = def ? def.codegen(opProps, lang) : nodeId;
      } else if (node.type === 'call') {
        result = (props.name||'func') + '(' + (props.args||'') + ')';
      } else if (node.type === 'print') {
        result = props.msg || '';
      } else if (node.type === 'return') {
        result = props.val || '';
      } else if (node.type === 'object') {
        result = props.name || nodeId;
      } else if (node.type === 'c_for' || node.type === 'for' || node.type === 'while') {
        result = props.var || 'i';
      } else if (node.type === 'loop') {
        result = props.label || 'loop';
      } else if (node.type === 'vec_break') {
        var vecWire = wires.find(function(wr) { return wr.to === nodeId && wr.toPort === 'vec'; });
        var vecName = (vecWire && nodes[vecWire.from]) ? resolveOutputExpr(vecWire.from, vecWire.fromPort) : 'v';
        var idx = {x:'0', y:'1', z:'2', w:'3'}[portId] || '0';
        result = vecName + '[' + idx + ']';
      } else if (node.type === 'vector2d' || node.type === 'vector3d' || node.type === 'vector4d') {
        result = props.name || 'v';
      } else {
        result = props.name || props.msg || props.val || nodeId;
      }
    }
    _resolveDepth--;
    return result;
  }

  function generateNodeCode(nodeId, indent) {
    const node = nodes[nodeId];
    if (!node) return;
    const def = NODE_DEF_MAP[node.type];
    // Expression-only nodes: skip only if another node consumes their output
    var isExpr = node.type.startsWith('op_') || node.type === 'vec_break' || node.type === 'vec_make' || node.type === 'array' || node.type.startsWith('scalar_') || node.type === 'call';
    if (isExpr) {
      var consumed = wires.some(function(w) { return w.from === nodeId; });
      if (consumed) return;
    }
    const prefix = '    '.repeat(indent);
    if (!def || !def.codegen) {
      lines.push(prefix + '// ' + (node.type || 'unknown') + ' node');
    } else {
      // Merge wire-connected input values into props
      const wireProps = {...(node.props || {})};
      if (def.ports && def.ports.in) {
        def.ports.in.forEach(port => {
          const w = wires.find(wr => wr.to === nodeId && wr.toPort === port.id);
          if (w && nodes[w.from]) {
            wireProps[port.id] = resolveOutputExpr(w.from, w.fromPort);
          }
        });
      }
      const code = def.codegen(wireProps, lang);
      // If this is a container with children, inject children inside the block
      if (def.container && node.children && node.children.length > 0) {
        if (node.type === 'if') {
          // If/Else: split children into then/else branches based on wire source port
          const thenKids = [], elseKids = [];
          node.children.forEach(cid => {
            const w = wires.find(wr => wr.from === nodeId && wr.to === cid);
            if (w && w.fromPort === 'else') elseKids.push(cid);
            else thenKids.push(cid);
          });
          // Generate: if (...) {\n then kids \n} else {\n else kids \n}
          const ifLine = prefix + `${(SOV_LANGS.has(lang)?`(${node.props.cond||'condition'}) ${kw('if',lang)}`:`${kw('if',lang)} (${node.props.cond||'condition'})`)} {`;
          lines.push(ifLine);
          thenKids.forEach(cid => generateNodeCode(cid, indent + 1));
          lines.push(prefix + `} ${kw('else',lang)} {`);
          elseKids.forEach(cid => generateNodeCode(cid, indent + 1));
          lines.push(prefix + '}');
        } else {
          // Standard container: insert children before closing brace
          var codeLines = code.split('\n');
          // Remove placeholder comment lines like // ...
          codeLines = codeLines.filter(function(l) { return !/\/\/\s*\.{3}\s*$/.test(l.trim()); });
          const lastLine = codeLines[codeLines.length - 1].trim();
          if (lastLine === '}') {
            // Multi-line block: children before closing }
            codeLines.slice(0, -1).forEach(l => lines.push(prefix + l));
            node.children.forEach(cid => { generateNodeCode(cid, indent + 1); });
            lines.push(prefix + codeLines[codeLines.length - 1]);
          } else if (lastLine.endsWith('{')) {
            // Single-line opening: children then closing }
            lines.push(prefix + codeLines[0]);
            node.children.forEach(cid => { generateNodeCode(cid, indent + 1); });
            lines.push(prefix + '}');
          } else {
            lines.push(prefix + code);
          }
        }
      } else {
        code.split('\n').forEach(l => lines.push(prefix + l));
      }
    }
    lines.push('');
  }

  order.forEach(id => generateNodeCode(id, 0));
  return lines.join('\n');
}

// ── Syntax Highlighting ──────────────────────────────────────────────────────
function highlightCode(code) {
  if (!code) return '';
  var lines = code.split('\n');
  var html = '';
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var result = '';
    var pos = 0;
    // Find comment
    var cmMatch = line.match(/(\/\/.*)$/);
    var cmEnd = cmMatch ? cmMatch.index + cmMatch[0].length : -1;
    // Build line with highlights
    while (pos < line.length) {
      if (cmMatch && pos === cmMatch.index) {
        result += '<span class="hl-cmt">' + escHtml(line.slice(cmMatch.index, cmEnd)) + '</span>';
        pos = cmEnd;
        break;
      }
      // Find string
      var strMatch = line.slice(pos).match(/"(?:[^"\\]|\\.)*"/);
      if (strMatch && (!cmMatch || pos + strMatch.index < cmMatch.index)) {
        if (strMatch.index > 0) result += escHtml(line.slice(pos, pos + strMatch.index));
        result += '<span class="hl-str">' + escHtml(strMatch[0]) + '</span>';
        pos += strMatch.index + strMatch[0].length;
        continue;
      }
      // Find number
      var numMatch = line.slice(pos).match(/\b\d+\.?\d*\b/);
      if (numMatch && (!cmMatch || pos + numMatch.index < cmMatch.index)) {
        if (numMatch.index > 0) result += escHtml(line.slice(pos, pos + numMatch.index));
        result += '<span class="hl-num">' + escHtml(numMatch[0]) + '</span>';
        pos += numMatch.index + numMatch[0].length;
        continue;
      }
      // Plain text to end
      result += escHtml(line.slice(pos));
      break;
    }
    html += '<div class="ve-code-line"><span class="ve-code-ln">' + (i + 1) + '</span><span class="ve-code-text">' + (result || '&nbsp;') + '</span></div>';
  }
  return html;
}

// ── Code Execution ───────────────────────────────────────────────────────────
function checkSyntax() {
  if (!generatedCode) { log('Generate code first', 'warn'); return; }
  runCodeAction('check');
}

function compileCode() {
  if (!generatedCode) { log('Generate code first', 'warn'); return; }
  runCodeAction('compile');
}

function runCode() {
  if (!generatedCode) { log('Generate code first', 'warn'); return; }
  runCodeAction('run');
}

function runCodeAction(action) {
  log(`Running: hudhudscript ${action}...`, 'code');
  fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.CSRF_TOKEN || '' },
    body: JSON.stringify({ code: generatedCode, action, lang, csrf_token: window.CSRF_TOKEN || '' })
  }).then(r => r.json()).then(data => {
    if (data.error) {
      log(`${action} error: ${data.error}`, 'error');
    } else {
      log(`${action} result: ${data.output || 'OK'}`, 'success');
      if (data.output) log(data.output, 'code');
    }
  }).catch(err => {
    log(`${action} failed: ${err.message}`, 'error');
  });
}

function copyCode() {
  if (!generatedCode) { log('Generate code first', 'warn'); return; }
  navigator.clipboard.writeText(generatedCode).then(() => {
    log('Code copied to clipboard', 'success');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = generatedCode;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    log('Code copied to clipboard', 'success');
  });
}

// ── Auto Layout ──────────────────────────────────────────────────────────────
function autoLayout() {
  const ids = Object.keys(nodes);
  if (ids.length === 0) return;
  pushUndo();

  // Simple grid layout: categorize by type, lay out in columns
  const cols = {};
  ids.forEach(id => {
    const n = nodes[id];
    const def = NODE_DEF_MAP[n.type];
    const cat = def ? def.cat : 'Other';
    if (!cols[cat]) cols[cat] = [];
    cols[cat].push(id);
  });

  let colX = 60;
  const colWidth = 260;
  const rowHeight = 180;
  Object.keys(cols).forEach(cat => {
    const nodeIds = cols[cat];
    nodeIds.forEach((id, idx) => {
      const n = nodes[id];
      n.x = colX;
      n.y = 60 + idx * rowHeight;
    });
    colX += colWidth;
  });

  renderAll();
  log('Auto layout applied', 'info');
}

// ── Language ─────────────────────────────────────────────────────────────────
function setLang(l) {
  lang = l;
  buildPalette();
  buildCtxMenu();
  // Re-render nodes to update keyword displays
  Object.values(nodes).forEach(n => renderNode(n));
  renderWires();
  log('Language: ' + lang, 'info');
}

// ── Example Loading ──────────────────────────────────────────────────────────
function loadExample(name) {
  if (!name) return;
  const ex = (typeof EXAMPLES !== 'undefined') ? EXAMPLES[name] : null;
  if (!ex) {
    log('Example not found: ' + name, 'warn');
    return;
  }
  pushUndo();
  importGraph({
    nodes: JSON.parse(JSON.stringify(ex.nodes || {})),
    wires: (ex.wires || []).map((w, i) => ({ id: 'w' + (i+1), ...w })),
    nodeCounter: 0,
    wireCounter: (ex.wires || []).length,
    camX: 50, camY: 50, camZ: 1.0
  });
  // Update node counter
  Object.keys(nodes).forEach(id => {
    const num = parseInt(id.replace('n', ''));
    if (!isNaN(num) && num > nodeCounter) nodeCounter = num;
  });
  log('Loaded example: ' + name, 'success');
}

// ── Comment Selected ─────────────────────────────────────────────────────────
function commentSelected() {
  if (selected.size === 0) {
    // Just add an empty comment at center
    const cx = (canvasArea.clientWidth/2 - camX) / camZ;
    const cy = (canvasArea.clientHeight/2 - camY) / camZ;
    addNode('comment', cx - 80, cy - 40, { text: 'Add your comment here' });
    return;
  }
  // Find bounding box of selected nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  selected.forEach(id => {
    const n = nodes[id];
    if (!n) return;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + 190);
    maxY = Math.max(maxY, n.y + 120);
  });
  addNode('comment', minX - 20, minY - 60, { text: 'Comment for selected nodes' });
}

// ── Wrap in Function ─────────────────────────────────────────────────────────
function wrapInFunction() {
  if (selected.size === 0) { log('Select nodes to wrap', 'warn'); return; }
  // Find bounding box
  let minX = Infinity, minY = Infinity;
  selected.forEach(id => {
    const n = nodes[id];
    if (!n) return;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
  });
  // Add function node above
  addNode('function', minX, minY - 100, { name: 'wrappedFn', params: '' });
  log('Function node added above selection', 'info');
}

// ── Send to Playground ───────────────────────────────────────────────────────
function sendToPlayground() {
  if (!generatedCode) {
    // Generate first
    generatedCode = generateCodeClient();
  }
  // Open playground with code
  const encoded = encodeURIComponent(generatedCode);
  window.open('/playground?code=' + encoded, '_blank');
  log('Sent to playground', 'success');
}

// ── Debug Graph ─────────────────────────────────────────────────────────────
function showDebugGraph() {
  var modal = document.getElementById('ve-debug-modal');
  var output = document.getElementById('ve-debug-output');
  if (!modal || !output) return;

  // Build debug report
  var lines = [];
  lines.push('═══ GRAPH DEBUG ═══');
  lines.push('Time: ' + new Date().toISOString());
  lines.push('Language: ' + lang);
  lines.push('');

  // Nodes
  lines.push('── NODES (' + Object.keys(nodes).length + ') ──');
  Object.values(nodes).forEach(function(n) {
    var def = NODE_DEF_MAP[n.type];
    var label = def ? def.label : n.type;
    lines.push('');
    lines.push('[' + n.id + '] ' + label + ' (' + n.type + ')');
    lines.push('  position: x=' + Math.round(n.x) + ', y=' + Math.round(n.y));
    if (n.props && Object.keys(n.props).length > 0) {
      var propsClean = {};
      Object.keys(n.props).forEach(function(k) {
        if (k !== 'itemsList') propsClean[k] = n.props[k];
      });
      lines.push('  props: ' + JSON.stringify(propsClean));
    }
    if (n.parentId) lines.push('  parentId: ' + n.parentId);
    if (n.children && n.children.length > 0) lines.push('  children: [' + n.children.join(', ') + ']');
    if (n.collapsed) lines.push('  collapsed: true');
  });

  // Wires
  lines.push('');
  lines.push('── WIRES (' + wires.length + ') ──');
  wires.forEach(function(w) {
    var fromNode = nodes[w.from];
    var toNode = nodes[w.to];
    var fromLabel = fromNode ? (fromNode.props.name || fromNode.type) : w.from;
    var toLabel = toNode ? (toNode.props.name || toNode.type) : w.to;
    lines.push('  ' + w.from + ':' + w.fromPort + ' (' + fromLabel + ') ──→ ' + w.to + ':' + w.toPort + ' (' + toLabel + ')  [' + (w.type||'') + ']');
  });

  // Generated code preview
  lines.push('');
  lines.push('── GENERATED CODE ──');
  if (generatedCode) {
    lines.push(generatedCode);
  } else {
    lines.push('(not yet generated — click Generate)');
  }

  output.textContent = lines.join('\n');
  modal.style.display = 'flex';

  // Close button
  document.getElementById('ve-debug-close').onclick = function() { modal.style.display = 'none'; };
  // Copy button
  document.getElementById('ve-debug-copy').onclick = function() {
    navigator.clipboard.writeText(output.textContent).then(function() {
      log('Debug info copied!', 'success');
    });
  };
  // Click outside to close
  modal.onclick = function(e) { if (e.target === modal) modal.style.display = 'none'; };
  // Escape key
  var escHandler = function(e) { if (e.key === 'Escape') { modal.style.display = 'none'; document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
}

// ── Tutorial ─────────────────────────────────────────────────────────────────
function showTutorial() {
  const tut = $('ve-tutorial');
  if (!tut) return;
  tutStep = 0;
  tut.classList.remove('ve-hidden');
  tut.style.display = 'flex';
  updateTutStep();
}

function buildTutDots() {
  const dots = $('tut-dots');
  if (!dots) return;
  dots.innerHTML = '';
  for (let i = 0; i < TUT_STEPS; i++) {
    const dot = document.createElement('div');
    dot.className = 'tut-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => { tutStep = i; updateTutStep(); });
    dots.appendChild(dot);
  }
}

function updateTutStep() {
  for (let i = 0; i < TUT_STEPS; i++) {
    const step = $('tut-step-' + i);
    if (step) step.classList.toggle('active', i === tutStep);
  }
  const dots = $('tut-dots');
  if (dots) {
    [...dots.children].forEach((d, i) => d.classList.toggle('active', i === tutStep));
  }
  const btn = $('tut-next-btn');
  if (btn) btn.textContent = tutStep === TUT_STEPS - 1 ? 'Finish' : 'Next \u2192';
}

function tutNext() {
  if (tutStep >= TUT_STEPS - 1) {
    const tut = $('ve-tutorial');
    if (tut) { tut.style.display = 'none'; tut.classList.add('ve-hidden'); }
    return;
  }
  tutStep++;
  updateTutStep();
}

function tutPrev() {
  if (tutStep > 0) tutStep--;
  updateTutStep();
}

// ── Minimap ──────────────────────────────────────────────────────────────────
function updateMinimap() {
  const mc = $('minimap-canvas');
  if (!mc) return;
  const ctx = mc.getContext('2d');
  const w = mc.width;
  const h = mc.height;
  ctx.clearRect(0, 0, w, h);

  const ids = Object.keys(nodes);
  if (ids.length === 0) return;

  // Find bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  ids.forEach(id => {
    const n = nodes[id];
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + 190);
    maxY = Math.max(maxY, n.y + 120);
  });

  const pad = 40;
  const rangeX = (maxX - minX) + pad * 2;
  const rangeY = (maxY - minY) + pad * 2;
  const scale = Math.min(w / rangeX, h / rangeY);

  // Draw nodes as small rectangles
  ids.forEach(id => {
    const n = nodes[id];
    const def = NODE_DEF_MAP[n.type];
    const nx = (n.x - minX + pad) * scale;
    const ny = (n.y - minY + pad) * scale;
    const nw = 190 * scale;
    const nh = 40 * scale;
    ctx.fillStyle = selected.has(id) ? '#fff' : (def ? getCatColor(def.cat) : '#3b82f6');
    ctx.globalAlpha = 0.7;
    ctx.fillRect(nx, ny, Math.max(nw, 3), Math.max(nh, 2));
  });
  ctx.globalAlpha = 1.0;

  // Draw wires
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 0.5;
  wires.forEach(w => {
    const nFrom = nodes[w.from];
    const nTo = nodes[w.to];
    if (!nFrom || !nTo) return;
    const x1 = (nFrom.x + 190 - minX + pad) * scale;
    const y1 = (nFrom.y + 20 - minY + pad) * scale;
    const x2 = (nTo.x - minX + pad) * scale;
    const y2 = (nTo.y + 20 - minY + pad) * scale;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  // Draw viewport rectangle
  if (canvasArea) {
    const vx = (-camX / camZ - minX + pad) * scale;
    const vy = (-camY / camZ - minY + pad) * scale;
    const vw = (canvasArea.clientWidth / camZ) * scale;
    const vh = (canvasArea.clientHeight / camZ) * scale;
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, vw, vh);
  }
}

function getCatColor(cat) {
  switch(cat) {
    case 'Core Syntax': return '#3b82f6';
    case 'Agent System': return '#7c3aed';
    case 'Governance': return '#d97706';
    case 'Flow': return '#0891b2';
    case 'Math': return '#8b5cf6';
    case 'SOP': return '#ea580c';
    case 'RAG': return '#16a34a';
    default: return '#64748b';
  }
}

// ── Panel Toggles ────────────────────────────────────────────────────────────
function toggleLeft() {
  const panel = $('ve-left');
  if (panel) panel.classList.toggle('minimized');
}

function toggleProps() {
  const panel = $('ve-props-panel');
  if (panel) panel.classList.toggle('minimized');
}

function toggleCode() {
  const panel = $('ve-code-panel');
  if (panel) panel.classList.toggle('minimized');
}

function toggleConsole() {
  const panel = $('ve-console');
  if (panel) panel.classList.toggle('minimized');
  const toggle = $('ve-console-toggle');
  if (toggle) {
    const minimized = panel && panel.classList.contains('minimized');
    toggle.textContent = minimized ? '\u25B6' : '\u25BC';
  }
}

// ── Palette / Context Menu Search ────────────────────────────────────────────
function filterPalette(query) {
  buildPalette(query);
}

function filterCtxMenu(query) {
  buildCtxMenu(query);
}

function ctxKeyNav(e) {
  const visibleItems = ctxItems.filter(ci => ci.el.offsetParent !== null);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    ctxFocusIdx = Math.min(ctxFocusIdx + 1, visibleItems.length - 1);
    updateCtxFocus(visibleItems);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    ctxFocusIdx = Math.max(ctxFocusIdx - 1, 0);
    updateCtxFocus(visibleItems);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (ctxFocusIdx >= 0 && ctxFocusIdx < visibleItems.length) {
      visibleItems[ctxFocusIdx].el.click();
    }
  } else if (e.key === 'Escape') {
    hideCtxMenu();
  }
}

function updateCtxFocus(items) {
  items.forEach((ci, i) => {
    ci.el.classList.toggle('focused', i === ctxFocusIdx);
  });
  if (ctxFocusIdx >= 0 && ctxFocusIdx < items.length) {
    items[ctxFocusIdx].el.scrollIntoView({ block: 'nearest' });
  }
}

// ── VE Global API ────────────────────────────────────────────────────────────
window.VE = {
  // Undo/Redo
  undo,
  redo,
  // File operations
  save: saveToStorage,
  load: loadFromFile,
  exportGraph,
  clearAll,
  // Layout
  autoLayout,
  // Language
  setLang,
  // Examples
  loadExample,
  // Code generation
  generateCode,
  // Comments & wrapping
  commentSelected,
  wrapInFunction,
  // Playground
  sendToPlayground,
  // Tutorial
  showTutorial,
  tutNext,
  tutPrev,
  // Debug
  showDebugGraph,
  // Code actions
  copyCode,
  checkSyntax,
  compileCode,
  runCode,
  // Panel toggles
  toggleLeft,
  toggleProps,
  toggleCode,
  toggleConsole,
  // Console
  clearConsole,
  // Search / filter
  filterPalette,
  filterCtxMenu,
  ctxKeyNav,
  // Import/export graph data (used by ve-parser.js)
  importGraph,
  appendNodes: function(graphData) {
    // Append parsed nodes to the existing graph without clearing
    const newNodes = graphData.nodes || {};
    // Offset new node IDs and positions to avoid collision
    const existingIds = Object.keys(nodes);
    let maxNum = nodeCounter;
    const idMap = {};
    // Find rightmost x position to place new nodes after existing ones
    let maxX = 0;
    Object.values(nodes).forEach(n => {
      if (n.x > maxX) maxX = n.x;
    });
    const offsetX = existingIds.length > 0 ? maxX + 280 : 0;
    Object.keys(newNodes).forEach(oldId => {
      const newId = 'n' + (++maxNum);
      idMap[oldId] = newId;
      const n = newNodes[oldId];
      n.id = newId;
      n.x = (n.x || 0) + offsetX;
      nodes[newId] = n;
    });
    nodeCounter = maxNum;
    // Remap wire references
    (graphData.wires || []).forEach(w => {
      w.from = idMap[w.from] || w.from;
      w.to = idMap[w.to] || w.to;
      w.id = 'w' + (++wireCounter);
      wires.push(w);
    });
    pushUndo();
    renderAll();
    log('Appended ' + Object.keys(newNodes).length + ' nodes from code', 'success');
  },
  // Internal helpers for parser
  _log: log,
};

// ── Boot ─────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}

})();
