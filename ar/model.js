// Hidden test page: a pattern floating in space, its blocks moving to the sides and to the front and back. Open with ?code= and the pattern code. Not linked from anywhere.
import * as THREE from 'three';
const q = new URLSearchParams(location.search), code = (q.get('code') || '').trim();
const msg = t => { document.getElementById('msg').textContent = t; };
const INK = 0x231F20, PAPER = 0xDEDDD2, CAP = 150, LOOP_MAX = 120; // seconds
const MOVE_T = Math.max(0.2, Math.min(3, +q.get('speed') || 0.7)), UN_T = MOVE_T * 0.85; // seconds a move takes: ?speed=0.4 for faster, ?speed=1.5 for slower
let pat;
try { pat = decodePatternCode(code); } catch (e) { msg(code ? e.message : 'Add ?code= and a pattern code to the address.'); throw e; }
const start = []; pat.cells.forEach((c, i) => { if (c) start.push([i % pat.G, Math.floor(i / pat.G), 0]); });
const R = rng(codeSeed(patternCode(pat.G, pat.cells) + '-space'));
const moves = spaceMoves(start, CAP, R), unmade = spaceUnmake(start, R);
const nM = moves.length, nU = unmade.length;
const slots = spacePlan(start, moves), nS = slots.length; // one slot per move, and one to bring the last block home
const scale = Math.min(1, LOOP_MAX / (nS * MOVE_T + nU * UN_T)); // long patterns play faster so a loop stays under two minutes
const mt = MOVE_T * scale, ut = UN_T * scale, total = nS * mt + nU * ut + 1.5;
document.getElementById('count').textContent = `${nM} way${nM === 1 ? '' : 's'} I can make you up in space${nU ? ` and ${nU} to unmake you` : ''}`;
const view = document.getElementById('view'), W = () => innerWidth, H = () => innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setClearColor(PAPER); view.appendChild(renderer.domElement);
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
scene.add(new THREE.AmbientLight(0xffffff, 1.1)); const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-3, 6, 8); scene.add(sun);
const xs = start.map(b => b[0]), ys = start.map(b => b[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 5;
const P = (x, y, z) => new THREE.Vector3(x - cx, -(y - cy), z); // the page's down is the world's down; z comes toward the viewer
const rig = new THREE.Group(), root = new THREE.Group(); rig.add(root); scene.add(rig); // the rig holds the shape and its shadow so both move together in AR
const geo = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 });
const cube = () => new THREE.Mesh(geo, mat);
// a soft shadow on the ground below the object (a dark blur, flat, scaled to the shape)
const gc = document.createElement('canvas'); gc.width = gc.height = 128; const g2 = gc.getContext('2d'), gr = g2.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(35,31,32,.30)'); gr.addColorStop(1, 'rgba(35,31,32,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(span * 0.9, span * 0.9, 1); shadow.position.y = -(Math.max(...ys) - cy) - 1.6; rig.add(shadow);
const blocks = start.map(b => { const m = cube(); root.add(m); return m; });
let drag = null, t0 = 0, clock = 0;
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
function pose(time) {
  blocks.forEach((m, i) => { m.visible = true; m.scale.setScalar(1); m.position.copy(P(...start[i])); });
  const tt = time % total;
  if (tt < nS * mt) {
    const i = Math.floor(tt / mt), u = (tt - i * mt) / mt, sl = slots[i], s = ease(u / 0.8), a = Math.sin(Math.PI * Math.min(1, u / 0.8)) * 1.7, at = (p, q, h) => P(lerp(p[0], q[0], s), lerp(p[1], q[1], s), lerp(p[2], q[2], s) + h);
    sl.curs.forEach(c => blocks[c.bi].position.copy(at(c.src, c.to, a)));
    sl.rets.forEach(r => blocks[r.bi].position.copy(at(r.from, start[r.bi], a * 0.6)));
  } else {
    const k = tt - nS * mt, i = Math.min(nU - 1, Math.floor(k / ut)), u = (k - i * ut) / ut; if (k >= nU * ut) { blocks.forEach(m => m.visible = false); start.forEach((b, j) => { }); return; }
    const gone = new Set(i > 0 ? unmade[i - 1] : []), now = new Set(unmade[i]);
    start.forEach((b, j) => { const k3 = key3(b); if (gone.has(k3)) { blocks[j].visible = false; } else if (now.has(k3)) { const l = ease(u / 0.85); blocks[j].position.copy(P(b[0], b[1], b[2] + l * 3)); blocks[j].scale.setScalar(Math.max(0.01, 1 - l)); } });
  }
}
const key3 = b => b.join(',');
function resize() { renderer.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); cam.position.set(0, 0, span * (W() < H() ? 2.0 : 1.6)); cam.lookAt(0, 0, 0); }
addEventListener('resize', resize); resize();
// Turning: one finger or the mouse turns the shape about any axis (a trackball: sideways turns it about the vertical, up and down about the horizontal, with no stops, so it goes all the way round);
// two fingers twisting, or shift-drag, roll it about the line of sight. It keeps the turn you give it; until you touch it, it only sways.
const uq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, 0)), pts = new Map(), AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
let touched = false;
const turn = (axis, ang) => { uq.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, ang)); touched = true; };
const twist = () => { const [a, b] = [...pts.values()]; return Math.atan2(b.y - a.y, b.x - a.x); };
view.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); view.setPointerCapture(e.pointerId); drag = pts.size === 2 ? twist() : true; });
view.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y;
  if (pts.size === 2) { const before = twist(); p.x = e.clientX; p.y = e.clientY; let d = twist() - before; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; turn(AZ, d); }
  else { p.x = e.clientX; p.y = e.clientY; if (e.shiftKey) turn(AZ, dx * 0.01); else { turn(AY, dx * 0.01); turn(AX, dy * 0.01); } } });
