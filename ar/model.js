// Hidden test page: a pattern floating in space, its blocks moving to the sides and to the front and back. Open with ?code= and the pattern code. Not linked from anywhere.
import * as THREE from 'three';
const q = new URLSearchParams(location.search), code = (q.get('code') || '').trim();
const msg = t => { document.getElementById('msg').textContent = t; };
const INK = 0x231F20, PAPER = 0xDEDDD2, CAP = 150, MOVE_T = 1.2, UN_T = 1.0, LOOP_MAX = 120; // seconds
let pat;
try { pat = decodePatternCode(code); } catch (e) { msg(code ? e.message : 'Add ?code= and a pattern code to the address.'); throw e; }
const start = []; pat.cells.forEach((c, i) => { if (c) start.push([i % pat.G, Math.floor(i / pat.G), 0]); });
const R = rng(codeSeed(patternCode(pat.G, pat.cells) + '-space'));
const moves = spaceMoves(start, CAP, R), unmade = spaceUnmake(start, R);
const nM = moves.length, nU = unmade.length;
const scale = Math.min(1, LOOP_MAX / (nM * MOVE_T + nU * UN_T)); // long patterns play faster so a loop stays under two minutes
const mt = MOVE_T * scale, ut = UN_T * scale, total = nM * mt + nU * ut + 1.5;
document.getElementById('count').textContent = `${nM} way${nM === 1 ? '' : 's'} I can make you up in space${nU ? ` and ${nU} to unmake you` : ''}`;
const view = document.getElementById('view'), W = () => innerWidth, H = () => innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setClearColor(PAPER); view.appendChild(renderer.domElement);
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
scene.add(new THREE.AmbientLight(0xffffff, 1.1)); const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-3, 6, 8); scene.add(sun);
const xs = start.map(b => b[0]), ys = start.map(b => b[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 5;
const P = (x, y, z) => new THREE.Vector3(x - cx, -(y - cy), z); // the page's down is the world's down; z comes toward the viewer
const root = new THREE.Group(); scene.add(root);
const geo = new THREE.BoxGeometry(0.94, 0.94, 0.94), mat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 }), edge = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.94, 0.94, 0.94)), lineMat = new THREE.LineBasicMaterial({ color: 0x8d8b84 });
const edgeInk = new THREE.LineBasicMaterial({ color: 0x77736c }), cube = () => { const m = new THREE.Mesh(geo, mat); m.add(new THREE.LineSegments(edge, edgeInk)); return m; }, marker = () => new THREE.LineSegments(edge, lineMat);
// a soft shadow on the ground below the object (a dark blur, flat, scaled to the shape)
const gc = document.createElement('canvas'); gc.width = gc.height = 128; const g2 = gc.getContext('2d'), gr = g2.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(35,31,32,.30)'); gr.addColorStop(1, 'rgba(35,31,32,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(span * 0.9, span * 0.9, 1); shadow.position.y = -(Math.max(...ys) - cy) - 1.6; scene.add(shadow);
const blocks = start.map(b => { const m = cube(); root.add(m); return m; }), marks = start.map(() => { const m = marker(); m.visible = false; root.add(m); return m; });
let az = 0, el = 0.08, drag = null, userRot = 0, t0 = 0, clock = 0;
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
function pose(time) {
  blocks.forEach((m, i) => { m.visible = true; m.scale.setScalar(1); m.position.copy(P(...start[i])); marks[i].visible = false; });
  const tt = time % total;
  if (tt < nM * mt) {
    const i = Math.floor(tt / mt), u = (tt - i * mt) / mt, mv = moves[i], bi = start.findIndex(b => key3(b) === key3(mv.from)), s = ease(u / 0.8), a = Math.sin(Math.PI * Math.min(1, u / 0.8)) * 1.7;
    const p = P(lerp(mv.from[0], mv.to[0], s), lerp(mv.from[1], mv.to[1], s), lerp(mv.from[2], mv.to[2], s) + a); blocks[bi].position.copy(p); marks[bi].position.copy(P(...mv.from)); marks[bi].visible = true;
  } else {
    const k = tt - nM * mt, i = Math.min(nU - 1, Math.floor(k / ut)), u = (k - i * ut) / ut; if (k >= nU * ut) { blocks.forEach(m => m.visible = false); start.forEach((b, j) => { marks[j].position.copy(P(...b)); marks[j].visible = true; }); return; }
    const gone = new Set(i > 0 ? unmade[i - 1] : []), now = new Set(unmade[i]);
    start.forEach((b, j) => { const k3 = key3(b); if (gone.has(k3)) { blocks[j].visible = false; marks[j].position.copy(P(...b)); marks[j].visible = true; } else if (now.has(k3)) { const l = ease(u / 0.85); blocks[j].position.copy(P(b[0], b[1], b[2] + l * 3)); blocks[j].scale.setScalar(Math.max(0.01, 1 - l)); marks[j].position.copy(P(...b)); marks[j].visible = true; } });
  }
}
const key3 = b => b.join(',');
function resize() { renderer.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); cam.position.set(0, 0, span * (W() < H() ? 2.0 : 1.6)); cam.lookAt(0, 0, 0); }
addEventListener('resize', resize); resize();
view.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, az, el]; view.setPointerCapture(e.pointerId); });
view.addEventListener('pointermove', e => { if (!drag) return; az = drag[2] + (e.clientX - drag[0]) * 0.008; el = Math.max(-0.9, Math.min(0.9, drag[3] + (e.clientY - drag[1]) * 0.006)); });
view.addEventListener('pointerup', () => { drag = null; });
function frame(now) { const dt = Math.min(0.1, (now - t0) / 1000); t0 = now; clock += dt; pose(clock);
  const sway = drag ? 0 : Math.sin(clock * 0.35) * 0.35; root.rotation.set(el, az + sway, 0); renderer.render(scene, cam); requestAnimationFrame(frame); }
requestAnimationFrame(n => { t0 = n; frame(n); });
window.__space = { nM, nU, scale, total, set: t => { clock = t; } };
