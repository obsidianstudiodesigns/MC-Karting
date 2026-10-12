/* MC Karting – hero scene.
   The real track lives in Highveld Mall's undercover parking: fluorescent strips,
   banded pillars, black and white tyre walls. Everything here is built procedurally
   with PBR materials, then finished with AO, bloom, depth of field and grain. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const canvas = document.querySelector('[data-hero-canvas]');
const hero = document.querySelector('.hero');
const stage = document.querySelector('[data-stage]');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const small = () => innerWidth < 760;
const LOW = coarse || small();

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ready = () => { hero.classList.add('is-ready'); window.dispatchEvent(new CustomEvent('mc:sceneready')); };
const fail = (err) => { if (err) console.warn('[MC Karting] 3D disabled:', err); hero.classList.add('no-webgl'); ready(); };

/* ---------- small helpers ---------- */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function blot(g, S, x, y, r, rgb, a) {
  // seamless radial blotch: draw on every wrapped copy that could touch the tile
  for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
    const cx = x + ox * S, cy = y + oy * S;
    if (cx + r < 0 || cx - r > S || cy + r < 0 || cy - r > S) continue;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}
function grain(g, S, amt, R) {
  const d = g.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const n = (R() - 0.5) * amt; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
  g.putImageData(d, 0, 0);
}
function normalFromHeight(src, strength) {
  const S = src.width, g = src.getContext('2d');
  const h = g.getImageData(0, 0, S, S).data;
  const [c, o] = mkCanvas(S, S); const out = o.createImageData(S, S), q = out.data;
  const at = (x, y) => h[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    q[i] = (-dx / l * 0.5 + 0.5) * 255; q[i + 1] = (dy / l * 0.5 + 0.5) * 255; q[i + 2] = (1 / l * 0.5 + 0.5) * 255; q[i + 3] = 255;
  }
  o.putImageData(out, 0, 0); return c;
}
function tex(c, { srgb = true, repeat = 1, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = aniso;
  return t;
}

/* ---------- procedural surfaces ---------- */
function concreteSet(S, seed, base, aniso) {
  const R = rng(seed);
  const [a, ga] = mkCanvas(S, S), [h, gh] = mkCanvas(S, S), [r, gr] = mkCanvas(S, S);
  ga.fillStyle = base; ga.fillRect(0, 0, S, S);
  gh.fillStyle = '#808080'; gh.fillRect(0, 0, S, S);
  gr.fillStyle = 'rgb(186,186,186)'; gr.fillRect(0, 0, S, S);
  for (let i = 0; i < 170; i++) {
    const x = R() * S, y = R() * S, rad = S * (0.05 + R() * 0.22);
    blot(ga, S, x, y, rad, R() < 0.55 ? '0,0,0' : '255,255,255', 0.02 + R() * 0.06);
  }
  for (let i = 0; i < 40; i++) { // traffic polish: darker albedo, smoother
    const x = R() * S, y = R() * S, rad = S * (0.06 + R() * 0.2);
    blot(ga, S, x, y, rad, '20,18,16', 0.05 + R() * 0.07);
    blot(gr, S, x, y, rad, '70,70,70', 0.25 + R() * 0.3);
  }
  const n = Math.round(S * S / 300);
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, s = 0.5 + R() * 2.2, l = R();
    ga.fillStyle = l < 0.5 ? `rgba(40,40,40,${0.15 + R() * 0.25})` : `rgba(230,228,222,${0.12 + R() * 0.2})`;
    ga.beginPath(); ga.ellipse(x, y, s, s * (0.6 + R() * 0.5), R() * 3, 0, 7); ga.fill();
    gh.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.4})`; gh.beginPath(); gh.arc(x, y, s, 0, 7); gh.fill();
  }
  // hairline cracks
  ga.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    let x = R() * S, y = R() * S, ang = R() * 6.28;
    ga.strokeStyle = 'rgba(25,25,25,0.35)'; gh.strokeStyle = 'rgba(0,0,0,0.8)'; ga.lineWidth = gh.lineWidth = 0.8 + R();
    ga.beginPath(); gh.beginPath(); ga.moveTo(x, y); gh.moveTo(x, y);
    for (let k = 0; k < 40; k++) { ang += (R() - 0.5) * 0.7; x += Math.cos(ang) * S * 0.008; y += Math.sin(ang) * S * 0.008; ga.lineTo(x, y); gh.lineTo(x, y); }
    ga.stroke(); gh.stroke();
  }
  grain(ga, S, 20, R); grain(gh, S, 50, R); grain(gr, S, 22, R);
  return { map: tex(a, { aniso }), normalMap: tex(normalFromHeight(h, 2.2), { srgb: false, aniso }), roughnessMap: tex(r, { srgb: false, aniso }) };
}

function pillarTexture() {
  const [c, g] = mkCanvas(64, 512); const R = rng(7);
  // canvas top = top of pillar. bands from the photos: black foot, orange band, off-white shaft
  g.fillStyle = '#d9d6cf'; g.fillRect(0, 0, 64, 512);
  g.fillStyle = '#c96f22'; g.fillRect(0, 512 - 175, 64, 135);
  g.fillStyle = '#121212'; g.fillRect(0, 512 - 40, 64, 40);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.07})`; g.fillRect(R() * 64, R() * 512, 1 + R() * 3, 1 + R() * 6); }
  const gr = g.createLinearGradient(0, 512, 0, 380); gr.addColorStop(0, 'rgba(30,25,20,.35)'); gr.addColorStop(1, 'rgba(30,25,20,0)');
  g.fillStyle = gr; g.fillRect(0, 380, 64, 132);
  return tex(c);
}

