'use strict';
// Form — pick blocks on a 16x16 grid; a chain of moves leaves traces; export as SVG.
let G = 9;
const U = 100, MAXCAP = 500, TONE = 0.22, INK = '#111', PAPER = '#f4f2ee', YEL = '#ffe100';
// Shape library: paths in a 100x100 cell. sym = looks the same turned. A placed block has a base turn q (0 to 3, from clicking) and r (0 to 3, the direction of its last move).
const SHAPES = {
  square: { d: 'M0 0H100V100H0Z', sym: 1 },
  arch:   { d: 'M0 0A100 100 0 0 1 100 100L0 100Z' },
  tri:    { d: 'M0 0L100 100L0 100Z' },
  circle: { d: 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z', sym: 1 },
};
const ang = b => SHAPES[b.s].sym ? 0 : (((b.q || 0) + b.r) % 4) * 90;
const MOVES = 1; // one move per variant; the engine can repeat it (see variants), but the setting was dropped
const TRACED = new Set(['solid', 'trans', 'dens']);
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // right, down, left, up

// ---------- engine ----------
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function connected(cells) {
  if (!cells.length) return false;
  const set = new Set(cells.map(c => c.x + ',' + c.y)), seen = new Set([cells[0].x + ',' + cells[0].y]), q = [cells[0]];
  while (q.length) { const c = q.pop(); for (const [dx, dy] of DIRS) { const k = (c.x + dx) + ',' + (c.y + dy); if (set.has(k) && !seen.has(k)) { seen.add(k); q.push({ x: c.x + dx, y: c.y + dy }); } } }
  return seen.size === set.size;
}
// Variants: one move = one block jumps to any empty cell touching the rest of the shape.
// "moves" repeats that; the vacated cells are kept as traces (for Cumulative solid).
function norm(bl, tr, ox = 0, oy = 0) {
  const mx = Math.min(...bl.map(b => b.x)), my = Math.min(...bl.map(b => b.y));
  return {
    blocks: bl.map(b => ({ ...b, x: b.x - mx, y: b.y - my, r: SHAPES[b.s].sym ? 0 : b.r })).sort((p, q) => p.y - q.y || p.x - q.x),
    tr: tr.map(t => ({ ...t, x: t.x - mx, y: t.y - my })),
    ox: ox + mx, oy: oy + my, // where this variant's corner sits in the original grid, so earlier variants can be laid over it
  };
}
const keyOf = (st, ax, withTr) => st.blocks.map(b => b.x + ',' + b.y + b.s + b.r + (b.q || 0) + (ax ? b.a : '')).join('|') +
  (withTr ? '#' + st.tr.map(t => t.x + ',' + t.y).sort().join('|') : '');
// Direction: a block's stripes run along the line it is joined on: vertical if it has a block above or below, else horizontal.
const axisOf = (b, bl) => bl.some(o => o.x === b.x && Math.abs(o.y - b.y) === 1) ? 1 : 0;
function variants(start, moves, ax = false, withTr = false, cap = MAXCAP) {
  const first = norm(start.map(b => ({ ...b, r: 0, a: axisOf(b, start) })), []), seen = new Set([keyOf(first, ax, withTr)]);
  let level = [first], prev = level, count = 1, capped = false;
  for (let d = 1; d <= moves && !capped; d++) {
    const next = [];
    for (const st of level) {
      const occ = new Set(st.blocks.map(b => b.x + ',' + b.y));
      for (let i = 0; i < st.blocks.length && !capped; i++) {
        const old = st.blocks[i], rest = st.blocks.filter((_, j) => j !== i), targets = new Map();
        for (const o of rest) for (const [dx, dy] of DIRS) { const x = o.x + dx, y = o.y + dy; if (!occ.has(x + ',' + y)) targets.set(x + ',' + y, [x, y]); }
        for (const [tx, ty] of [...targets.values()].sort((p, q) => Math.abs(p[0] - old.x) + Math.abs(p[1] - old.y) - Math.abs(q[0] - old.x) - Math.abs(q[1] - old.y) || p[1] - q[1] || p[0] - q[0])) {
          const dx = tx - old.x, dy = ty - old.y, dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
          const nb = st.blocks.map((o, j) => j === i ? { ...o, x: tx, y: ty, r: dir } : o);
          nb[i].a = axisOf(nb[i], nb);
          if (!connected(nb)) continue;
          const n = norm(nb, [...st.tr, { x: old.x, y: old.y, s: old.s, r: old.r, q: old.q }], st.ox, st.oy);
          if (Math.max(...n.blocks.map(b => b.x)) >= G || Math.max(...n.blocks.map(b => b.y)) >= G) continue;
          const k = keyOf(n, ax, withTr); if (seen.has(k)) continue;
          seen.add(k); next.push(n);
          if (++count >= cap) { capped = true; break; }
        }
      }
      if (capped) break;
    }
    if (!next.length) break;
    prev = level = next;
  }
  return { states: [first, ...(prev === first ? [] : prev)].map((st, id) => ({ ...st, id })), capped };
}

// Unmake: the reverse rule. One block is taken away per step, in a random order, and never comes back. The place it left stays marked (a trace),
// so the cumulative views still work. Blocks keep their positions (no re-centring), and the last state is empty.
function unmake(start, order) {
  const first = norm(start.map(b => ({ ...b, r: 0, a: axisOf(b, start) })), []);
  const idx = first.blocks.map((_, i) => i);
  if (order) idx.sort((p, q) => order[p] - order[q]);
  else for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const states = [first];
  idx.forEach((bi, k) => {
    const gone = new Set(idx.slice(0, k + 1));
    states.push({ blocks: first.blocks.filter((_, i) => !gone.has(i)), tr: first.blocks.filter((_, i) => gone.has(i)).map(b => ({ x: b.x, y: b.y, s: b.s, r: b.r, q: b.q })), ox: first.ox, oy: first.oy });
  });
  return { states: states.map((st, id) => ({ ...st, id })), capped: false };
}

// Unmake by rearranging: each step moves one block that still touches another to an empty cell inside the grid that touches nothing, leaving its old
// cell marked. Every move leaves the mover alone and cannot join anything, so the shape comes apart and the moves stop when no block touches another.
function scatter(start, size) {
  const first = norm(start.map(b => ({ ...b, r: 0, a: axisOf(b, start) })), []);
  const pick = a => a[Math.floor(Math.random() * a.length)], near = (p, q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y) === 1;
  let blocks = first.blocks, tr = [];
  const states = [first];
  for (let guard = 0; guard < 200; guard++) {
    const touching = blocks.filter(b => blocks.some(o => near(o, b)));
    if (!touching.length) break;
    const b = pick(touching), others = blocks.filter(o => o !== b), cells = [];
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) {
      const c = { x: x - first.ox, y: y - first.oy };
      if (!blocks.some(o => o.x === c.x && o.y === c.y) && !others.some(o => near(o, c))) cells.push(c);
    }
    if (!cells.length) break;
    const c = pick(cells), dx = c.x - b.x, dy = c.y - b.y, dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
    tr = [...tr, { x: b.x, y: b.y, s: b.s, r: b.r, q: b.q }];
    blocks = blocks.map(o => o === b ? { ...o, x: c.x, y: c.y, r: SHAPES[o.s].sym ? 0 : dir, a: 0 } : o);
    states.push({ blocks, tr, ox: first.ox, oy: first.oy });
  }
  return { states: states.map((st, id) => ({ ...st, id })), capped: false };
}

