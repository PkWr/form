'use strict';
// Form — pick blocks on a 16x16 grid; a chain of moves leaves traces; export as SVG.
const G = 16, U = 100, INK = '#111', PAPER = '#f4f2ee', YEL = '#ffe100';
// Shape library: paths in a 100x100 cell. sign = turn direction (mirror pairs turn opposite ways).
const SHAPES = {
  square: { d: 'M0 0H100V100H0Z', sign: 1 },
  archR:  { d: 'M0 0A100 100 0 0 1 100 100L0 100Z', sign: 1 },
  archL:  { d: 'M100 0A100 100 0 0 0 0 100L100 100Z', sign: -1 },
  circle: { d: 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z', sign: 1 },
};
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // right, down, left, up

// ---------- engine ----------
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function connected(cells) {
  if (!cells.length) return false;
  const set = new Set(cells.map(c => c.x + ',' + c.y)), seen = new Set([cells[0].x + ',' + cells[0].y]), q = [cells[0]];
  while (q.length) { const c = q.pop(); for (const [dx, dy] of DIRS) { const k = (c.x + dx) + ',' + (c.y + dy); if (set.has(k) && !seen.has(k)) { seen.add(k); q.push({ x: c.x + dx, y: c.y + dy }); } } }
  return seen.size === set.size;
}
// Chain: each step moves one random block one cell (staying connected), turns it, leaves a trace.
function buildChain(start, len, seed) {
  const rand = rng(seed), blocks = start.map(b => ({ ...b })), traces = [], states = [{ blocks: blocks.map(b => ({ ...b })), tc: 0 }];
  for (let n = 1; n <= len; n++) {
    const occ = new Set(blocks.map(b => b.x + ',' + b.y)), cand = [];
    blocks.forEach((b, i) => DIRS.forEach(([dx, dy], d) => {
      const nx = b.x + dx, ny = b.y + dy;
      if (nx < 0 || ny < 0 || nx >= G || ny >= G || occ.has(nx + ',' + ny)) return;
      const after = blocks.map((o, j) => j === i ? { x: nx, y: ny } : o);
      if (connected(after)) cand.push([i, d, nx, ny]);
    }));
    if (!cand.length) break;
    const [i, d, nx, ny] = cand[Math.floor(rand() * cand.length)], b = blocks[i];
    traces.push({ ...b }); b.x = nx; b.y = ny; b.r = d;
    states.push({ blocks: blocks.map(o => ({ ...o })), tc: traces.length });
  }
  return { states, traces };
}

// ---------- rendering ----------
const defs = () => '<defs>' + Object.entries(SHAPES).map(([id, s]) => `<path id="${id}" d="${s.d}"/>`).join('') + '</defs>';
const use = (b, c = INK) => `<use stroke="${c}" stroke-width="1.5" href="#${b.s}" transform="translate(${b.x * U} ${b.y * U}) rotate(${SHAPES[b.s].sign * 90 * b.r} 50 50)"/>`;
function frame(chain, k, mode) {
  const s = chain.states[k];
  return (mode === 'solid' ? chain.traces.slice(0, s.tc).map(use).join('') : '') + s.blocks.map(use).join('');
}
function bbox(chain) {
  const all = [...chain.traces, ...chain.states.flatMap(s => s.blocks)];
  const x0 = Math.min(...all.map(b => b.x)) - 1, y0 = Math.min(...all.map(b => b.y)) - 1;
  return { x: x0 * U, y: y0 * U, w: (Math.max(...all.map(b => b.x)) + 2 - (x0 + 1) + 1) * U, h: (Math.max(...all.map(b => b.y)) + 2 - (y0 + 1) + 1) * U };
}
const svgWrap = (w, h, inner, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${extra}><rect width="${w}" height="${h}" fill="${PAPER}"/>${defs()}${inner}</svg>`;
function sheetSVG(chain, mode) {
  const bb = bbox(chain), n = chain.states.length, cols = Math.min(6, Math.ceil(Math.sqrt(n))), rows = Math.ceil(n / cols), fh = bb.h + 120;
  let inner = '';
  chain.states.forEach((_, k) => {
    const cx = (k % cols) * bb.w, cy = Math.floor(k / cols) * fh;
    inner += `<g transform="translate(${cx - bb.x} ${cy - bb.y})" fill="${INK}">${frame(chain, k, mode)}</g>` +
      `<text x="${cx + bb.w / 2}" y="${cy + bb.h + 70}" text-anchor="middle" font-family="sans-serif" font-size="40" fill="${INK}">${k}</text>`;
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
  const grid = Array(G * G).fill(null);
  let shape = 'square', chain = null, mode = 'form', cur = 0, timer = null;
  const mk = (s, m = {}) => ({ s, r: 0, ...m });
  // starting shape: a T
  [[6, 5], [7, 5], [8, 5], [7, 6], [7, 7], [7, 8]].forEach(([x, y]) => grid[y * G + x] = mk('square'));

  function drawGrid() {
    let h = '';
    for (let i = 0; i <= G; i++) h += `<path d="M${i * U} 0V${G * U}M0 ${i * U}H${G * U}" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>`;
    h += `<g fill="${YEL}">` + grid.map((c, i) => c ? use({ ...c, x: i % G, y: Math.floor(i / G) }, YEL) : '').join('') + '</g>';
    $('grid').innerHTML = defs() + h;
  }
  $('grid').addEventListener('click', e => {
    const r = $('grid').getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * G), y = Math.floor((e.clientY - r.top) / r.height * G), i = y * G + x;
    grid[i] = grid[i] ? null : mk(shape); drawGrid();
  });
  $('palette').innerHTML = Object.entries(SHAPES).map(([id, s]) =>
    `<button role="radio" aria-checked="${id === shape}" aria-label="${id}" data-s="${id}"><svg viewBox="0 0 100 100"><path d="${s.d}"/></svg></button>`).join('');
  $('palette').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; shape = b.dataset.s;
    [...$('palette').children].forEach(c => c.setAttribute('aria-checked', c === b));
  });

  function show() {
    if (!chain) return;
    const bb = bbox(chain);
    $('anim').setAttribute('viewBox', `0 0 ${bb.w} ${bb.h}`);
    $('sheet').innerHTML = sheetSVG(chain, mode);
    clearInterval(timer); cur = 0;
    const draw = () => { $('anim').innerHTML = defs() + `<g fill="${INK}" transform="translate(${-bb.x} ${-bb.y})">${frame(chain, cur, mode)}</g>`; cur = (cur + 1) % chain.states.length; };
    draw(); timer = setInterval(draw, +$('spd').value);
  }
  function process() {
    const start = grid.map((c, i) => c && { x: i % G, y: Math.floor(i / G), s: c.s, r: 0 }).filter(Boolean);
    if (!start.length) return $('msg').textContent = 'Place some blocks first.';
    if (!connected(start)) return $('msg').textContent = 'Blocks must touch edge to edge.';
    chain = buildChain(start, +$('len').value, +$('seed').value);
    $('msg').textContent = chain.states.length - 1 < +$('len').value ? `Stopped at step ${chain.states.length - 1}: no legal move.` : '';
    show();
  }
  const dl = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
  $('process').onclick = process;
  $('reroll').onclick = () => { $('seed').value = Math.floor(Math.random() * 1e6); process(); };
  $('clear').onclick = () => { grid.fill(null); drawGrid(); };
  $('len').oninput = () => $('lenOut').textContent = $('len').value;
  $('spd').oninput = () => { $('spdOut').textContent = $('spd').value + ' ms'; show(); };
  document.querySelectorAll('input[name=mode]').forEach(r => r.onchange = () => { mode = r.value; show(); });
  $('dlSheet').onclick = () => chain && dl(`form-sheet-${mode}-seed${$('seed').value}.svg`, sheetSVG(chain, mode));
  $('dlAnim').onclick = () => chain && dl(`form-anim-${mode}-seed${$('seed').value}.svg`, animSVG(chain, mode, +$('spd').value));
  $('dlFrame').onclick = () => { if (!chain) return; const bb = bbox(chain), k = (cur + chain.states.length - 1) % chain.states.length; dl(`form-frame-${k}.svg`, svgWrap(bb.w, bb.h, `<g fill="${INK}" transform="translate(${-bb.x} ${-bb.y})">${frame(chain, k, mode)}</g>`)); };
  const sync = r => r.style.setProperty('--to', (r.value - r.min) / (r.max - r.min) * 100 + '%');
  document.querySelectorAll('input[type=range]').forEach(r => { sync(r); r.addEventListener('input', () => sync(r)); });
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'd' && !/INPUT/.test(e.target.tagName)) $('panel').classList.toggle('hidden'); });
  drawGrid();
} else module.exports = { buildChain, connected };
