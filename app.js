'use strict';
// Form — pick blocks on a 16x16 grid; a chain of moves leaves traces; export as SVG.
let G = 9;
const U = 100, MAXCAP = 500, TONE = 0.22, YEL = '#ffe100';
let INK = '#111111', PAPER = '#f4f2ee'; // the artwork's colours, set from the Colour setting
const mixHex = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
// Isometric: a second view beside the treatments. Every treatment is drawn as normal and the whole drawing is then laid onto the isometric plane (x' = (x - y) cos 30, y' = (x + y) / 2),
// with each current block given a little thickness, drawn under the tops as a few copies of the block shifted down in a mid tone.
let ISO = false;
const ISO_D = 0.4, ISO_M = 'matrix(0.866 0.5 -0.866 0.5 0 0)';
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
  const out = [first, ...(prev === first ? [] : prev)].map((st, id) => ({ ...st, id }));
  return { states: out, capped, orig: out[0] };
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
  const out = states.map((st, id) => ({ ...st, id }));
  return { states: out, capped: false, orig: out[0] };
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
// The count travels with the artwork: every export carries a title line such as "36 ways I can make you up".
// Iterations are numbered in lower-case Roman numerals, as the sections of the book are. The original has no number.
const roman = n => { let r = ''; [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']].forEach(([v, t]) => { while (n >= v) { r += t; n -= v; } }); return r; };
const waysLabel = (n, verb) => `${n} way${n === 1 ? '' : 's'} I can ${verb}`;
function titleBlock(W, text) { const fs = Math.max(14, W / 36); return { h: fs * 2.4, svg: `<text x="${W * 0.05}" y="${fs * 1.5}" font-family="monospace" font-style="italic" font-size="${fs}" fill="${INK}">${esc(text)}</text>` }; }
const defs = () => '<defs>' + Object.entries(SHAPES).map(([id, s]) => `<path id="${id}" d="${s.d}"/>` +
  [0, 90, 180, 270].map(a => `<clipPath id="c_${id}_${a}"><path d="${s.d}" transform="rotate(${a} 50 50)"/></clipPath>`).join('')).join('') +
  `<path id="hl" fill="none" stroke-width="1.1" d="${(() => { let d = ''; for (let x = -30; x <= 130; x += 3.2) d += `M${+x.toFixed(1)} -30V130`; return d; })()}"/>` +
  '</defs>';
// Direction: each block is three stripes running along its last move (vertical until it moves).
// Direction stripes: three lines of equal width with equal gaps, flush to the cell edge on open sides (as in the book). Where a block with stripes the same way
// touches this one, that side is inset by half a gap, so the two blocks together make an even gap and not a doubled line. Line width follows: 20% of the cell flush
// both sides, about 18% with one side inset, about 17% with both. Square blocks draw unclipped and a hair long so joined lines have no seam.
function stripeRects(b, all, over) {
  const v = b.a === 1, has = (dx, dy) => all.some(o => o.x === b.x + dx && o.y === b.y + dy && o.a === b.a);
  const nl = v ? has(-1, 0) : has(0, -1), nr = v ? has(1, 0) : has(0, 1), w = 100 / (5 + 0.5 * nl + 0.5 * nr), L = nl ? w / 2 : 0, e = over ? 0.6 : 0;
  return [0, 1, 2].map(i => { const p = L + i * 2 * w; return v ? [p, -e, w, 100 + 2 * e] : [-e, p, 100 + 2 * e, w]; });
}
const stripes = (b, all) => { const sq = b.s === 'square'; return `<g transform="translate(${b.x * U} ${b.y * U})"${sq ? '' : ` clip-path="url(#c_${b.s}_${ang(b)})"`}>${stripeRects(b, all, sq).map(([x, y, w, h]) => `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}"/>`).join('')}</g>`; };
const n3 = v => +v.toFixed(3);
// Density: every block is drawn as fine lines, and each iteration adds a layer at its own angle. Where layers overlap the lines cross into a darker mesh,
// so tone builds up as texture. Layers: the original (vertical), this variant, and the two variants before it.
const DENS = [0, 45, 135, 90];
function densLayers(chain, k) {
  const s = chain.states[k], o = chain.orig || chain.states[0];
  const layer = (blocks, dx, dy, a) => blocks.map(b => `<g transform="translate(${(b.x + dx) * U} ${(b.y + dy) * U})" clip-path="url(#c_${b.s}_${ang(b)})"><use href="#hl" stroke="${INK}" transform="rotate(${a} 50 50)"/></g>`).join('');
  let out = layer(o.blocks, o.ox - s.ox, o.oy - s.oy, DENS[0]);
  if (s !== o) out += layer(s.blocks, 0, 0, DENS[1]);
  for (let a = 1; a <= 2; a++) { const j = k - a; if (j >= 0 && chain.states[j] !== o && chain.states[j] !== s) out += layer(chain.states[j].blocks, chain.states[j].ox - s.ox, chain.states[j].oy - s.oy, DENS[1 + a]); }
  return out;
}
const use = (b, c = INK, o = 1) => `<use opacity="${o}" stroke="${c}" stroke-width="1.5" href="#${b.s}" transform="translate(${b.x * U} ${b.y * U}) rotate(${ang(b)} 50 50)"/>`;
// Transparency (onion skin): the blocks of the variants shown just before this one stay as fading ghosts.
const GHOSTS = [0.3, 0.2, 0.13, 0.09, 0.06, 0.04];
const ghosts = (chain, k) => GHOSTS.map((o, a) => { const j = k - 1 - a; if (j < 0) return null; const st = chain.states[j], s = chain.states[k];
  return { o, dx: st.ox - s.ox, dy: st.oy - s.oy, blocks: st.blocks }; }).filter(Boolean).reverse();
function frame(chain, k, mode) {
  if (!ISO) return frame0(chain, k, mode);
  const s = chain.states[k], side = mixHex(INK, PAPER, 0.5);
  const sides = [1 / 3, 2 / 3, 1].map(t => `<g transform="translate(0 ${n3(t * ISO_D * U)}) ${ISO_M}" fill="${side}">${s.blocks.map(b => use(b, side)).join('')}</g>`).join('');
  return sides + `<g transform="${ISO_M}">${frame0(chain, k, mode)}</g>`;
}
function frame0(chain, k, mode) {
  const s = chain.states[k];
  if (mode === 'direction') return s.blocks.map(b => stripes(b, s.blocks)).join('');
  if (mode === 'dens') return densLayers(chain, k);
  return (mode === 'solid' ? s.tr.map(t => use(t)).join('') : mode === 'trans' ? ghosts(chain, k).map(g => `<g transform="translate(${g.dx * U} ${g.dy * U})">${g.blocks.map(b => use(b, INK, g.o)).join('')}</g>`).join('') + s.tr.map(t => use(t, INK, TONE)).join('') : '') + s.blocks.map(use).join('');
}
function bbox(chain, mode) {
  const all = chain.states.flatMap((s, k) => [...s.blocks, ...s.tr, ...(mode === 'dens' ? (chain.orig || chain.states[0]).blocks.map(b => ({ x: b.x + (chain.orig || chain.states[0]).ox - s.ox, y: b.y + (chain.orig || chain.states[0]).oy - s.oy })) : []), ...(mode === 'trans' ? ghosts(chain, k).flatMap(g => g.blocks.map(b => ({ x: b.x + g.dx, y: b.y + g.dy }))) : [])]);
  if (ISO) { // projected extents of every cell corner, plus the thickness
    let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9;
    all.forEach(p => { for (let i = 0; i < 4; i++) { const cx = p.x + (i & 1), cy = p.y + (i >> 1), qx = (cx - cy) * 0.866, qy = (cx + cy) * 0.5; if (qx < xa) xa = qx; if (qx > xb) xb = qx; if (qy < ya) ya = qy; if (qy > yb) yb = qy; } });
    return { x: (xa - 0.6) * U, y: (ya - 0.6) * U, w: (xb - xa + 1.2) * U, h: (yb - ya + ISO_D + 1.2) * U };
  }
  const x0 = Math.min(...all.map(b => b.x)) - 1, y0 = Math.min(...all.map(b => b.y)) - 1;
  return { x: x0 * U, y: y0 * U, w: (Math.max(...all.map(b => b.x)) + 2 - (x0 + 1) + 1) * U, h: (Math.max(...all.map(b => b.y)) + 2 - (y0 + 1) + 1) * U };
}
// Credit and terms travel with every file: in SVGs as a description and Dublin Core metadata (no title element, which would show as a tooltip), in PDFs as document properties, in GIFs as a comment.
const CREDIT = 'Made with Form, form.pkwr.co. \u00a9 2026 Patrick Walker. Free to share and print for non-commercial use with this credit; ask before commercial use.';
const metaSVG = `<desc>${CREDIT}</desc><metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><rdf:Description><dc:creator>Patrick Walker</dc:creator><dc:publisher>form.pkwr.co</dc:publisher><dc:rights>${CREDIT}</dc:rights></rdf:Description></rdf:RDF></metadata>`;
const svgWrap = (w, h, inner, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${extra}>${metaSVG}<rect width="${w}" height="${h}" fill="${PAPER}"/>${defs()}${inner}</svg>`;
// Portrait paper sizes in mm (ISO A series). The contact sheet is laid out on one page of the chosen size and exported at that physical size.
const PAPERS = { A3: [297, 420], A2: [420, 594], A1: [594, 841], A0: [841, 1189] };
const n2s = v => +v.toFixed(1);
function sheetSVG(chain, mode, hidden = new Set(), edit = false, paper = 'A3', title = '') {
  const bb = bbox(chain, mode), n = chain.states.length, fh = bb.h + 120, [pw, ph] = PAPERS[paper] || PAPERS.A3, W = pw * 10, H = ph * 10, m = W * 0.06, nb = NOTE ? noteBlock(W) : null, band = nb ? nb.h + (title ? 160 : 0) : 0, top = 0, fs = W / 105;
  // The title sits small in the bottom left corner with the name, in the margin, not across the top.
  const cap = title ? `<text x="${m}" y="${n2s(H - m * 0.55 - fs * 1.7)}" font-family="Times New Roman, Times, serif" font-style="italic" font-size="${n2s(fs * 1.2)}" fill="${INK}">${esc(title)}</text><text x="${m}" y="${n2s(H - m * 0.55)}" font-family="Helvetica, Arial, sans-serif" font-size="${n2s(fs * 0.85)}" fill="${INK}">Form by Patrick Walker, form.pkwr.co</text>` : '';
  // Choose the number of columns that makes the variants as large as possible on the page.
  let cols = 1, best = 0;
  for (let c = 1; c <= n; c++) { const sc = Math.min((W - 2 * m) / (c * bb.w), (H - 2 * m - band - top) / (Math.ceil(n / c) * fh)); if (sc > best) { best = sc; cols = c; } }
  let inner = '';
  chain.states.forEach((st, k) => {
    const cx = (k % cols) * bb.w, cy = Math.floor(k / cols) * fh, off = edit && hidden.has(st.id);
    inner += `<g data-id="${st.id}" opacity="${off ? 0.12 : 1}">` + (edit ? `<rect x="${cx}" y="${cy}" width="${bb.w}" height="${fh}" fill="transparent" style="cursor:pointer"/>` : '') +
      `<g transform="translate(${cx - bb.x} ${cy - bb.y})" fill="${INK}">${frame(chain, k, mode)}</g>` +
      `<text x="${cx + bb.w / 2}" y="${cy + bb.h + 70}" text-anchor="middle" font-family="sans-serif" font-size="40" fill="${INK}">${st.id ? roman(st.id) : ''}</text></g>`;
  });
  return svgWrap(W, H, `<g transform="translate(${(W - cols * bb.w * best) / 2} ${m + top}) scale(${best})">${inner}</g>` + cap + (nb ? nb.svg(H - band - m / 2) : ''), `width="${pw}mm" height="${ph}mm"`);
}
function animSVG(chain, mode, ms, title = '') {
  const bb = bbox(chain, mode), n = chain.states.length, T = (n * ms / 1000).toFixed(2);
  let inner = '';
  chain.states.forEach((_, k) => {
    const a = (k / n).toFixed(4), b = ((k + 1) / n).toFixed(4);
    inner += `<g fill="${INK}" opacity="0" transform="translate(${-bb.x} ${-bb.y})"><animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${a};${b};1" values="0;1;0;0"/>${frame(chain, k, mode)}</g>`;
  });
  const nb = NOTE ? noteBlock(bb.w) : null, tb = title ? titleBlock(bb.w, title) : null, top = tb ? tb.h : 0;
  return svgWrap(bb.w, top + bb.h + (nb ? nb.h : 0), (tb ? tb.svg : '') + `<g transform="translate(0 ${top})">${inner}</g>` + (nb ? nb.svg(top + bb.h) : ''));
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

  function drawGrid(live) {
    let h = '';
    for (let i = 0; i <= G; i++) h += `<path d="M${i * U} 0V${G * U}M0 ${i * U}H${G * U}" stroke="${INK}" stroke-opacity=".16" stroke-width="2"/>`; // the grid is the artwork's paper and ink, so a colour change shows at once
    h += `<g fill="${INK}">` + grid.map((c, i) => c ? use({ ...c, x: i % G, y: Math.floor(i / G) }, INK) : '').join('') + '</g>';
    $('grid').style.background = PAPER;
    $('grid').setAttribute('viewBox', `0 0 ${G * U} ${G * U}`);
    $('grid').innerHTML = defs() + h;
    if (!live) updateCount(); // the live camera redraws many times a second, so it skips the count
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
  const titleText = c => waysLabel(c.states.filter(s => s.id !== 0).length, act === 'make' ? 'make you up' : 'unmake you');
  const renderSheet = () => { $('sheet').innerHTML = sheetSVG(chain, mode, hidden, true, paper, titleText({ states: chain.states.filter(s => !hidden.has(s.id)) })); };
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
  function process(quiet) { // quiet: redo the results in place, without moving to step 1 or to the results pane
    const start = startBlocks();
    if (!start.length) return $('msg').textContent = 'Place some blocks first.';
    if (act === 'make' && !connected(start)) return $('msg').textContent = 'Blocks must touch edge to edge. (Unmake works with separate blocks.)';
    hidden = new Set();
    chain = act === 'unmake' ? unmake(start) : act === 'rearrange' ? scatter(start, G) : variants(start, MOVES, mode === 'direction', TRACED.has(mode));
    const n = chain.states.length - 1;
    $('msg').textContent = act === 'unmake' ? `${n} step${n > 1 ? 's' : ''}. Each takes one block away; nothing is added back.` : act === 'rearrange' ? `${n} step${n > 1 ? 's' : ''}. Each moves one block away from the rest.` : n ? `${n} variant${n > 1 ? 's' : ''}${chain.capped ? ` (stopped at the cap of ${MAXCAP})` : ''}.` : 'No variants: nothing can move.';
    show();
    if (!quiet) { document.body.classList.add('view-results'); paneSwitch(); goStep(1); }
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
    G = n; grid = ng; $('msg').textContent = ''; drawGrid(); if (chain) process(true);
  });
  // Camera: your face as blocks. The picture is cut to a square, shrunk to the grid, mirrored, and a cell is filled where it is darker than the average
  // (the slider moves that cut-off). It is processed on the device, never recorded or sent, and the camera stops when you take the picture.
  let camStream = null, camVideo = null, camTimer = null, camBefore = null;
  const camCanvas = document.createElement('canvas');
  function camTick() {
    if (!camVideo || camVideo.readyState < 2) return;
    const vw = camVideo.videoWidth, vh = camVideo.videoHeight, side = Math.min(vw, vh);
    camCanvas.width = camCanvas.height = G;
    const cx = camCanvas.getContext('2d', { willReadFrequently: true });
    cx.setTransform(-1, 0, 0, 1, G, 0); // mirror, as in a mirror
    cx.drawImage(camVideo, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, G, G);
    const d = cx.getImageData(0, 0, G, G).data, lum = [];
    for (let i = 0; i < G * G; i++) lum.push(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
    const mean = lum.reduce((a, b) => a + b, 0) / lum.length, cut = mean + (+$('camT').value - 50) * 1.2;
    grid = lum.map(v => v < cut ? mk('square') : null);
    drawGrid(true);
  }
  async function camStart() {
    if (camStream) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return $('msg').textContent = 'This browser cannot use a camera here. The camera needs a secure (https) page.';
    try { camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); }
    catch (e) { return $('msg').textContent = 'The camera could not be opened: it was blocked or none was found.'; }
    camVideo = document.createElement('video'); camVideo.muted = true; camVideo.playsInline = true; camVideo.srcObject = camStream; await camVideo.play().catch(() => {});
    camBefore = grid; $('camBar').hidden = false; $('camera').setAttribute('aria-pressed', 'true');
    $('msg').textContent = G < 11 ? 'Camera on. A grid of 11 or 15 shows more of a face.' : 'Camera on. Move the slider for more or fewer blocks, then press Take.';
    camTimer = setInterval(camTick, 120); camTick();
  }
  function camStop(keep) {
    clearInterval(camTimer); camTimer = null;
    if (camStream) camStream.getTracks().forEach(t => t.stop());
    camStream = null; camVideo = null; $('camBar').hidden = true; $('camera').setAttribute('aria-pressed', 'false');
    if (!keep && camBefore) grid = camBefore;
    camBefore = null; drawGrid();
  }
  $('camera').onclick = () => camStream ? camStop(false) : camStart();
  $('camTake').onclick = () => { camStop(true); $('msg').textContent = 'Taken. Press Process, or try Unmake: it does not need the blocks to touch.'; };
  $('camStop').onclick = () => camStop(false);
  addEventListener('pagehide', () => { if (camStream) camStop(false); });
  $('process').onclick = () => { if (camStream) camStop(true); process(); };
  $('act').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    [...$('act').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === a));
    act = a.dataset.a; verb(); updateCount(); if (chain) process(true);
  });
  $('random').onclick = () => { $('msg').textContent = 'Starter: ' + startSymbol() + '.'; drawGrid(); };
  $('clear').onclick = () => { grid.fill(null); drawGrid(); };
  $('spd').oninput = () => { $('spdOut').textContent = $('spd').value + ' ms'; show(); };
  $('projIcons').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    [...$('projIcons').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === a));
    ISO = a.dataset.proj === 'iso'; if (chain) show();
  });
  $('viewIcons').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    [...$('viewIcons').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === a));
    mode = a.dataset.mode; updateCount(); if (chain) process(true);
  });
  $('sheet').addEventListener('click', e => { const g = e.target.closest('[data-id]'); if (!g) return; const id = +g.dataset.id; hidden.has(id) ? hidden.delete(id) : hidden.add(id); show(); });
  $('paper').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    [...$('paper').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === a));
    paper = a.dataset.p; if (chain) renderSheet();
  });
  // The publication: an A5 book of this shape and its variants, in the design of the original, as a PDF. Imposed means two pages to an A4 landscape sheet in booklet order.
  // The preface is read from the About page (the one copy of that text): from Summary to Using it, with the numbered views as a list.
  async function fetchPreface() {
    const html = await (await fetch('about.html')).text(), main = new DOMParser().parseFromString(html, 'text/html').querySelector('main'), out = [];
    let on = false;
    [...main.children].forEach(el => {
      if (el.tagName === 'H2') on = /^Summary$|^Description$/.test(el.textContent.trim());
      else if (on && el.tagName === 'P') { const n = el.querySelector('.n'); out.push(n ? n.textContent + '. ' + el.textContent.slice(n.textContent.length) : el.textContent.trim()); }
    });
    return out;
  }
  async function dlBook(imposed) {
    if (!chain) return $('msg').textContent = 'Press Process first.';
    const kc = kept(), orig = chain.states.find(s => s.id === 0), vs = kc.states.filter(s => s.id !== 0);
    if (!orig || !vs.length) return $('msg').textContent = 'There are no variants to put in a book.';
    let preface = [];
    if ($('prefacePage').checked) { try { preface = await fetchPreface(); } catch (e) { return $('msg').textContent = 'The preface could not be read from the About page.'; } }
    const bytes = makeBook({ states: [orig, ...vs], orig }, { imposed, preface, message: $('personalMsg').value.trim(), verb: act === 'make' ? 'make you up' : 'unmake you', note: NOTE, endpapers: $('endPapers').checked, date: new Date().toISOString().slice(0, 10) });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    a.download = `form-publication-A5${imposed ? '-imposed' : ''}.pdf`; a.click(); URL.revokeObjectURL(a.href);
  }
  // A looping GIF of the animation for socials: each variant is drawn as an SVG, rasterised, mapped to 32 steps between paper and ink, and written by gifEncode.
  let gifFmt = 'sq';
  $('gifFormat').addEventListener('click', e => { const g = e.target.closest('a'); if (!g) return; e.preventDefault(); [...$('gifFormat').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === g)); gifFmt = g.dataset.g; });
  // Frames for socials: each variant as an SVG at 720 wide (square 720 high, story 1280 high), with the title line, a small credit and, for a framed piece, its source and caption.
  function socialSetup() {
    if (!chain) { $('msg').textContent = 'Press Process first.'; return null; }
    const kc = kept(); if (!kc.states.length) { $('msg').textContent = 'There are no variants to use.'; return null; }
    const W = 720, H = gifFmt === 'sq' ? 720 : 1280, skip = Math.max(1, Math.ceil(kc.states.length / 120)), idxs = []; for (let k = 0; k < kc.states.length; k += skip) idxs.push(k);
    const bb = bbox(kc, mode), fs = W / 38, perLine = Math.floor(W * 0.92 / (fs * 0.6)), lines = NOTE ? [...wrapText(NOTE.ref, perLine), ...wrapText(NOTE.text, perLine)] : [];
    const band = 100 + (lines.length ? lines.length * fs * 1.45 + 24 : 0), availW = W * 0.84, availH = H - band - H * 0.06, sc = Math.min(availW / bb.w, availH / bb.h), tx = (W - bb.w * sc) / 2, ty = H * 0.06 + (availH - bb.h * sc) / 2, title = titleText(kc);
    const notes = lines.map((l, i) => `<text x="${W * 0.04}" y="${H - band + 30 + i * fs * 1.45}" font-family="monospace" font-style="italic" font-size="${fs}" fill="${INK}">${esc(l)}</text>`).join('');
    const svgAt = n => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${defs()}<g transform="translate(${tx} ${ty}) scale(${sc})"><g fill="${INK}" transform="translate(${-bb.x} ${-bb.y})">${frame(kc, idxs[n], mode)}</g></g>${notes}<text x="${W / 2}" y="${H - 46}" text-anchor="middle" font-family="monospace" font-style="italic" font-size="${fs * 1.15}" fill="${INK}">${esc(title)}</text><text x="${W / 2}" y="${H - 18}" text-anchor="middle" font-family="monospace" font-size="${fs * 0.7}" fill="${INK}" opacity=".6">Made with Form, form.pkwr.co</text></svg>`;
    return { W, H, idxs, svgAt, delay: Math.max(20, +$('spd').value) };
  }
  const loadSvg = async svg => { const img = new Image(); img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); await img.decode(); return img; };
  let socialBusy = false;
  // A looping GIF: each frame is rasterised, mapped to 32 steps between paper and ink, and written by gifEncode.
  async function dlGif() {
    if (socialBusy) return; const S = socialSetup(); if (!S) return; socialBusy = true;
    try {
      const hex = c => { const n = parseInt(c.length === 4 ? '#' + [...c.slice(1)].map(x => x + x).join('') : c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
      const P = hex(PAPER), I = hex(INK), pal = []; for (let i = 0; i < 32; i++) pal.push(P.map((v, c) => Math.round(v + (I[c] - v) * i / 31)));
      const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], PL = lum(P), IL = lum(I);
      const cv = document.createElement('canvas'); cv.width = S.W; cv.height = S.H; const cx = cv.getContext('2d', { willReadFrequently: true }), frames = [];
      for (let n = 0; n < S.idxs.length; n++) {
        $('msg').textContent = `Making the GIF: ${n + 1} of ${S.idxs.length}`;
        const img = await loadSvg(S.svgAt(n)); URL.revokeObjectURL(img.src);
        cx.fillStyle = PAPER; cx.fillRect(0, 0, S.W, S.H); cx.drawImage(img, 0, 0, S.W, S.H);
        const d = cx.getImageData(0, 0, S.W, S.H).data, px = new Uint8Array(S.W * S.H);
        for (let i = 0; i < px.length; i++) px[i] = Math.max(0, Math.min(31, Math.round((PL - (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2])) / (PL - IL) * 31)));
        frames.push(px);
      }
      const bytes = gifEncode(S.W, S.H, pal, frames, Math.max(2, Math.round(S.delay / 10)), CREDIT.replace('©', '(c)'));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' })); a.download = `form-${gifFmt === 'sq' ? 'square' : 'story'}.gif`; a.click(); URL.revokeObjectURL(a.href);
      $('msg').textContent = `GIF ready: ${S.idxs.length} frames.`;
    } finally { socialBusy = false; }
  }
  $('dlGif').onclick = dlGif;
  // A video, recorded in the browser from a canvas playing the frames in real time, repeated to run at least six seconds. MP4 where the browser can write it, otherwise WebM.
  async function dlVideo() {
    if (socialBusy) return; const S = socialSetup(); if (!S) return;
    if (typeof MediaRecorder === 'undefined') return $('msg').textContent = 'This browser cannot record video.';
    const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    if (!type) return $('msg').textContent = 'This browser cannot record video.';
    socialBusy = true;
    try {
      $('msg').textContent = 'Getting the frames ready...';
      const imgs = []; for (let n = 0; n < S.idxs.length; n++) imgs.push(await loadSvg(S.svgAt(n)));
      const cv = document.createElement('canvas'); cv.width = S.W; cv.height = S.H; const cx = cv.getContext('2d');
      const reps = Math.min(30, Math.max(1, Math.ceil(6000 / (S.idxs.length * S.delay)))), chunks = [];
      const rec = new MediaRecorder(cv.captureStream(30), { mimeType: type, videoBitsPerSecond: 4000000 });
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise(r => { rec.onstop = r; });
      cx.drawImage(imgs[0], 0, 0, S.W, S.H); rec.start(200);
      const total = reps * imgs.length; let done = 0;
      for (let r = 0; r < reps; r++) for (let n = 0; n < imgs.length; n++) {
        const t0 = performance.now(); $('msg').textContent = `Recording the video: ${Math.round(done / total * 100)}%`;
        do { cx.drawImage(imgs[n], 0, 0, S.W, S.H); await new Promise(res => setTimeout(res, 33)); } while (performance.now() - t0 < S.delay);
        done++;
      }
      rec.stop(); await stopped; imgs.forEach(i => URL.revokeObjectURL(i.src));
      const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm', a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(chunks, { type })); a.download = `form-${gifFmt === 'sq' ? 'square' : 'story'}.${ext}`; a.click(); URL.revokeObjectURL(a.href);
      $('msg').textContent = ext === 'mp4' ? 'Video ready.' : 'Video ready, but this browser made WebM; Instagram and TikTok need MP4. Try Safari or a recent Chrome.';
    } finally { socialBusy = false; }
  }
  $('dlVideo').onclick = dlVideo;
  $('dlBookImposed').onclick = () => dlBook(true);
  $('dlBook').onclick = () => dlBook(false);
  $('dlSheet').onclick = () => chain && kept().states.length && dl(`form-sheet-${mode}-${paper}.svg`, sheetSVG(kept(), mode, new Set(), false, paper, titleText(kept())));
  $('dlAnim').onclick = () => chain && dl(`form-anim-${mode}.svg`, animSVG(kept(), mode, +$('spd').value, titleText(kept())));
  const sync = r => r.style.setProperty('--to', (r.value - r.min) / (r.max - r.min) * 100 + '%');
  document.querySelectorAll('input[type=range]').forEach(r => { sync(r); r.addEventListener('input', () => sync(r)); });
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'd' && !/INPUT/.test(e.target.tagName)) $('panel').classList.toggle('hidden'); });
  // Phones: the grid and shapes live on the screen, the settings in the sheet. One element moves between the two places.
  const small = matchMedia('(pointer: coarse), (max-width: 600px)');
  // The treatments sit with the results on every screen size, which keeps the panel short.
  const placeDraw = () => { $(small.matches ? 'drawHostScreen' : 'drawHostPanel').prepend($('drawBox')); $('viewHostOut').prepend($('viewBox')); $(small.matches ? 'colourHostPanel' : 'colourHostOut').prepend($('colours')); (small.matches ? $('processHostScreen') : $('panel').querySelector('.cp-foot')).prepend($('processRow')); };
  small.addEventListener('change', () => { placeDraw(); sizeBody(); });
  const sizeBody = () => { document.body.style.paddingBottom = small.matches ? $('panel').offsetHeight + 16 + 'px' : ''; };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(sizeBody).observe($('panel'));
  // The results are a short path, one step at a time: the animation, the contact sheet, then make a book or a print.
  function goStep(n) {
    document.querySelectorAll('#out .step').forEach(el => el.classList.toggle('on', el.id === 'step' + n));
    [...$('steps').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x.dataset.s === String(n)));
    scrollTo(0, 0);
  }
  $('makeTabs').addEventListener('click', e => {
    const t = e.target.closest('a'); if (!t) return; e.preventDefault();
    [...$('makeTabs').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === t));
    document.querySelectorAll('#step3 .card').forEach(c => c.classList.toggle('on', c.dataset.m === t.dataset.m));
  });
  $('steps').addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); goStep(+a.dataset.s); });
  $('out').addEventListener('click', e => { const b = e.target.closest('button[data-go]'); if (b) goStep(+b.dataset.go); });
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
  // Colour: paper and ink for the artwork (the results, every download and the book). The app's own screen keeps its colours.
  const PRESETS = [['Default', '#f4f2ee', '#111111'], ['Book', '#deddd2', '#231f20'], ['Night', '#231f20', '#deddd2'], ['Yellow', '#ffe100', '#111111']];
  $('presets').innerHTML = PRESETS.map(([n, p, i]) => `<button type="button" class="preset" title="${n}" aria-label="${n}" data-p="${p}" data-i="${i}" style="background:linear-gradient(135deg,${p} 50%,${i} 50%)"></button>`).join('');
  function setColours(p, i) {
    [...$('presets').children].forEach(b => b.classList.toggle('on', b.dataset.p === p && b.dataset.i === i)); // the chosen preset is ringed in yellow
    PAPER = p; INK = i; $('paperCol').value = p; $('inkCol').value = i; $('anim').style.background = p;
    drawGrid(true); // the drawing grid shows the colours too, so the change is visible wherever you are
    if (chain) show();
  }
  $('paperCol').addEventListener('input', () => setColours($('paperCol').value, INK));
  $('inkCol').addEventListener('input', () => setColours(PAPER, $('inkCol').value));
  $('presets').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setColours(b.dataset.p, b.dataset.i); });
  $('anim').style.background = PAPER; $('presets').firstChild.classList.add('on');
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