// ---------- framed piece ----------
// A piece is a fixed starting shape run in Unmake with its source and caption always shown, and written into every download. It is reached only by its own address (?piece=unmake), is not in the random starters, and is not linked from the site.
const PIECES = {
  unmake: {
    rows: ['X.XXX', 'X.X..', 'XXXXX', '..X.X', 'XXX.X'],
    ref: 'United States Holocaust Memorial Museum. (n.d.). History of the swastika. Holocaust Encyclopedia. https://encyclopedia.ushmm.org/content/en/article/history-of-the-swastika',
    text: 'The symbol starts whole. Each iteration removes a block from it. The animation does not end until it has come apart. It is shown only to be taken apart, and the frames are never meant to stand alone.',
  },
};
let NOTE = null; // the active piece, when there is one
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function wrapText(t, n) { const out = []; let line = ''; t.split(' ').forEach(w => { if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }); if (line) out.push(line); return out; }
// The source and caption as SVG text under a drawing W wide. h is the height to reserve; svg(y0) draws it starting at y0.
function noteBlock(W) {
  const fs = Math.max(11, W / 70), n = Math.floor(W * 0.9 / (fs * 0.6)), lines = [...wrapText(NOTE.ref, n), '', ...wrapText(NOTE.text, n)];
  return { h: (lines.length + 2) * fs * 1.5, svg: y0 => lines.map((l, i) => l ? `<text x="${W * 0.05}" y="${y0 + fs * 2 + i * fs * 1.5}" font-family="monospace" font-style="italic" font-size="${fs}" fill="${INK}">${esc(l)}</text>` : '').join('') };
}

