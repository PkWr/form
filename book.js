'use strict';
// Publication: the current shape, its variants and the five treatments laid out as a small book in the design of the original
// (11 ways I can make you up, and Form): light pages with the shape on top and its variants in a grid under it, then dark plates.
// Output is a real PDF written by hand (no library): A5 pages with no bleed, imposed two to a sheet for saddle stitch on A4 landscape
// (print double sided, flip on short edge, fold and staple), or the plain A5 pages for proofing.
// It relies on globals from app.js: SHAPES, ang, ghosts, TONE, U, bbox, waysLabel.
const PT = 72 / 25.4, A5W = 148 * PT, A5H = 210 * PT, A4W = 297 * PT;
const THEME = { light: { bg: '#DEDDD2', ink: '#231F20', dim: '#231F20' }, dark: { bg: '#231F20', ink: '#DEDDD2', dim: '#7A776F' }, yellow: { bg: '#FFE100', ink: '#FFFFFF', dim: '#231F20' } };
// Shape outlines in a 100 by 100 cell. Keep in step with SHAPES in app.js.
const SEG = {
  square: [['m', 0, 0], ['l', 100, 0], ['l', 100, 100], ['l', 0, 100], ['h']],
  tri: [['m', 0, 0], ['l', 100, 100], ['l', 0, 100], ['h']],
  arch: [['m', 0, 0], ['c', 55.23, 0, 100, 44.77, 100, 100], ['l', 0, 100], ['h']],
  circle: [['m', 50, 0], ['c', 77.61, 0, 100, 22.39, 100, 50], ['c', 100, 77.61, 77.61, 100, 50, 100], ['c', 22.39, 100, 0, 77.61, 0, 50], ['c', 0, 22.39, 22.39, 0, 50, 0], ['h']],
};
const rotPt = (x, y, a) => a === 90 ? [100 - y, x] : a === 180 ? [100 - x, 100 - y] : a === 270 ? [y, 100 - x] : [x, y];
const n2 = v => +v.toFixed(3);
const pathOps = (id, a) => SEG[id].map(([op, ...p]) => { if (op === 'h') return 'h'; const q = []; for (let i = 0; i < p.length; i += 2) { const r = rotPt(p[i], p[i + 1], a); q.push(n2(r[0]), n2(r[1])); } return q.join(' ') + ' ' + op; }).join(' ');
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map(v => n2(v / 255)).join(' '); };
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v'];
const VIEWS = [['form', 'Form'], ['direction', 'Direction'], ['solid', 'Cumulative Solid'], ['trans', 'Cumulative Transparency'], ['dens', 'Cumulative Density']];

// Text width, by the browser's metric-compatible fonts when there is a canvas, otherwise a rough average.
const FONTS = [['Helvetica-Bold', 'bold 100px Arial, Helvetica, sans-serif'], ['Helvetica', '100px Arial, Helvetica, sans-serif'], ['Times-Italic', 'italic 100px "Times New Roman", Times, serif'], ['Courier-Oblique', 'italic 100px "Courier New", Courier, monospace']];
let measureCtx = null;
function textWidth(t, f, size) {
  if (typeof document !== 'undefined') { measureCtx = measureCtx || document.createElement('canvas').getContext('2d'); measureCtx.font = FONTS[f][1]; return measureCtx.measureText(t).width * size / 100; }
  return t.length * size * (f === 3 ? 0.6 : 0.5);
}
const pdfStr = t => t.replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');

