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
function norm(bl, tr) {
  const mx = Math.min(...bl.map(b => b.x)), my = Math.min(...bl.map(b => b.y));
  return {
    blocks: bl.map(b => ({ ...b, x: b.x - mx, y: b.y - my, r: SHAPES[b.s].sym ? 0 : b.r })).sort((p, q) => p.y - q.y || p.x - q.x),
    tr: tr.map(t => ({ ...t, x: t.x - mx, y: t.y - my })),
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
          const n = norm(nb, [...st.tr, { x: old.x, y: old.y, s: old.s, r: old.r, q: old.q }]);
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
function frame(chain, k, mode) {
  const s = chain.states[k];
  if (mode === 'direction') return s.blocks.map(stripes).join('');
  return (mode === 'solid' ? s.tr.map(t => use(t)).join('') : mode === 'trans' ? s.tr.map(t => use(t, INK, TONE)).join('') : mode === 'dens' ? hatch(s.tr) : '') + s.blocks.map(use).join('');
}
function bbox(chain) {
  const all = chain.states.flatMap(s => [...s.blocks, ...s.tr]);
  const x0 = Math.min(...all.map(b => b.x)) - 1, y0 = Math.min(...all.map(b => b.y)) - 1;
  return { x: x0 * U, y: y0 * U, w: (Math.max(...all.map(b => b.x)) + 2 - (x0 + 1) + 1) * U, h: (Math.max(...all.map(b => b.y)) + 2 - (y0 + 1) + 1) * U };
}
const svgWrap = (w, h, inner, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${extra}><rect width="${w}" height="${h}" fill="${PAPER}"/>${defs()}${inner}</svg>`;
function sheetSVG(chain, mode, hidden = new Set(), edit = false) {
  const bb = bbox(chain), n = chain.states.length, cols = Math.min(n > 36 ? 20 : 6, Math.ceil(Math.sqrt(n))), rows = Math.ceil(n / cols), fh = bb.h + 120;
  let inner = '';
  chain.states.forEach((st, k) => {
    const cx = (k % cols) * bb.w, cy = Math.floor(k / cols) * fh, off = edit && hidden.has(st.id);
    inner += `<g data-id="${st.id}" opacity="${off ? 0.12 : 1}">` + (edit ? `<rect x="${cx}" y="${cy}" width="${bb.w}" height="${fh}" fill="transparent" style="cursor:pointer"/>` : '') +
      `<g transform="translate(${cx - bb.x} ${cy - bb.y})" fill="${INK}">${frame(chain, k, mode)}</g>` +
      `<text x="${cx + bb.w / 2}" y="${cy + bb.h + 70}" text-anchor="middle" font-family="sans-serif" font-size="40" fill="${INK}">${st.id}</text></g>`;
  });
  return svgWrap(cols * bb.w, rows * fh, inner);
}
function animSVG(chain, mode, ms) {
  const bb = bbox(chain), n = chain.states.length, T = (n * ms / 1000).toFixed(2);
  let inner = '';
  chain.states.forEach((_, k) => {
    const a = (k / n).toFixed(4), b = ((k + 1) / n).toFixed(4);
    inner += `<g fill="${INK}" opacity="0" transform="translate(${-bb.x} ${-bb.y})"><animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${a};${b};1" values="0;1;0;0"/>${frame(chain, k, mode)}</g>`;
  });
  return svgWrap(bb.w, bb.h, inner);
}