// ---------- rendering ----------
const defs = () => '<defs>' + Object.entries(SHAPES).map(([id, s]) => `<path id="${id}" d="${s.d}"/>` +
  [0, 90, 180, 270].map(a => `<clipPath id="c_${id}_${a}"><path d="${s.d}" transform="rotate(${a} 50 50)"/></clipPath>`).join('')).join('') +
  [1, 2, 3, 4, 5, 6, 7, 8].map(k => { const s = 40 / k; let d = ''; for (let x = -100; x <= 100; x += s) d += `M${+x.toFixed(2)} 0L${+(x + 100).toFixed(2)} 100`; return `<path id="ht${k}" fill="none" stroke-width="3.5" d="${d}"/>`; }).join('') +
  '<g id="hs" shape-rendering="crispEdges"><rect y="0" width="100" height="20"/><rect y="40" width="100" height="20"/><rect y="80" width="100" height="20"/></g>' +
  '<g id="vs" shape-rendering="crispEdges"><rect x="0" width="20" height="100"/><rect x="40" width="20" height="100"/><rect x="80" width="20" height="100"/></g></defs>';
// Direction: each block is three stripes running along its last move (vertical until it moves).
const stripes = b => `<g transform="translate(${b.x * U} ${b.y * U})" clip-path="url(#c_${b.s}_${ang(b)})"><use href="#${b.a === 0 ? 'hs' : 'vs'}"/></g>`;
// Density: a cell left k times is hatched at k times the line density, inside the shape that left it.
function hatch(tr) {
  const n = new Map(), seen = new Set();
  tr.forEach(t => n.set(t.x + ',' + t.y, (n.get(t.x + ',' + t.y) || 0) + 1));
  return tr.map(t => { const key = t.x + ',' + t.y + t.s + ang(t); if (seen.has(key)) return ''; seen.add(key);
    return `<g transform="translate(${t.x * U} ${t.y * U})" clip-path="url(#c_${t.s}_${ang(t)})"><use href="#ht${Math.min(8, n.get(t.x + ',' + t.y))}" stroke="${INK}"/></g>`; }).join('');
}
const use = (b, c = INK, o = 1) => `<use opacity="${o}" stroke="${c}" stroke-width="1.5" href="#${b.s}" transform="translate(${b.x * U} ${b.y * U}) rotate(${ang(b)} 50 50)"/>`;
// Transparency (onion skin): the blocks of the variants shown just before this one stay as fading ghosts.
const GHOSTS = [0.3, 0.2, 0.13, 0.09, 0.06, 0.04];
const ghosts = (chain, k) => GHOSTS.map((o, a) => { const j = k - 1 - a; if (j < 0) return null; const st = chain.states[j], s = chain.states[k];
  return { o, dx: st.ox - s.ox, dy: st.oy - s.oy, blocks: st.blocks }; }).filter(Boolean).reverse();
