// Пердёж-балдёж — what you see and touch. The rules of the river live in sim.js (the server runs the same file).
import * as THREE from 'three';
import * as G from './sim.js?v=0.3';

const $ = (id) => document.getElementById(id);
const TG = window.Telegram && Telegram.WebApp && Telegram.WebApp.initData ? Telegram.WebApp : null;
const BOT = 'PerdezhBaldezhBot', PROD = 'https://perdezh.basirxujamuradov.workers.dev';
const HERE = /\.workers\.dev$|^localhost$|^127\.0\.0\.1$/.test(location.hostname), API = HERE ? location.origin : PROD;
const VERSION = G.VERSION, STEP_MS = 1000*G.DT;
const PCOL = ['#ff5a4f', '#3fa2ff', '#ffcf33', '#5fd35a'], PNAME = ['красный', 'синий', 'жёлтый', 'зелёный'];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a)*t;
const wrap = (a) => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
if (TG) { try { TG.ready(); TG.expand(); TG.disableVerticalSwipes && TG.disableVerticalSwipes(); TG.setHeaderColor && TG.setHeaderColor('#8fd6ee'); TG.setBackgroundColor && TG.setBackgroundColor('#8fd6ee'); } catch (e) {} }
const buzz = (k) => { try { TG && TG.HapticFeedback && TG.HapticFeedback.impactOccurred(k || 'light'); } catch (e) {} };
let toastT = 0; function toast(s, ms) { const t = $('toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 2600); }
function pop(s, small) { const p = $('pop'); p.textContent = s; p.style.fontSize = small ? '40px' : '64px'; p.classList.remove('go'); void p.offsetWidth; p.classList.add('go'); }
const fmt = (t) => { t = Math.max(0, t); const m = Math.floor(t/60), s = t - m*60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
const fmt2 = (t) => { const m = Math.floor(t/60), s = t - m*60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const starsHtml = (n) => '⭐'.repeat(n) + '<s>⭐</s>'.repeat(3 - n);

// ---------- the picture ----------
const R = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
const scene = new THREE.Scene(); scene.background = new THREE.Color('#79c95a');
const cam = new THREE.PerspectiveCamera(60, 1, 0.5, 500);
scene.add(new THREE.HemisphereLight(0xffffff, 0x9ad07a, 2.3)); const sun = new THREE.DirectionalLight(0xfff1cf, 1.9); sun.position.set(-30, 60, 25); scene.add(sun);
const U = { uT: { value: 0 } }, PU = { uScale: { value: 500 } };
let CAMD = 22, DPR = Math.min(window.devicePixelRatio || 1, 2);
function resize() { const w = innerWidth, h = innerHeight; R.setPixelRatio(DPR); R.setSize(w, h, false); cam.aspect = w/h; cam.fov = w < h ? 62 : 46; cam.updateProjectionMatrix();
  const th = Math.tan(cam.fov*Math.PI/360); CAMD = clamp(6.8/(th*cam.aspect), 20, 27); PU.uScale.value = h*DPR/(2*th); }
addEventListener('resize', resize); resize();

const lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, o || {}));
const MAT = { wood: lam('#b67a45'), wood2: lam('#9c6234'), dark: lam('#6b4423'), cut: lam('#e2b77c'), rock: lam('#9a9ca6'), rock2: lam('#b9bbc4'), skin: lam('#ffd7ae'), jeans: lam('#3c5a9a'), black: lam('#222'), white: lam('#ffffff'),
  can: lam('#d8392c'), label: lam('#fff1c9'), tin: lam('#c9ced6'), tree: lam('#ffffff'), red: lam('#e9453a'), flag: lam('#ff5a4f', { side: THREE.DoubleSide }) };
const waterMat = new THREE.ShaderMaterial({ uniforms: { uT: U.uT }, side: THREE.DoubleSide,
  vertexShader: 'attribute float aLat; attribute float aW; attribute float aS; varying float vLat; varying float vW; varying float vS; void main(){ vLat=aLat; vW=aW; vS=aS; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `precision highp float; uniform float uT; varying float vLat; varying float vW; varying float vS;
    void main(){ float e = vW - abs(vLat);
      vec3 c = mix(vec3(0.42,0.84,0.93), vec3(0.17,0.62,0.88), smoothstep(0.0, 3.4, e));
      float w1 = sin(vS*0.8 - uT*2.4 + sin(vLat*1.3 + vS*0.25)*1.6); c += 0.075*smoothstep(0.80, 0.98, w1);
      float w2 = sin(vS*0.37 - uT*1.3 + vLat*0.9); c -= 0.03*smoothstep(0.7, 1.0, w2);
      float foam = 1.0 - smoothstep(0.22, 0.55, e + 0.16*sin(vS*1.7 - uT*2.0)); c = mix(c, vec3(1.0), foam*0.92);
      gl_FragColor = vec4(c, 1.0); }` });
const groundMat = new THREE.ShaderMaterial({ vertexShader: 'varying vec3 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: `precision highp float; varying vec3 vP; void main(){ float n = sin(vP.x*0.21)*sin(vP.z*0.17) + 0.5*sin(vP.x*0.53+1.3)*sin(vP.z*0.47+2.1);
    vec3 c = mix(vec3(0.43,0.76,0.33), vec3(0.54,0.84,0.38), smoothstep(-0.5, 0.7, n)); float d = step(0.93, sin(vP.x*1.9+sin(vP.z*1.3)*2.0)*sin(vP.z*2.3)); c = mix(c, vec3(0.36,0.68,0.29), d*0.5); gl_FragColor = vec4(c, 1.0); }` });
const poolMat = new THREE.ShaderMaterial({ uniforms: { uT: U.uT }, transparent: true, depthWrite: false,
  vertexShader: 'varying vec2 vU; void main(){ vU = uv*2.0-1.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `precision highp float; uniform float uT; varying vec2 vU; void main(){ float d = length(vU); if (d > 1.0) discard; float a = atan(vU.y, vU.x);
    float sp = sin(a*3.0 - d*11.0 - uT*5.0); float line = smoothstep(0.55, 0.95, sp); vec3 c = mix(vec3(0.07,0.36,0.62), vec3(1.0), line*0.9);
    float hole = 1.0 - smoothstep(0.0, 0.2, d); c = mix(c, vec3(0.03,0.18,0.36), hole); float al = (1.0 - smoothstep(0.55, 1.0, d))*0.9; gl_FragColor = vec4(c, al*(0.55 + 0.45*line + hole)); }` });
const rapidMat = new THREE.ShaderMaterial({ uniforms: { uT: U.uT }, transparent: true, depthWrite: false,
  vertexShader: 'varying vec2 vU; void main(){ vU = uv*2.0-1.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `precision highp float; uniform float uT; varying vec2 vU; void main(){ float d = length(vU); if (d > 1.0) discard;
    float ch = fract((vU.x + abs(vU.y)*0.7)*2.2 - uT*2.2); float a = smoothstep(0.0, 0.12, ch)*(1.0 - smoothstep(0.3, 0.46, ch))*(1.0 - smoothstep(0.6, 1.0, d)); gl_FragColor = vec4(1.0, 1.0, 1.0, a*0.85); }` });
const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
const sandMat = new THREE.MeshBasicMaterial({ color: '#f1dba0', side: THREE.DoubleSide });
const UP = new THREE.Vector3(0, 1, 0), M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3();
const GEO = { ico: new THREE.IcosahedronGeometry(1, 0), ico1: new THREE.IcosahedronGeometry(1, 1), cone: new THREE.ConeGeometry(1, 2, 7).translate(0, 1, 0), trunk: new THREE.CylinderGeometry(0.16, 0.24, 1, 6).translate(0, 0.5, 0), circle: new THREE.CircleGeometry(1, 40) };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0)/4294967296; }; }
function ribbon(E, f0, f1, y) { const n = E.length, pos = new Float32Array(n*6), lat = new Float32Array(n*2), ww = new Float32Array(n*2), ss = new Float32Array(n*2), idx = [];
  for (let i = 0; i < n; i++) { const e = E[i], a = f0(e), b = f1(e); pos.set([e.x + e.rx*a, y, e.z + e.rz*a, e.x + e.rx*b, y, e.z + e.rz*b], i*6); lat[i*2] = a; lat[i*2 + 1] = b; ww[i*2] = ww[i*2 + 1] = e.w; ss[i*2] = ss[i*2 + 1] = e.s; if (i < n - 1) idx.push(i*2, i*2 + 1, i*2 + 2, i*2 + 1, i*2 + 3, i*2 + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aLat', new THREE.BufferAttribute(lat, 1)); g.setAttribute('aW', new THREE.BufferAttribute(ww, 1)); g.setAttribute('aS', new THREE.BufferAttribute(ss, 1)); g.setIndex(idx); return g; }
function insts(geo, mat, list) { const m = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((t, i) => { Q4.setFromAxisAngle(UP, t.r || 0); M4.compose(V3.set(t.x, t.y || 0, t.z), Q4, S3.set(t.sx, t.sy, t.sz)); m.setMatrixAt(i, M4); if (t.c) m.setColorAt(i, t.c); }); m.frustumCulled = false; return m; }
const flat = (m) => { m.rotation.x = -Math.PI/2; return m; };

let LV = null;
function buildLevel(i) {
  if (LV && LV.L.i === i) return LV;
  if (LV) { scene.remove(LV.g); LV.g.traverse((o) => { if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); }); }
  const L = G.level(i), P = L.P, g = new THREE.Group(), rnd = rng(77 + i*131), E = [];
  // the river a little before the start and a pond after the finish, so the picture has no edge
  const p0 = P[0], pl = P[P.length - 1];
  for (let k = 16; k >= 1; k--) E.push({ x: p0.x - Math.cos(p0.a)*2*k, z: p0.z - Math.sin(p0.a)*2*k, w: p0.w, s: -2*k });
  for (const p of P) E.push({ x: p.x, z: p.z, w: p.w, s: p.s });
  for (let k = 1; k <= 26; k++) E.push({ x: pl.x + Math.cos(pl.a)*2*k, z: pl.z + Math.sin(pl.a)*2*k, w: pl.w + Math.min(k, 9)*0.9, s: pl.s + 2*k });
  for (let k = 0; k < E.length; k++) { const a = E[Math.max(0, k - 1)], b = E[Math.min(E.length - 1, k + 1)], d = Math.hypot(b.x - a.x, b.z - a.z) || 1; E[k].tx = (b.x - a.x)/d; E[k].tz = (b.z - a.z)/d; E[k].rx = -E[k].tz; E[k].rz = E[k].tx; }
  let cx = 0, cz = 0; for (const e of E) { cx += e.x; cz += e.z; } cx /= E.length; cz /= E.length;
  const ground = flat(new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), groundMat)); ground.position.set(cx, -0.03, cz); g.add(ground);
  g.add(new THREE.Mesh(ribbon(E, (e) => -e.w, (e) => e.w, 0), waterMat));
  g.add(new THREE.Mesh(ribbon(E, (e) => -e.w - 1.3, (e) => -e.w + 0.05, 0.02), sandMat)); g.add(new THREE.Mesh(ribbon(E, (e) => e.w - 0.05, (e) => e.w + 1.3, 0.02), sandMat));
  // trees, bushes and stones on the banks, never in the water
  const clear = (x, z, m) => { for (const e of E) { const dx = x - e.x, dz = z - e.z, r = e.w + m; if (dx*dx + dz*dz < r*r) return false; } return true; };
  const trunks = [], cones = [], balls = [], stones = [];
  for (let k = 0; k < E.length; k++) for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
    const e = E[k]; if (rnd() < 0.45) { const d = e.w + 2.6 + rnd()*rnd()*34, x = e.x + e.rx*side*d + (rnd() - 0.5)*2, z = e.z + e.rz*side*d + (rnd() - 0.5)*2; if (!clear(x, z, 2.2)) continue;
      const s = 0.8 + rnd()*0.8, c = new THREE.Color().setHSL(0.27 + rnd()*0.09, 0.5 + rnd()*0.15, 0.3 + rnd()*0.12), r = rnd()*6;
      if (rnd() < 0.68) { trunks.push({ x, z, sx: s, sy: s*1.1, sz: s }); cones.push({ x, y: s*0.8, z, r, sx: s*1.35, sy: s*1.15, sz: s*1.35, c }); cones.push({ x, y: s*2.1, z, r: r + 1, sx: s*1.0, sy: s*0.95, sz: s*1.0, c: c.clone().offsetHSL(0, 0, 0.05) }); }
      else { trunks.push({ x, z, sx: s*1.1, sy: s*1.7, sz: s*1.1 }); balls.push({ x, y: s*2.5, z, r, sx: s*1.45, sy: s*1.3, sz: s*1.45, c: c.offsetHSL(-0.03, 0, 0.06) }); } }
    if (rnd() < 0.16) { const d = e.w + 0.5 + rnd()*2.2, x = e.x + e.rx*side*d, z = e.z + e.rz*side*d, s = 0.3 + rnd()*0.5; if (clear(x, z, 0.3)) stones.push({ x, y: s*0.2, z, r: rnd()*6, sx: s, sy: s*0.7, sz: s*1.2 }); } }
  g.add(insts(GEO.trunk, MAT.wood2, trunks), insts(GEO.cone, MAT.tree, cones), insts(GEO.ico1, MAT.tree, balls), insts(GEO.ico, MAT.rock2, stones));
  // what is in the river
  const rings = [];
  for (const r of L.rocks) { const m = new THREE.Mesh(GEO.ico, rnd() < 0.5 ? MAT.rock : MAT.rock2); m.scale.set(r.r*1.02, r.r*(0.6 + rnd()*0.35), r.r*1.02); m.position.set(r.x, r.r*0.12, r.z); m.rotation.y = rnd()*6; g.add(m);
    const ring = flat(new THREE.Mesh(new THREE.RingGeometry(r.r*0.95, r.r*1.22, 20), foamMat)); ring.position.set(r.x, 0.03, r.z); g.add(ring); rings.push(ring); }
  const logs = L.logs.map((o) => { const lg = new THREE.Group(); lg.position.set(o.x, 0.22, o.z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, o.hl*2, 9), MAT.wood); body.rotation.z = Math.PI/2; lg.add(body);
    for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 9), MAT.cut); cap.rotation.z = Math.PI/2; cap.position.x = s*(o.hl + 0.01); lg.add(cap); }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 1.0, 8), MAT.dark); post.position.y = 0.3; lg.add(post); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 8), MAT.cut); top.position.y = 0.82; lg.add(top);
    g.add(lg); return { o, m: lg }; });
  for (const p of L.pools) { const m = flat(new THREE.Mesh(GEO.circle, poolMat)); m.scale.setScalar(p.r); m.position.set(p.x, 0.025, p.z); g.add(m); }
  for (const p of L.rapids) { const loc = G.locate(L, p.x, p.z, Math.floor(p.s/2)), h = new THREE.Group(); h.position.set(p.x, 0.022, p.z); h.rotation.y = -Math.atan2(loc.tz, loc.tx); const m = flat(new THREE.Mesh(GEO.circle, rapidMat)); m.scale.setScalar(p.r); h.add(m); g.add(h); }
  const beans = L.beans.map((b) => { const c = new THREE.Group(); c.position.set(b.x, 0.5, b.z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 12), MAT.can), lab = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12), MAT.label), t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 12), MAT.tin), t2 = t1.clone(); t1.position.y = 0.32; t2.position.y = -0.32; c.add(body, lab, t1, t2); c.rotation.z = 0.35;
    const ring = flat(new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 20), foamMat)); ring.position.set(b.x, 0.03, b.z); g.add(c, ring); return { c, ring }; });
  // the finish: two poles and a chequered banner
  { const sF = L.len - 1.5, loc = G.locate(L, ...L.at(sF, 0), Math.floor(sF/2)), w = loc.w, ta = Math.atan2(loc.tz, loc.tx), [mx, mz] = L.at(sF, 0);
    for (const s of [-1, 1]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.4, 8), s < 0 ? MAT.red : MAT.white); pole.position.set(mx - Math.sin(ta)*s*(w + 0.5), 2.2, mz + Math.cos(ta)*s*(w + 0.5)); g.add(pole); }
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const c2 = cv.getContext('2d'); for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { c2.fillStyle = (x + y) % 2 ? '#222' : '#fff'; c2.fillRect(x*16, y*16, 16, 16); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const ban = new THREE.Mesh(new THREE.PlaneGeometry(w*2 + 1, 1.1), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); ban.position.set(mx, 3.8, mz); ban.rotation.y = Math.atan2(-Math.cos(ta), -Math.sin(ta)); g.add(ban); }
  scene.add(g); return LV = { L, g, logs, beans, rings };
}

// ---------- the crew: four different characters, each bent over with the business end pointing back ----------
const HEAD = 0.29, SPH = new THREE.SphereGeometry(1, 16, 12), HALF = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI*2, 0, Math.PI/2);
const smooth = (c) => new THREE.MeshLambertMaterial({ color: c });
const ball = (mat, r, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(SPH, mat); m.scale.set(r*(sx || 1), r*(sy || 1), r*(sz || 1)); m.position.set(x, y, z); return m; };
function pantsTex(k, skinHex) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = PCOL[k]; c.fillRect(0, 0, 128, 128); c.fillStyle = '#fff'; c.strokeStyle = '#fff';
  if (k === 0) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const px = x*32 + (y % 2)*16 + 8, py = y*32 + 12; c.beginPath(); c.moveTo(px, py + 9); c.bezierCurveTo(px - 13, py - 2, px - 5, py - 10, px, py - 3); c.bezierCurveTo(px + 5, py - 10, px + 13, py - 2, px, py + 9); c.fill(); }   // hearts
  else if (k === 1) for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { c.beginPath(); c.arc(x*26 + (y % 2)*13 + 8, y*26 + 10, 6, 0, 7); c.fill(); }   // dots
  else if (k === 2) { c.fillStyle = '#e8552f'; for (let x = 0; x < 8; x++) c.fillRect(x*16, 0, 7, 128); }   // stripes
  else for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const px = x*32 + (y % 2)*16 + 10, py = y*32 + 14; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i*Math.PI/5 - Math.PI/2, r = i % 2 ? 4 : 10; c.lineTo(px + Math.cos(a)*r, py + Math.sin(a)*r); } c.fill(); }   // stars
  // the pants have slipped: bare skin above the waistband, with the crack down the middle
  const sk = new THREE.Color(skinHex), dk = '#' + sk.clone().multiplyScalar(0.72).getHexString(); c.fillStyle = skinHex; c.fillRect(0, 0, 128, 40); c.fillStyle = dk; c.fillRect(0, 6, 2.5, 34); c.fillRect(125.5, 6, 2.5, 34); c.fillStyle = '#fff'; c.fillRect(0, 38, 128, 9);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return t; }
const BUILD = [{ fat: 1.18, tall: 0.95, head: 1.0 }, { fat: 0.88, tall: 1.12, head: 0.95 }, { fat: 1.05, tall: 1.0, head: 1.05 }, { fat: 0.92, tall: 0.9, head: 1.2 }];
function buildGuy(k, off, n) {
  const c = new THREE.Group(), B = BUILD[k], col = new THREE.Color(PCOL[k]), size = n <= 2 ? 1.3 : n === 3 ? 1.12 : 0.95;
  c.position.set(-0.78 + (n === 4 && Math.abs(off) < 0.5 ? 0.3 : 0), 0.24, off*0.82); c.scale.setScalar(size);
  const skinHex = ['#ffd7ae', '#f3c69a', '#ffe0c0', '#e9b98c'][k], skin = smooth(skinHex), shirt = smooth(col.clone().lerp(new THREE.Color('#ffffff'), 0.6)), ink = MAT.black, white = smooth('#ffffff');
  // the back end, in loud underpants
  const bum = new THREE.Group(); bum.position.set(-0.2, 0.44*B.tall, 0); const cheeks = ball(new THREE.MeshLambertMaterial({ map: pantsTex(k, skinHex) }), 0.31, 0, 0, 0, 0.95*B.fat, 0.92, 1.16*B.fat); cheeks.rotation.z = -0.85; bum.add(cheeks);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2*B.fat, 0.26, 6, 12), shirt); body.rotation.z = -1.2; body.position.set(0.1, 0.5*B.tall, 0);
  const feet = [-1, 1].map((s) => ball(MAT.dark, 0.09, -0.12, 0.09, s*0.24*B.fat, 1.6, 0.7, 1));
  // arms: pivot at the shoulder, hand at the end
  const arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(0.3, 0.52*B.tall, s*0.2*B.fat); const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.26, 4, 8), shirt); up.position.y = -0.16; a.add(up, ball(skin, 0.075, 0, -0.34, 0)); a.rotation.z = 0.45; return a; });
  // the head: turns round to look at you when its owner is pushing
  const neck = new THREE.Group(), tilt = new THREE.Group(), R = HEAD*B.head; neck.position.set(0.4, 0.84*B.tall, 0); neck.add(tilt);
  const skull = ball(skin, R, 0, 0, 0, 1, 0.96, 1.02); tilt.add(skull, ball(skin, R*0.24, 0, 0, R*1.0), ball(skin, R*0.24, 0, 0, -R*1.0));
  const eyes = [-1, 1].map((s) => { const e = new THREE.Group(); e.position.set(R*0.8, R*0.25, s*R*0.42); e.add(ball(white, R*0.36, 0, 0, 0), ball(ink, R*0.17, R*0.26, 0, 0)); tilt.add(e); return e; });
  const puff = [-1, 1].map((s) => { const m = ball(smooth('#ff9d9d'), R*0.3, R*0.72, -R*0.3, s*R*0.62); tilt.add(m); return m; });
  tilt.add(ball(smooth('#f0a98a'), R*0.2, R*1.0, -R*0.05, 0));   // nose
  const mouth = ball(ink, R*0.16, R*0.9, -R*0.5, 0, 0.5, 0.6, 1.5); tilt.add(mouth);
  let spin = null;
  if (k === 0) { const cap = new THREE.Mesh(HALF, smooth(col)); cap.scale.setScalar(R*1.06); cap.position.y = R*0.12; const visor = new THREE.Mesh(new THREE.BoxGeometry(R*1.0, R*0.12, R*1.3), cap.material); visor.position.set(-R*1.2, R*0.2, 0); tilt.add(cap, visor);   // cap worn backwards
    const mo = new THREE.Mesh(new THREE.BoxGeometry(R*0.14, R*0.16, R*0.95), ink); mo.position.set(R*0.98, -R*0.26, 0); tilt.add(mo); }   // moustache
  else if (k === 1) { const pot = new THREE.Mesh(new THREE.CylinderGeometry(R*1.0, R*1.0, R*0.85, 16), smooth(col)); pot.position.y = R*0.75; const rim = new THREE.Mesh(new THREE.CylinderGeometry(R*1.08, R*1.08, R*0.12, 16), white); rim.position.y = R*0.36;
    const hd = new THREE.Mesh(new THREE.BoxGeometry(R*0.14, R*0.12, R*1.3), ink); hd.position.set(0, R*0.8, R*1.5); tilt.add(pot, rim, hd);   // a saucepan for a helmet
    for (const s of [-1, 1]) { const gl = new THREE.Mesh(new THREE.TorusGeometry(R*0.4, R*0.06, 6, 14), ink); gl.rotation.y = Math.PI/2; gl.position.set(R*0.86, R*0.25, s*R*0.42); tilt.add(gl); } }   // glasses
  else if (k === 2) { const brim = new THREE.Mesh(new THREE.CylinderGeometry(R*1.75, R*1.75, R*0.1, 18), smooth('#f6d868')); brim.position.y = R*0.6; const top = new THREE.Mesh(new THREE.CylinderGeometry(R*0.8, R*0.9, R*0.7, 14), brim.material); top.position.y = R*0.95;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R*0.92, R*0.92, R*0.2, 14), smooth('#e8552f')); band.position.y = R*0.74; tilt.add(brim, top, band);   // straw hat
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(R*0.1, R*0.22, R*0.22), white); tooth.position.set(R*0.95, -R*0.52, 0); tilt.add(tooth); }
  else { const cap = new THREE.Mesh(HALF, smooth(col)); cap.scale.setScalar(R*1.06); cap.position.y = R*0.15; const stem = new THREE.Mesh(new THREE.CylinderGeometry(R*0.06, R*0.06, R*0.5, 6), ink); stem.position.y = R*1.35;
    spin = new THREE.Group(); spin.position.y = R*1.6; for (const a of [0, Math.PI/2]) { const bl = new THREE.Mesh(new THREE.BoxGeometry(R*1.5, R*0.05, R*0.3), smooth('#ffcf33')); bl.rotation.y = a; spin.add(bl); } tilt.add(cap, stem, spin);   // propeller beanie
    tilt.add(ball(smooth('#eeeeee'), R*0.55, R*0.62, -R*0.72, 0, 0.9, 0.85, 1.25)); }   // a white beard
  c.add(bum, body, ...feet, ...arms, neck);
  return { c, off, k, B, size, bum, body, arms, neck, tilt, eyes, puff, mouth, skull, skin, spin, base: skin.color.clone(), side: off > 0.01 ? -1 : 1, puffAcc: 0, f: 0, dry: 0, strain: 0, yaw: 0, hop: 0, vy: 0, shock: 0, cheer: 0, party: false, was: false, look: Math.random()*9 };
}
const RED = new THREE.Color('#ff7a66'), BLUE = new THREE.Color('#9aa6ee');
function guyStep(c, j, run, dt, fire) {
  const dryNow = j.on && !fire && run; c.f += ((fire ? 1 : 0) - c.f)*Math.min(1, dt*12); c.dry += ((dryNow ? 1 : 0) - c.dry)*Math.min(1, dt*8);
  c.strain = clamp(c.strain + (fire ? dt*0.7 : -dt*0.9), 0, 1); c.shock = Math.max(0, c.shock - dt); c.cheer = Math.max(0, c.cheer - dt);
  // hop: knocked up by a bump, or dancing at the finish
  if (c.party && c.hop <= 0 && c.vy <= 0 && Math.sin(T*7 + c.k*1.9) > 0.9) c.vy = 3.2; c.vy -= 16*dt; c.hop += c.vy*dt; if (c.hop <= 0) { c.hop = 0; c.vy = 0; }
  const shake = fire ? Math.sin(T*65 + c.k*2)*0.02 : dryNow ? Math.sin(T*40 + c.k)*0.012 : 0;
  c.c.position.y = 0.24 + c.hop + shake; c.c.rotation.z = -0.22*c.f + Math.sin(T*2 + c.k)*0.02; c.c.rotation.x = c.hop*0.25*c.side;
  // the back end inflates and flaps while pushing, sags when the tank is dry
  const pump = 1 + 0.22*c.f - 0.14*c.dry + (fire ? Math.sin(T*48 + c.k)*0.05 : 0) + Math.sin(T*2.6 + c.k)*0.015; c.bum.scale.set(pump, pump*(1 + 0.08*c.f), pump); c.bum.rotation.x = fire ? Math.sin(T*33)*0.12 : Math.sin(T*1.7 + c.k*2)*0.06; c.bum.position.y = 0.44*c.B.tall + 0.1*c.f;
  // the head: looks back over the shoulder when pushing, cheering or worried; otherwise watches the river
  c.look += dt; const glance = Math.sin(c.look*0.7 + c.k*3)*0.5 + (Math.sin(c.look*0.23 + c.k) > 0.93 ? 1.2*c.side : 0), back = Math.max(c.f, c.dry, c.party ? 1 : 0, c.shock > 0 ? 0.7 : 0);
  const wantYaw = back > 0.3 ? c.side*2.75 : glance; c.yaw += (wantYaw - c.yaw)*Math.min(1, dt*(back > 0.3 ? 11 : 4)); c.neck.rotation.y = c.yaw; c.tilt.rotation.z = 0.62*Math.min(1, Math.abs(c.yaw)/2.6) + (fire ? Math.sin(T*55)*0.03 : 0);
  // the face: squeezed and red when pushing, pop-eyed and blue when empty
  const squint = c.f*(1 - c.dry), pop = Math.max(c.dry, c.shock > 0 ? 1 : 0); for (const e of c.eyes) e.scale.set(1 + pop*0.25, (1 - 0.72*squint)*(1 + pop*0.35), 1 + pop*0.25);
  const ch = 1 + 0.9*c.f + 0.25*Math.sin(T*30)*c.f; for (const p of c.puff) p.scale.setScalar(HEAD*c.B.head*0.3*ch);
  c.mouth.scale.set(HEAD*c.B.head*0.16*0.5, HEAD*c.B.head*0.16*(0.6 + 1.3*Math.max(pop, c.cheer > 0 || c.party ? 1 : 0)), HEAD*c.B.head*0.16*(1.5 - 0.8*squint));
  c.skin.color.copy(c.base).lerp(RED, 0.75*c.strain*(1 - c.dry)).lerp(BLUE, 0.6*c.dry);
  // arms: holding on; up in the air for a volley and at the finish
  const up = c.cheer > 0 || c.party ? 1 : 0; c.arms.forEach((a, i) => { const want = up ? 2.7 + Math.sin(T*14 + i*2 + c.k)*0.3 : 0.45 + 0.25*c.f; a.rotation.z += (want - a.rotation.z)*Math.min(1, dt*12); a.rotation.x = up ? (i ? 1 : -1)*0.35 : 0; });
  if (c.spin) c.spin.rotation.y += dt*(4 + 40*c.f);
  const started = fire && !c.was; c.was = fire; return started;
}
// little shouts that fly off the raft
const WORDS = ['ПУК!', 'ПРРР', 'ПШШШ', 'ТР-Р-Р', 'ФУ-У!', 'БДЫЩ', 'ПУ-УК', 'ВЖУХ'], SHOUT = [];
function shout(x, z, col, word) { if (!SHOUT.length) for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true })); s.visible = false; s.renderOrder = 6; scene.add(s); SHOUT.push({ s, life: 0, tex: {} }); }
  const o = SHOUT.find((q) => q.life <= 0) || SHOUT[0], w = word || WORDS[Math.floor(Math.random()*WORDS.length)], key = w + col; if (!TEX[key]) TEX[key] = label(w, col).material.map;
  o.s.material.map = TEX[key]; o.s.material.needsUpdate = true; o.life = o.max = 0.9; o.x = x; o.z = z; o.vx = (Math.random() - 0.5)*2; o.s.visible = true; }
const TEX = {};
function shoutStep(dt) { for (const o of SHOUT) { if (o.life <= 0) continue; o.life -= dt; if (o.life <= 0) { o.s.visible = false; continue; } const t = 1 - o.life/o.max, k = 1.4 + t*1.6; o.s.position.set(o.x + o.vx*t, 1.4 + t*2.4, o.z); o.s.scale.set(1.9*k, 0.475*k, 1); o.s.material.opacity = t < 0.7 ? 1 : (1 - t)/0.3; } }

// ---------- the raft ----------
let RAFT = null;
function label(text, col) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d'); c.font = '900 34px Rubik, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = '#43260f'; c.strokeText(text, 128, 34); c.fillStyle = col; c.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.scale.set(1.9, 0.475, 1); s.renderOrder = 5; return s; }
function buildRaft(n, names) {
  if (RAFT) scene.remove(RAFT.g);
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  const shadow = flat(new THREE.Mesh(GEO.circle, new THREE.MeshBasicMaterial({ color: '#0a3a5c', transparent: true, opacity: 0.22, depthWrite: false }))); shadow.scale.set(1.75, 1.45, 1); shadow.position.y = 0.035; g.add(shadow);
  for (let i = 0; i < 5; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 2.7 - (i % 2)*0.18, 8), i % 2 ? MAT.wood2 : MAT.wood); lg.rotation.z = Math.PI/2; lg.position.set(0, 0.12, (i - 2)*0.45); b.add(lg);
    for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 8), MAT.cut); cap.rotation.z = Math.PI/2; cap.position.set(s*(1.35 - (i % 2)*0.09), 0.12, (i - 2)*0.45); b.add(cap); } }
  for (const x of [-0.85, 0.85]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 2.15), MAT.dark); pl.position.set(x, 0.36, 0); b.add(pl); }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6), MAT.dark); mast.position.set(0.95, 1.2, 0); b.add(mast);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0.55, 0, -0.8, 0.27, 0]), 3)); fg.computeVertexNormals(); const flag = new THREE.Mesh(fg, MAT.flag); flag.position.set(0.95, 1.55, 0); b.add(flag);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.6), MAT.cut), band = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.63), MAT.dark); crate.position.set(0.3, 0.62, 0); crate.rotation.y = 0.2; band.position.copy(crate.position); band.rotation.y = 0.2; b.add(crate, band);
  const crew = G.SEATS[n].map((off, k) => { const c = buildGuy(k, off, n); b.add(c.c); if (names && names[k]) { const l = label(names[k], PCOL[k]); l.position.set(0.1, 1.5 + (k % 2)*0.4, 0); c.c.add(l); } return c; });
  scene.add(g); return RAFT = { g, b, crew, flag };
}

// ---------- puffs, splashes and confetti: one cloud of round dots ----------
const PN = 520, pPos = new Float32Array(PN*3), pCol = new Float32Array(PN*4), pSize = new Float32Array(PN), PT = []; let pNext = 0;
for (let i = 0; i < PN; i++) { PT.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 0, s1: 0, r: 1, g: 1, b: 1, a: 1, drag: 1 }); pPos[i*3 + 1] = -99; }
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aCol', new THREE.BufferAttribute(pCol, 4)); pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
const puffs = new THREE.Points(pGeo, new THREE.ShaderMaterial({ uniforms: PU, transparent: true, depthWrite: false,
  vertexShader: 'attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = aSize*uScale/max(0.1,-mv.z); gl_Position = projectionMatrix*mv; }',
  fragmentShader: 'precision mediump float; varying vec4 vC; void main(){ float d = length(gl_PointCoord-0.5)*2.0; if (d > 1.0) discard; vec3 c = mix(vC.rgb, vC.rgb*0.72, smoothstep(0.7, 0.86, d)); c = mix(c, vec3(1.0), (1.0-smoothstep(0.0,0.5,length(gl_PointCoord-vec2(0.36,0.34))*2.0))*0.35); gl_FragColor = vec4(c, vC.a); }' }));
puffs.frustumCulled = false; puffs.renderOrder = 3; scene.add(puffs);
function emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, drag) { const i = pNext; pNext = (pNext + 1) % PN; const p = PT[i]; p.life = p.max = life; p.vx = vx; p.vy = vy; p.vz = vz; p.s0 = s0; p.s1 = s1; p.r = r; p.g = g; p.b = b; p.a = a; p.drag = drag == null ? 2.2 : drag; pPos[i*3] = x; pPos[i*3 + 1] = y; pPos[i*3 + 2] = z; }
function puffStep(dt) { for (let i = 0; i < PN; i++) { const p = PT[i]; if (p.life <= 0) continue; p.life -= dt; if (p.life <= 0) { pPos[i*3 + 1] = -99; pSize[i] = 0; continue; }
    const t = 1 - p.life/p.max, k = Math.exp(-p.drag*dt); p.vx *= k; p.vz *= k; if (p.drag === 0) p.vy -= 9*dt; else p.vy *= k;
    pPos[i*3] += p.vx*dt; pPos[i*3 + 1] = Math.max(0.05, pPos[i*3 + 1] + p.vy*dt); pPos[i*3 + 2] += p.vz*dt; pSize[i] = p.s0 + (p.s1 - p.s0)*Math.sqrt(t);
    const w = t*0.5; pCol[i*4] = p.r + (1 - p.r)*w; pCol[i*4 + 1] = p.g + (1 - p.g)*w; pCol[i*4 + 2] = p.b + (1 - p.b)*w; pCol[i*4 + 3] = p.a*(1 - t*t); }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.aCol.needsUpdate = pGeo.attributes.aSize.needsUpdate = true; }
function clearPuffs() { for (let i = 0; i < PN; i++) { PT[i].life = 0; pPos[i*3 + 1] = -99; pSize[i] = 0; } }

// ---------- sound: everything is made on the spot, no files ----------
let AC = null, master = null, MUTE = store.get('pb_mute', false); const VO = [];
function audio() { if (AC) { if (AC.state === 'suspended') AC.resume(); return; } try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = MUTE ? 0 : 0.7; master.connect(AC.destination); } catch (e) { AC = null; } }
function voice(k) { const o = AC.createOscillator(), l = AC.createOscillator(), lg = AC.createGain(), lf = AC.createGain(), f = AC.createBiquadFilter(), g = AC.createGain();
  o.type = 'sawtooth'; l.type = 'square'; l.frequency.value = 21 + k*5; lg.gain.value = 22; lf.gain.value = 260; l.connect(lg); lg.connect(o.frequency); l.connect(lf); lf.connect(f.frequency);
  f.type = 'lowpass'; f.frequency.value = 480; f.Q.value = 7; g.gain.value = 0; o.connect(f); f.connect(g); g.connect(master); o.start(); l.start(); return { o, l, g, base: [58, 81, 69, 94][k], on: false }; }
function fartSound(k, on, gas, hot) { if (!AC) return; const v = VO[k] || (VO[k] = voice(k)), t = AC.currentTime;
  if (on !== v.on) { v.on = on; v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(on ? 0.3 : 0, t, on ? 0.012 : 0.06); if (on) { v.o.frequency.cancelScheduledValues(t); v.o.frequency.setValueAtTime(v.base*1.7, t); v.l.frequency.setValueAtTime(19 + Math.random()*14, t); } }
  if (on) v.o.frequency.setTargetAtTime(v.base*(0.7 + 0.55*gas)*(hot ? 1.35 : 1), t, 0.09); }
function quiet() { for (let k = 0; k < VO.length; k++) if (VO[k]) fartSound(k, false, 0, false); }
function tone(type, f0, f1, dur, vol, delay) { if (!AC) return; const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
function noise(dur, vol, freq) { if (!AC) return; const n = Math.floor(AC.sampleRate*dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random()*2 - 1)*(1 - i/n); const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(); }
const SFX = { bump: (f) => { tone('sine', 120, 45, 0.18, 0.5*f + 0.2); noise(0.14, 0.35*f + 0.1, 900); }, bean: () => { tone('square', 520, 780, 0.09, 0.16); tone('square', 780, 1170, 0.12, 0.16, 0.09); },
  volley: () => { tone('sawtooth', 150, 52, 0.55, 0.42); tone('sawtooth', 226, 78, 0.5, 0.25); noise(0.4, 0.3, 500); }, count: () => tone('square', 440, 440, 0.1, 0.14), go: () => tone('square', 880, 880, 0.25, 0.16),
  finish: () => [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.2, 0.15, i*0.12)) };
function setMute(m) { MUTE = m; store.set('pb_mute', m); if (master) master.gain.value = m ? 0 : 0.7; $('mute').textContent = m ? '🔇' : '🔊'; } setMute(MUTE);

// ---------- one run ----------
let RUN = null, NET = null, BEST = store.get('pb_best', {});
const HELD = { L: false, R: false, O: false, kl: false, kr: false, kb: false };
const bits = () => RUN && RUN.S.n === 1 ? ((HELD.L || HELD.kl || HELD.kb || HELD.O) ? 1 : 0) | ((HELD.R || HELD.kr || HELD.kb || HELD.O) ? 2 : 0) : (HELD.O || HELD.L || HELD.R || HELD.kl || HELD.kr || HELD.kb) ? 1 : 0;
function show(id) { for (const s of ['home', 'over', 'room']) $(s).classList.toggle('on', s === id); }
function begin(mode, lv, n, names, seat) {
  const S = G.newRun(lv, n); buildLevel(S.lv); buildRaft(n, names); clearPuffs(); quiet();
  RUN = { kind: mode, S, px: S.x, pz: S.z, pa: S.a, k: 1, acc: 0, cnt: 4, seat: seat == null ? 0 : seat, shake: 0, camA: null, sx: S.x, sz: S.z, sa: S.a, ex: 0, ez: 0, ea: 0, over: false, t0: performance.now() };
  for (const k in HELD) HELD[k] = false;
  const play = mode !== 'demo'; $('hud').classList.toggle('on', play); if (play) show(null);
  const two = n === 1, mine = seat != null && seat >= 0 || mode === 'solo';
  $('bL').classList.toggle('hide', !two || !mine); $('bR').classList.toggle('hide', !two || !mine); $('bOne').classList.toggle('hide', two || !mine); if (!two && mine) $('bOne').style.setProperty('--c', PCOL[RUN.seat]);
  $('progName').textContent = S.L.name; $('goal').innerHTML = '⭐⭐⭐ до ' + fmt(S.L.par).slice(0, -2) + ' · ⭐⭐ до ' + fmt(S.L.par*1.45).slice(0, -2);
  const crew = $('crew'); crew.innerHTML = ''; if (mode === 'net' && n > 1) (names || []).forEach((nm, k) => { const d = document.createElement('div'); d.className = 'm'; d.innerHTML = '<i style="background:' + PCOL[k] + '"></i><span></span><b><u></u></b>'; d.children[1].textContent = nm + (k === seat ? ' (ты)' : ''); crew.appendChild(d); });
  const h = $('hint'); if (play && (two ? !BEST[G.LEVELS[0].id] : true)) { h.textContent = two ? 'Левая кнопка — пукает левый, и плот несёт ВПРАВО. Правая — влево. Обе сразу — прямо!' : seat >= 0 ? 'Твой человечек — ' + PNAME[seat] + '. Пукаешь один — плот крутит. Жмите вместе — летит прямо!' : 'Мест на плоту нет — смотришь заплыв. В следующий возьмут.'; h.classList.remove('hide'); RUN.hintT = 9; } else h.classList.add('hide');
}
function handle(ev) { for (const e of ev) {
    if (e.t === 'bump') { RUN.shake = Math.max(RUN.shake, 0.25 + e.f*0.5); if (RAFT) for (const c of RAFT.crew) { c.vy = 2.2 + e.f*3 + Math.random()*1.2; c.hop = Math.max(c.hop, 0.01); c.shock = 0.6; } if (RUN.kind !== 'demo' && e.f > 0.35) shout(RUN.S.x, RUN.S.z, '#ffffff', 'БДЫЩ'); if (RUN.kind !== 'demo') { SFX.bump(e.f); buzz(e.f > 0.5 ? 'heavy' : 'medium'); } for (let i = 0; i < 8; i++) emit(RUN.S.x, 0.2, RUN.S.z, (Math.random() - 0.5)*7, 2 + Math.random()*3, (Math.random() - 0.5)*7, 0.5, 0.25, 0.1, 1, 1, 1, 0.95, 0); }
    else if (e.t === 'bean') { const b = LV.L.beans[e.k]; if (b) for (let i = 0; i < 14; i++) emit(b.x, 0.6, b.z, (Math.random() - 0.5)*6, 3 + Math.random()*3, (Math.random() - 0.5)*6, 0.7, 0.3, 0.12, 1, 0.75 + Math.random()*0.2, 0.2, 1, 0); if (RUN.kind !== 'demo') { SFX.bean(); pop('🥫 ТУРБО!', true); buzz('light'); } }
    else if (e.t === 'volley') { RUN.vol = 0.35; if (RAFT) for (const c of RAFT.crew) c.cheer = 0.8; if (RUN.kind !== 'demo') { SFX.volley(); pop('ЗАЛП!'); buzz('heavy'); } }
    else if (e.t === 'finish' && RUN.kind === 'solo') finished({ lv: RUN.S.lv, time: e.time, stars: e.stars, bumps: RUN.S.bumps, volleys: RUN.S.volleys, n: 1 });
    else if (e.t === 'finish' && RUN.kind === 'demo') RUN.over = true; } }
function finished(r) {
  if (RUN) RUN.over = true; quiet(); SFX.finish(); buzz('heavy'); const L = G.LEVELS[r.lv], old = BEST[L.id], better = !old || r.time < old.t;
  if (better) { BEST[L.id] = { t: r.time, st: Math.max(r.stars, old ? old.st : 0) }; store.set('pb_best', BEST); } else if (r.stars > old.st) { old.st = r.stars; store.set('pb_best', BEST); }
  for (let i = 0; i < 90; i++) { const c = new THREE.Color().setHSL(Math.random(), 0.9, 0.6); emit(RUN.S.x + (Math.random() - 0.5)*8, 3 + Math.random()*5, RUN.S.z + (Math.random() - 0.5)*8, (Math.random() - 0.5)*5, 2 + Math.random()*5, (Math.random() - 0.5)*5, 1.6 + Math.random(), 0.3, 0.2, c.r, c.g, c.b, 1, 0); }
  $('oTitle').textContent = r.stars === 3 ? 'Вот это тяга!' : r.stars === 2 ? 'Доплыли!' : 'Дотянули…'; $('oStars').innerHTML = starsHtml(r.stars); $('oTime').textContent = fmt2(r.time);
  $('oBest').textContent = better && old ? 'Новый рекорд! Было ' + fmt2(old.t) : better ? 'Первый заплыв по этой реке' : 'Рекорд: ' + fmt2(old.t); $('oStat').innerHTML = '<span>💥 ударов: ' + r.bumps + '</span><span>💨 залпов: ' + r.volleys + '</span>';
  const net = RUN.kind === 'net', cap = !net || (NET && NET.you === NET.cap), more = r.lv < G.LEVELS.length - 1;
  $('oNext').classList.toggle('hide', !cap || !more); $('oAgain').classList.toggle('hide', !cap); $('oHome').textContent = net ? (cap ? 'На берег, выбрать реку' : 'Выйти из экипажа') : 'Меню';
  if (!cap) $('oBest').textContent += ' · ждём капитана';
  setTimeout(() => { if (RUN && RUN.over && RUN.kind !== 'demo') show('over'); }, 900); renderLevels();
}
function home() { netLeave(); show('home'); $('hud').classList.remove('on'); quiet(); renderLevels(); begin('demo', Math.floor(Math.random()*3), 2); }
function renderLevels() { const box = $('levels'); box.innerHTML = ''; G.LEVELS.forEach((d, i) => { const b = BEST[d.id], lock = i > 0 && !BEST[G.LEVELS[i - 1].id], el = document.createElement('div'); el.className = 'card lv' + (lock ? ' lock' : '');
    el.innerHTML = '<div class="n">' + (i + 1) + '</div><div class="nm">' + d.name + '</div><div class="st">' + (lock ? '🔒' : starsHtml(b ? b.st : 0)) + '</div><div class="bt">' + (lock ? 'пройди предыдущую' : b ? 'рекорд ' + fmt2(b.t) : 'ещё не пройдена') + '</div>';
    el.onclick = () => { if (lock) return toast('Сначала пройди «' + G.LEVELS[i - 1].name + '»'); audio(); begin('solo', i, 1); }; box.appendChild(el); }); }

// ---------- friends: the server runs the river, the phone shows it without waiting for the answer ----------
const qn = /[?&]name=([^&]{1,40})/.exec(location.search); if (qn) store.set('pb_gname', decodeURIComponent(qn[1]));
const initStr = () => TG ? TG.initData : HERE ? 'guest:' + (store.get('pb_gid') || (store.set('pb_gid', Math.random().toString(36).slice(2, 12).padEnd(8, 'x')), store.get('pb_gid'))) + ':' + encodeURIComponent(store.get('pb_gname') || 'Гость') : '';
function netSend(o) { if (NET && NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); }
function netLeave() { if (!NET) return; const N = NET; NET = null; clearInterval(N.ping); try { N.ws.close(); } catch (e) {} }
function netNew() { if (!initStr()) return toast('С друзьями играют в Telegram: @' + BOT, 3500); audio(); toast('Готовлю плот…', 1500);
  fetch(API + '/new', { method: 'POST', body: JSON.stringify({ init: initStr() }) }).then((r) => r.json()).then((r) => { if (r && r.ok) netJoin(r.id); else toast(r && r.err === 'auth' ? 'Открой игру через @' + BOT : 'Не получилось, попробуй ещё раз'); }).catch(() => toast('Нет связи с сервером')); }
function netJoin(room) { netLeave(); const N = NET = { room, ws: null, you: -1, cap: 0, crew: [], lv: 0, ph: 'bank', base: null, baseAt: 0, fresh: false, rtt: 120, lead: 4, log: [], lastB: -1, tries: 0, link: 'https://t.me/' + BOT + '?startapp=r_' + room, warned: false };
  const open = () => { if (NET !== N) return; const ws = N.ws = new WebSocket(API.replace(/^http/, 'ws') + '/ws?room=' + room + '&init=' + encodeURIComponent(initStr()));
    ws.onopen = () => { N.tries = 0; N.lastB = -1; N.heard = performance.now(); }; ws.onmessage = (e) => { if (NET !== N || N.ws !== ws) return; N.heard = performance.now(); let m = null; try { m = JSON.parse(e.data); } catch (err) { return; } netMsg(N, m); };
    ws.onclose = (e) => { if (NET !== N || N.ws !== ws) return; if (e.code === 4001) { toast('Игра открыта в другом окне'); return home(); } if (e.code === 4002) { toast('На этом плоту уже нет места'); return home(); }
      if (++N.tries > 8) { toast('Связь потерялась'); return home(); } toast('Связь пропала, возвращаюсь…', 1500); setTimeout(open, 700 + N.tries*400); }; };
  open(); N.reopen = open; N.ping = setInterval(() => { const ws = N.ws; if (ws && ws.readyState === 1 && performance.now() - N.heard > 5000) { N.ws = null; try { ws.close(); } catch (e) {} toast('Связь пропала, возвращаюсь…', 1500); return open(); } netSend({ t: 'p', c: performance.now() }); }, 1500); }
function netMsg(N, m) {
  if (m.t === 'q') { const r = performance.now() - m.c; N.rtt = N.rtt*0.7 + r*0.3; N.lead = clamp(N.rtt/STEP_MS + 0.6, 1, 9); }
  else if (m.t === 'room') { N.you = m.you; N.cap = m.cap; N.crew = m.crew; N.lv = m.lv; const was = N.ph; N.ph = m.ph; if (m.sv && m.sv !== VERSION && !N.warned) { N.warned = true; toast('Вышла новая версия — перезайди, когда будет удобно', 4000); }
    if (m.ph === 'bank') { if (!RUN || RUN.kind !== 'demo') begin('demo', m.lv, 2); show('room'); renderRoom(N, m); }
    else { const els = $('crew').children; m.crew.forEach((c, k) => { if (els[k]) els[k].classList.toggle('off', !c.on); }); if (m.ph === 'done' && RUN && RUN.over) finishedButtons(); } }
  else if (m.t === 'start') { begin('net', m.lv, m.n, m.names, m.seat); G.load(RUN.S, m.d); N.base = m.d; N.baseAt = performance.now(); N.fresh = false; N.log = []; N.lastB = -1; RUN.px = RUN.S.x; RUN.pz = RUN.S.z; RUN.pa = RUN.S.a; if (RUN.S.ph === 'done') RUN.over = true; }
  else if (m.t === 's') { if (!RUN || RUN.kind !== 'net') return; N.base = m.d; N.baseAt = performance.now(); N.fresh = true; if (m.e) handle(m.e); }
  else if (m.t === 'over') { if (RUN && RUN.kind === 'net') finished(m); }
  else if (m.t === 'full') toast('На этом плоту уже нет места'); }
function finishedButtons() { const cap = NET && NET.you === NET.cap; $('oNext').classList.toggle('hide', !cap || RUN.S.lv >= G.LEVELS.length - 1); $('oAgain').classList.toggle('hide', !cap); $('oHome').textContent = cap ? 'На берег, выбрать реку' : 'Выйти из экипажа'; }
function renderRoom(N, m) { const cap = m.you === m.cap, seats = $('seats'); seats.innerHTML = '';
  for (let k = 0; k < G.MAXP; k++) { const c = m.crew[k], d = document.createElement('div'); d.className = 'seat' + (c ? '' : ' free'); d.innerHTML = '<i style="background:' + PCOL[k] + '"></i><span></span>'; d.children[1].textContent = c ? c.n + (k === m.cap ? ' 👑' : '') + (k === m.you ? ' (ты)' : '') : 'свободно'; seats.appendChild(d); }
  const lv = $('rLevels'); lv.innerHTML = ''; lv.classList.toggle('ro', !cap); G.LEVELS.forEach((d, i) => { const c = document.createElement('div'); c.className = 'chip' + (i === m.lv ? ' on' : ''); c.textContent = (i + 1) + '. ' + d.name; if (cap) c.onclick = () => netSend({ t: 'lv', lv: i }); lv.appendChild(c); });
  $('rSub').textContent = m.you < 0 ? 'Мест нет — посмотришь заплыв, в следующий возьмут' : cap ? (m.crew.length < 2 ? 'Позови друзей — вместе смешнее. Можно и одному.' : 'Ты капитан: выбирай реку и отчаливай') : 'Ждём, когда капитан отчалит';
  $('rStart').classList.toggle('hide', !cap); if (m.last && m.last.time) $('rTitle').textContent = 'Экипаж · прошлый заплыв ' + fmt2(m.last.time); else $('rTitle').textContent = 'Экипаж'; }
function netInvite() { const N = NET; if (!N) return; const text = '💨 Запрыгивай на плот в «Пердёж-балдёж»!';
  const old = () => { if (TG && TG.openTelegramLink) TG.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(N.link) + '&text=' + encodeURIComponent(text)); else { const l = HERE ? location.origin + '/?room=' + N.room : N.link; (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(() => toast('Ссылка скопирована — отправь друзьям'), () => toast(l, 6000)); } };
  if (!TG || !TG.shareMessage) return old();
  fetch(API + '/share', { method: 'POST', body: JSON.stringify({ init: initStr(), room: N.room }) }).then((r) => r.json()).then((r) => { if (r && r.ok) { try { TG.shareMessage(r.id); } catch (e) { old(); } } else old(); }).catch(old); }
// where the raft is right now: start from the server's last word and play forward the time that has passed since,
// with my own presses put in at the moments I made them — so my jet answers at once, whatever the ping
function netPredict(now) { const N = NET, S = RUN.S; if (!N || !N.base) return;
  G.load(S, N.base); const f = clamp((now - N.baseAt)/STEP_MS + N.lead, 0, 14), n = Math.floor(f); let li = 0;
  while (N.log.length > 1 && (N.log[1].t - N.baseAt)/STEP_MS + N.lead <= 0) N.log.shift();
  for (let i = 0; i <= n; i++) { while (li < N.log.length && (N.log[li].t - N.baseAt)/STEP_MS + N.lead <= i) { if (RUN.seat >= 0) G.input(S, RUN.seat, N.log[li].b); li++; }
    if (i === n) { RUN.px = S.x; RUN.pz = S.z; RUN.pa = S.a; } G.step(S); }
  RUN.k = S.ph === 'done' ? 1 : f - n; }

// ---------- every frame ----------
let last = performance.now(), T = 0;
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.1, (now - last)/1000); last = now; T += dt; U.uT.value = T; if (!RUN || !LV) return R.render(scene, cam);
  const S = RUN.S, kind = RUN.kind, play = kind !== 'demo';
  if (kind === 'net') { if (!NET) return; const b = bits(); if (RUN.seat >= 0 && b !== NET.lastB) { NET.lastB = b; NET.log.push({ t: now, b }); netSend({ t: 'i', b }); } netPredict(now); }
  else { RUN.acc += dt; let guard = 0; while (RUN.acc >= G.DT && guard++ < 5) { RUN.acc -= G.DT; RUN.px = S.x; RUN.pz = S.z; RUN.pa = S.a; if (kind === 'solo') G.input(S, 0, bits()); else G.pilot(S); G.step(S); handle(S.ev); } if (guard >= 5) RUN.acc = 0; RUN.k = S.ph === 'done' ? 1 : RUN.acc/G.DT;
    if (kind === 'demo' && RUN.over && (RUN.end = (RUN.end || 0) + dt) > 2.5) { begin('demo', (S.lv + 1) % 3, 2); return; } }
  // where to draw the raft: between the last two steps, and with any correction from the server eased in
  let x = lerp(RUN.px, S.x, RUN.k), z = lerp(RUN.pz, S.z, RUN.k), a = RUN.pa + wrap(S.a - RUN.pa)*RUN.k;
  if (kind === 'net' && NET.base) { if (NET.fresh) { NET.fresh = false; const ex = RUN.sx + S.vx*dt - x, ez = RUN.sz + S.vz*dt - z, ea = wrap(RUN.sa + S.w*dt - a); if (Math.hypot(ex, ez) < 4) { RUN.ex = ex; RUN.ez = ez; RUN.ea = ea; } else RUN.ex = RUN.ez = RUN.ea = 0; }
    const kk = Math.exp(-dt*9); RUN.ex *= kk; RUN.ez *= kk; RUN.ea *= kk; x += RUN.ex; z += RUN.ez; a += RUN.ea; }
  RUN.sx = x; RUN.sz = z; RUN.sa = a;
  const tm = S.tm - (1 - RUN.k)*G.DT, fx = Math.cos(a), fz = Math.sin(a), rx = -fz, rz = fx, hot = S.turbo > 0, vol = S.volley > 0, sp = Math.hypot(S.vx, S.vz);
  // countdown
  const cnt = S.tm < 0 ? Math.ceil(-S.tm) : 0; if (cnt !== RUN.cnt) { if (play) { if (cnt > 0) { pop(String(cnt)); SFX.count(); } else if (RUN.cnt === 1) { pop('ПОПЁРЛИ!', true); SFX.go(); } } RUN.cnt = cnt; }
  // raft
  const g = RAFT.g, bob = Math.sin(T*2.3)*0.035; g.position.set(x, 0, z); g.rotation.y = -a; RAFT.b.position.y = 0.06 + bob; RAFT.b.rotation.x = Math.sin(T*1.7)*0.03 + clamp(S.w*0.07, -0.2, 0.2); RAFT.b.rotation.z = Math.sin(T*2.1 + 1)*0.025 + (vol || hot ? 0.07 : 0);
  RAFT.flag.rotation.y = Math.sin(T*9)*0.25*clamp(sp/5, 0.2, 1);
  S.jets.forEach((j, k) => { const c = RAFT.crew[k]; if (!c) return; const fire = j.fire && S.ph === 'run'; if (RUN.over) c.party = true;
    if (guyStep(c, j, S.ph === 'run', dt, fire) && play) shout(x - fx*1.5 + rx*c.off*0.82, z - fz*1.5 + rz*c.off*0.82, PCOL[k]);
    if (play) fartSound(k, fire, j.g, hot || vol);
    if (fire) { c.puffAcc += dt*(vol ? 70 : hot ? 55 : 34); while (c.puffAcc >= 1) { c.puffAcc -= 1; const jx = x - fx*(1.45 + c.c.position.x + 0.78) + rx*c.off*0.82, jz = z - fz*(1.45 + c.c.position.x + 0.78) + rz*c.off*0.82, v = 4 + Math.random()*3, sx = (Math.random() - 0.5)*2.2, big = vol ? 1.5 : 1;
          const col = hot ? [1, 0.62 + Math.random()*0.2, 0.2] : [0.72 + Math.random()*0.12, 0.88, 0.25 + Math.random()*0.12];
          emit(jx, 0.6 + Math.random()*0.25, jz, -fx*v + rx*sx + S.vx*0.5, 0.5 + Math.random()*0.9, -fz*v + rz*sx + S.vz*0.5, 0.75 + Math.random()*0.5, 0.25*big, (0.95 + Math.random()*0.6)*big, col[0], col[1], col[2], 0.92); } } });
  if (sp > 2.5 && Math.random() < dt*sp*2.2) emit(x - fx*1.2 + rx*(Math.random() - 0.5)*2, 0.06, z - fz*1.2 + rz*(Math.random() - 0.5)*2, 0, 0, 0, 0.9, 0.2, 0.55, 1, 1, 1, 0.6);
  puffStep(dt); shoutStep(dt);
  // the river's moving parts
  for (const l of LV.logs) l.m.rotation.y = -(l.o.ph + l.o.sp*Math.max(0, tm));
  LV.beans.forEach((b, k) => { const on = !S.beans[k]; b.c.visible = b.ring.visible = on; if (on) { b.c.position.y = 0.5 + Math.sin(T*3 + k)*0.1; b.c.rotation.y = T*1.6 + k; const s = 1 + Math.sin(T*4 + k)*0.12; b.ring.scale.set(s, s, 1); } });
  LV.rings.forEach((r, k) => { const s = 1 + Math.sin(T*2.4 + k*1.7)*0.06; r.scale.set(s, s, 1); });
  // camera: behind the raft, looking down the river
  const loc = G.locate(LV.L, x, z, S.hint), P = LV.L.P, j2 = Math.min(P.length - 1, loc.i + 5), want = j2 > loc.i + 1 ? Math.atan2(P[j2].z - P[loc.i].z, P[j2].x - P[loc.i].x) : Math.atan2(loc.tz, loc.tx);
  RUN.camA = RUN.camA == null ? want : RUN.camA + wrap(want - RUN.camA)*Math.min(1, dt*2.2);
  const orbit = play ? 0 : Math.sin(T*0.25)*0.5, ca = RUN.camA + orbit, cx = Math.cos(ca), cz = Math.sin(ca), back = CAMD*(play ? 0.5 : 0.62), up = CAMD*(play ? 0.86 : 0.7);
  RUN.shake *= Math.exp(-dt*7); const shx = (Math.random() - 0.5)*RUN.shake, shz = (Math.random() - 0.5)*RUN.shake;
  cam.position.set(x - cx*back + shx, up, z - cz*back + shz); cam.lookAt(x + cx*CAMD*0.17 + shx, 0, z + cz*CAMD*0.17 + shz);
  // the panel
  if (play) { $('hTime').textContent = fmt(S.ph === 'done' ? S.time : S.tm); const pr = clamp(S.s/LV.L.len, 0, 1)*100; $('progFill').style.width = pr + '%'; $('progRaft').style.left = clamp(pr, 5, 92) + '%';
    const two = S.n === 1, mine = (k) => two ? k : RUN.seat; const btn = (el, k) => { const j = S.jets[k]; if (!j) return; el.style.setProperty('--g', Math.round(j.g*100)); el.classList.toggle('on', j.fire); el.classList.toggle('dry', j.on && !j.fire && S.ph === 'run'); };
    if (two) { btn($('bL'), 0); btn($('bR'), 1); } else if (RUN.seat >= 0) btn($('bOne'), mine()); const els = $('crew').children; for (let k = 0; k < els.length; k++) els[k].querySelector('u').style.width = Math.round(S.jets[k].g*100) + '%';
    if (RUN.hintT > 0 && (RUN.hintT -= dt) <= 0) $('hint').classList.add('hide'); }
  R.render(scene, cam);
}

// ---------- hands ----------
function hold(el, key) { const down = (e) => { e.preventDefault(); audio(); HELD[key] = true; try { el.setPointerCapture(e.pointerId); } catch (err) {} }, up = (e) => { e.preventDefault(); HELD[key] = false; };
  el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up); el.addEventListener('contextmenu', (e) => e.preventDefault()); }
hold($('bL'), 'L'); hold($('bR'), 'R'); hold($('bOne'), 'O');
const KEY = { KeyA: 'kl', ArrowLeft: 'kl', KeyD: 'kr', ArrowRight: 'kr', KeyW: 'kb', ArrowUp: 'kb', Space: 'kb' };
addEventListener('keydown', (e) => { const k = KEY[e.code]; if (k) { e.preventDefault(); audio(); HELD[k] = true; } else if (e.code === 'KeyR' && RUN && RUN.kind === 'solo') begin('solo', RUN.S.lv, 1); else if (e.code === 'Escape' && RUN && RUN.kind === 'solo') home(); });
addEventListener('keyup', (e) => { const k = KEY[e.code]; if (k) HELD[k] = false; });
addEventListener('blur', () => { for (const k in HELD) HELD[k] = false; });
$('mute').onclick = () => { audio(); setMute(!MUTE); };
$('quit').onclick = () => home();
$('goFriends').onclick = () => netNew();
$('oNext').onclick = () => { if (RUN.kind === 'net') netSend({ t: 'go', lv: RUN.S.lv + 1 }); else begin('solo', Math.min(G.LEVELS.length - 1, RUN.S.lv + 1), 1); };
$('oAgain').onclick = () => { if (RUN.kind === 'net') netSend({ t: 'again' }); else begin('solo', RUN.S.lv, 1); };
$('oHome').onclick = () => { if (RUN.kind === 'net' && NET && NET.you === NET.cap) netSend({ t: 'bank' }); else home(); };
$('rStart').onclick = () => { audio(); netSend({ t: 'go' }); };
$('rInvite').onclick = () => netInvite();
$('rLeave').onclick = () => home();
$('ver').textContent = 'v' + VERSION;
addEventListener('pointerdown', () => audio(), { once: true });

renderLevels(); begin('demo', 0, 2); requestAnimationFrame(frame);
const sp = (TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || '', rm = /^r_([a-z0-9]{6,12})$/.exec(sp) || /[?&]room=([a-z0-9]{6,12})/.exec(location.search); if (rm && initStr()) netJoin(rm[1]);
window.__pb = { get RUN() { return RUN; }, get NET() { return NET; }, G, begin, HELD, get LV() { return LV; } };