// ---------- UI ----------
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  let grid = Array(G * G).fill(null);
  let shape = 'square', chain = null, mode = 'form', cur = 0, timer = null;
  const mk = s => ({ s, r: 0, q: 0 });
  function startT() {
    grid = Array(G * G).fill(null);
    const ox = Math.floor((G - 3) / 2), oy = Math.floor((G - 5) / 2);
    [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2], [1, 3]].forEach(([x, y]) => grid[(oy + y) * G + ox + x] = mk('square'));
  }
  startT();

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
  function show() {
    if (!chain) return;
    const kc = kept();
    if (!kc.states.length) { clearInterval(timer); $('anim').innerHTML = ''; $('sheet').innerHTML = sheetSVG(chain, mode, hidden, true); return; }
    const bb = bbox(kc);
    $('anim').setAttribute('viewBox', `0 0 ${bb.w} ${bb.h}`);
    $('sheet').innerHTML = sheetSVG(chain, mode, hidden, true);
    clearInterval(timer); cur = 0;
    const draw = () => { $('anim').innerHTML = defs() + `<g fill="${INK}" transform="translate(${-bb.x} ${-bb.y})">${frame(kc, cur, mode)}</g>`; cur = (cur + 1) % kc.states.length; };
    draw(); timer = setInterval(draw, +$('spd').value);
  }
  const startBlocks = () => grid.map((c, i) => c && { x: i % G, y: Math.floor(i / G), s: c.s, r: 0, q: c.q }).filter(Boolean);
  // The subtitle number follows the grid, Moves and view live.
  function updateCount() {
    const st = startBlocks();
    $('count').textContent = st.length && connected(st) ? variants(st, +$('len').value, mode === 'direction', TRACED.has(mode)).states.length - 1 : 0;
  }
  function process() {
    const start = startBlocks();
    if (!start.length) return $('msg').textContent = 'Place some blocks first.';
    if (!connected(start)) return $('msg').textContent = 'Blocks must touch edge to edge.';
    hidden = new Set();
    chain = variants(start, +$('len').value, mode === 'direction', TRACED.has(mode));
    const n = chain.states.length - 1;
    $('msg').textContent = n ? `${n} variant${n > 1 ? 's' : ''}${chain.capped ? ` (stopped at the cap of ${MAXCAP})` : ''}.` : 'No variants: nothing can move.';
    show();
  }
  const dl = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
  $('size').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    [...$('size').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === a));
    G = +a.dataset.n; chain = null; clearInterval(timer); $('sheet').innerHTML = ''; $('anim').innerHTML = ''; startT(); drawGrid();
  });
  $('process').onclick = process;
  $('clear').onclick = () => { grid.fill(null); drawGrid(); };
  $('len').oninput = () => { $('lenOut').textContent = $('len').value; updateCount(); };
  $('spd').oninput = () => { $('spdOut').textContent = $('spd').value + ' ms'; show(); };
  document.querySelectorAll('input[name=mode]').forEach(r => r.onchange = () => { mode = r.value; updateCount(); if (chain) process(); });
  $('sheet').addEventListener('click', e => { const g = e.target.closest('[data-id]'); if (!g) return; const id = +g.dataset.id; hidden.has(id) ? hidden.delete(id) : hidden.add(id); show(); });
  $('dlSheet').onclick = () => chain && kept().states.length && dl(`form-sheet-${mode}-${$('len').value}moves.svg`, sheetSVG(kept(), mode));
  $('dlAnim').onclick = () => chain && dl(`form-anim-${mode}-${$('len').value}moves.svg`, animSVG(kept(), mode, +$('spd').value));
  $('dlFrame').onclick = () => { if (!chain) return; const kc = kept(); if (!kc.states.length) return; const bb = bbox(kc), k = (cur + kc.states.length - 1) % kc.states.length; dl(`form-frame-${kc.states[k].id}.svg`, svgWrap(bb.w, bb.h, `<g fill="${INK}" transform="translate(${-bb.x} ${-bb.y})">${frame(kc, k, mode)}</g>`)); };
  const sync = r => r.style.setProperty('--to', (r.value - r.min) / (r.max - r.min) * 100 + '%');
  document.querySelectorAll('input[type=range]').forEach(r => { sync(r); r.addEventListener('input', () => sync(r)); });
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'd' && !/INPUT/.test(e.target.tagName)) $('panel').classList.toggle('hidden'); });
  $('grab').onclick = () => { const c = $('panel').classList.toggle('collapsed'); document.body.classList.toggle('sheet-collapsed', c); $('grab').setAttribute('aria-expanded', !c); $('grab').setAttribute('aria-label', c ? 'Open controls' : 'Collapse controls'); };
  drawGrid();
} else module.exports = { variants, connected, sheetSVG };