function frame(chain, k, mode) {
  const s = chain.states[k];
  if (mode === 'direction') return s.blocks.map(stripes).join('');
  return (mode === 'solid' ? s.tr.map(t => use(t)).join('') : mode === 'trans' ? ghosts(chain, k).map(g => `<g transform="translate(${g.dx * U} ${g.dy * U})">${g.blocks.map(b => use(b, INK, g.o)).join('')}</g>`).join('') + s.tr.map(t => use(t, INK, TONE)).join('') : mode === 'dens' ? hatch(s.tr) : '') + s.blocks.map(use).join('');
}
function bbox(chain, mode) {
  const all = chain.states.flatMap((s, k) => [...s.blocks, ...s.tr, ...(mode === 'trans' ? ghosts(chain, k).flatMap(g => g.blocks.map(b => ({ x: b.x + g.dx, y: b.y + g.dy }))) : [])]);
  const x0 = Math.min(...all.map(b => b.x)) - 1, y0 = Math.min(...all.map(b => b.y)) - 1;
  return { x: x0 * U, y: y0 * U, w: (Math.max(...all.map(b => b.x)) + 2 - (x0 + 1) + 1) * U, h: (Math.max(...all.map(b => b.y)) + 2 - (y0 + 1) + 1) * U };
}
const svgWrap = (w, h, inner, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${extra}><rect width="${w}" height="${h}" fill="${PAPER}"/>${defs()}${inner}</svg>`;
// Portrait paper sizes in mm (ISO A series). The contact sheet is laid out on one page of the chosen size and exported at that physical size.
const PAPERS = { A3: [297, 420], A2: [420, 594], A1: [594, 841], A0: [841, 1189] };
function sheetSVG(chain, mode, hidden = new Set(), edit = false, paper = 'A3') {
  const bb = bbox(chain, mode), n = chain.states.length, fh = bb.h + 120, [pw, ph] = PAPERS[paper] || PAPERS.A3, W = pw * 10, H = ph * 10, m = W * 0.06, nb = NOTE ? noteBlock(W) : null, band = nb ? nb.h : 0;
  // Choose the number of columns that makes the variants as large as possible on the page.
  let cols = 1, best = 0;
  for (let c = 1; c <= n; c++) { const sc = Math.min((W - 2 * m) / (c * bb.w), (H - 2 * m - band) / (Math.ceil(n / c) * fh)); if (sc > best) { best = sc; cols = c; } }
  let inner = '';
  chain.states.forEach((st, k) => {
    const cx = (k % cols) * bb.w, cy = Math.floor(k / cols) * fh, off = edit && hidden.has(st.id);
    inner += `<g data-id="${st.id}" opacity="${off ? 0.12 : 1}">` + (edit ? `<rect x="${cx}" y="${cy}" width="${bb.w}" height="${fh}" fill="transparent" style="cursor:pointer"/>` : '') +
      `<g transform="translate(${cx - bb.x} ${cy - bb.y})" fill="${INK}">${frame(chain, k, mode)}</g>` +
      `<text x="${cx + bb.w / 2}" y="${cy + bb.h + 70}" text-anchor="middle" font-family="sans-serif" font-size="40" fill="${INK}">${st.id}</text></g>`;
  });
  return svgWrap(W, H, `<g transform="translate(${(W - cols * bb.w * best) / 2} ${m}) scale(${best})">${inner}</g>` + (nb ? nb.svg(H - band - m / 2) : ''), `width="${pw}mm" height="${ph}mm"`);
}
function animSVG(chain, mode, ms) {
  const bb = bbox(chain, mode), n = chain.states.length, T = (n * ms / 1000).toFixed(2);
  let inner = '';
  chain.states.forEach((_, k) => {
    const a = (k / n).toFixed(4), b = ((k + 1) / n).toFixed(4);
    inner += `<g fill="${INK}" opacity="0" transform="translate(${-bb.x} ${-bb.y})"><animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${a};${b};1" values="0;1;0;0"/>${frame(chain, k, mode)}</g>`;
  });
  const nb = NOTE ? noteBlock(bb.w) : null;
  return svgWrap(bb.w, bb.h + (nb ? nb.h : 0), inner + (nb ? nb.svg(bb.h) : ''));
}