function makeBook(bc, opt) {
  const N = bc.states.length - 1, W = A5W, H = A5H, gs = new Set();
  const title = waysLabel(N, opt.verb), note = opt.note || null;
  const alpha = o => { const p = Math.round(o * 100); gs.add(p); return `/G${p} gs `; };
  const text = (t, f, size, x, y, col, align = 'c') => { const w = textWidth(t, f, size), xx = align === 'c' ? x - w / 2 : x; return `${rgb(col)} rg BT /F${f + 1} ${size} Tf 1 0 0 -1 ${n2(xx)} ${n2(y)} Tm (${pdfStr(t)}) Tj ET\n`; };
  // blocks, stripes and hatching, in a frame whose cell (0,0) sits at (X,Y) with cells c points wide
  const blockOps = (b, X, Y, c, ink, o = 1) => `q ${o < 1 ? alpha(o) : ''}${n2(c / 100)} 0 0 ${n2(c / 100)} ${n2(X + b.x * c)} ${n2(Y + b.y * c)} cm ${rgb(ink)} rg ${rgb(ink)} RG 1.5 w ${pathOps(b.s, ang(b))} B Q\n`;
  const stripeOps = (b, X, Y, c, ink) => `q ${n2(c / 100)} 0 0 ${n2(c / 100)} ${n2(X + b.x * c)} ${n2(Y + b.y * c)} cm ${rgb(ink)} rg ${pathOps(b.s, ang(b))} W n ` +
    (b.a === 0 ? '0 0 100 20 re 0 40 100 20 re 0 80 100 20 re' : '0 0 20 100 re 40 0 20 100 re 80 0 20 100 re') + ' f Q\n';
  const hatchOps = (tr, X, Y, c, ink) => {
    const cnt = new Map(), seen = new Set(); let out = '';
    tr.forEach(t => cnt.set(t.x + ',' + t.y, (cnt.get(t.x + ',' + t.y) || 0) + 1));
    tr.forEach(t => {
      const key = t.x + ',' + t.y + t.s + ang(t); if (seen.has(key)) return; seen.add(key);
      const sp = 40 / Math.min(8, cnt.get(t.x + ',' + t.y)); let ln = '';
      for (let x = -100; x <= 100; x += sp) ln += `${n2(x)} 0 m ${n2(x + 100)} 100 l `;
      out += `q ${n2(c / 100)} 0 0 ${n2(c / 100)} ${n2(X + t.x * c)} ${n2(Y + t.y * c)} cm ${rgb(ink)} RG 3.5 w ${pathOps(t.s, ang(t))} W n ${ln}S Q\n`;
    });
    return out;
  };
  const frameOps = (k, view, X, Y, c, ink) => {
    const s = bc.states[k]; let out = '';
    if (view === 'direction') return s.blocks.map(b => stripeOps(b, X, Y, c, ink)).join('');
    if (view === 'trans') { ghosts(bc, k).forEach(g => g.blocks.forEach(b => { out += blockOps(b, X + g.dx * c, Y + g.dy * c, c, ink, g.o); })); s.tr.forEach(t => { out += blockOps(t, X, Y, c, ink, TONE); }); }
    else if (view === 'solid') s.tr.forEach(t => { out += blockOps(t, X, Y, c, ink); });
    else if (view === 'dens') out += hatchOps(s.tr, X, Y, c, ink);
    return out + s.blocks.map(b => blockOps(b, X, Y, c, ink)).join('');
  };
  const fit = (n, bw, bh, rw, rh, cmax) => { let best = null; for (let c = 1; c <= n; c++) { const r = Math.ceil(n / c), s = Math.min(cmax, rw / (c * bw), rh / (r * bh)); if (!best || s > best.s - 1e-9) best = { cols: c, rows: r, s }; } return best; };
  const foot = (th) => {
    let out = text(title, 2, 5.5, W / 2, H * 0.962, th.dim);
    if (note) { const n = Math.floor(W * 0.86 / (5 * 0.6)), lines = [...wrapText(note.ref, n), ...wrapText(note.text, n)]; lines.forEach((l, i) => { out += text(l, 3, 5, W / 2, H * 0.9 + i * 7, th.dim); }); }
    return out;
  };
  const page = (th, body) => `${rgb(th.bg)} rg 0 0 ${n2(W)} ${n2(H)} re f\n` + body + foot(th);
  const slot = (view, th) => { // the original, large, on the cover and on dark plates (registered on the shared frame)
    const bb = bbox(bc, view), bw = bb.w / U, bh = bb.h / U, c = Math.min(0.11 * W, 0.76 * W / bw, 0.5 * H / bh);
    return { bb, c, X: W / 2 - bw * c / 2 - bb.x / U * c, Y: 0.435 * H - bh * c / 2 - bb.y / U * c };
  };
  // End papers: the iterations tiled edge to edge, white on yellow. The front one runs through the variants in order, the back one in reverse. The bleed is not drawn, so the pattern runs to the page edge.
  const endpaper = rev => {
    const bb = bbox(bc, 'form'), bw = bb.w / U, bh = bb.h / U, s = W / (7 * bw), pw = s * bw, ph = s * bh, th = THEME.yellow; let body = '';
    for (let r = 0; r <= Math.ceil(H / ph); r++) for (let c = -1; c <= 8; c++) {
      const idx = (((r * 7 + c) % N) + N) % N, k = rev ? N - idx : idx + 1;
      body += frameOps(k, 'form', c * pw + (r % 2 ? pw / 2 : 0) - bb.x / U * s, r * ph - bb.y / U * s, s, th.ink);
    }
    return page(th, body);
  };
  const pages = [];
  // cover
  { const bb = bbox(bc, 'form'), bw = bb.w / U, bh = bb.h / U, c = Math.min(0.11 * W, 0.76 * W / bw, 0.5 * H / bh);
    const o = bc.states[0].blocks, x0 = Math.min(...o.map(b => b.x)), x1 = Math.max(...o.map(b => b.x)) + 1, y0 = Math.min(...o.map(b => b.y)), y1 = Math.max(...o.map(b => b.y)) + 1;
    const cc = Math.min(0.11 * W, 0.7 * W / (x1 - x0), 0.5 * H / (y1 - y0));
    pages.push(page(THEME.light, frameOps(0, 'form', W / 2 - (x0 + x1) / 2 * cc, 0.435 * H - (y0 + y1) / 2 * cc, cc, THEME.light.ink) +
      text(title, 0, 8, W / 2, H * 0.808, THEME.light.ink) + text('Form', 2, 8, W / 2, H * 0.826, THEME.light.ink))); }
  if (opt.endpapers) pages.push(endpaper(false));
  // the five treatments, each with the original on top and the variants in a grid
  VIEWS.forEach(([view, name], vi) => {
    const bb = bbox(bc, view), bw = bb.w / U, bh = bb.h / U, per = 48, pc = Math.max(1, Math.ceil(N / per));
    for (let p = 0; p < pc; p++) {
      const ks = []; for (let k = 1 + p * per; k <= Math.min(N, (p + 1) * per); k++) ks.push(k);
      const rx = 0.78 * W, ry = 0.445 * H, f = fit(ks.length, bw, bh, rx, ry, 0.0373 * W);
      const left = 0.11 * W + (rx - f.cols * f.s * bw) / 2; let body = '';
      const o = bc.states[0].blocks, x0 = Math.min(...o.map(b => b.x)), x1 = Math.max(...o.map(b => b.x)) + 1, y0 = Math.min(...o.map(b => b.y));
      body += frameOps(0, view, W / 2 - (x0 + x1) / 2 * 0.0373 * W, 0.12 * H - y0 * 0.0373 * W, 0.0373 * W, THEME.light.ink);
      ks.forEach((k, i) => { body += frameOps(k, view, left + (i % f.cols) * f.s * bw - bb.x / U * f.s, 0.275 * H + Math.floor(i / f.cols) * f.s * bh - bb.y / U * f.s, f.s, THEME.light.ink); });
      body += text(ROMAN[vi] + (pc > 1 ? '   ' + (p + 1) + ' of ' + pc : ''), 2, 6, W / 2, H * 0.805, THEME.light.ink) + text(name, 0, 8, W / 2, H * 0.824, THEME.light.ink);
      pages.push(page(THEME.light, body));
    }
  });
  // dark plates: the original, then every variant one to a page (or in grids when there are many)
  { const sl = slot('form'), d = THEME.dark;
    pages.push(page(d, frameOps(0, 'form', sl.X, sl.Y, sl.c, d.ink) + text(waysLabel(N, opt.verb).split(' ')[0] + ' ways', 2, 6, W / 2, H * 0.805, d.dim) + text('Form', 0, 8, W / 2, H * 0.824, d.dim)));
    if (N <= 16) for (let k = 1; k <= N; k++) pages.push(page(d, frameOps(k, 'form', sl.X, sl.Y, sl.c, d.ink)));
    else { const bb = bbox(bc, 'form'), bw = bb.w / U, bh = bb.h / U;
      for (let p = 0; p * 12 < N; p++) { const ks = []; for (let k = 1 + p * 12; k <= Math.min(N, p * 12 + 12); k++) ks.push(k);
        const rx = 0.78 * W, ry = 0.62 * H, f = fit(ks.length, bw, bh, rx, ry, 0.0373 * W), left = 0.11 * W + (rx - f.cols * f.s * bw) / 2;
        pages.push(page(d, ks.map((k, i) => frameOps(k, 'form', left + (i % f.cols) * f.s * bw - bb.x / U * f.s, 0.1 * H + Math.floor(i / f.cols) * f.s * bh - bb.y / U * f.s, f.s, d.ink)).join(''))); } }
  }
  // blank pages so the booklet is a multiple of four, then the colophon as the last page
  while ((pages.length + (opt.endpapers ? 1 : 0) + 1) % 4) pages.push(page(THEME.dark, ''));
  if (opt.endpapers) pages.push(endpaper(true));
  const total = pages.length + 1, L = THEME.light;
  pages.push(page(L, text(title, 0, 8, W / 2, H * 0.78, L.ink) + text('Made with Form, form.pkwr.co, on ' + (opt.date || '') + '.', 2, 6.5, W / 2, H * 0.80, L.ink) +
    text('Based on the publication 11 ways I can make you up by Patrick Walker.', 2, 6.5, W / 2, H * 0.815, L.ink) + text('A5, ' + total + ' pages, saddle stitch, no bleed.', 2, 6.5, W / 2, H * 0.83, L.ink)));
  return pdfBuild(pages, opt.imposed, gs);
}

