// The make rule in space. A block moves to any empty cell that touches the rest on one of six faces, in front of or behind the page as well as beside it,
// and the shape stays joined face to face. Depth is limited to one cell either side of the page (z from -1 to 1). Each variant is one move from the original.
// Hidden test code: not used by the tool or the book.
(function (root) {
  const D = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], key = c => c.join(',');
  const norm = bs => { const m = [0, 1, 2].map(i => Math.min(...bs.map(b => b[i]))); return bs.map(b => b.map((v, i) => v - m[i])).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]).map(key).join('|'); };
  const joined = bs => { const s = new Set(bs.map(key)), seen = new Set([key(bs[0])]), q = [bs[0]]; while (q.length) { const c = q.pop(); for (const d of D) { const n = [c[0] + d[0], c[1] + d[1], c[2] + d[2]]; if (s.has(key(n)) && !seen.has(key(n))) { seen.add(key(n)); q.push(n); } } } return seen.size === bs.length; };
  // start: [[x,y,z],...]. Returns [{from,to}], in a fixed order (by block, then nearest target first). If more than cap, a seeded pick of cap of them (R is a 0..1 generator), kept in order.
  function spaceMoves(start, cap, R, zmin = -1, zmax = 1) {
    const occ = new Set(start.map(key)), seen = new Set([norm(start)]), out = [];
    start.forEach((b, i) => {
      const rest = start.filter((_, j) => j !== i), t = new Map();
      rest.forEach(o => D.forEach(d => { const n = [o[0] + d[0], o[1] + d[1], o[2] + d[2]]; if (!occ.has(key(n)) && n[2] >= zmin && n[2] <= zmax) t.set(key(n), n); }));
      [...t.values()].sort((p, q) => Math.abs(p[0] - b[0]) + Math.abs(p[1] - b[1]) + Math.abs(p[2] - b[2]) - Math.abs(q[0] - b[0]) - Math.abs(q[1] - b[1]) - Math.abs(q[2] - b[2]) || p[2] - q[2] || p[1] - q[1] || p[0] - q[0]).forEach(n => {
        const nb = rest.concat([n]); if (!joined(nb)) return; const k = norm(nb); if (seen.has(k)) return; seen.add(k); out.push({ from: b, to: n });
      });
    });
    if (out.length <= cap) return out;
    const idx = out.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx.slice(0, cap).sort((a, b) => a - b).map(i => out[i]);
  }
  // Unmake: one block taken away per step, in a seeded order, and never back. Returns the list of cumulative removed sets (as key strings); the last holds every block.
  function spaceUnmake(start, R) {
    const order = start.map((_, i) => i).sort((a, b) => R() - R() || a - b), steps = [];
    order.forEach((_, k) => steps.push(order.slice(0, k + 1).map(i => key(start[i]))));
    return steps;
  }
  const api = { spaceMoves, spaceUnmake };
  if (typeof module !== 'undefined') module.exports = api; else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
