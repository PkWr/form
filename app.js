'use strict';
// Form — pick blocks on a 16x16 grid; a chain of moves leaves traces; export as SVG.
let G = 5;
const U = 100, MAXCAP = 500, TONE = 0.22, YEL = '#ffe100';
let INK = '#111111', PAPER = '#f4f2ee'; // the artwork's colours, set from the Colour setting
const mixHex = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
// Isometric: a second view beside the treatments. Every treatment is drawn as normal and the whole drawing is then laid onto the isometric plane (x' = (x - y) cos 30, y' = (x + y) / 2),
// with each current block given a little thickness, drawn under the tops as a few copies of the block shifted down in a mid tone.
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
          const nb0 = st.blocks.map((o, j) => j === i ? { ...o, x: tx, y: ty, r: dir } : o);
          const nb = nb0.map(b => ({ ...b, a: axisOf(b, nb0) })); // a move changes who is joined to whom, so every block's stripe direction is worked out again
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

// Extra ways to make you up: after every single move, EXTRA more variants, each made by 1 to 3 moves in a row from the original, chosen by R (seeded from the pattern code).
// A variant that is already in the list is skipped, so a one-move pick adds nothing new and the extras are mostly two or three moves.
const EXTRA = 6;
function movesFrom(st) {
  const out = [], occ = new Set(st.blocks.map(b => b.x + ',' + b.y));
  st.blocks.forEach((old, i) => {
    const rest = st.blocks.filter((_, j) => j !== i), targets = new Map();
    for (const o of rest) for (const [dx, dy] of DIRS) { const x = o.x + dx, y = o.y + dy; if (!occ.has(x + ',' + y)) targets.set(x + ',' + y, [x, y]); }
    for (const [tx, ty] of targets.values()) {
      const dx = tx - old.x, dy = ty - old.y, dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
      const nb0 = st.blocks.map((o, j) => j === i ? { ...o, x: tx, y: ty, r: dir } : o), nb = nb0.map(b => ({ ...b, a: axisOf(b, nb0) }));
      if (!connected(nb)) continue;
      const n = norm(nb, [...st.tr, { x: old.x, y: old.y, s: old.s, r: old.r, q: old.q }], st.ox, st.oy);
      if (Math.max(...n.blocks.map(b => b.x)) >= G || Math.max(...n.blocks.map(b => b.y)) >= G) continue;
      out.push(n);
    }
  });
  return out;
}
function makeWays(start, ax, withTr, R) {
  const made = variants(start, MOVES, ax, withTr), seen = new Set(variants(start, MOVES, false, false).states.map(s => keyOf(s, false, false))), states = [...made.states]; // the extras are picked the same way whatever the treatment, so the book does not depend on it
  if (made.capped) return made;
  for (let tries = 0, added = 0; added < EXTRA && tries < EXTRA * 12; tries++) {
    let cur = made.states[0];
    for (let k = 1 + Math.floor(R() * 3); k > 0; k--) { const nx = movesFrom(cur); if (!nx.length) break; cur = nx[Math.floor(R() * nx.length)]; }
    const key = keyOf(cur, false, false); if (seen.has(key)) continue;
    seen.add(key); states.push(cur); added++;
  }
  const out = states.map((st, id) => ({ ...st, id }));
  return { states: out, capped: false, orig: out[0] };
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
    const left = first.blocks.filter((_, i) => !gone.has(i)); states.push({ blocks: left.map(b => ({ ...b, a: axisOf(b, left) })), tr: first.blocks.filter((_, i) => gone.has(i)).map(b => ({ x: b.x, y: b.y, s: b.s, r: b.r, q: b.q })), ox: first.ox, oy: first.oy });
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
// The title carries both sets: "36 ways I can make you up and 9 ways to unmake you". A set with nothing in it is left out.
const waysTitle = c => { const m = c.states.filter(s => s.phase === 'make').length, u = c.states.filter(s => s.phase === 'unmake').length;
  return [m && `${m} way${m === 1 ? '' : 's'} I can make you up`, u && `${u} way${u === 1 ? '' : 's'} to unmake you`].filter(Boolean).join(' and '); };
// The states before this one that count as its past: the same set only (making looks back at earlier makes, unmaking at earlier unmakes), then the original.
const pastOf = (c, k) => { const s = c.states[k], o = c.orig || c.states[0]; if (s === o) return [];
  return [...c.states.slice(0, k).filter(x => x !== o && x.phase === s.phase).reverse(), o]; };
function titleBlock(W, text) { const fs = Math.max(14, W / 36); return { h: fs * 2.4, svg: `<text x="${W * 0.05}" y="${fs * 1.5}" font-family="monospace" font-style="italic" font-size="${fs}" fill="${INK}">${esc(text)}</text>` }; }
const defs = () => '<defs>' + Object.entries(SHAPES).map(([id, s]) => `<path id="${id}" d="${s.d}"/>` +
  [0, 90, 180, 270].map(a => `<clipPath id="c_${id}_${a}"><path d="${s.d}" transform="rotate(${a} 50 50)"/></clipPath>`).join('')).join('') +
  DENS.map((d, i) => `<path id="hl${i}" fill="none" stroke-width="${+(0.3 * 2.4 * d[1]).toFixed(2)}" d="${(() => { let p = ''; for (let x = -40; x <= 140; x += 2.4 * d[1]) p += `M${+x.toFixed(1)} -40V140`; return p; })()}"/>`).join('') +
  '</defs>';
// Direction: each block is three stripes running along its last move (vertical until it moves).
// Direction stripes: three lines of equal width with equal gaps, flush to the cell edge on open sides (as in the book). Where a block with stripes the same way
// touches this one, that side is inset by half a gap, so the two blocks together make an even gap and not a doubled line. Line width follows: 20% of the cell flush
// both sides, about 18% with one side inset, about 17% with both. Square blocks draw unclipped and a hair long so joined lines have no seam.
// All the blocks in a run along the stripes (a vertical stack, or a horizontal row) share one geometry: a side counts as touching if any block in the run has a parallel block beside it there,
// so each line runs straight through the whole run instead of stepping where one block has a neighbour and the next does not.
const stripeCells = new WeakMap();
function stripeRects(b, all, over) {
  let cells = stripeCells.get(all); if (!cells) { cells = new Map(all.map(o => [o.x + ',' + o.y, o])); stripeCells.set(all, cells); }
  const v = b.a === 1, at = (x, y) => { const o = cells.get(x + ',' + y); return o && o.a === b.a ? o : null; };
  const run = [b]; for (const d of [-1, 1]) for (let x = b.x, y = b.y; ;) { if (v) y += d; else x += d; const o = at(x, y); if (!o) break; run.push(o); }
  const nl = run.some(o => v ? at(o.x - 1, o.y) : at(o.x, o.y - 1)), nr = run.some(o => v ? at(o.x + 1, o.y) : at(o.x, o.y + 1)), w = 100 / (5 + 0.5 * nl + 0.5 * nr), L = nl ? w / 2 : 0, e = over ? 0.6 : 0;
  return [0, 1, 2].map(i => { const p = L + i * 2 * w; return v ? [p, -e, w, 100 + 2 * e] : [-e, p, 100 + 2 * e, w]; });
}
const stripes = (b, all) => { const sq = b.s === 'square'; return `<g transform="translate(${b.x * U} ${b.y * U})"${sq ? '' : ` clip-path="url(#c_${b.s}_${ang(b)})"`}>${stripeRects(b, all, sq).map(([x, y, w, h]) => `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}"/>`).join('')}</g>`; };
const n3 = v => +v.toFixed(3);
// Density: every block is drawn as fine lines, and each iteration adds a layer at its own angle. Where layers overlap the lines cross into a darker mesh,
// so tone builds up as texture. Layers: the original (vertical), this variant, and the two variants before it.
// Density: every block is filled with fine lines. The original and the last four variants each keep their own slot, an angle and a pitch, so a layer
// holds its texture as later ones are added and the overlaps cross into a mesh, as in the 11 ways publication. [angle, pitch factor].
const DENS = [[0, 1], [45, 1.35], [135, 1.7], [90, 1.15], [22, 1.5], [158, 1.05], [67, 1.9], [112, 1.25]];
function densStack(chain, k) {
  const s = chain.states[k], o = chain.orig || chain.states[0], list = [{ st: o, slot: 0 }];
  for (const st of [...pastOf(chain, k).filter(x => x !== o).slice(0, 3).reverse(), s]) if (st !== o) list.push({ st, slot: 1 + (st.id % 7) });
  return list.map(e => ({ blocks: e.st.blocks, dx: e.st.ox - s.ox, dy: e.st.oy - s.oy, slot: e.slot }));
}
function densLayers(chain, k) {
  return densStack(chain, k).map(l => l.blocks.map(b => `<g transform="translate(${(b.x + l.dx) * U} ${(b.y + l.dy) * U})" clip-path="url(#c_${b.s}_${ang(b)})"><use href="#hl${l.slot}" stroke="${INK}" transform="rotate(${DENS[l.slot][0]} 50 50)"/></g>`).join('')).join('');
}
const use = (b, c = INK, o = 1) => `<use opacity="${o}" stroke="${c}" stroke-width="1.5" href="#${b.s}" transform="translate(${b.x * U} ${b.y * U}) rotate(${ang(b)} 50 50)"/>`;
// Transparency (onion skin): the blocks of the variants shown just before this one stay as fading ghosts.
const GHOSTS = [0.3, 0.2, 0.13, 0.09, 0.06, 0.04];
const ghosts = (chain, k) => GHOSTS.map((o, a) => { const st = pastOf(chain, k)[a], s = chain.states[k]; if (!st) return null;
  return { o, dx: st.ox - s.ox, dy: st.oy - s.oy, blocks: st.blocks }; }).filter(Boolean).reverse();
function frame(chain, k, mode) { return frame0(chain, k, mode); }
function frame0(chain, k, mode) {
  const s = chain.states[k];
  if (mode === 'direction') return s.blocks.map(b => stripes(b, s.blocks)).join('');
  if (mode === 'dens') return densLayers(chain, k);
  return (mode === 'solid' ? s.tr.map(t => use(t)).join('') : mode === 'trans' ? ghosts(chain, k).map(g => `<g transform="translate(${g.dx * U} ${g.dy * U})">${g.blocks.map(b => use(b, INK, g.o)).join('')}</g>`).join('') + s.tr.map(t => use(t, INK, TONE)).join('') : '') + s.blocks.map(use).join('');
}
function bbox(chain, mode) {
  // The same frame for every treatment (blocks, traces, the density overlay and the ghosts), so changing treatment never changes the scale.
  const pts = (s, k) => [...s.blocks, ...s.tr, ...(chain.orig || chain.states[0]).blocks.map(b => ({ x: b.x + (chain.orig || chain.states[0]).ox - s.ox, y: b.y + (chain.orig || chain.states[0]).oy - s.oy })), ...ghosts(chain, k).flatMap(g => g.blocks.map(b => ({ x: b.x + g.dx, y: b.y + g.dy })))];
  const all = chain.states.flatMap(pts);
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
// ---------- Pattern code ----------
// A short code that names a pattern, so the same code always rebuilds the same book. The pattern is cropped to its bounding box (the book does not depend on where the shape sits, only on its
// size and the grid size G, which limits how far a shape can grow), each cell is one of 11 states, and the cells are packed as one base-11 number with a small header. The number is written in a
// 31-character alphabet without 0, O, 1, I or L, closed by two check characters (the number modulo 929, a prime), and grouped in fives.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ', CODE_GRIDS = [5, 7, 9], CODE_PRIME = 929n;
const CODE_CELLS = [null, { s: 'square', q: 0 }, { s: 'circle', q: 0 }, ...[0, 1, 2, 3].map(q => ({ s: 'arch', q })), ...[0, 1, 2, 3].map(q => ({ s: 'tri', q }))]; // state 0 is empty
const cellState = c => !c ? 0 : c.s === 'square' ? 1 : c.s === 'circle' ? 2 : (c.s === 'arch' ? 3 : 7) + ((c.q || 0) & 3);
function toDigits(n, radix, alphabet) { let out = ''; const r = BigInt(radix); do { out = alphabet[Number(n % r)] + out; n /= r; } while (n > 0n); return out; }
function patternCode(G, cells) {
  const gi = CODE_GRIDS.indexOf(G); if (gi < 0) throw new Error('Grid size ' + G + ' has no code.');
  const occ = []; cells.forEach((c, i) => { if (c) occ.push([i % G, Math.floor(i / G)]); });
  const x0 = occ.length ? Math.min(...occ.map(p => p[0])) : 0, y0 = occ.length ? Math.min(...occ.map(p => p[1])) : 0;
  const w = occ.length ? Math.max(...occ.map(p => p[0])) - x0 + 1 : 1, h = occ.length ? Math.max(...occ.map(p => p[1])) - y0 + 1 : 1;
  let num = 0n; for (let i = w * h - 1; i >= 0; i--) num = num * 11n + BigInt(cellState(cells[(y0 + Math.floor(i / w)) * G + x0 + i % w]));
  const value = BigInt(gi | (w - 1) << 2 | (h - 1) << 6) + num * 1024n, chk = Number(value % CODE_PRIME);
  const text = toDigits(value, 31, CODE_ALPHABET) + CODE_ALPHABET[Math.floor(chk / 31)] + CODE_ALPHABET[chk % 31];
  return text.match(/.{1,5}/g).join('-');
}
function decodePatternCode(code) {
  const t = String(code).toUpperCase().replace(/[\s-]/g, ''), bad = [...t].find(ch => !CODE_ALPHABET.includes(ch));
  if (bad) throw new Error(`"${bad}" is not used in codes (no 0, O, 1, I or L).`);
  if (t.length < 3) throw new Error('That code is too short.');
  let value = 0n; for (const ch of t.slice(0, -2)) value = value * 31n + BigInt(CODE_ALPHABET.indexOf(ch));
  const chk = CODE_ALPHABET.indexOf(t[t.length - 2]) * 31 + CODE_ALPHABET.indexOf(t[t.length - 1]);
  if (BigInt(chk) !== value % CODE_PRIME) throw new Error('The code does not check out: a character is wrong or missing.');
  const gi = Number(value & 3n), w = Number(value >> 2n & 15n) + 1, h = Number(value >> 6n & 15n) + 1, G = CODE_GRIDS[gi];
  let num = value >> 10n; if (w > G || h > G) throw new Error('That code is not a valid pattern.');
  const cells = Array(G * G).fill(null), box = [];
  for (let i = 0; i < w * h; i++) { const st = Number(num % 11n); num /= 11n; box.push(st); }
  if (num !== 0n) throw new Error('That code is not a valid pattern.');
  const used = box.some(Boolean), top = box.slice(0, w).some(Boolean), left = box.some((v, i) => v && i % w === 0), right = box.some((v, i) => v && i % w === w - 1), bottom = box.slice((h - 1) * w).some(Boolean);
  if (used ? !(top && left && right && bottom) : (w !== 1 || h !== 1)) throw new Error('That code is not a valid pattern.');
  const ox = Math.floor((G - w) / 2), oy = Math.floor((G - h) / 2);
  box.forEach((st, i) => { if (st) { const c = CODE_CELLS[st]; cells[(oy + Math.floor(i / w)) * G + ox + i % w] = { s: c.s, r: 0, q: c.q }; } });
  return { G, cells };
}
// A fixed number from a code, to seed the one random choice the output has (the order Unmake takes blocks away, and the random isometric angles), so a code always gives the same book.
const codeSeed = code => { let h = 2166136261; for (const ch of code) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

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
  // Letterforms (block capitals and a few lower-case) and more shapes. Each is joined edge to edge, so Make works on it.
  'letter A': ['XXXXX', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  'letter B': ['XXXXX', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'XXXXX'],
  'letter C': ['XXXXX', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  'letter D': ['XXXX.', 'X..XX', 'X...X', 'X...X', 'X...X', 'X..XX', 'XXXX.'],
  'letter E': ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  'letter F': ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
  'letter G': ['XXXXX', 'X....', 'X....', 'X.XXX', 'X...X', 'X...X', 'XXXXX'],
  'letter H': ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  'letter L': ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  'letter O': ['XXXXX', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXXX'],
  'letter P': ['XXXXX', 'X...X', 'X...X', 'XXXXX', 'X....', 'X....', 'X....'],
  'letter S': ['XXXXX', 'X....', 'X....', 'XXXXX', '....X', '....X', 'XXXXX'],
  'letter T': ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
  'letter U': ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXXX'],
  'letter Z': ['XXXXX', '....X', '....X', '..XXX', 'XXX..', 'X....', 'XXXXX'],
  'lower f': ['XXX', 'X..', 'XXX', 'X..', 'X..', 'X..', 'X..'],
  'lower e': ['XXXXX', 'X...X', 'XXXXX', 'X....', 'XXXXX'],
  'lower a': ['XXXXX', '....X', 'XXXXX', 'X...X', 'XXXXX'],
  'heart': ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'],
  'diamond': ['..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..'],
  'flag': ['XXXX', 'XXXX', 'X...', 'X...', 'X...'],
  'step': ['X....', 'XX...', 'XXX..', 'XXXX.', 'XXXXX'],
  'letter Y': ['X...X', 'XX.XX', '.XXX.', '..X..', '..X..'],
  // Signs of the kind collected in Rudolf Koch's The Book of Signs (1930), drawn here as block shapes (our own simplified versions, not copies of his plates).
  'Koch: St Andrew cross': ['X...X', 'XX.XX', '.XXX.', 'XX.XX', 'X...X'],
  'Koch: anchor': ['..X..', 'XXXXX', '..X..', 'X.X.X', 'XXXXX'],
  'Koch: life rune': ['X...X', 'XX.XX', '.XXX.', '..X..', '..X..'],
  'Koch: trident': ['X.X.X', 'X.X.X', 'XXXXX', '..X..', '..X..'],
  'Koch: sun wheel': ['.XXX.', 'X.X.X', 'XXXXX', 'X.X.X', '.XXX.'],
  'Koch: crescent': ['.XXXX', 'XX...', 'X....', 'XX...', '.XXXX'],
  'Koch: hourglass': ['XXXXX', '.XXX.', '..X..', '.XXX.', 'XXXXX'],
  'Koch: window': ['XXXXX', 'X.X.X', 'XXXXX', 'X.X.X', 'XXXXX'],
  'Koch: triangle': ['..X..', '.XXX.', 'XXXXX'],
  'Koch: nested squares': ['XXXXXXX', 'X.....X', 'X.XXX.X', 'XXX.X.X', 'X.XXX.X', 'X.....X', 'XXXXXXX'],
  'Koch: Lorraine cross': ['..X..', 'XXXXX', '..X..', 'XXXXX', '..X..', '..X..'],
  'Koch: triple cross': ['..X..', 'XXXXX', '..X..', 'XXXXX', '..X..', 'XXXXX', '..X..'],
};

if (typeof document !== 'undefined' && document.getElementById('grid')) { // the demo page loads this file for the engine only
  const $ = id => document.getElementById(id);
  let grid = Array(G * G).fill(null);
  let shape = 'square', chain = null, mode = 'form', cur = 0, timer = null;
  const mk = s => ({ s, r: 0, q: 0 });
  let lastSymbol = '';
  function startSymbol() { // only symbols that fit the grid are picked (a 5 grid is too small for the 7-row letters)
    const names = Object.keys(SYMBOLS).filter(n => n !== lastSymbol && SYMBOLS[n].length <= G && SYMBOLS[n][0].length <= G), name = lastSymbol = names[Math.floor(Math.random() * names.length)], rows = SYMBOLS[name];
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
    if (!live) { updateCount(); codeShow(); } // the live camera redraws many times a second, so it skips the count and the code
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
  const titleText = c => waysTitle(c);
  const renderSheet = () => { $('sheet').innerHTML = sheetSVG(chain, mode, hidden, false, paper, titleText({ states: chain.states.filter(s => !hidden.has(s.id)) })); };
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
  let act = 'both'; // 'both': the output holds the ways to make you up and the ways to unmake you; 'unmake' (the framed piece) holds only the unmaking
  function updateCount() {
    const st = startBlocks();
    $('count').textContent = act === 'both' && st.length && connected(st) ? makeWays(st, mode === 'direction', TRACED.has(mode), rng(codeSeed(patternCode(G, grid)))).states.length - 1 : 0;
    $('countU').textContent = st.length;
  }
  function process(quiet) { // quiet: redo the results in place, without moving to step 1 or to the results pane
    const start = startBlocks();
    if (!start.length) return $('msg').textContent = 'Place some blocks first.';
    hidden = new Set();
    // One sequence: the original, then every way to make you up (when the blocks touch), then every way to unmake you.
    // The only random choices (the order blocks are taken away, the random isometric angles) are drawn from the pattern's own code, so a code always gives the same results.
    const code = patternCode(G, grid), R = rng(codeSeed(code));
    const made = act === 'both' && connected(start) ? makeWays(start, mode === 'direction', TRACED.has(mode), R) : null, unmade = unmake(start, start.map(() => R()));
    const states = [{ ...(made ? made.states[0] : unmade.states[0]), phase: 'start' },
      ...(made ? made.states.slice(1).map(s => ({ ...s, phase: 'make' })) : []), ...unmade.states.slice(1).map(s => ({ ...s, phase: 'unmake' }))].map((s, id) => ({ ...s, id }));
    chain = { states, capped: !!(made && made.capped), orig: states[0], code };
    document.querySelectorAll('[data-tally=iter]').forEach(p => { p.textContent = states.length + (states.length === 1 ? ' iteration' : ' iterations'); });
    $('msg').textContent = act === 'both' && !made ? 'The blocks do not touch edge to edge, so there is only the unmaking.' : chain.capped ? `Making stopped at the cap of ${MAXCAP}.` : '';
    show();
    if (!quiet) { showPane('results'); goStep(1); }
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
    $('msg').textContent = G < 9 ? 'Camera on. A grid of 9 shows more of a face.' : 'Camera on. Move the slider for more or fewer blocks, then press Take.';
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
  $('camTake').onclick = () => { camStop(true); $('msg').textContent = 'Taken. Press the yellow button.'; };
  $('camStop').onclick = () => camStop(false);
  addEventListener('pagehide', () => { if (camStream) camStop(false); });
  $('process').onclick = () => { if (camStream) camStop(true); process(); };
  $('random').onclick = () => { $('msg').textContent = 'Starter: ' + startSymbol() + '.'; drawGrid(); };
  $('clear').onclick = () => { grid.fill(null); drawGrid(); };
  $('spd').oninput = () => { $('spdOut').textContent = $('spd').value + ' ms'; show(); };
  $('viewIcons').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    [...$('viewIcons').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === a));
    mode = a.dataset.mode; updateCount(); if (chain) process(true);
  });
  // The variants are what they are: nothing to hide or keep.
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
  // The book's inputs (shared by the download and the preview): the kept variants, the preface read from About, the message, the colours.
  async function bookInputs(imposed) {
    if (!chain) { $('msg').textContent = 'Press the yellow button first.'; return null; }
    const kc = kept(), orig = chain.states.find(s => s.id === 0), vs = kc.states.filter(s => s.id !== 0);
    if (!orig || !vs.length) { $('msg').textContent = 'There are no variants to put in a book.'; return null; }
    let preface = [];
    if (BOOKOPT.preface) { try { preface = await fetchPreface(); } catch (e) { $('msg').textContent = 'The preface could not be read from the About page.'; return null; } }
    return [{ states: [orig, ...vs], orig }, { imposed, preface, title: waysTitle(kc), note: NOTE, endpapers: BOOKOPT.end, code: chain.code }];
  }
  async function dlBook(imposed) {
    const inp = await bookInputs(imposed); if (!inp) return;
    const bytes = makeBook(inp[0], inp[1]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    a.download = `form-publication-A5${imposed ? '-imposed' : ''}.pdf`; a.click(); URL.revokeObjectURL(a.href);
  }
  // The Book step shows the book as a visual, like the others: its pages, one after another, in the same square. Clicking it opens the full preview.
  const BOOKOPT = { preface: false, end: false }; let bookFmt = 'imposed', bookPages = null, bookTimer = 0;
  const pageTally = () => { if (bookPages) $('pageTally').textContent = bookPages.length + ' pages' + (bookFmt === 'imposed' ? ', ' + bookPages.length / 2 + ' printed sides on ' + bookPages.length / 4 + ' sheets' : ''); };
  async function showBook() {
    clearInterval(bookTimer); const inp = await bookInputs(false); if (!inp) return;
    bookPages = buildPages(inp[0], inp[1]).pages; pageTally();
    const fr = $('bookFrame'), st = $('bookPages'), items = bookItems(bookPages.length), h = Math.max(80, Math.min(fr.clientHeight - 24, (fr.clientWidth - 24) / (2 * A5W / A5H))), w = h * A5W / A5H; let i = 0;
    const draw = () => { drawSides(st, bookPages, items[i].sides, w, h); i = (i + 1) % items.length; };
    draw(); bookTimer = setInterval(draw, 1100);
  }
  $('sheet').onclick = () => { if (chain && $('sheet').firstElementChild) openSheetPreview($('sheet').innerHTML); };
  $('bookFrame').onclick = () => { if (bookPages) openBookPreview(bookPages); };
  // The book has no options besides its format: no preface and no end papers.
  $('bookFormat').addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); bookFmt = a.dataset.f; [...$('bookFormat').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === a)); pageTally(); });
  // A looping GIF of the animation for socials: each variant is drawn as an SVG, rasterised, mapped to 32 steps between paper and ink, and written by gifEncode.
  let gifFmt = 'sq';
  $('gifFormat').addEventListener('click', e => { const g = e.target.closest('a'); if (!g) return; e.preventDefault(); [...$('gifFormat').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === g)); gifFmt = g.dataset.g; });
  // Frames for socials: each variant as an SVG at 720 wide (square 720 high, story 1280 high), with the title line, a small credit and, for a framed piece, its source and caption.
  function socialSetup() {
    if (!chain) { $('msg').textContent = 'Press the yellow button first.'; return null; }
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
  $('dlBook').onclick = () => dlBook(bookFmt === 'imposed');
  $('dlSheet').onclick = () => chain && kept().states.length && dl(`form-sheet-${mode}-${paper}.svg`, sheetSVG(kept(), mode, new Set(), false, paper, titleText(kept())));
  // One download for the animation; the format (SVG, GIF or video) is chosen beside it, like the print size.
  let animFmt = 'svg';
  $('animFormat').addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); animFmt = a.dataset.f;
    [...$('animFormat').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', x === a)); $('dlAnim').setAttribute('aria-label', 'Download the animation as ' + a.textContent); });
  $('dlAnim').onclick = () => { if (!chain) return; if (animFmt === 'gif') return dlGif(); if (animFmt === 'video') return dlVideo();
    dl(`form-anim-${mode}.svg`, animSVG(kept(), mode, +$('spd').value, titleText(kept()))); };
  const sync = r => r.style.setProperty('--to', (r.value - r.min) / (r.max - r.min) * 100 + '%');
  document.querySelectorAll('input[type=range]').forEach(r => { sync(r); r.addEventListener('input', () => sync(r)); });
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'd' && !/INPUT/.test(e.target.tagName)) $('panel').classList.toggle('hidden'); });
  // Phones: the grid and shapes live on the screen, the settings in the sheet. One element moves between the two places.
  const small = matchMedia('all'), phone = matchMedia('(pointer: coarse), (max-width: 600px)');
  // The treatments sit with the results on every screen size, which keeps the panel short.
  const wide = matchMedia('(min-width: 901px) and (pointer: fine)');
  // On a wide desktop window the drawing tools (shapes, Clear, Random and the hint) sit in the side panel, beside the grid; elsewhere they stay under the grid.
  const placeTools = () => { if (wide.matches) { $('toolsHostPanel').append($('drawTools'), $('viewIcons')); } else { $('grid').after($('drawTools')); $('anim').after($('viewIcons')); } };
  wide.addEventListener('change', placeTools);
  const placeDraw = () => { placeTools(); $(small.matches ? 'drawHostScreen' : 'drawHostPanel').prepend($('drawBox')); $('spdHostPanel').prepend($('spd').closest('label')); (small.matches ? $('processHostScreen') : $('panel').querySelector('.cp-foot')).prepend($('processRow')); };
  small.addEventListener('change', () => { placeDraw(); sizeBody(); }); phone.addEventListener('change', () => { placeDraw(); sizeBody(); });
  const sizeBody = () => { document.body.style.paddingBottom = small.matches ? $('panel').offsetHeight + 4 + 'px' : ''; };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(sizeBody).observe($('panel'));
  // The results are a short path, one step at a time: the animation, the contact sheet, then make a book or a print.
  // One linear flow: Animation, Sheet, Print, GIF or video, Book. Steps 3 to 5 share one panel and show one card each.
  const CARDS = { 3: 'book' }, NEXT = { 1: 'Next', 2: 'Next' };
  let curStep = 1;
  // Animation is the result. The contact sheet, the GIF or video and the book are outputs, each optional, in that order, with the book last.
  function goStep(n) {
    $('msg').textContent = ''; curStep = n; document.body.dataset.step = n; document.body.classList.toggle('view-outputs', n > 1); paneSwitch();
    const panel = n > 2 ? 3 : n;
    document.querySelector('#step' + panel + ' .row.nav').append($('dlWrap')); $(n === 1 ? 'animFormat' : n === 2 ? 'paper' : 'bookFormat').append($('dlBar')); // the download icon sits at the end of the choice that decides what it downloads
    document.querySelectorAll('#out .step').forEach(el => el.classList.toggle('on', el.id === 'step' + panel));
    if (n > 2) { $('startAgain').hidden = false; document.querySelector('#step3 .back').dataset.go = n - 1; showBook(); } else { clearInterval(bookTimer); $('startAgain').hidden = true; }
    scrollTo(0, 0);
  }
  $('out').addEventListener('click', e => { const b = e.target.closest('button[data-go]'); if (b) goStep(+b.dataset.go); });
  // Three screens in order: Draw, Rule, Results. The rule is chosen after the shape is drawn, never while building.
  const paneNow = () => document.body.classList.contains('view-outputs') ? 'outputs' : document.body.classList.contains('view-results') ? 'results' : 'draw';
  // One path, in order, with no jumping ahead: Draw, Animation, Contact sheet, Book.
  const STEP_NAMES = ['Draw', 'Animation', 'Contact sheet', 'Book'];
  function paneSwitch() {
    const p = paneNow(), n = p === 'draw' ? 1 : 1 + curStep;
    $('stepNow').textContent = `Step ${n} of ${STEP_NAMES.length} · ${STEP_NAMES[n - 1]}`;
  }
  function showPane(p) {
    document.body.classList.toggle('view-results', p === 'results' || p === 'outputs');
    document.body.classList.toggle('view-outputs', p === 'outputs');
    if (p === 'draw') { document.body.dataset.step = '0'; clearInterval(bookTimer); $('paneSwitch').append($('dlWrap')); } else if (p === 'outputs') goStep(2); else if (p === 'results' && curStep > 1) goStep(1);
    paneSwitch(); scrollTo(0, 0);
  }
  $('backRule').onclick = () => showPane('draw');
  // Start again: back to Draw with a fresh starter symbol, as on a first visit, and nothing kept from the last run.
  $('startAgain').onclick = () => { clearInterval(timer); chain = null; hidden = new Set(); startSymbol(); drawGrid(); $('msg').textContent = ''; showPane('draw'); };
  placeDraw();
  if (small.matches) { $('panel').classList.add('collapsed'); $('grab').setAttribute('aria-expanded', 'false'); $('grab').setAttribute('aria-label', 'Open controls'); }
  sizeBody();
  $('anim').style.background = PAPER;
  $('grab').onclick = () => { const c = $('panel').classList.toggle('collapsed'); document.body.classList.toggle('sheet-collapsed', c); $('grab').setAttribute('aria-expanded', !c); $('grab').setAttribute('aria-label', c ? 'Open controls' : 'Collapse controls'); };
  // Pattern code: shown with a copy button, and a field that loads a pattern from a code. A ?code= address loads one on opening.
  function codeShow() { try { $('codeOut').textContent = patternCode(G, grid); } catch (e) { $('codeOut').textContent = ''; } }
  function loadCode(text) {
    try { const d = decodePatternCode(text); G = d.G; grid = d.cells; [...$('size').querySelectorAll('a')].forEach(x => x.setAttribute('aria-checked', +x.dataset.n === G)); $('codeMsg').textContent = ''; drawGrid(); if (chain) process(true); return true; }
    catch (e) { $('codeMsg').textContent = e.message; return false; }
  }
  $('codeLoad').onclick = () => { if (loadCode($('codeIn').value)) $('codeIn').value = ''; };
  $('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('codeLoad').click(); });
  $('codeCopy').onclick = () => { const c = $('codeOut').textContent; (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(() => { $('codeMsg').textContent = 'Copied.'; }, () => { const r = document.createRange(); r.selectNodeContents($('codeOut')); getSelection().removeAllRanges(); getSelection().addRange(r); $('codeMsg').textContent = 'Press copy on your keyboard.'; }); };
  { const qc = new URLSearchParams(location.search).get('code'); if (qc) loadCode(qc); }
  const pieceName = new URLSearchParams(location.search).get('piece');
  if (PIECES[pieceName]) {
    const P = PIECES[pieceName]; NOTE = P;
    grid = Array(G * G).fill(null);
    const ox = Math.floor((G - P.rows[0].length) / 2), oy = Math.floor((G - P.rows.length) / 2);
    P.rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') grid[(oy + y) * G + ox + x] = mk('square'); }));
    act = 'unmake'; // the framed piece shows only the unmaking
    $('spd').value = 250; $('spdOut').textContent = '250 ms'; sync($('spd'));
    $('pieceNote').innerHTML = `<p>${P.ref.replace(/(https?:\/\/\S+)/, '<a href="$1">$1</a>')}</p><p>${P.text}</p>`;
    $('pieceNote').hidden = false; document.body.classList.add('piece');
    drawGrid(); process();
  }
  drawGrid();
} else if (typeof module !== 'undefined') module.exports = { variants, unmake, scatter, connected, sheetSVG, patternCode, decodePatternCode, codeSeed, rng };