// ---------- UI ----------
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  let grid = Array(G * G).fill(null);
  let shape = 'square', chain = null, mode = 'form', cur = 0, timer = null;
  const mk = s => ({ s, r: 0, q: 0 });
  // Starter symbols, drawn in square blocks (X). One is picked at random on load; the Random symbol button picks another.
  const SYMBOLS = {
    T: ['XXX', '.X.', '.X.', '.X.'],
    cross: ['.X.', 'XXX', '.X.', '.X.', '.X.'],
    inverted: ['.X.', '.X.', '.X.', 'XXX', '.X.'],
    plus: ['.X.', 'XXX', '.X.'],
    ankh: ['XXX', 'X.X', 'XXX', '.X.', 'XXX', '.X.'],
    arrow: ['..X..', '.XXX.', 'XXXXX', '..X..', '..X..'],
    H: ['X.X', 'XXX', 'X.X'],
    ring: ['XXX', 'X.X', 'XXX'],
    tower: ['X.X.X', 'XXXXX', '.XXX.', '.XXX.'],
    U: ['X.X', 'X.X', 'XXX'],
    L: ['X.', 'X.', 'X.', 'XX'],
    stairs: ['X..', 'XX.', 'XXX'],
  };
  let lastSymbol = '';
  function startSymbol() {
    const names = Object.keys(SYMBOLS).filter(n => n !== lastSymbol), name = lastSymbol = names[Math.floor(Math.random() * names.length)], rows = SYMBOLS[name];
    grid = Array(G * G).fill(null);
    const ox = Math.floor((G - rows[0].length) / 2), oy = Math.floor((G - rows.length) / 2);
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') grid[(oy + y) * G + ox + x] = mk('square'); }));
    return name;
  }
  startSymbol();

  function drawGrid() {
    let h = '';
    for (let i = 0; i <= G; i++) h += `<path d="M${i * U} 0V${G * U}M0 ${i * U}H${G * U}" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>`;
    h += `<g fill="${YEL}">` + grid.map((c, i) => c ? use({ ...c, x: i % G, y: Math.floor(i / G) }, YEL) : '').join('') + '</g>';
    $('grid').setAttribute('viewBox', `0 0 ${G * U} ${G * U}`);
    $('grid').innerHTML = defs() + h;
    updateCount();
  }
  $('grid').addEventListener('click', e => {
    const r = $('grid').getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * G), y = Math.floor((e.clientY - r.top) / r.height * G), i = y * G + x;
    // Empty cell: place. Same shape: turn a quarter (removed after the fourth turn, or at once for square and circle). Other shape: replace.
    const c = grid[i];
    grid[i] = !c || c.s !== shape ? mk(shape) : SHAPES[c.s].sym || c.q === 3 ? null : { ...c, q: c.q + 1 };
    drawGrid();
  });
  $('palette').innerHTML = Object.entries(SHAPES).map(([id, s]) =>
    `<button role="radio" aria-checked="${id === shape}" aria-label="${id}" data-s="${id}"><svg viewBox="0 0 100 100"><path d="${s.d}"/></svg></button>`).join('');
  $('palette').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; shape = b.dataset.s;
    [...$('palette').children].forEach(c => c.setAttribute('aria-checked', c === b));
  });

  let hidden = new Set();
  const kept = () => ({ ...chain, states: chain.states.filter(st => !hidden.has(st.id)) });
  let paper = 'A3';
  const renderSheet = () => { $('sheet').innerHTML = sheetSVG(chain, mode, hidden, true, paper); };
  function show() {
    if (!chain) return;
    const kc = kept();
    if (!kc.states.length) { clearInterval(timer); $('anim').innerHTML = ''; renderSheet(); return; }
    const bb = bbox(kc, mode);
    $('anim').setAttribute('viewBox', `0 0 ${bb.w} ${bb.h}`);
    renderSheet();
    clearInterval(timer); cur = 0;
    const draw = () => { $('anim').innerHTML = defs() + `<g fill="${INK}" transform="translate(${-bb.x} ${-bb.y})">${frame(kc, cur, mode)}</g>`; cur = (cur + 1) % kc.states.length; };
    draw(); timer = setInterval(draw, +$('spd').value);
  }
  const startBlocks = () => grid.map((c, i) => c && { x: i % G, y: Math.floor(i / G), s: c.s, r: 0, q: c.q }).filter(Boolean);
  // The subtitle number follows the grid, Moves and view live.
  let act = 'make'; // the rule: make (a block moves and stays joined), unmake (a block is taken away) or rearrange (a block moves away from the rest)
  const verb = () => $('verb').textContent = act === 'make' ? 'make you up' : 'unmake you';
  function updateCount() {
    const st = startBlocks();
    $('count').textContent = act !== 'make' ? st.length : st.length && connected(st) ? variants(st, MOVES, mode === 'direction', TRACED.has(mode)).states.length - 1 : 0;
  }
  function process() {
    const start = startBlocks();
    if (!start.length) return $('msg').textContent = 'Place some blocks first.';
    if (act === 'make' && !connected(start)) return $('msg').textContent = 'Blocks must touch edge to edge.';
    hidden = new Set();
    chain = act === 'unmake' ? unmake(start) : act === 'rearrange' ? scatter(start, G) : variants(start, MOVES, mode === 'direction', TRACED.has(mode));
    const n = chain.states.length - 1;
    $('msg').textContent = act === 'unmake' ? `${n} step${n > 1 ? 's' : ''}. Each takes one block away; nothing is added back.` : act === 'rearrange' ? `${n} step${n > 1 ? 's' : ''}. Each moves one block away from the rest.` : n ? `${n} variant${n > 1 ? 's' : ''}${chain.capped ? ` (stopped at the cap of ${MAXCAP})` : ''}.` : 'No variants: nothing can move.';
    show();
    document.body.classList.add('view-results'); paneSwitch();
  }
  const dl = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
  $('size').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    // The blocks stay: they are re-entered, centred, in the new grid. If they do not fit, the size is left alone.
    const n = +a.dataset.n, cells = grid.map((c, i) => c && { c, x: i % G, y: Math.floor(i / G) }).filter(Boolean);
    let ng = Array(n * n).fill(null);
    if (cells.length) {
      const x0 = Math.min(...cells.map(p => p.x)), y0 = Math.min(...cells.map(p => p.y)), w = Math.max(...cells.map(p => p.x)) - x0 + 1, h = Math.max(...cells.map(p => p.y)) - y0 + 1;
      if (w > n || h > n) return $('msg').textContent = `Your shape is ${w} by ${h}; it needs a larger grid than ${n}.`;
      const ox = Math.floor((n - w) / 2), oy = Math.floor((n - h) / 2);
      cells.forEach(p => ng[(oy + p.y - y0) * n + ox + p.x - x0] = p.c);
    }
    [...$('size').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === a));
    G = n; grid = ng; $('msg').textContent = ''; drawGrid(); if (chain) process();
  });
  $('process').onclick = process;
  $('act').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    [...$('act').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === a));
    act = a.dataset.a; verb(); updateCount(); if (chain) process();
  });
  $('random').onclick = () => { $('msg').textContent = 'Starter: ' + startSymbol() + '.'; drawGrid(); };
  $('clear').onclick = () => { grid.fill(null); drawGrid(); };
  $('spd').oninput = () => { $('spdOut').textContent = $('spd').value + ' ms'; show(); };
  document.querySelectorAll('input[name=mode]').forEach(r => r.onchange = () => { mode = r.value; updateCount(); if (chain) process(); });
  $('sheet').addEventListener('click', e => { const g = e.target.closest('[data-id]'); if (!g) return; const id = +g.dataset.id; hidden.has(id) ? hidden.delete(id) : hidden.add(id); show(); });
  $('paper').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    [...$('paper').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === a));
    paper = a.dataset.p; if (chain) renderSheet();
  });
  $('dlSheet').onclick = () => chain && kept().states.length && dl(`form-sheet-${mode}-${paper}.svg`, sheetSVG(kept(), mode, new Set(), false, paper));
  $('dlAnim').onclick = () => chain && dl(`form-anim-${mode}.svg`, animSVG(kept(), mode, +$('spd').value));
  $('dlFrame').onclick = () => { if (!chain) return; const kc = kept(); if (!kc.states.length) return; const bb = bbox(kc, mode), k = (cur + kc.states.length - 1) % kc.states.length; dl(`form-frame-${kc.states[k].id}.svg`, (() => { const nb = NOTE ? noteBlock(bb.w) : null; return svgWrap(bb.w, bb.h + (nb ? nb.h : 0), `<g fill="${INK}" transform="translate(${-bb.x} ${-bb.y})">${frame(kc, k, mode)}</g>` + (nb ? nb.svg(bb.h) : '')); })()); };
  const sync = r => r.style.setProperty('--to', (r.value - r.min) / (r.max - r.min) * 100 + '%');
  document.querySelectorAll('input[type=range]').forEach(r => { sync(r); r.addEventListener('input', () => sync(r)); });
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'd' && !/INPUT/.test(e.target.tagName)) $('panel').classList.toggle('hidden'); });
  // Phones: the grid and shapes live on the screen, the settings in the sheet. One element moves between the two places.
  const small = matchMedia('(pointer: coarse), (max-width: 600px)');
  const placeDraw = () => { $(small.matches ? 'drawHostScreen' : 'drawHostPanel').prepend($('drawBox')); (small.matches ? $('processHostScreen') : $('panel').querySelector('.cp-foot')).prepend($('processRow')); };
  small.addEventListener('change', () => { placeDraw(); sizeBody(); });
  const sizeBody = () => { document.body.style.paddingBottom = small.matches ? $('panel').offsetHeight + 16 + 'px' : ''; };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(sizeBody).observe($('panel'));
  function paneSwitch() {
    const res = document.body.classList.contains('view-results');
    [...$('paneSwitch').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', (x.dataset.pane === 'results') === res));
  }
  $('paneSwitch').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    if (a.dataset.pane === 'results' && !chain) { $('msg').textContent = 'Press Process first.'; return; }
    document.body.classList.toggle('view-results', a.dataset.pane === 'results'); paneSwitch();
  });
  placeDraw();
  if (small.matches) { $('panel').classList.add('collapsed'); $('grab').setAttribute('aria-expanded', 'false'); $('grab').setAttribute('aria-label', 'Open controls'); }
  sizeBody();
  $('grab').onclick = () => { const c = $('panel').classList.toggle('collapsed'); document.body.classList.toggle('sheet-collapsed', c); $('grab').setAttribute('aria-expanded', !c); $('grab').setAttribute('aria-label', c ? 'Open controls' : 'Collapse controls'); };
  const pieceName = new URLSearchParams(location.search).get('piece');
  if (PIECES[pieceName]) {
    const P = PIECES[pieceName]; NOTE = P;
    grid = Array(G * G).fill(null);
    const ox = Math.floor((G - P.rows[0].length) / 2), oy = Math.floor((G - P.rows.length) / 2);
    P.rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') grid[(oy + y) * G + ox + x] = mk('square'); }));
    act = 'unmake'; verb(); [...$('act').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x.dataset.a === 'unmake'));
    $('spd').value = 250; $('spdOut').textContent = '250 ms'; sync($('spd'));
    $('pieceNote').innerHTML = `<p>${P.ref.replace(/(https?:\/\/\S+)/, '<a href="$1">$1</a>')}</p><p>${P.text}</p>`;
    $('pieceNote').hidden = false; document.body.classList.add('piece');
    drawGrid(); process();
  }
  drawGrid();
} else module.exports = { variants, unmake, scatter, connected, sheetSVG };