function stackTyreTexture() {
  // lathe UVs: u runs round the tyre, v runs along the profile (sidewall, shoulder, tread, shoulder, sidewall)
  const W = 512, H = 1024, R = rng(17); const [c, g] = mkCanvas(W, H);
  const y = v => (1 - v) * H, N = 30;
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  // shoulders pick up grime from the floor and other karts
  [[8 / N, 15 / N], [16 / N, 23 / N]].forEach(([a, b]) => { g.fillStyle = 'rgba(70,64,58,0.28)'; g.fillRect(0, y(b), W, y(a) - y(b)); });
  // tread blocks
  const t0 = y(16 / N), t1 = y(15 / N);
  g.fillStyle = 'rgba(40,38,36,0.75)'; g.fillRect(0, t0, W, t1 - t0);
  g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 3;
  for (let u = 0; u < W; u += 16) { g.beginPath(); g.moveTo(u, t0); g.lineTo(u + 8, (t0 + t1) / 2); g.lineTo(u, t1); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.9)'; g.fillRect(0, (t0 + t1) / 2 - 2, W, 4);
  // sidewalls: rings and lettering
  [[1 / N, 7 / N], [24 / N, 29 / N]].forEach(([a, b]) => {
    const top = y(b), bot = y(a), mid = (top + bot) / 2;
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    [0.2, 0.8].forEach(k => { g.beginPath(); g.moveTo(0, top + (bot - top) * k); g.lineTo(W, top + (bot - top) * k); g.stroke(); });
    for (let u = 0; u < W; u += 40 + R() * 60) for (let k = 0; k < 3 + R() * 6; k++) { g.fillStyle = `rgba(0,0,0,${0.18 + R() * 0.2})`; g.fillRect(u + k * 7, mid - 6, 5, 12); }
  });
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(60,55,50,${R() * 0.12})`; g.fillRect(R() * W, R() * H, 1 + R() * 4, 1 + R() * 4); }
  return tex(c, { srgb: true });
}

function chevronTexture() {
  const [c, g] = mkCanvas(1024, 256);
  g.fillStyle = '#f0c010'; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#111';
  for (let x = -100; x < 1100; x += 170) {
    g.beginPath(); g.moveTo(x, 20); g.lineTo(x + 80, 20); g.lineTo(x + 150, 128); g.lineTo(x + 80, 236); g.lineTo(x, 236); g.lineTo(x + 70, 128); g.closePath(); g.fill();
  }
  const R = rng(3);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(60,50,30,${R() * 0.12})`; g.fillRect(R() * 1024, R() * 256, 2 + R() * 6, 1 + R() * 3); }
  g.strokeStyle = '#111'; g.lineWidth = 10; g.strokeRect(5, 5, 1014, 246);
  return tex(c);
}

function brickTexture() {
  const [c, g] = mkCanvas(512, 512); const R = rng(11);
  g.fillStyle = '#6d6a64'; g.fillRect(0, 0, 512, 512);
  const bw = 64, bh = 24;
  for (let row = 0; row < 512 / bh; row++) for (let col = -1; col < 512 / bw + 1; col++) {
    const x = col * bw + (row % 2 ? bw / 2 : 0), y = row * bh;
    const t = R(); g.fillStyle = `rgb(${110 + t * 40 | 0},${48 + t * 18 | 0},${36 + t * 12 | 0})`;
    g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
  }
  grain(g, 512, 26, R);
  return tex(c, { repeat: 1 });
}

function softSpot() {
  // greyscale mask for alphaMap (three reads the green channel)
  const [c, g] = mkCanvas(256, 256);
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, '#777'); gr.addColorStop(1, '#000');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = tex(c, { srgb: false }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

function plateTexture(text, sub) {
  const [c, g] = mkCanvas(512, 384);
  g.fillStyle = '#f2f1ec'; g.beginPath(); g.roundRect(8, 8, 496, 368, 48); g.fill();
  g.fillStyle = '#ff5a0f'; g.fillRect(8, 300, 496, 34);
  g.fillStyle = '#0c0c0c';
  g.font = 'italic 900 230px Saira, "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(256, 170); g.transform(1, 0, -0.18, 1, 0, 0); g.fillText(text, 0, 0); g.restore();
  if (sub) { g.font = '700 30px Saira, Arial, sans-serif'; g.fillStyle = '#0c0c0c'; g.fillText(sub, 256, 318); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

function podDecal() {
  const [c, g] = mkCanvas(1024, 256);
  g.clearRect(0, 0, 1024, 256);
  // the logo's slashes: black and white streaks running back
  const stripe = (x, w, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, 40); g.lineTo(x + w, 40); g.lineTo(x + w - 90, 216); g.lineTo(x - 90, 216); g.closePath(); g.fill(); };
  stripe(560, 70, '#0d0d0d'); stripe(660, 26, '#f4f4f1'); stripe(710, 120, '#0d0d0d'); stripe(860, 18, '#f4f4f1');
  g.font = 'italic 900 150px Saira, "Arial Black", Impact, sans-serif'; g.textBaseline = 'middle';
  g.fillStyle = '#f4f4f1'; g.fillText('MC', 210, 132);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

/* ---------- geometry builders ---------- */
function tube(points, r, mat, segs = 48, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => V(...p)), closed, 'catmullrom', 0.25);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 12, closed), mat);
  m.castShadow = true; m.receiveShadow = true; return m;
}
function tyreProfile(ro, ri, w) {
  // cross-section of a tyre, revolved around Y. rounded shoulders, slight bulge
  const pts = [], hw = w / 2, sh = Math.min(0.035, w * 0.24);
  pts.push(new THREE.Vector2(ri, -hw * 0.92));
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector2(ri + (ro - sh - ri) * t, -hw * (0.92 + 0.08 * Math.sin(t * Math.PI)))); }
  for (let i = 1; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(ro - sh + Math.cos(a) * sh, -hw + sh + Math.sin(a) * sh)); }
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(ro - sh + Math.cos(a) * sh, hw - sh + Math.sin(a) * sh)); }
  for (let i = 1; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector2(ro - sh - (ro - sh - ri) * t, hw * (0.92 + 0.08 * Math.sin((1 - t) * Math.PI)))); }
  pts.push(new THREE.Vector2(ri, hw * 0.92));
  return pts;
}
function extrudeShape(points, depth, bevel, closedSpline = true) {
  const s = new THREE.Shape();
  if (closedSpline) { s.moveTo(points[0][0], points[0][1]); s.splineThru(points.slice(1).concat([points[0]]).map(p => new THREE.Vector2(p[0], p[1]))); }
  else { s.moveTo(points[0][0], points[0][1]); points.slice(1).forEach(p => s.lineTo(p[0], p[1])); s.closePath(); }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 5, curveSegments: 40 });
}

