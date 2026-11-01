'use strict';
// A small GIF writer (no library): a palette of up to 256 colours, any number of frames, looping. Frames are arrays of palette indices.
function gifEncode(w, h, palette, frames, delayCs, comment) {
  const bits = Math.max(1, Math.ceil(Math.log2(palette.length))), size = 1 << bits, minCode = Math.max(2, bits), bytes = [];
  const u16 = v => bytes.push(v & 255, v >> 8);
  '47 49 46 38 39 61'.split(' ').forEach(x => bytes.push(parseInt(x, 16))); // GIF89a
  u16(w); u16(h); bytes.push(0x80 | (bits - 1), 0, 0);
  for (let i = 0; i < size; i++) bytes.push(...(palette[i] || [0, 0, 0]));
  bytes.push(0x21, 0xff, 11, ...[...'NETSCAPE2.0'].map(c => c.charCodeAt(0)), 3, 1, 0, 0, 0); // loop forever
  if (comment) { const c = [...comment].map(ch => ch.charCodeAt(0) & 127); bytes.push(0x21, 0xfe); for (let i = 0; i < c.length; i += 255) { const n = Math.min(255, c.length - i); bytes.push(n, ...c.slice(i, i + n)); } bytes.push(0); } // comment block: the credit
  frames.forEach(px => {
    bytes.push(0x21, 0xf9, 4, 0, delayCs & 255, delayCs >> 8, 0, 0, 0x2c); u16(0); u16(0); u16(w); u16(h); bytes.push(0, minCode);
    const data = lzw(px, minCode);
    for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); bytes.push(n); for (let j = 0; j < n; j++) bytes.push(data[i + j]); }
    bytes.push(0);
  });
  bytes.push(0x3b);
  return Uint8Array.from(bytes);
}
function lzw(px, minCode) {
  const clear = 1 << minCode, eoi = clear + 1, out = []; let codeSize = minCode + 1, maxcode = (1 << codeSize) - 1, next = eoi + 1, cur = 0, nb = 0, dict = new Map();
  const put = c => { cur |= c << nb; nb += codeSize; while (nb >= 8) { out.push(cur & 255); cur >>>= 8; nb -= 8; } };
  const emit = c => { put(c); if (next > maxcode && codeSize < 12) { codeSize++; maxcode = (1 << codeSize) - 1; } };
  const reset = () => { codeSize = minCode + 1; maxcode = (1 << codeSize) - 1; next = eoi + 1; dict = new Map(); };
  put(clear);
  let prefix = px[0];
  for (let i = 1; i < px.length; i++) {
    const k = px[i], key = prefix * 256 + k, hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    if (next < 4096) dict.set(key, next++); else { put(clear); reset(); }
    prefix = k;
  }
  emit(prefix); put(eoi);
  if (nb > 0) out.push(cur & 255);
  return out;
}
if (typeof module !== 'undefined' && typeof document === 'undefined') module.exports = { gifEncode };
