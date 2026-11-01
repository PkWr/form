// Builds a USDZ file (for AR Quick Look on iPhone) of the floating pattern, with the movement baked in as time samples.
// The model is the same as model.js shows: cells are 5 cm, the shape floats, y is up and z comes toward the viewer.
// Hidden test code: not used by the tool or the book.
(function (root) {
  const FPS = 24, CELL = 0.05, f4 = v => (Math.round(v * 10000) / 10000).toString();
  const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
  // m = { start:[[x,y,z]], moves:[{from,to}], unmade:[[keys]], mt, ut } (times in seconds). Returns the USDA text and its frame count.
  function buildUSDA(m) {
    const { start, moves, unmade, mt, ut } = m, key3 = b => b.join(','), xs = start.map(b => b[0]), ys = start.map(b => b[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const lift = ((Math.max(...ys) - Math.min(...ys)) / 2 + 2) * CELL, P = (x, y, z) => [(x - cx) * CELL, -(y - cy) * CELL + lift, z * CELL];
    const nSlots = moves.length ? moves.length + 1 : 0, mf = Math.round(mt * FPS), uf = Math.round(ut * FPS), endF = nSlots * mf + unmade.length * uf + Math.round(1.5 * FPS);
    const dedupe = a => { const o = [], seen = new Set(); a.forEach(([f, v]) => { if (!seen.has(f)) { seen.add(f); o.push([f, v]); } else o[o.length - 1] = [f, v]; }); return o.sort((p, q) => p[0] - q[0]); };
    const N = start.length, tr = start.map(() => []), sc = start.map(() => []), mk = start.map(() => []); // keyframes per block: [frame, value]
    const T = (j, f, p) => tr[j].push([f, p]), S = (j, f, v) => sc[j].push([f, v]), M = (j, f, v) => mk[j].push([f, v]);
    start.forEach((b, j) => { T(j, 0, P(...b)); S(j, 0, 1); M(j, 0, 0); });
    const slots = root.spacePlan ? root.spacePlan(start, moves) : m.plan, nS = slots.length, K = 8, runStart = {}, bounds = {};
    slots.forEach((sl, i) => { const f0 = i * mf;
      if (sl.cur) { const c = sl.cur; for (let k = 0; k <= K; k++) { const x = k / K, s = ease(x), a = Math.sin(Math.PI * x) * 1.7; T(c.bi, Math.round(f0 + x * 0.8 * mf), P(lerp(c.src[0], c.to[0], s), lerp(c.src[1], c.to[1], s), lerp(c.src[2], c.to[2], s) + a)); }
        T(c.bi, f0 + mf - 1, P(...c.to)); if (!(c.bi in runStart) || bounds[c.bi] !== i - 1) { runStart[c.bi] = i; } bounds[c.bi] = i; if (runStart[c.bi] === i) M(c.bi, f0 - 1, 0); M(c.bi, f0, 1); M(c.bi, f0 + mf - 1, 1); }
      if (sl.ret) { const r = sl.ret, o = start[r.bi]; for (let k = 0; k <= K; k++) { const x = k / K, s = ease(x), a = Math.sin(Math.PI * x) * 1.0; T(r.bi, Math.round(f0 + x * 0.8 * mf), P(lerp(r.from[0], o[0], s), lerp(r.from[1], o[1], s), lerp(r.from[2], o[2], s) + a)); }
        T(r.bi, f0 + mf - 1, P(...o)); M(r.bi, f0, 1); M(r.bi, f0 + mf - 1, 1); M(r.bi, f0 + mf, 0); }
    });
    const u0 = nSlots * mf;
    unmade.forEach((set, i) => {
      const gone = new Set(i > 0 ? unmade[i - 1] : []), f0 = u0 + i * uf;
      start.forEach((b, j) => { const k3 = key3(b); if (gone.has(k3)) return; if (set.includes(k3)) {
        const K = 6; for (let k = 0; k <= K; k++) { const l = ease(k / K); T(j, Math.round(f0 + (k / K) * 0.85 * uf), P(b[0], b[1], b[2] + l * 3)); S(j, Math.round(f0 + (k / K) * 0.85 * uf), Math.max(0, 1 - l)); }
        S(j, f0 + uf - 1, 0); M(j, f0 - 1, 0); M(j, f0, 1); } });
    });
    // after the last step every block is gone and every place is marked; then the loop restarts with everything back
    start.forEach((b, j) => { M(j, u0 + unmade.length * uf - 1, 0); M(j, u0 + unmade.length * uf, 1); M(j, endF - 1, 1); T(j, endF - 1, dedupe(tr[j]).slice(-1)[0][1]); T(j, endF, P(...b)); S(j, endF - 1, dedupe(sc[j]).slice(-1)[0][1]); S(j, endF, 1); M(j, endF, 0); });
    const samples = (a, fmt) => '{\n' + dedupe(a).map(([f, v]) => `                ${f}: ${fmt(v)}`).join(',\n') + ',\n            }';
    let s = `#usda 1.0\n(\n    defaultPrim = "Form"\n    metersPerUnit = 1\n    upAxis = "Y"\n    startTimeCode = 0\n    endTimeCode = ${endF}\n    timeCodesPerSecond = ${FPS}\n)\n\ndef Xform "Form"\n{\n`;
    s += `    def Material "Ink"\n    {\n        token outputs:surface.connect = </Form/Ink/Surf.outputs:surface>\n        def Shader "Surf"\n        {\n            uniform token info:id = "UsdPreviewSurface"\n            color3f inputs:diffuseColor = (0.137, 0.122, 0.125)\n            float inputs:roughness = 0.6\n            token outputs:surface\n        }\n    }\n`;
    s += `    def Material "Mark"\n    {\n        token outputs:surface.connect = </Form/Mark/Surf.outputs:surface>\n        def Shader "Surf"\n        {\n            uniform token info:id = "UsdPreviewSurface"\n            color3f inputs:diffuseColor = (0.55, 0.54, 0.51)\n            float inputs:opacity = 0.22\n            float inputs:roughness = 1\n            token outputs:surface\n        }\n    }\n`;
    start.forEach((b, j) => {
      s += `    def Xform "B${j}"\n    {\n        double3 xformOp:translate.timeSamples = ${samples(tr[j], v => `(${v.map(f4).join(', ')})`)}\n        double3 xformOp:scale.timeSamples = ${samples(sc[j], v => `(${f4(v)}, ${f4(v)}, ${f4(v)})`)}\n        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]\n        def Cube "Cube"\n        {\n            double size = ${f4(CELL * 0.94)}\n            rel material:binding = </Form/Ink>\n        }\n    }\n`;
      const p0 = P(...moves.length ? start[j] : b), vis = mk[j];
      s += `    def Xform "M${j}"\n    {\n        double3 xformOp:translate = (${P(...b).map(f4).join(', ')})\n        double3 xformOp:scale.timeSamples = ${samples(vis, v => `(${f4(v)}, ${f4(v)}, ${f4(v)})`)}\n        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]\n        def Cube "Cube"\n        {\n            double size = ${f4(CELL * 0.94)}\n            rel material:binding = </Form/Mark>\n        }\n    }\n`;
    });
    return { text: s + '}\n', frames: endF };
  }
  // Marks that move: the vacated place of a move is not the block's own start in the make phase if two blocks share a start; each block has its own marker at its own start.
  // A plain, uncompressed zip, as USDZ requires: each file's data starts on a 64-byte boundary.
  const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = crcT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zipStore(name, data) {
    const nm = new TextEncoder().encode(name), crc = crc32(data), le = (v, n) => { const a = []; for (let i = 0; i < n; i++) a.push((v >>> (8 * i)) & 255); return a; };
    let hdr = 30 + nm.length, pad = (64 - (hdr % 64)) % 64; const extra = pad >= 4 ? pad : pad + 64; // an extra field (id 0x0000 plus length) holds the padding
    const ext = [0, 0, ...le(extra - 4, 2), ...new Array(extra - 4).fill(0)];
    const local = [...le(0x04034b50, 4), ...le(20, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0x21, 2), ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nm.length, 2), ...le(extra, 2), ...nm, ...ext];
    const cen = [...le(0x02014b50, 4), ...le(20, 2), ...le(20, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0x21, 2), ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nm.length, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(0, 4), ...nm];
    const end = [...le(0x06054b50, 4), ...le(0, 2), ...le(0, 2), ...le(1, 2), ...le(1, 2), ...le(cen.length, 4), ...le(local.length + data.length, 4), ...le(0, 2)];
    const out = new Uint8Array(local.length + data.length + cen.length + end.length); out.set(local, 0); out.set(data, local.length); out.set(cen, local.length + data.length); out.set(end, local.length + data.length + cen.length); return out;
  }
  function makeUSDZ(m) { const { text } = buildUSDA(m); return zipStore('form.usda', new TextEncoder().encode(text)); }
  const api = { buildUSDA, makeUSDZ, zipStore };
  if (typeof module !== 'undefined') module.exports = api; else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