// Booklet imposition: for n pages (a multiple of four) the sides of the sheets, each as [left page, right page], 0-based.
function imposition(n) { const out = []; for (let i = 0; i < n / 4; i++) { out.push([n - 1 - 2 * i, 2 * i]); out.push([2 * i + 1, n - 2 - 2 * i]); } return out; }

function pdfBuild(pageOps, imposed, gs) {
  const W = A5W, H = A5H, objs = [null, null];
  const add = s => { objs.push(s); return objs.length; };
  const stream = (dict, body) => add(`<< ${dict} /Length ${body.length} >>\nstream\n${body}endstream`);
  const wrap = ops => `1 0 0 -1 0 ${n2(H)} cm\n${ops}`;
  const fonts = FONTS.map(f => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${f[0]} /Encoding /WinAnsiEncoding >>`));
  const gsIds = [...gs].map(p => [p, add(`<< /Type /ExtGState /CA ${p / 100} /ca ${p / 100} >>`)]);
  const resId = add('');
  const xo = imposed ? pageOps.map(o => stream(`/Type /XObject /Subtype /Form /BBox [0 0 ${n2(W)} ${n2(H)}] /Resources ${resId} 0 R`, wrap(o))) : [];
  objs[resId - 1] = `<< /Font << ${fonts.map((id, i) => `/F${i + 1} ${id} 0 R`).join(' ')} >> /ExtGState << ${gsIds.map(([p, id]) => `/G${p} ${id} 0 R`).join(' ')} >> /XObject << ${xo.map((id, i) => `/P${i} ${id} 0 R`).join(' ')} >> >>`;
  const kids = [];
  if (imposed) { const sw = A4W, off = (sw - 2 * W) / 2; imposition(pageOps.length).forEach(([l, r]) => { const c = stream('', `q 1 0 0 1 ${n2(off)} 0 cm /P${l} Do Q q 1 0 0 1 ${n2(off + W)} 0 cm /P${r} Do Q\n`); kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(sw)} ${n2(H)}] /Resources ${resId} 0 R /Contents ${c} 0 R >>`)); }); }
  else pageOps.forEach(o => { const c = stream('', wrap(o)); kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(W)} ${n2(H)}] /Resources ${resId} 0 R /Contents ${c} 0 R >>`)); });
  objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((s, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${s}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
if (typeof module !== 'undefined' && typeof document === 'undefined') module.exports = { makeBook, imposition };