const lift = e => { pts.delete(e.pointerId); drag = pts.size ? true : null; }; view.addEventListener('pointerup', lift); view.addEventListener('pointercancel', lift);
const swayQ = new THREE.Quaternion();
function frame(now) { if (renderer.xr.isPresenting) { requestAnimationFrame(frame); return; } const dt = Math.min(0.1, (now - t0) / 1000); t0 = now; clock += dt; pose(clock);
  swayQ.setFromAxisAngle(AY, touched || drag ? 0 : Math.sin(clock * 0.35) * 0.35); root.quaternion.copy(swayQ).multiply(uq); renderer.render(scene, cam); requestAnimationFrame(frame); }
requestAnimationFrame(n => { t0 = n; frame(n); });
window.__space = { nM, nU, scale, total, set: t => { clock = t; } };

// ---- View in AR: iPhone through AR Quick Look (a USDZ file made here), Android through WebXR (the shape is placed on a tap) ----
const arBtn = document.getElementById('ar');
async function setupAR() {
  const a = document.createElement('a'); arBtn.hidden = false; // always shown, so a phone that cannot do AR says why
  arBtn.onclick = () => msg('This browser cannot open AR. iPhone: use Safari. Android: use Chrome, with Google Play Services for AR installed. (' + (navigator.xr ? 'WebXR present, AR not supported' : 'no WebXR') + ')');
  if (a.relList && a.relList.supports && a.relList.supports('ar')) {
    arBtn.hidden = false; arBtn.onclick = () => {
      const blob = new Blob([makeUSDZ({ start, moves, unmade, mt, ut })], { type: 'model/vnd.usdz+zip' }), link = document.createElement('a');
      link.rel = 'ar'; link.href = URL.createObjectURL(blob) + '#allowsContentScaling=0'; link.download = 'form.usdz'; link.appendChild(document.createElement('img')); link.style.display = 'none'; document.body.appendChild(link); link.click(); setTimeout(() => link.remove(), 1000);
    };
  } else if (navigator.xr && await navigator.xr.isSessionSupported('immersive-ar').catch(() => false)) { arBtn.hidden = false; arBtn.onclick = startXR; }
}
async function startXR() {
  const CELLM = 0.05, L = shadow.position.y;
  const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: document.body } }).catch(e => { msg('AR could not start: ' + e.message); return null; });
  if (!session) return;
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(session); renderer.setClearColor(PAPER, 0);
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: INK })); reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);
  const viewer = await session.requestReferenceSpace('viewer'), source = await session.requestHitTestSource({ space: viewer }); let placed = false;
  rig.scale.setScalar(CELLM); rig.visible = false; root.quaternion.identity(); document.getElementById('msg').textContent = 'Move the phone, then tap to place it.';
  session.addEventListener('select', () => { if (!reticle.visible) return; const p = new THREE.Vector3().setFromMatrixPosition(reticle.matrix), c = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    rig.position.set(p.x, p.y - L * CELLM, p.z); rig.rotation.y = Math.atan2(c.x - p.x, c.z - p.z); rig.visible = true; placed = true; reticle.visible = false; document.getElementById('msg').textContent = ''; });
  session.addEventListener('end', () => { source.cancel(); renderer.xr.enabled = false; renderer.setAnimationLoop(null); scene.remove(reticle); rig.scale.setScalar(1); rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.visible = true; renderer.setClearColor(PAPER, 1); resize(); document.getElementById('msg').textContent = ''; });
  let last = performance.now();
  renderer.setAnimationLoop((t, frame) => { const n = performance.now(); clock += Math.min(0.1, (n - last) / 1000); last = n; pose(clock);
    if (frame && !placed) { const hits = frame.getHitTestResults(source); if (hits.length) { reticle.visible = true; reticle.matrix.fromArray(hits[0].getPose(renderer.xr.getReferenceSpace()).transform.matrix); } else reticle.visible = false; }
    renderer.render(scene, cam); });
}
setupAR();