/* ---------- the kart ---------- */
function buildKart(M) {
  const kart = new THREE.Group();
  const body = new THREE.Group(); kart.add(body);
  const add = (m, parent = body) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

  const halves = new THREE.Group(); body.add(halves);
  const half = new THREE.Group(); halves.add(half);

  // chassis rails and nerf bar, left side (mirrored below)
  half.add(tube([[-0.16, 0.08, 0.84], [-0.29, 0.075, 0.64], [-0.36, 0.07, 0.3], [-0.38, 0.07, -0.2], [-0.36, 0.075, -0.64]], 0.016, M.chromoly, 64));
  half.add(tube([[-0.36, 0.09, 0.42], [-0.6, 0.11, 0.34], [-0.67, 0.12, 0.06], [-0.65, 0.11, -0.24], [-0.38, 0.09, -0.3]], 0.014, M.chromoly, 48));
  // kingpin + stub mount
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 16), M.steel), half).position.set(-0.42, 0.14, 0.56);
  half.add(tube([[-0.29, 0.08, 0.62], [-0.42, 0.12, 0.57]], 0.013, M.chromoly, 8));
  // side pod
  const podGeo = extrudeShape([[0.38, 0.075], [0.41, 0.15], [0.3, 0.215], [-0.08, 0.235], [-0.28, 0.205], [-0.33, 0.11], [-0.27, 0.065], [0.2, 0.06]], 0.085, 0.03);
  podGeo.rotateY(-Math.PI / 2);
  const pod = add(new THREE.Mesh(podGeo, M.paint), half); pod.position.set(-0.53, 0, 0);
  const podDec = add(new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.165), M.podDecal), half);
  podDec.position.set(-0.6455, 0.148, 0.04); podDec.rotation.y = -Math.PI / 2; podDec.castShadow = false; podDec.name = 'podDecal';
  const podBase = add(new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.03, 0.62, 3, 0.012), M.black), half); podBase.position.set(-0.59, 0.075, 0.04);

  const mirror = half.clone(); mirror.scale.x = -1; halves.add(mirror);
  mirror.getObjectByName('podDecal').scale.x = -1; // keep the lettering readable on the mirrored side

  // cross members
  [[0.62, 0.075, 0.29], [0.3, 0.07, 0.36], [-0.2, 0.07, 0.38], [-0.62, 0.075, 0.36]].forEach(([z, y, w]) => body.add(tube([[-w, y, z], [w, y, z]], 0.015, M.chromoly, 4)));
  body.add(tube([[-0.42, 0.12, 0.56], [0, 0.11, 0.6], [0.42, 0.12, 0.56]], 0.014, M.chromoly, 16));
  // floor tray
  const tray = add(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.012, 0.9, 2, 0.005), M.alu)); tray.position.set(0, 0.066, 0.16);

  // front bumper loops
  body.add(tube([[-0.42, 0.1, 0.66], [-0.38, 0.1, 0.9], [0, 0.11, 1.0], [0.38, 0.1, 0.9], [0.42, 0.1, 0.66]], 0.014, M.chromoly, 48));

  // nose cone
  const noseGeo = extrudeShape([[-0.4, -0.64], [-0.45, -0.74], [-0.36, -0.96], [-0.14, -1.04], [0.14, -1.04], [0.36, -0.96], [0.45, -0.74], [0.4, -0.64], [0.18, -0.6], [-0.18, -0.6]], 0.035, 0.03);
  noseGeo.rotateX(-Math.PI / 2);
  const noseG = new THREE.Group(); noseG.position.set(0, 0.105, 0); noseG.rotation.x = -0.05; body.add(noseG);
  add(new THREE.Mesh(noseGeo, M.paint), noseG);
  const noseStripe = add(new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.38), M.white), noseG);
  noseStripe.rotation.x = -Math.PI / 2; noseStripe.position.set(-0.2, 0.0655, 0.83); noseStripe.rotation.z = 0.25; noseStripe.castShadow = false;
  const noseStripe2 = noseStripe.clone(); noseStripe2.position.x = 0.2; noseStripe2.rotation.z = -0.25; noseG.add(noseStripe2);
  const noseBlack = add(new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.34), M.black), noseG);
  noseBlack.rotation.x = -Math.PI / 2; noseBlack.position.set(-0.27, 0.0656, 0.84); noseBlack.rotation.z = 0.25; noseBlack.castShadow = false;
  const noseBlack2 = noseBlack.clone(); noseBlack2.position.x = 0.27; noseBlack2.rotation.z = -0.25; noseG.add(noseBlack2);

  // front panel with the MC plate
  const panelGeo = extrudeShape([[-0.19, 0], [0.19, 0], [0.14, 0.28], [-0.14, 0.28]], 0.02, 0.014, false);
  const panelG = new THREE.Group(); panelG.position.set(0, 0.14, 0.52); panelG.rotation.x = -0.38; body.add(panelG);
  add(new THREE.Mesh(panelGeo, M.paint), panelG);
  const plate = add(new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.19), M.plate), panelG);
  plate.position.set(0, 0.145, 0.0355); plate.castShadow = false;
  panelG.add(tube([[-0.06, -0.03, -0.02], [-0.07, -0.08, -0.05]], 0.01, M.chromoly, 4));

  // fuel tank, pedals
  const tank = add(new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.11, 0.16, 4, 0.035), M.tank)); tank.position.set(0, 0.13, 0.38);
  const cap = add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 20), M.red)); cap.position.set(0.05, 0.195, 0.38);
  [-0.09, 0.09].forEach((x, i) => {
    const p = add(new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.09, 0.012, 2, 0.004), M.alu)); p.position.set(x, 0.13, 0.7); p.rotation.x = -0.5;
    if (i) p.material = M.alu;
  });

  // steering column + wheel
  const colA = V(0, 0.13, 0.52), colB = V(0, 0.37, 0.22);
  body.add(tube([[0, 0.13, 0.52], [0, 0.37, 0.22]], 0.012, M.steel, 4));
  const dir = colB.clone().sub(colA).normalize();
  const wheelOrient = new THREE.Group(); wheelOrient.position.copy(colB); wheelOrient.quaternion.setFromUnitVectors(V(0, 0, 1), dir.clone().negate()); body.add(wheelOrient);
  const wheelSpin = new THREE.Group(); wheelOrient.add(wheelSpin);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.017, 18, 72), M.grip), wheelSpin);
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 3);
    const spoke = add(new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.024, 0.008, 2, 0.003), M.alu), wheelSpin);
    spoke.position.set(Math.cos(a) * 0.07, Math.sin(a) * 0.07, -0.006); spoke.rotation.z = a;
  }
  const hub = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.024, 32), M.paint), wheelSpin); hub.rotation.x = Math.PI / 2;

  // seat
  const seatPts = [[0, 0], [0.1, 0.004], [0.165, 0.035], [0.19, 0.11], [0.2, 0.24], [0.205, 0.37], [0.2, 0.4]].map(p => new THREE.Vector2(p[0], p[1]));
  const seatGeo = new THREE.LatheGeometry(seatPts, 64, 0.1 * Math.PI, 1.8 * Math.PI);
  { // scoop it: tall backrest, sides falling away towards the front
    const p = seatGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z) || 1;
      const f = Math.pow(Math.max(0, z / r), 1.2);
      if (y > 0.08) p.setY(i, 0.08 + (y - 0.08) * (1 - 0.72 * f));
    }
    seatGeo.computeVertexNormals();
  }
  const seat = add(new THREE.Mesh(seatGeo, M.seat)); seat.scale.set(1, 1, 0.82); seat.position.set(0, 0.075, -0.13); seat.rotation.x = -0.42;
  body.add(tube([[0.17, 0.08, -0.32], [0.16, 0.3, -0.36]], 0.01, M.chromoly, 4));
  body.add(tube([[-0.17, 0.08, -0.32], [-0.16, 0.3, -0.36]], 0.01, M.chromoly, 4));

  // engine on the right, behind the seat
  const eng = new THREE.Group(); eng.position.set(0.33, 0, -0.4); body.add(eng);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.012, 0.26, 2, 0.004), M.alu), eng).position.set(0, 0.09, 0);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.16, 0.2, 4, 0.03), M.engine), eng).position.set(0, 0.18, 0);
  const finGeo = new RoundedBoxGeometry(0.15, 0.007, 0.15, 1, 0.003);
  const fins = new THREE.InstancedMesh(finGeo, M.engine, 9); fins.castShadow = true; fins.receiveShadow = true;
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.45));
  for (let i = 0; i < 9; i++) { mm.compose(V(0.05 + i * 0.011, 0.27 + i * 0.016, 0.0), q, V(1, 1, 1)); fins.setMatrixAt(i, mm); }
  eng.add(fins);
  const recoil = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 40), M.black), eng); recoil.rotation.z = Math.PI / 2; recoil.position.set(0.12, 0.2, 0.01);
  const recoilRing = add(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.006, 8, 48), M.alu), eng); recoilRing.rotation.y = Math.PI / 2; recoilRing.position.set(0.147, 0.2, 0.01);
  const pull = add(new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.025, 0.07, 2, 0.008), M.red), eng); pull.position.set(0.16, 0.2, 0.01);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.08, 0.12, 4, 0.025), M.black), eng).position.set(-0.03, 0.31, 0.09);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.02, 0.11, 3, 0.008), M.red), eng).position.set(-0.03, 0.355, 0.09);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.09, 0.08, 4, 0.03), M.muffler), eng).position.set(-0.02, 0.22, -0.17);
  eng.add(tube([[0.04, 0.24, -0.08], [0.02, 0.25, -0.12], [-0.02, 0.23, -0.14]], 0.014, M.heat, 12));
  eng.add(tube([[-0.1, 0.22, -0.17], [-0.15, 0.2, -0.2], [-0.16, 0.19, -0.26]], 0.012, M.heat, 12));
  const chainGuard = add(new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.12, 0.3, 3, 0.008), M.paint), body); chainGuard.position.set(0.18, 0.16, -0.48);

  // rear axle, brake disc
  const axle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 24), M.steel)); axle.rotation.z = Math.PI / 2; axle.position.set(0, 0.14, -0.5);
  [-0.3, 0.3].forEach(x => { add(new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.09, 0.07, 2, 0.01), M.alu)).position.set(x, 0.12, -0.5); });
  const disc = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.008, 48), M.disc)); disc.rotation.z = Math.PI / 2; disc.position.set(-0.14, 0.14, -0.5);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.06, 0.05, 2, 0.01), M.red)).position.set(-0.14, 0.215, -0.47);

  // moulded plastic rear bumper (outline in plan view, extruded upwards)
  {
    const s = new THREE.Shape(), P = (x, z) => new THREE.Vector2(x, -z);
    const outer = [[-0.86, -0.7], [-0.9, -0.86], [-0.72, -0.99], [0, -1.03], [0.72, -0.99], [0.9, -0.86], [0.86, -0.7]];
    const inner = [[0.77, -0.7], [0.79, -0.83], [0.64, -0.915], [0, -0.95], [-0.64, -0.915], [-0.79, -0.83], [-0.77, -0.7]];
    s.moveTo(outer[0][0], -outer[0][1]); s.splineThru(outer.slice(1).map(p => P(p[0], p[1])));
    s.lineTo(inner[0][0], -inner[0][1]); s.splineThru(inner.slice(1).map(p => P(p[0], p[1]))); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.018, bevelSegments: 4, curveSegments: 48 });
    g.rotateX(-Math.PI / 2);
    const bump = add(new THREE.Mesh(g, M.bumper)); bump.position.y = 0.11;
  }
  body.add(tube([[-0.36, 0.1, -0.64], [-0.62, 0.13, -0.74]], 0.014, M.chromoly, 4));
  body.add(tube([[0.36, 0.1, -0.64], [0.62, 0.13, -0.74]], 0.014, M.chromoly, 4));
  body.add(tube([[-0.5, 0.13, -0.72], [-0.52, 0.11, -0.98]], 0.012, M.chromoly, 4));
  body.add(tube([[0.5, 0.13, -0.72], [0.52, 0.11, -0.98]], 0.012, M.chromoly, 4));

  // wheels
  function wheel(ro, ri, w) {
    const g = new THREE.Group();
    const tyreGeo = new THREE.LatheGeometry(tyreProfile(ro, ri, w), 72); tyreGeo.rotateZ(Math.PI / 2);
    add(new THREE.Mesh(tyreGeo, M.tyre), g);
    const rim = add(new THREE.Mesh(new THREE.CylinderGeometry(ri * 1.01, ri * 1.01, w * 0.84, 48, 1, true), M.rim), g); rim.rotation.z = Math.PI / 2;
    const face = new THREE.Shape(); face.absarc(0, 0, ri * 1.01, 0, Math.PI * 2);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, h = new THREE.Path(); h.absarc(Math.cos(a) * ri * 0.58, Math.sin(a) * ri * 0.58, ri * 0.22, 0, Math.PI * 2, true); face.holes.push(h); }
    const fg = new THREE.ExtrudeGeometry(face, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 32 }); fg.rotateY(Math.PI / 2);
    const fm = add(new THREE.Mesh(fg, M.rim), g); fm.position.x = w * 0.3;
    const hubc = add(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.05, 24), M.steel), g); hubc.rotation.z = Math.PI / 2; hubc.position.x = w * 0.3;
    return g;
  }
  const rears = [];
  [-1, 1].forEach(s => { const r = wheel(0.14, 0.066, 0.19); r.position.set(s * 0.64, 0.14, -0.5); if (s < 0) r.rotation.y = Math.PI; body.add(r); rears.push(r); });
  const fronts = [];
  [-1, 1].forEach(s => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.42, 0.135, 0.56); body.add(pivot);
    pivot.add(tube([[0, 0, 0], [s * 0.1, 0, 0]], 0.012, M.steel, 2));
    const f = wheel(0.132, 0.062, 0.13); f.position.set(s * 0.15, 0, 0); if (s < 0) f.rotation.y = Math.PI; pivot.add(f);
    fronts.push(pivot);
  });
  return { kart, body, fronts, rears, wheelSpin, engine: eng };
}

