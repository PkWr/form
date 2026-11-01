'use strict';
// Book preview: the book's own page drawing instructions (the same text that goes into the PDF) are drawn onto canvases, so what you see is what the PDF holds.
// A small interpreter covers exactly the operators book.js writes: q Q cm rg RG w m l c h re f B S W n gs cs scn BT Tf Tm Tj ET.
const OPS_RE = /\((?:\\.|[^\\)])*\)|\/[A-Za-z0-9]+|-?\d*\.?\d+|[A-Za-z]+\*?/g;
const WIN_BACK = { '\x91': '‘', '\x92': '’', '\x93': '“', '\x94': '”', '\x96': '–', '\x97': '—', '\x85': '…' };
const PREVIEW_FONTS = ['bold SZpx Arial, Helvetica, sans-serif', 'SZpx Arial, Helvetica, sans-serif', 'italic SZpx "Times New Roman", Times, serif', 'italic SZpx "Courier New", Courier, monospace'];
function patternsFor(ctx, k) { // the four fine-line patterns, drawn at the preview scale (PDF patterns ignore the page transform, so these are applied after resetting it)
  return DENS.map(a => {
    const t = Math.max(3, 1.1 * k), c = document.createElement('canvas'); c.width = c.height = Math.ceil(t * 2); const x = c.getContext('2d');
    x.fillStyle = INK; x.fillRect(0, 0, t * 2 * 0.45, t * 2);
    const p = ctx.createPattern(c, 'repeat'); if (p.setTransform) p.setTransform(new DOMMatrix().rotate(-a).scale(0.5)); return p;
  });
}
function renderOps(ctx, ops, k, W, H) {
  const toks = ops.match(OPS_RE) || [], pats = patternsFor(ctx, k), stack = [];
  let st = [], pat = null, clip = false, font = 1, size = 8, tx = 0, ty = 0;
  const num = v => v / 1, rgb = (r, g, b) => `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  const doFill = () => { if (pat) { ctx.save(); ctx.clip(); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); ctx.restore(); } else ctx.fill(); };
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineJoin = 'miter'; ctx.beginPath();
  for (const t of toks) {
    if (/^-?\d*\.?\d+$/.test(t)) { st.push(+t); continue; }
    if (t[0] === '/' || t[0] === '(') { st.push(t); continue; }
    switch (t) {
      case 'q': ctx.save(); stack.push(pat); break;
      case 'Q': ctx.restore(); pat = stack.pop() || null; break;
      case 'cm': ctx.transform(st[0], st[1], st[2], st[3], st[4], st[5]); break;
      case 'rg': ctx.fillStyle = rgb(st[0], st[1], st[2]); pat = null; break;
      case 'RG': ctx.strokeStyle = rgb(st[0], st[1], st[2]); break;
      case 'w': ctx.lineWidth = st[0]; break;
      case 'm': ctx.moveTo(st[0], st[1]); break;
      case 'l': ctx.lineTo(st[0], st[1]); break;
      case 'c': ctx.bezierCurveTo(st[0], st[1], st[2], st[3], st[4], st[5]); break;
      case 'h': ctx.closePath(); break;
      case 're': ctx.rect(st[0], st[1], st[2], st[3]); break;
      case 'f': doFill(); ctx.beginPath(); break;
      case 'B': doFill(); ctx.stroke(); ctx.beginPath(); break;
      case 'S': ctx.stroke(); ctx.beginPath(); break;
      case 'W': clip = true; break;
      case 'n': if (clip) { ctx.clip(); clip = false; } ctx.beginPath(); break;
      case 'gs': ctx.globalAlpha = +st[0].slice(2) / 100; break;
      case 'scn': pat = pats[+st[0].slice(2)]; break;
      case 'BT': tx = ty = 0; break;
      case 'Tf': font = +st[0].slice(2) - 1; size = st[1]; break;
      case 'Tm': tx = st[4]; ty = st[5]; break;
      case 'Tj': { const s = st[0].slice(1, -1).replace(/\\([\\()])/g, '$1').replace(/[\x85\x91-\x94\x96\x97]/g, c => WIN_BACK[c]);
        ctx.font = PREVIEW_FONTS[font].replace('SZ', size); ctx.textBaseline = 'alphabetic'; ctx.fillText(s, tx, ty); break; }
      default: break; // cs, ET and anything else: nothing to do
    }
    st = [];
  }
  ctx.restore();
}

// ---- the viewer ----
let BP = { pages: [], mode: 'read', i: 0 };
const bpEl = id => document.getElementById(id);
// The reading order: the cover alone on the right, then facing pages as spreads, then the back cover alone on the left.
function bookItems(n) {
  const out = [{ sides: [null, 0], label: 'Cover' }];
  for (let q = 1; q < n - 1; q += 2) out.push({ sides: [q, q + 1], label: `Pages ${q + 1} and ${q + 2} of ${n}` });
  out.push({ sides: [n - 1, null], label: `Back cover, page ${n}` });
  return out;
}
// Draw one spread (or a single page with its partner side left empty) into a container, one canvas per page.
function drawSides(stage, pages, sides, w, h) {
  const dpr = window.devicePixelRatio || 1; stage.innerHTML = '';
  sides.forEach(pg => {
    if (pg === null) { const d = document.createElement('div'); d.style.cssText = `width:${w}px;height:${h}px`; stage.appendChild(d); return; }
    const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px';
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', `Page ${pg + 1}`);
    renderOps(c.getContext('2d'), pages[pg], c.width / A5W, A5W, A5H); stage.appendChild(c);
  });
}
function bpItems() {
  const n = BP.pages.length;
  if (BP.mode === 'sheets') return imposition(n).map(([l, r], i) => ({ sides: [l, r], label: `Printer's sheet ${Math.floor(i / 2) + 1}, ${i % 2 ? 'back' : 'front'}` }));
  return bookItems(n);
}
function bpShow() {
  const items = bpItems(); BP.i = Math.max(0, Math.min(items.length - 1, BP.i));
  const it = items[BP.i], stage = bpEl('bpStage'), sides = it.sides.length, dpr = window.devicePixelRatio || 1;
  const h = Math.max(120, Math.min(stage.clientHeight - 24, (stage.clientWidth - 24) / (sides * A5W / A5H))), w = h * A5W / A5H;
  stage.innerHTML = '';
  it.sides.forEach(pg => {
    if (pg === null) { const d = document.createElement('div'); d.style.cssText = `width:${w}px;height:${h}px`; stage.appendChild(d); return; }
    const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px';
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', `Page ${pg + 1}`);
    renderOps(c.getContext('2d'), BP.pages[pg], c.width / A5W, A5W, A5H); stage.appendChild(c);
  });
  bpEl('bpPos').textContent = `${it.label}  (${BP.i + 1} of ${items.length})`;
  bpEl('bpPrev').disabled = BP.i === 0; bpEl('bpNext').disabled = BP.i === items.length - 1;
  [...bpEl('bpMode').querySelectorAll('a')].forEach(a => a.setAttribute('aria-checked', a.dataset.v === BP.mode));
}
function openBookPreview(pages) {
  BP = { pages, mode: 'read', i: 0 }; bpEl('bookPreview').hidden = false; document.body.style.overflow = 'hidden'; bpShow(); bpEl('bpNext').focus();
}
function closeBookPreview() { bpEl('bookPreview').hidden = true; document.body.style.overflow = ''; }
if (typeof document !== 'undefined') {
  bpEl('bpClose').onclick = closeBookPreview;
  bpEl('bpPrev').onclick = () => { BP.i--; bpShow(); };
  bpEl('bpNext').onclick = () => { BP.i++; bpShow(); };
  bpEl('bpMode').addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); BP.mode = a.dataset.v; BP.i = 0; bpShow(); });
  addEventListener('keydown', e => { if (bpEl('bookPreview').hidden) return; if (e.key === 'Escape') closeBookPreview(); else if (e.key === 'ArrowRight') { BP.i++; bpShow(); } else if (e.key === 'ArrowLeft') { BP.i--; bpShow(); } });
  addEventListener('resize', () => { if (!bpEl('bookPreview').hidden) bpShow(); });
}
