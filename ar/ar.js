// Hidden AR test: the printed symbol is the tracking target, and the blocks are drawn on it as boxes. Not linked from anywhere.
import * as THREE from 'three';
import { MindARThree } from './vendor/mindar-image-three.prod.js';
const q = new URLSearchParams(location.search), target = q.get('target') || 'T-density-A5';
const status = t => { document.getElementById('status').textContent = t; };
const ASPECT = 210 / 148, S = 0.7 / 3; // the A5 target is 1 wide; the T is 3 cells across and 70 percent of the width, so a cell is 0.7/3
const T = [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2], [1, 3]]; // cells of the T, column and row from the top left
async function run() {
  document.getElementById('start').remove();
  const mind = new MindARThree({ container: document.getElementById('view'), imageTargetSrc: `targets/${target}.mind`, uiLoading: 'no', uiScanning: 'no', uiError: 'no' });
  const { renderer, scene, camera } = mind, anchor = mind.addAnchor(0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.9)); const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(0.5, 1, 1); scene.add(sun);
  const mat = new THREE.MeshStandardMaterial({ color: 0x231F20 });
  T.forEach(([c, r]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(S, S, S), mat); m.position.set((c + 0.5 - 1.5) * S, -(r + 0.5 - 2) * S, S / 2); anchor.group.add(m); });
  anchor.onTargetFound = () => status('found'); anchor.onTargetLost = () => status('lost');
  status('starting camera');
  await mind.start(); status('looking');
  window.__ar = { found: () => document.getElementById('status').textContent };
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
}
document.getElementById('go').onclick = () => run().catch(e => { status('error: ' + (e && e.message || e)); console.error(e); });
if (q.has('auto')) run().catch(e => { status('error: ' + (e && e.message || e)); console.error(e); });