/* ---------- main ---------- */
async function main() {
  if (!canvas) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false });
  } catch (e) { return fail(e); }
  if (!renderer.getContext()) return fail('no context');

  const PP = await import('postprocessing').catch(() => null);
  const N8 = PP && !LOW ? await import('n8ao').catch(() => null) : null;
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* fonts optional */ }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = PP ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060708);
  scene.fog = new THREE.FogExp2(0x060708, 0.045);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 120);

  /* environment: a garage of strip lights, baked to a PMREM cube for reflections */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(60, 7, 60), new THREE.MeshBasicMaterial({ color: 0x17191c, side: THREE.BackSide })));
  const envFloor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x2a2b2c })); envFloor.rotation.x = -Math.PI / 2; envFloor.position.y = -3.4; env.add(envFloor);
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(9) });
  for (let x = -14; x <= 14; x += 3.6) for (let z = -24; z <= 24; z += 3.2) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.12), stripMat); s.position.set(x, 3.3, z); env.add(s); }
  const dayMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.92, 1).multiplyScalar(2.2) });
  for (let z = -24; z <= 24; z += 7.5) { const o = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.6), dayMat); o.position.set(29.8, 0.6, z); o.rotation.y = -Math.PI / 2; env.add(o); }
  const envTex = pmrem.fromScene(env, 0.035).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.06;

  /* materials */
  const conc = concreteSet(LOW ? 512 : 1024, 21, '#6b6d6e', aniso);
  ['map', 'normalMap', 'roughnessMap'].forEach(k => conc[k].repeat.set(30, 30));
  const ceilSet = concreteSet(256, 5, '#4a4c4e', aniso);
  ['map', 'normalMap', 'roughnessMap'].forEach(k => ceilSet[k].repeat.set(14, 14));
  const M = {
    floor: new THREE.MeshStandardMaterial({ ...conc, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.55, 0.55) }),
    ceiling: new THREE.MeshStandardMaterial({ ...ceilSet, roughness: 1 }),
    beam: new THREE.MeshStandardMaterial({ color: 0x8a8b8c, roughness: 0.9 }),
    pillar: new THREE.MeshStandardMaterial({ map: pillarTexture(), roughness: 0.82 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x55575a, roughness: 0.95 }),
    brick: new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.9 }),
    stackTyre: (() => { const t = stackTyreTexture(); return new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, bumpMap: t, bumpScale: 1.5, roughness: 0.86, metalness: 0 }); })(),
    chevron: new THREE.MeshStandardMaterial({ map: chevronTexture(), roughness: 0.55 }),
    fixture: new THREE.MeshStandardMaterial({ color: 0xd8d8d4, roughness: 0.5, metalness: 0.2 }),
    tubeLit: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.99, 0.96).multiplyScalar(7), toneMapped: true }),
    opening: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.88, 1).multiplyScalar(1.5), fog: true }),

    paint: new THREE.MeshPhysicalMaterial({ color: 0xf04a0a, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }),
    black: new THREE.MeshPhysicalMaterial({ color: 0x0b0c0d, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
    white: new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06, polygonOffset: true, polygonOffsetFactor: -2 }),
    seat: new THREE.MeshPhysicalMaterial({ color: 0x0c0d0f, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
    bumper: new THREE.MeshPhysicalMaterial({ color: 0x101113, roughness: 0.55, clearcoat: 0.3 }),
    chromoly: new THREE.MeshStandardMaterial({ color: 0xbfc3c8, metalness: 1, roughness: 0.27 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xe6e8ea, metalness: 1, roughness: 0.14 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xb4b8bd, metalness: 1, roughness: 0.38 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 1, roughness: 0.3 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x9a9da1, metalness: 1, roughness: 0.22 }),
    engine: new THREE.MeshStandardMaterial({ color: 0x2b2e32, metalness: 0.7, roughness: 0.45 }),
    muffler: new THREE.MeshStandardMaterial({ color: 0xa8acb0, metalness: 1, roughness: 0.32 }),
    heat: new THREE.MeshStandardMaterial({ color: 0x8c6a48, metalness: 1, roughness: 0.3 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0xc8140c, roughness: 0.35, clearcoat: 0.8 }),
    tank: new THREE.MeshPhysicalMaterial({ color: 0xe8e4d8, roughness: 0.42, clearcoat: 0.3, transmission: 0, thickness: 0.02 }),
    grip: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.85 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.74 }),
    plate: new THREE.MeshPhysicalMaterial({ map: plateTexture('MC', 'KARTING'), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, polygonOffset: true, polygonOffsetFactor: -2 }),
    podDecal: new THREE.MeshPhysicalMaterial({ map: podDecal(), transparent: true, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  };

  /* garage */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const CEIL = 3.25;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), M.ceiling); ceil.rotation.x = Math.PI / 2; ceil.position.y = CEIL; scene.add(ceil);
  for (let z = 7.5; z > -50; z -= 7.5) { const b = new THREE.Mesh(new THREE.BoxGeometry(40, 0.45, 0.5), M.beam); b.position.set(-4, CEIL - 0.225, z); b.receiveShadow = true; scene.add(b); }

  // pillars
  const pillarXs = [-4.9, 4.7, -11.4];
  const pillarGeo = new THREE.BoxGeometry(0.55, CEIL, 0.55);
  const pillars = new THREE.InstancedMesh(pillarGeo, M.pillar, pillarXs.length * 8);
  let pi = 0; const pm = new THREE.Matrix4();
  pillarXs.forEach(x => { for (let z = 7.5; z > -52; z -= 7.5) { if (pi >= pillars.count) break; pm.makeTranslation(x, CEIL / 2, z); pillars.setMatrixAt(pi++, pm); } });
  pillars.count = pi; pillars.castShadow = true; pillars.receiveShadow = true; scene.add(pillars);

  // far brick wall and the open side with daylight
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, CEIL), M.brick); back.position.set(-3, CEIL / 2, -52); M.brick.map.repeat.set(10, 1); scene.add(back);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(80, CEIL), M.wall); side.position.set(8.2, CEIL / 2, -14); side.rotation.y = -Math.PI / 2; scene.add(side);
  for (let z = 4; z > -48; z -= 7.5) { const o = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.5), M.opening); o.position.set(8.18, 1.95, z - 3.75); o.rotation.y = -Math.PI / 2; scene.add(o); }

  // strip light fixtures (instanced so each tube can flicker on by itself)
  const fixtureXs = [-9.2, -5.6, -1.9, 1.9, 5.6];
  const fixtures = [];
  fixtureXs.forEach(x => { for (let z = 9; z > -50; z -= 3.75) fixtures.push(V(x, CEIL - 0.04, z)); });
  const housing = new THREE.InstancedMesh(new RoundedBoxGeometry(1.3, 0.06, 0.16, 2, 0.015), M.fixture, fixtures.length);
  const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, 1.2, 10).rotateZ(Math.PI / 2), M.tubeLit, fixtures.length * 2);
  const fm4 = new THREE.Matrix4(), black = new THREE.Color(0, 0, 0);
  fixtures.forEach((p, i) => {
    fm4.makeTranslation(p.x, p.y, p.z); housing.setMatrixAt(i, fm4);
    fm4.makeTranslation(p.x, p.y - 0.045, p.z - 0.035); tubes.setMatrixAt(i * 2, fm4); tubes.setColorAt(i * 2, black);
    fm4.makeTranslation(p.x, p.y - 0.045, p.z + 0.035); tubes.setMatrixAt(i * 2 + 1, fm4); tubes.setColorAt(i * 2 + 1, black);
  });
  scene.add(housing, tubes);

  // tyre walls: stacks of three, alternating painted white and bare rubber
  const stackGeo = new THREE.LatheGeometry(tyreProfile(0.3, 0.17, 0.2), 20);
  const stackSpots = [];
  const line = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 0.62); for (let i = 0; i <= n; i++) { const t = i / n; stackSpots.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]); } };
  line(-2.5, 9, -2.5, -32); line(3.3, 0.4, 3.3, -40);
  line(-7.6, 6, -7.6, -40);
  for (let a = 0; a <= Math.PI; a += 0.62 / 5.45) stackSpots.push([-2.15 + Math.cos(a) * 5.45, -40 - Math.sin(a) * 2.2]);
  const R = rng(99);
  const stacks = new THREE.InstancedMesh(stackGeo, M.stackTyre, stackSpots.length * 3);
  const col = new THREE.Color(); let si = 0;
  stackSpots.forEach(([x, z], k) => {
    const white = (k % 2) === 0;
    for (let lvl = 0; lvl < 3; lvl++) {
      const jx = (R() - 0.5) * 0.04, jz = (R() - 0.5) * 0.04;
      fm4.compose(V(x + jx, 0.1 + lvl * 0.2, z + jz), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.04, R() * 6.28, (R() - 0.5) * 0.04)), V(1, 1, 1));
      stacks.setMatrixAt(si, fm4);
      if (white) col.setRGB(0.5 + R() * 0.08, 0.49 + R() * 0.08, 0.46 + R() * 0.06); else col.setRGB(0.018, 0.018, 0.018);
      stacks.setColorAt(si++, col);
    }
  });
  stacks.castShadow = true; stacks.receiveShadow = true; scene.add(stacks);

  // chevron boards on the tyre walls
  [[-2.5, -9, Math.PI / 2], [3.3, -17, -Math.PI / 2], [-2.5, -27, Math.PI / 2]].forEach(([x, z, ry]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.03), [M.beam, M.beam, M.beam, M.beam, M.chevron, M.beam]);
    b.position.set(x + (ry > 0 ? 0.32 : -0.32), 0.88, z); b.rotation.y = ry; b.castShadow = true; scene.add(b);
  });

  // track markings: start line, grid box, worn parking lines, rubbered-in racing line
  {
    const W = LOW ? 1024 : 2048, H = W * 2, X0 = -12, Z0 = -38, SX = 24, SZ = 48;
    const [c, g] = mkCanvas(W, H); const Rm = rng(42);
    const px = x => (x - X0) / SX * W, pz = z => (z - Z0) / SZ * H, m = W / SX;
    g.lineCap = 'round';
    // rubber
    for (let k = 0; k < 90; k++) {
      g.strokeStyle = `rgba(8,8,8,${0.03 + Rm() * 0.04})`; g.lineWidth = m * (0.08 + Rm() * 0.16);
      const off = (Rm() - 0.5) * 0.7;
      g.beginPath(); g.moveTo(px(0.8 + off), pz(9));
      g.bezierCurveTo(px(1.2 + off), pz(-8), px(-1.4 + off), pz(-22), px(1.6 + off * 1.4), pz(-36));
      g.stroke();
    }
    for (let k = 0; k < 14; k++) { // skid arcs
      g.strokeStyle = `rgba(5,5,5,${0.06 + Rm() * 0.08})`; g.lineWidth = m * (0.1 + Rm() * 0.06);
      const z = -30 - Rm() * 6, x = -1.5 + Rm() * 3;
      g.beginPath(); g.arc(px(x), pz(z), m * (2 + Rm() * 3), Rm() * 3, Rm() * 3 + 0.8); g.stroke();
    }
    // parking lines, worn
    g.strokeStyle = 'rgba(235,235,228,0.55)'; g.lineWidth = m * 0.1;
    for (let z = 8; z > -36; z -= 2.6) { g.beginPath(); g.moveTo(px(-7.4), pz(z)); g.lineTo(px(-2.9), pz(z)); g.stroke(); g.beginPath(); g.moveTo(px(3.7), pz(z)); g.lineTo(px(8), pz(z)); g.stroke(); }
    g.beginPath(); g.moveTo(px(-5.2), pz(9)); g.lineTo(px(-5.2), pz(-36)); g.stroke();
    // start line chequers across the track ahead of the kart
    const sq = 0.16;
    for (let x = -2.25; x < 3.0; x += sq) for (let r = 0; r < 2; r++) {
      if ((Math.round((x + 2.25) / sq) + r) % 2) continue;
      g.fillStyle = 'rgba(232,232,226,0.78)'; g.fillRect(px(x), pz(1.55 + r * sq), sq * m, sq * m);
    }
    // grid box bracket around the kart
    g.strokeStyle = 'rgba(244,244,238,0.85)'; g.lineWidth = m * 0.08; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(px(-0.95), pz(0.55)); g.lineTo(px(-0.95), pz(1.25)); g.lineTo(px(0.95), pz(1.25)); g.lineTo(px(0.95), pz(0.55)); g.stroke();
    // wear: punch holes in the paint
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < W * 16; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + Rm() * 0.6})`; const s = 1 + Rm() * 3.5; g.fillRect(Rm() * W, Rm() * H, s, s); }
    g.globalCompositeOperation = 'source-over';
    const t = tex(c, { aniso }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(SX, SZ), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    decal.rotation.x = -Math.PI / 2; decal.position.set(X0 + SX / 2, 0.001, Z0 + SZ / 2); decal.receiveShadow = true; scene.add(decal);
  }

  // pools of light on the slab under each fitting (cheap stand-in for dozens of real lights)
  const PX0 = -12, PZ0 = -50, PSX = 20, PSZ = 62;
  const pools = (() => {
    const [c, g] = mkCanvas(256, 800);
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 800);
    fixtures.forEach(p => {
      const cx = (p.x - PX0) / PSX * 256, cz = (p.z - PZ0) / PSZ * 800, rx = 1.7 / PSX * 256, rz = 1.25 / PSZ * 800;
      g.save(); g.translate(cx, cz); g.scale(rx, rz);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore();
    });
    const t = tex(c, { srgb: false }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(PSX, PSZ), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.13, 0.13, 0.125), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(PX0 + PSX / 2, 0.004, PZ0 + PSZ / 2); m.renderOrder = 2;
    scene.add(m); return m;
  })();

  /* the kart */
  const K = buildKart(M);
  K.kart.rotation.y = 0.0;
  scene.add(K.kart);

  // contact shadows, to sit everything on the slab
  const spot = softSpot();
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.5), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.8, color: 0x000000, alphaMap: spot }));
  cs.rotation.x = -Math.PI / 2; cs.position.y = 0.002; scene.add(cs);

  /* lights */
  const hemi = new THREE.HemisphereLight(0xdfe6ee, 0x4a4640, 0); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xf3f6ff, 0);
  key.position.set(0.6, 6, 1.2); key.target.position.set(0, 0, -0.1);
  key.castShadow = true; key.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 1, far: 12 });
  key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
  scene.add(key, key.target);
  // strip-light highlights come from the environment map; one fill stands in for the daylight openings
  const fill = new THREE.DirectionalLight(0xd8e6ff, 0); fill.position.set(8, 2, -2); fill.target.position.set(0, 0.3, 0); scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xfff4ea, 0); rim.position.set(-3, 3, -6); rim.target.position.set(0, 0.3, 0); scene.add(rim, rim.target);
  const redGlow = new THREE.PointLight(0xff2a1a, 0, 12, 1.6); redGlow.position.set(0.5, 2.6, 3.8); scene.add(redGlow);

  /* dust in the light */
  const DN = LOW ? 160 : 380;
  const dpos = new Float32Array(DN * 3), dseed = new Float32Array(DN);
  for (let i = 0; i < DN; i++) { dpos[i * 3] = (R() - 0.5) * 6; dpos[i * 3 + 1] = R() * 3; dpos[i * 3 + 2] = (R() - 0.7) * 9; dseed[i] = R() * 100; }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dustMat = new THREE.PointsMaterial({ size: 0.012, alphaMap: spot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff1e0 });
  const dust = new THREE.Points(dgeo, dustMat); scene.add(dust);

  /* post, in quality tiers. 2: AO + depth of field + chromatic fringe, 1: bloom + grain, 0: tone map + AA only.
     we start from a guess about the GPU and step down if the frame rate can't keep up */
  const gpu = (() => { try { const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : ''; } catch (e) { return ''; } })();
  const softwareGL = /swiftshader|llvmpipe|software/i.test(gpu);
  let tier = softwareGL ? 0 : LOW ? 1 : 2;
  const DPR_MAX = [1, 1.5, 1.75];
  let composer = null, dof = null;
  function buildPost() {
    if (composer) { composer.dispose(); composer = null; dof = null; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, DPR_MAX[tier]));
    if (typeof mirror !== 'undefined') mirror.visible = tier >= 2;
    if (!PP) return;
    try {
      const { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, SMAAEffect, NoiseEffect, BlendFunction, ChromaticAberrationEffect, DepthOfFieldEffect } = PP;
      composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
      composer.addPass(new RenderPass(scene, camera));
      if (tier >= 2 && N8 && N8.N8AOPostPass) {
        const ao = new N8.N8AOPostPass(scene, camera, 2, 2);
        Object.assign(ao.configuration, { aoRadius: 0.45, distanceFalloff: 0.5, intensity: 2.6, halfRes: true, gammaCorrection: false, color: new THREE.Color(0, 0, 0) });
        ao.setQualityMode('Medium');
        composer.addPass(ao);
      }
      if (tier >= 2) {
        dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 4, worldFocusRange: 3.6, bokehScale: 1.8, resolutionScale: 0.5 });
        composer.addPass(new EffectPass(camera, dof));
      }
      const fx = [];
      if (tier >= 1) fx.push(new BloomEffect({ intensity: 0.9, luminanceThreshold: 0.92, luminanceSmoothing: 0.18, mipmapBlur: true, radius: 0.72 }));
      fx.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }), new VignetteEffect({ offset: 0.28, darkness: 0.62 }));
      if (tier >= 1) { const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false }); noise.blendMode.opacity.value = 0.09; fx.push(noise); }
      composer.addPass(new EffectPass(camera, ...fx));
      composer.addPass(new EffectPass(camera, new SMAAEffect()));
      if (tier >= 2) composer.addPass(new EffectPass(camera, new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0005, 0.0004), radialModulation: true, modulationOffset: 0.35 })));
      composer.setSize(W, H);
    } catch (e) {
      console.warn('[MC Karting] post-processing off:', e);
      composer = null; renderer.toneMapping = THREE.ACESFilmicToneMapping; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    }
  }
  let W = 1, H = 1;

  // soft reflections in the polished slab (top tier only: it costs a second scene render at low resolution)
  const mirror = new Reflector(new THREE.PlaneGeometry(14, 26), { textureWidth: 512, textureHeight: 512, color: 0x5a5a5a, clipBias: 0.003 });
  mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, 0.005, -8);
  Object.assign(mirror.material, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  mirror.renderOrder = 3; scene.add(mirror);
  buildPost();

  // fixed scenery, so shadows only need redrawing when the kart moves
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  /* sizing + framing */
  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    // keep the kart clear of the copy: right of frame on wide screens, top of frame on tall ones.
    // the projection is built for the full (virtual) frame, so aspect and fov describe that frame
    const wide = W / H > 1.15;
    const FW = wide ? W * 1.42 : W, FH = wide ? H * 1.06 : H * 1.4;
    camera.aspect = FW / FH;
    camera.setViewOffset(FW, FH, 0, FH - H, W, H);
    camera.fov = wide ? 32 : 46;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(W, H);
  }
  resize();
  new ResizeObserver(resize).observe(stage);

  /* input */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; ptr.tx = (e.clientX / innerWidth) * 2 - 1; ptr.ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  let scrollP = 0;
  const onScroll = () => { scrollP = Math.min(1, Math.max(0, scrollY / (hero.offsetHeight || 1))); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* lights-out sequence */
  const clock = new THREE.Clock();
  const fx = fixtures.map(p => ({ p, on: 0, start: Infinity, flick: 0.18 + R() * 0.35, seed: R() * 50 }));
  let tOut = null;
  function lightsOn(now) {
    if (tOut !== null) return;
    tOut = now;
    fx.forEach(f => { const d = f.p.distanceTo(V(0, CEIL, 0)); f.start = now + (reduceMotion ? 0 : d * 0.028 + R() * 0.18); });
  }
  let simT = 0;
  addEventListener('mc:lightsout', () => lightsOn(simT));

  const tmpCol = new THREE.Color();
  const target = V(0, 0.34, -0.1);
  let visible = true, running = !document.hidden;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (sampleStart !== Infinity) sampleStart = null; });

  function frame() {
    requestAnimationFrame(frame);
    const d = clock.getDelta();
    if (visible && running) update(Math.min(d, 0.05), true);
  }
  function update(dt, draw) {
    simT += dt; const t = simT;

    // fixtures: flicker, then hold
    let total = 0, near = 0, nearN = 0;
    for (let i = 0; i < fx.length; i++) {
      const f = fx[i]; let v = 0;
      if (t >= f.start) {
        const k = t - f.start;
        v = k < f.flick ? (Math.sin(k * 90 + f.seed) > 0.2 ? 0.25 + Math.random() * 0.75 : 0.02) : 1;
      }
      f.on = v; total += v;
      if (Math.abs(f.p.x) < 3 && f.p.z < 7 && f.p.z > -4) { near += v; nearN++; }
      tmpCol.setScalar(v);
      tubes.setColorAt(i * 2, tmpCol); tubes.setColorAt(i * 2 + 1, tmpCol);
    }
    tubes.instanceColor.needsUpdate = true;
    const all = total / fx.length, nearP = nearN ? near / nearN : 0;
    scene.environmentIntensity = 0.05 + all * 0.72;
    hemi.intensity = all * 0.3;
    key.intensity = nearP * 1.8;
    fill.intensity = all * 0.5;
    rim.intensity = nearP * 1.6;
    pools.material.opacity = all;
    M.opening.color.setRGB(0.8, 0.88, 1).multiplyScalar(0.08 + all * 1.5);
    dustMat.opacity = nearP * 0.5;

    // start-light glow before the lights go out
    const lit = tOut === null ? document.querySelectorAll('[data-lights] span.lit').length : 0;
    redGlow.intensity += ((lit / 5) * 6 - redGlow.intensity) * Math.min(1, dt * 12);

    // camera
    ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 3); ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 3);
    const drift = reduceMotion ? 0 : Math.sin(t * 0.13) * 0.14;
    const wide = W / H > 1.15;
    const theta = (wide ? 0.7 : 0.62) + drift + ptr.x * 0.2 - scrollP * 0.35;
    const phi = (wide ? 1.45 : 1.4) - ptr.y * 0.05 - scrollP * 0.22;
    const rad = (wide ? 4.0 : 6.4) * (1 + scrollP * 0.12);
    camera.position.set(target.x + rad * Math.sin(phi) * Math.sin(theta), target.y + rad * Math.cos(phi), target.z + rad * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(target);
    if (dof) dof.cocMaterial.worldFocusDistance = camera.position.distanceTo(target);

    // steer with the pointer; idle sway on touch
    const steerT = coarse ? Math.sin(t * 0.6) * 0.25 : -ptr.x * 0.42;
    K.fronts.forEach(p => { p.rotation.y += (steerT - p.rotation.y) * Math.min(1, dt * 6); });
    K.wheelSpin.rotation.z = -K.fronts[0].rotation.y * 2.4;
    if (Math.abs(K.fronts[0].rotation.y - lastSteer) > 0.012) { lastSteer = K.fronts[0].rotation.y; renderer.shadowMap.needsUpdate = true; }

    // engine idle once the lights are out
    if (tOut !== null && !reduceMotion) {
      const idle = Math.min(1, (t - tOut) * 0.8);
      K.engine.position.y = Math.sin(t * 92) * 0.0012 * idle;
      K.body.position.y = Math.sin(t * 46 + 1) * 0.0004 * idle;
    }

    // dust
    if (!reduceMotion) {
      const a = dgeo.attributes.position.array;
      for (let i = 0; i < DN; i++) { a[i * 3 + 1] += dt * (0.02 + Math.sin(t * 0.3 + dseed[i]) * 0.015); a[i * 3] += Math.sin(t * 0.2 + dseed[i]) * dt * 0.01; if (a[i * 3 + 1] > 3) a[i * 3 + 1] = 0; }
      dgeo.attributes.position.needsUpdate = true;
    }

    if (!draw) return;
    if (composer) composer.render(dt); else renderer.render(scene, camera);

    // quality governor: step down a tier while the frame rate is under ~28fps
    if (t > 0.8 && sampleStart !== Infinity && document.visibilityState === 'visible') {
      if (sampleStart === null) { sampleStart = performance.now(); sampleFrames = 0; }
      sampleFrames++;
      const el = performance.now() - sampleStart;
      if (el > 1500) {
        const fps = sampleFrames * 1000 / el;
        if (fps < 28 && tier > 0) { tier--; buildPost(); resize(); sampleStart = null; }
        else if (fps < 24 && renderer.getPixelRatio() > 0.55) { renderer.setPixelRatio(renderer.getPixelRatio() * 0.8); resize(); sampleStart = null; }
        else sampleStart = Infinity;
      }
    }
  }
  let sampleStart = null, sampleFrames = 0, lastSteer = 0;
  if (/[?&]debug3d\b/.test(location.search)) window.__mc = { renderer, scene, camera, get composer() { return composer; }, get tier() { return tier; }, setTier(n) { tier = n; buildPost(); resize(); sampleStart = Infinity; }, tick(n, dt = 1 / 60) { for (let i = 0; i < n; i++) update(dt, i === n - 1); }, lightsOn: () => lightsOn(simT), ptr };

  try { await renderer.compileAsync(scene, camera); } catch (e) { /* older drivers: compile on first frame */ }
  frame();
  requestAnimationFrame(() => {
    ready();
    if (hero.classList.contains('go')) lightsOn(simT);
  });
}

main().catch(fail);
