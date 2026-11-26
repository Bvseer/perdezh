// Пердёж-балдёж — what you see and touch. The rules of the river live in sim.js (the server runs the same file).
import * as THREE from 'three';
import * as G from './sim.js?v=0.6';

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
const HEMI = new THREE.HemisphereLight(0xffffff, 0x9ad07a, 2.3); scene.add(HEMI); const sun = new THREE.DirectionalLight(0xfff1cf, 1.9); sun.position.set(-30, 60, 25); scene.add(sun);
const U = { uT: { value: 0 } }, PU = { uScale: { value: 500 } };
let CAMD = 22, FOV0 = 60, DPR = Math.min(window.devicePixelRatio || 1, 2);
function resize() { const w = innerWidth, h = innerHeight; R.setPixelRatio(DPR); R.setSize(w, h, false); cam.aspect = w/h; FOV0 = cam.fov = w < h ? 62 : 46; cam.updateProjectionMatrix();
  const th = Math.tan(cam.fov*Math.PI/360); CAMD = clamp(6.1/(th*cam.aspect), 18, 24); PU.uScale.value = h*DPR/(2*th); }
addEventListener('resize', resize); resize();

const lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, o || {}));
const MAT = { wood: lam('#b67a45'), wood2: lam('#9c6234'), dark: lam('#6b4423'), cut: lam('#e2b77c'), rock: lam('#9a9ca6'), rock2: lam('#b9bbc4'), skin: lam('#ffd7ae'), jeans: lam('#3c5a9a'), black: lam('#222'), white: lam('#ffffff'),
  reed: lam('#7a9a3a'), hay: lam('#e8c858'), can: lam('#d8392c'), label: lam('#fff1c9'), tin: lam('#c9ced6'), tree: lam('#ffffff'), red: lam('#e9453a'), flag: lam('#ff5a4f', { side: THREE.DoubleSide }) };
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
const GEO = { cylU: new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0), boxU: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), half: new THREE.SphereGeometry(1, 14, 7, 0, Math.PI*2, 0, Math.PI/2), pyr: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI/4).translate(0, 0.5, 0), ico: new THREE.IcosahedronGeometry(1, 0), ico1: new THREE.IcosahedronGeometry(1, 1), cone: new THREE.ConeGeometry(1, 2, 7).translate(0, 1, 0), trunk: new THREE.CylinderGeometry(0.16, 0.24, 1, 6).translate(0, 0.5, 0), circle: new THREE.CircleGeometry(1, 40) };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0)/4294967296; }; }
const SHARED = new Set();
function insts(geo, mat, list) { const m = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((t, i) => { Q4.setFromAxisAngle(UP, t.r || 0); M4.compose(V3.set(t.x, t.y || 0, t.z), Q4, S3.set(t.sx, t.sy, t.sz)); m.setMatrixAt(i, M4); if (t.c) m.setColorAt(i, t.c); }); m.frustumCulled = false; return m; }
const flat = (m) => { m.rotation.x = -Math.PI/2; return m; };

// ---------- what is in the river: one small model per kind of thing ----------
const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x || 0, y || 0, z || 0); return m; };
const cyl = (r0, r1, h, n, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, n), mat); m.position.set(x || 0, y || 0, z || 0); return m; };
const face = (g, dx, dz) => { g.rotation.y = -Math.atan2(dz, dx); return g; };   // turn the model's own +x to point along (dx, dz)
const basic = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
function canvasTex(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
const FLAG = new THREE.BufferGeometry(); FLAG.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0.55, 0, -0.8, 0.27, 0]), 3)); FLAG.computeVertexNormals();
const CONE = new THREE.ConeGeometry(1, 1, 6); SHARED.add(CONE); SHARED.add(FLAG);
let XMAT = null;
function xmat() { if (XMAT) return XMAT; return XMAT = { croc: lam('#2f9e44'), croc2: lam('#237a35'), belly: lam('#d8e8a0'), gold: new THREE.MeshLambertMaterial({ color: '#ffcf33', emissive: '#7a5200' }), goldIn: lam('#a8760a'), yel: lam('#ffcf33'), lily: basic('#3f9a3a'), pink: lam('#ff8ab8'), steel: new THREE.MeshLambertMaterial({ color: '#dfe5ee' }), spike: lam('#4a3a66'), tip: lam('#ff5a6e'), iron: lam('#6f7787'), mouth: lam('#ff8a9a'),
    vent: basic('#0e5a94', { transparent: true, opacity: 0.5, depthWrite: false }), column: basic('#eafaff', { transparent: true, opacity: 0.82, depthWrite: false }),
    gate: new THREE.MeshLambertMaterial({ map: canvasTex(256, 16, (c) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#fff' : '#e9453a'; c.fillRect(i*16, 0, 16, 16); } }) }),
    ramp: new THREE.MeshLambertMaterial({ map: canvasTex(128, 128, (c) => { c.fillStyle = '#c98d52'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#9c6234'; c.lineWidth = 2; for (let y = 0; y < 128; y += 21) { c.beginPath(); c.moveTo(0, y); c.lineTo(128, y); c.stroke(); } c.strokeStyle = '#ffd23a'; c.lineWidth = 12; c.lineJoin = 'miter'; for (const x of [18, 58, 98]) { c.beginPath(); c.moveTo(x, 20); c.lineTo(x + 22, 64); c.lineTo(x, 108); c.stroke(); } }) }),
    mud: new THREE.ShaderMaterial({ uniforms: { uT: U.uT }, transparent: true, depthWrite: false, vertexShader: 'varying vec2 vU; void main(){ vU = uv*2.0-1.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'precision highp float; uniform float uT; varying vec2 vU; void main(){ float a = atan(vU.y, vU.x), d = length(vU) + 0.07*sin(a*5.0 + uT*0.7) + 0.05*sin(a*9.0 - uT); if (d > 1.0) discard; float n = sin(vU.x*9.0 + uT*0.6)*sin(vU.y*8.0 - uT*0.4); vec3 c = mix(vec3(0.36,0.50,0.20), vec3(0.50,0.64,0.26), smoothstep(-0.3, 0.6, n)); gl_FragColor = vec4(c, 0.93*(1.0 - smoothstep(0.86, 1.0, d))); }' }),
    oil: new THREE.ShaderMaterial({ uniforms: { uT: U.uT }, transparent: true, depthWrite: false, vertexShader: 'varying vec2 vU; void main(){ vU = uv*2.0-1.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'precision highp float; uniform float uT; varying vec2 vU; void main(){ float a = atan(vU.y, vU.x), d = length(vU) + 0.09*sin(a*4.0 - uT*0.5) + 0.04*sin(a*7.0 + uT*0.8); if (d > 1.0) discard; float k = sin(d*9.0 - uT*1.2 + sin(a*3.0)*1.5); vec3 c = mix(vec3(0.12,0.08,0.20), vec3(0.20,0.55,0.60), smoothstep(0.2, 0.9, k)); c = mix(c, vec3(0.80,0.35,0.75), smoothstep(0.75, 1.0, sin(d*14.0 + a*2.0 + uT))*0.6); gl_FragColor = vec4(c, 0.8*(1.0 - smoothstep(0.85, 1.0, d))); }' }) }; }
const frac = (v) => v - Math.floor(v);
// a crocodile: long snout full of teeth, eyes on top, a ridged back, four legs and a tail that swings in four pieces
function crocModel(X) {
  const c = new THREE.Group(), body = new THREE.Group(), G1 = X.croc, G2 = X.croc2, B = X.belly; c.add(body); body.scale.setScalar(1.02);
  body.add(ball(G1, 1, 0.35, 0.16, 0, 0.62, 0.3, 0.5), ball(G1, 1, -0.3, 0.17, 0, 0.78, 0.34, 0.6), ball(G1, 1, -0.95, 0.15, 0, 0.58, 0.28, 0.46), ball(B, 1, -0.25, 0.05, 0, 1.2, 0.24, 0.5));
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) { const sc = new THREE.Mesh(CONE, G2); sc.scale.set(0.09, 0.2, 0.09); sc.position.set(0.6 - i*0.27, 0.5 - Math.abs(i - 3)*0.02, s*0.17); body.add(sc); }
  const legs = []; for (const [x, s] of [[0.45, 1], [0.45, -1], [-0.9, 1], [-0.9, -1]]) { const lg = new THREE.Group(); lg.position.set(x, 0.1, s*0.4); const up = cyl(0.11, 0.09, 0.44, 6, G2, 0, 0, s*0.2); up.rotation.x = s*Math.PI/2*0.85; lg.add(up, ball(G2, 0.15, 0.08, -0.04, s*0.45, 1.5, 0.45, 1.1)); body.add(lg); legs.push(lg); }
  const tail = [], R = [0.3, 0.22, 0.15, 0.085, 0.02]; let parent = body;
  for (let i = 0; i < 4; i++) { const t = new THREE.Group(); t.position.set(i === 0 ? -1.4 : -0.56, i === 0 ? 0.15 : 0, 0); const seg = cyl(R[i + 1], R[i], 0.62, 8, i % 2 ? G2 : G1, -0.29, 0, 0); seg.rotation.z = Math.PI/2; seg.scale.x = 0.85; const sc = new THREE.Mesh(CONE, G2); sc.scale.set(0.07, 0.2 - i*0.03, 0.07); sc.position.set(-0.3, R[i]*0.8, 0); t.add(seg, sc); parent.add(t); parent = t; tail.push(t); }
  const head = new THREE.Group(); head.position.set(0.9, 0.16, 0); head.add(ball(G1, 1, 0, 0.02, 0, 0.36, 0.26, 0.4));
  const low = cyl(0.11, 0.27, 1.05, 10, B, 0.55, -0.1, 0); low.rotation.z = -Math.PI/2; low.scale.x = 0.32; head.add(low, box(0.85, 0.02, 0.3, X.mouth, 0.5, -0.045, 0));
  const jaw = new THREE.Group(); jaw.position.set(0.02, 0.0, 0); const upJ = cyl(0.13, 0.3, 1.1, 10, G1, 0.57, 0.07, 0); upJ.rotation.z = -Math.PI/2; upJ.scale.x = 0.42; jaw.add(upJ, ball(G1, 0.17, 1.1, 0.09, 0, 1, 0.6, 1.1), ball(G2, 0.045, 1.15, 0.17, 0.07), ball(G2, 0.045, 1.15, 0.17, -0.07));
  for (const s of [-1, 1]) { jaw.add(ball(G1, 0.13, 0.12, 0.2, s*0.2), ball(X.yel, 0.085, 0.16, 0.25, s*0.23), ball(MAT.black, 0.045, 0.2, 0.26, s*0.26, 0.5, 1.2, 0.5));
    for (let i = 0; i < 6; i++) { const tu = new THREE.Mesh(CONE, MAT.white); tu.scale.set(0.035, 0.12, 0.035); tu.rotation.x = Math.PI; tu.position.set(0.32 + i*0.14, 0.0, s*(0.25 - i*0.022)); jaw.add(tu); const tl = new THREE.Mesh(CONE, MAT.white); tl.scale.set(0.03, 0.1, 0.03); tl.position.set(0.38 + i*0.13, -0.04, s*(0.22 - i*0.02)); head.add(tl); } }
  head.add(jaw); body.add(head);
  const wk = flat(new THREE.Mesh(new THREE.RingGeometry(1.5, 1.72, 24), foamMat)); wk.scale.set(1.5, 0.65, 1); wk.position.set(-0.3, -0.02, 0); c.add(wk);
  return { c, body, tail, jaw, legs, head };
}
function buildThings(L, g, rnd, Tm) {
  const X = xmat(), K = { upd: [], bumps: [] };
  let curY = 0; const sandM = lam(Tm.sand), grassM = lam(Tm.top[0]), stoneM = lam(Tm.rockHue || '#9a9ca6');
  const ring = (x, z, r0, r1) => { const m = flat(new THREE.Mesh(new THREE.RingGeometry(r0, r1, 22), foamMat)); m.position.set(x, 0.03 + curY, z); g.add(m); return m; };
  const disc = (mat, x, z, r, y) => { const m = flat(new THREE.Mesh(GEO.circle, mat)); m.scale.setScalar(r); m.position.set(x, y + curY, z); g.add(m); return m; };
  const near = (S, o) => Math.abs(o.s - S.s) < 45;
  let cpN = 0;
  for (const o of L.all) { const t = o.t, ph = rnd()*6, Y = G.elev(L, o.s), add = (...ms) => { for (const m of ms) { m.position.y += Y; g.add(m); } }; curY = Y;
    if (t === 'rock') { const m = new THREE.Mesh(GEO.ico, rnd() < 0.5 ? MAT.rock : MAT.rock2); m.scale.set(o.r*1.02, o.r*(0.6 + rnd()*0.35), o.r*1.02); m.position.set(o.x, o.r*0.12, o.z); m.rotation.y = ph; add(m); const rg = ring(o.x, o.z, o.r*0.95, o.r*1.22); K.upd.push(() => { const s = 1 + Math.sin(T*2.4 + ph)*0.06; rg.scale.set(s, s, 1); }); }
    else if (t === 'bump') { const b = new THREE.Group(); b.position.set(o.x, 0, o.z); const band = new THREE.Mesh(new THREE.TorusGeometry(o.r*0.92, o.r*0.15, 6, 18), MAT.white); band.rotation.x = Math.PI/2; band.position.y = o.r*0.3;
      b.add(ball(MAT.red, o.r, 0, o.r*0.25, 0, 1, 0.85, 1), band, cyl(0.06, 0.06, 0.8, 6, MAT.dark, 0, o.r*1.2, 0), ball(X.yel, 0.17, 0, o.r*1.2 + 0.45, 0)); add(b); ring(o.x, o.z, o.r*1.0, o.r*1.25); const rec = { o, sq: 0 }; K.bumps.push(rec);
      K.upd.push((tm, S, dt) => { rec.sq = Math.max(0, rec.sq - dt*2.5); const q = Math.sin(rec.sq*20)*rec.sq*0.4; b.scale.set(1 + q, 1 - q, 1 + q); b.rotation.z = Math.sin(T*1.8 + ph)*0.08; }); }
    else if (t === 'wall') { const len = Math.hypot(o.x1 - o.x0, o.z1 - o.z0), w = face(new THREE.Group(), o.x1 - o.x0, o.z1 - o.z0), n = Math.max(1, Math.round(len/1.3)); w.position.set((o.x0 + o.x1)/2, 0, (o.z0 + o.z1)/2);
      w.add(box(len, 1.0, 0.42, MAT.wood2, 0, 0.45, 0), box(len, 0.16, 0.52, MAT.dark, 0, 0.98, 0)); for (let i = 0; i <= n; i++) w.add(cyl(0.2, 0.24, 1.7, 7, MAT.dark, -len/2 + len*i/n, 0.7, 0)); add(w); }
    else if (t === 'reef') { const len = Math.hypot(o.x1 - o.x0, o.z1 - o.z0), n = Math.max(2, Math.round(len/0.8)); for (let i = 0; i < n; i++) { const u = (i + 0.5)/n, r = 0.42 + rnd()*0.3, m = new THREE.Mesh(GEO.ico, rnd() < 0.5 ? MAT.rock : MAT.rock2); m.scale.set(r, r*0.55, r); m.position.set(lerp(o.x0, o.x1, u), 0.06, lerp(o.z0, o.z1, u)); m.rotation.y = rnd()*6; add(m); }
      const f = face(new THREE.Group(), o.x1 - o.x0, o.z1 - o.z0); f.position.set((o.x0 + o.x1)/2, 0.028, (o.z0 + o.z1)/2); const pl = flat(new THREE.Mesh(new THREE.PlaneGeometry(len + 0.6, 1.7), foamMat)); f.add(pl); add(f); }
    else if (t === 'log') { const lg = new THREE.Group(); lg.position.set(o.x, 0.22, o.z); const body = cyl(0.42, 0.42, o.hl*2, 9, MAT.wood); body.rotation.z = Math.PI/2; lg.add(body);
      for (const s of [-1, 1]) { const cap = cyl(0.36, 0.36, 0.06, 9, MAT.cut, s*(o.hl + 0.01)); cap.rotation.z = Math.PI/2; lg.add(cap); } lg.add(cyl(0.5, 0.56, 1.0, 8, MAT.dark, 0, 0.3, 0), cyl(0.4, 0.4, 0.06, 8, MAT.cut, 0, 0.82, 0)); add(lg);
      K.upd.push((tm) => { lg.rotation.y = -(o.ph + o.sp*Math.max(0, tm)); }); }
    else if (t === 'croc') { const cm = crocModel(X); add(cm.c);
      K.upd.push((tm) => { const p = G.where(o, Math.max(0, tm)), sp = Math.hypot(p[2], p[3]); cm.c.position.set(p[0], Y + 0.04 + Math.sin(T*3 + ph)*0.04, p[1]); if (sp > 0.15) face(cm.c, p[2], p[3]); const sw = 0.5 + Math.min(1, sp/3); cm.body.rotation.y = Math.sin(T*5 + ph)*0.1*sw; cm.tail.forEach((tl, q) => { tl.rotation.y = Math.sin(T*5 + ph - 0.9 - q*0.8)*0.38*sw; });
        cm.jaw.rotation.z = Math.max(0, Math.sin(T*2.6 + ph))*0.55; cm.legs.forEach((lg, q) => { lg.rotation.y = Math.sin(T*5 + ph + q*1.6)*0.35; }); }); }
    else if (t === 'saw') { const len = Math.abs(o.l1 - o.l0), mid = (o.l0 + o.l1)/2, rail = face(new THREE.Group(), o.rx, o.rz); rail.position.set(o.cx + o.rx*mid, 0, o.cz + o.rz*mid); rail.add(box(len + 2.2, 0.14, 0.22, MAT.dark, 0, 0.07, 0), cyl(0.2, 0.2, 0.5, 6, MAT.dark, -len/2 - 1.1, 0.2, 0), cyl(0.2, 0.2, 0.5, 6, MAT.dark, len/2 + 1.1, 0.2, 0)); add(rail);
      const sg = face(new THREE.Group(), o.rx, o.rz), blade = new THREE.Group(); blade.add(cyl(1.0, 1.0, 0.08, 22, X.steel), cyl(0.3, 0.3, 0.16, 8, MAT.red)); for (let i = 0; i < 10; i++) { const a = i*Math.PI/5, tt = box(0.32, 0.08, 0.32, X.steel, Math.cos(a)*1.0, 0, Math.sin(a)*1.0); tt.rotation.y = -a + Math.PI/4; blade.add(tt); }
      blade.rotation.x = Math.PI/2; blade.position.y = 0.4; sg.add(blade, cyl(0.14, 0.14, 0.5, 6, MAT.dark, 0, 0.2, 0)); add(sg);
      K.upd.push((tm, S, dt) => { const p = G.where(o, Math.max(0, tm)); sg.position.set(p[0], Y, p[1]); blade.rotation.y -= dt*22; if (near(S, o) && Math.random() < dt*10) emit(p[0], 0.15, p[1], (Math.random() - 0.5)*3, 2 + Math.random()*2, (Math.random() - 0.5)*3, 0.4, 0.14, 0.05, 1, 1, 1, 0.9, 0); }); }
    else if (t === 'ball') { const bx = o.cx + o.rx*o.dir*(o.w + 1.9), bz = o.cz + o.rz*o.dir*(o.w + 1.9), cg = face(new THREE.Group(), -o.dir*o.rx, -o.dir*o.rz); cg.position.set(bx, 0, bz);
      const brl = new THREE.Group(), tube = cyl(0.4, 0.5, 1.8, 10, MAT.black, 0.5, 0, 0); tube.rotation.z = -Math.PI/2; brl.add(tube, cyl(0.46, 0.46, 0.2, 10, MAT.dark, 1.35, 0, 0)); brl.children[1].rotation.z = -Math.PI/2; brl.position.y = 0.85; brl.rotation.z = 0.12; cg.add(brl, box(1.3, 0.3, 1.0, MAT.wood2, 0, 0.4, 0));
      for (const s of [-1, 1]) { const wh = cyl(0.48, 0.48, 0.16, 10, MAT.dark, 0, 0.48, s*0.6); wh.rotation.x = Math.PI/2; cg.add(wh); } add(cg); const bm = ball(MAT.black, 0.55, 0, -5, 0); add(bm); const rec = { prev: 9 };
      K.upd.push((tm, S, dt) => { const tt = Math.max(0, tm), p = G.where(o, tt), fr = frac(tt/o.per + o.ph); bm.visible = p[4] && tm >= 0; bm.position.set(p[0], Y + 0.55, p[1]); bm.rotation.x += dt*6; if (fr < rec.prev && tm > 0 && near(S, o)) { rec.kick = 1; for (let i = 0; i < 10; i++) emit(bx - o.dir*o.rx*1.6, 1, bz - o.dir*o.rz*1.6, -o.dir*o.rx*(2 + Math.random()*3) + (Math.random() - 0.5)*2, 0.5 + Math.random()*1.5, -o.dir*o.rz*(2 + Math.random()*3) + (Math.random() - 0.5)*2, 0.8, 0.4, 1.2, 0.75, 0.75, 0.75, 0.85); if (Math.abs(o.s - S.s) < 22) K.bang = true; }
        rec.prev = fr; rec.kick = Math.max(0, (rec.kick || 0) - dt*4); brl.position.x = -rec.kick*0.4; }); }
    else if (t === 'barge') { const bg = face(new THREE.Group(), o.tx, o.tz); bg.add(box(o.hl*2 + 1.2, 0.6, 1.5, MAT.wood, 0, 0.2, 0), box(o.hl*2 + 1.3, 0.1, 1.6, MAT.dark, 0, 0.52, 0), box(1.3, 0.8, 1.0, MAT.white, -o.hl*0.45, 0.95, 0), box(1.5, 0.12, 1.2, MAT.red, -o.hl*0.45, 1.4, 0), cyl(0.16, 0.2, 0.7, 8, MAT.red, o.hl*0.5, 0.9, 0), box(0.5, 0.4, 0.5, MAT.cut, o.hl*0.1, 0.75, 0.3)); add(bg);
      K.upd.push((tm, S, dt) => { const p = G.where(o, Math.max(0, tm)); bg.position.set(p[0], Y + Math.sin(T*2 + ph)*0.03, p[1]); if (near(S, o) && Math.random() < dt*5) emit(p[0] + o.tx*o.hl*0.5, 1.4, p[1] + o.tz*o.hl*0.5, 0, 1.5, 0, 1.2, 0.2, 0.8, 0.85, 0.85, 0.85, 0.6); }); }
    else if (t === 'mine') { const mg = new THREE.Group(); mg.position.set(o.x, 0.22, o.z); mg.add(ball(MAT.black, 0.5, 0, 0, 0)); for (let i = 0; i < 9; i++) { const sp = new THREE.Mesh(CONE, MAT.dark), a = i*Math.PI/4, top = i === 8; sp.scale.set(0.1, 0.34, 0.1); sp.position.set(top ? 0 : Math.cos(a)*0.55, top ? 0.55 : 0.1, top ? 0 : Math.sin(a)*0.55); if (!top) { sp.rotation.z = -Math.PI/2; sp.rotation.y = -a; } mg.add(sp); }
      const lamp = new THREE.Mesh(SPH, basic('#ff2a2a')); lamp.scale.setScalar(0.13); lamp.position.set(0.25, 0.42, 0.1); mg.add(lamp); add(mg); const rg = ring(o.x, o.z, 0.7, 0.9);
      K.upd.push((tm, S) => { const on = !S.mines[o.k]; mg.visible = rg.visible = on; if (on) { mg.position.y = Y + 0.2 + Math.sin(T*2.2 + ph)*0.07; mg.rotation.z = Math.sin(T*1.6 + ph)*0.12; lamp.visible = Math.sin(T*9 + ph) > 0; } }); }
    else if (t === 'gate') { const gg = face(new THREE.Group(), o.rx, o.rz); gg.position.set(o.cx, 0, o.cz); const beam = box(2*o.w + 0.5, 0.42, 0.42, X.gate, 0, 0.35, 0), lm = basic('#ff3b30'); gg.add(beam);
      for (const s of [-1, 1]) gg.add(cyl(0.26, 0.32, 3.6, 8, MAT.dark, s*(o.w + 0.5), 1.8, 0), ball(lm, 0.3, s*(o.w + 0.5), 3.85, 0)); add(gg);
      K.upd.push((tm, S, dt) => { const tt = Math.max(0, tm), open = G.gateOpen(o, tt), fr = frac(tt/o.per + o.ph), warn = open && fr > o.open - 0.7/o.per; beam.position.y += ((open ? 3.1 : 0.35) - beam.position.y)*Math.min(1, dt*10); lm.color.set(warn ? (Math.sin(T*22) > 0 ? '#ffd23a' : '#6b5200') : open ? '#39d353' : '#ff3b30'); }); }
    else if (t === 'pool') disc(poolMat, o.x, o.z, o.r, 0.025);
    else if (t === 'flow') { const h = face(new THREE.Group(), o.fx, o.fz); h.position.set(o.x, 0.022, o.z); const m = flat(new THREE.Mesh(GEO.circle, rapidMat)); m.scale.setScalar(o.r); h.add(m); add(h); }
    else if (t === 'mud') { disc(X.mud, o.x, o.z, o.r, 0.024); for (let i = 0; i < 4; i++) { const a = rnd()*6.3, d = rnd()*o.r*0.65, r = 0.35 + rnd()*0.3, px = o.x + Math.cos(a)*d, pz = o.z + Math.sin(a)*d; const pad = flat(new THREE.Mesh(new THREE.CircleGeometry(r, 12, 0.5, 5.6), X.lily)); pad.position.set(px, 0.04, pz); pad.rotation.z = rnd()*6; add(pad); if (i % 2 === 0) add(ball(X.pink, 0.13, px, 0.12, pz)); } }
    else if (t === 'oil') disc(X.oil, o.x, o.z, o.r, 0.024);
    else if (t === 'geyser') { disc(X.vent, o.x, o.z, o.r*0.85, 0.024); const rg = ring(o.x, o.z, o.r*0.8, o.r*1.0), col = cyl(0.55, 1, 1, 12, X.column); col.visible = false; add(col);
      K.upd.push((tm, S, dt) => { const p = G.geyserAt(o, Math.max(0, tm)), blow = p < 0.14 && tm >= 0, warn = p > 0.72, nr = near(S, o); col.visible = blow;
        if (blow) { const h = 3.4*Math.sin(Math.PI*p/0.14) + 0.4; col.scale.set(o.r*0.8, h, o.r*0.8); col.position.set(o.x, Y + h/2, o.z); if (nr) for (let i = 0; i < 2; i++) emit(o.x + (Math.random() - 0.5)*o.r, h, o.z + (Math.random() - 0.5)*o.r, (Math.random() - 0.5)*5, 2 + Math.random()*4, (Math.random() - 0.5)*5, 0.7, 0.3, 0.12, 0.92, 0.98, 1, 0.9, 0); }
        const s = warn ? 1 + 0.2*Math.sin(T*26) : 1; rg.scale.set(s, s, 1); if (warn && nr && Math.random() < dt*22) emit(o.x + (Math.random() - 0.5)*o.r*1.4, 0.1, o.z + (Math.random() - 0.5)*o.r*1.4, 0, 1.6, 0, 0.45, 0.12, 0.34, 1, 1, 1, 0.85); }); }
    else if (t === 'ramp') { const rg = face(new THREE.Group(), o.tx, o.tz), tl = new THREE.Group(); rg.position.set(o.x, 0, o.z); tl.position.set(-1.7, 0.05, 0); tl.rotation.z = 0.3; tl.add(box(3.4, 0.14, 3.0, X.ramp, 1.7, 0, 0), box(3.4, 0.2, 0.16, MAT.dark, 1.7, -0.02, 1.5), box(3.4, 0.2, 0.16, MAT.dark, 1.7, -0.02, -1.5)); rg.add(tl, cyl(0.16, 0.16, 1.0, 6, MAT.dark, 1.3, 0.35, 1.3), cyl(0.16, 0.16, 1.0, 6, MAT.dark, 1.3, 0.35, -1.3)); add(rg); }
    else if (t === 'spike') { const sg = new THREE.Group(); sg.position.set(o.x, 0.25, o.z); sg.add(ball(X.spike, o.r*0.72, 0, 0, 0)); const n = 16, dir = new THREE.Vector3(); for (let q = 0; q < n; q++) { const sp = new THREE.Mesh(CONE, X.tip), yy = 1 - 2*(q + 0.5)/n, rr = Math.sqrt(1 - yy*yy), a = q*2.4; dir.set(Math.cos(a)*rr, yy*0.8 + 0.3, Math.sin(a)*rr).normalize(); sp.scale.set(o.r*0.2, o.r*0.62, o.r*0.2); sp.position.copy(dir).multiplyScalar(o.r*0.9); sp.quaternion.setFromUnitVectors(UP, dir); sg.add(sp); }
      add(sg); ring(o.x, o.z, o.r*0.95, o.r*1.2); K.upd.push(() => { sg.position.y = Y + 0.25 + Math.sin(T*2 + ph)*0.08; sg.rotation.y = T*0.8 + ph; }); }
    else if (t === 'thorn') { const len = Math.hypot(o.x1 - o.x0, o.z1 - o.z0), w = face(new THREE.Group(), o.x1 - o.x0, o.z1 - o.z0), n = Math.max(2, Math.round(len/0.55)); w.position.set((o.x0 + o.x1)/2, 0, (o.z0 + o.z1)/2); w.add(box(len, 0.7, 0.4, X.spike, 0, 0.3, 0));
      for (let q = 0; q <= n; q++) for (const sd of [-1, 0, 1]) { const sp = new THREE.Mesh(CONE, X.tip); sp.scale.set(0.15, 0.6, 0.15); sp.position.set(-len/2 + len*q/n, sd ? 0.35 : 0.92, sd*0.42); if (sd) sp.rotation.x = sd*Math.PI/2; w.add(sp); } add(w); }
    else if (t === 'isle') { for (let q = 0; q < o.pts.length; q++) { const px = o.pts[q][0], pz = o.pts[q][1], yy = G.elev(L, o.pts[q][2]) - Y, k1 = 1 + (rnd() - 0.5)*0.2; add(ball(sandM, o.r*1.12*k1, px, yy - 0.05, pz, 1, 0.42, 1), ball(grassM, o.r*0.86*k1, px, yy + 0.22, pz, 1, 0.55, 1)); if (q % 3 === 1) { const a = rnd()*6.3, m = new THREE.Mesh(GEO.ico, MAT.rock2), r = 0.4 + rnd()*0.3; m.scale.set(r, r*0.7, r); m.position.set(px + Math.cos(a)*o.r*0.9, yy + 0.2, pz + Math.sin(a)*o.r*0.9); add(m); } } }
    else if (t === 'mill') { const mg = new THREE.Group(); mg.position.set(o.x, 0.22, o.z); for (let q = 0; q < 2; q++) { const h = new THREE.Group(), body = cyl(0.42, 0.42, o.hl*2, 9, q ? MAT.wood2 : MAT.wood); body.rotation.z = Math.PI/2; h.rotation.y = -q*Math.PI/2; h.position.y = q*0.1; h.add(body); for (const sd of [-1, 1]) { const cap = cyl(0.36, 0.36, 0.06, 9, MAT.cut, sd*(o.hl + 0.01)); cap.rotation.z = Math.PI/2; h.add(cap); } mg.add(h); }
      mg.add(cyl(0.62, 0.68, 1.25, 8, MAT.dark, 0, 0.35, 0), cyl(0.52, 0.52, 0.08, 8, MAT.red, 0, 1.0, 0)); add(mg); K.upd.push((tm) => { mg.rotation.y = -(o.ph + o.sp*Math.max(0, tm)); }); }
    else if (t === 'jaws') { const jg = face(new THREE.Group(), o.rx, o.rz); jg.position.set(o.cx, 0, o.cz); const slabs = [-1, 1].map((sd) => { const body = box(1, 1.5, 0.85, X.iron, 0, 0.6, 0), teeth = new THREE.Group(); for (let q = -1; q <= 1; q++) for (const yy of [0.25, 0.9]) { const sp = new THREE.Mesh(CONE, X.tip); sp.scale.set(0.16, 0.5, 0.16); sp.rotation.z = sd*Math.PI/2; sp.position.set(0, yy, q*0.26); teeth.add(sp); } jg.add(body, teeth); return { body, teeth, sd }; });
      for (const sd of [-1, 1]) jg.add(box(1.4, 2.4, 1.6, stoneM, sd*(o.w + 1.5), 1.2, 0), box(1.6, 0.25, 1.8, MAT.dark, sd*(o.w + 1.5), 2.5, 0)); add(jg);
      K.upd.push((tm) => { const gp = G.jawGap(o, Math.max(0, tm)); for (const q of slabs) { const len = o.w + 1.2 - gp; q.body.scale.x = len; q.body.position.x = q.sd*(gp + len/2); q.teeth.position.x = q.sd*(gp - 0.2); } }); }
    else if (t === 'arm') { add(cyl(0.3, 0.36, 1.7, 8, MAT.dark, o.px, 0.85, o.pz), cyl(0.44, 0.44, 0.2, 8, MAT.red, o.px, 1.75, o.pz)); const ag = new THREE.Group(); ag.position.set(o.px, 0.8, o.pz); const boom = cyl(0.14, 0.14, o.len - 0.5, 8, MAT.wood2, (o.len - 0.5)/2, 0, 0), cuff = cyl(0.36, 0.4, 0.3, 10, MAT.white, o.len - 0.95, 0, 0); boom.rotation.z = Math.PI/2; cuff.rotation.z = Math.PI/2;
      ag.add(boom, cuff, ball(MAT.red, 0.62, o.len - 0.35, 0, 0, 1.15, 0.95, 0.95), ball(MAT.red, 0.28, o.len - 0.5, 0.22, 0.42)); add(ag); K.upd.push((tm) => { const p = G.armAt(o, Math.max(0, tm)); face(ag, p[2] - p[0], p[3] - p[1]); }); }
    else if (t === 'barrel') { const bg = new THREE.Group(), roll = new THREE.Group(), body = cyl(0.8, 0.8, 1.5, 12, MAT.wood); body.rotation.x = Math.PI/2; roll.add(body); for (const zz of [-0.5, 0, 0.5]) { const hp = cyl(0.83, 0.83, 0.1, 12, MAT.dark, 0, 0, zz); hp.rotation.x = Math.PI/2; roll.add(hp); } bg.add(roll); g.add(bg);
      K.upd.push((tm, S, dt) => { const p = G.where(o, Math.max(0, tm)); bg.position.set(p[0], G.elev(L, p[5]) + 0.45, p[1]); face(bg, p[2], p[3]); roll.rotation.z -= dt*7; if (near(S, o) && Math.random() < dt*12) emit(p[0], G.elev(L, p[5]) + 0.1, p[1], (Math.random() - 0.5)*3, 1.5 + Math.random()*2, (Math.random() - 0.5)*3, 0.5, 0.25, 0.08, 1, 1, 1, 0.9, 0); }); }
    else if (t === 'fall') { for (const sd of [-1, 1]) { const m = new THREE.Mesh(GEO.ico, MAT.rock); m.scale.set(1.0, 0.9, 1.0); m.position.set(o.cx + o.rx*sd*(o.w + 0.2), 0.3, o.cz + o.rz*sd*(o.w + 0.2)); m.rotation.y = rnd()*6; add(m); }
      K.upd.push((tm, S, dt) => { if (!near(S, o)) return; for (let q = 0; q < 3; q++) if (Math.random() < dt*26) { const lat = (Math.random()*2 - 1)*o.w*0.92; emit(o.cx + o.rx*lat + o.tx*3.2, Y - o.drop + 0.3, o.cz + o.rz*lat + o.tz*3.2, o.tx*(1 + Math.random()*2), 1.5 + Math.random()*2.5, o.tz*(1 + Math.random()*2), 0.9, 0.5, 1.6, 1, 1, 1, 0.5); } }); }
    else if (t === 'bridge') { const bg = face(new THREE.Group(), o.rx, o.rz), W = o.w + 2.6; bg.position.set(o.cx, 0, o.cz); bg.add(box(2*W, 0.3, 2.6, MAT.wood, 0, 4.4, 0), box(2*W, 0.12, 0.14, MAT.dark, 0, 5.6, 1.25), box(2*W, 0.12, 0.14, MAT.dark, 0, 5.6, -1.25)); for (let q = 0; q <= 8; q++) for (const zz of [-1.25, 1.25]) bg.add(box(0.16, 0.95, 0.16, MAT.dark, -W + 2*W*q/8, 4.7, zz)); for (const sd of [-1, 1]) bg.add(box(1.3, 4.5, 2.9, stoneM, sd*(W - 0.6), 2.2, 0)); add(bg); }
    else if (t === 'bean') { const k = L.beans.indexOf(o), c = new THREE.Group(); c.position.set(o.x, 0.5, o.z); c.add(cyl(0.34, 0.34, 0.62, 12, MAT.can), cyl(0.35, 0.35, 0.3, 12, MAT.label), cyl(0.36, 0.36, 0.05, 12, MAT.tin, 0, 0.32, 0), cyl(0.36, 0.36, 0.05, 12, MAT.tin, 0, -0.32, 0)); c.rotation.z = 0.35; add(c); const rg = ring(o.x, o.z, 0.55, 0.72);
      K.upd.push((tm, S) => { const on = !S.beans[k]; c.visible = rg.visible = on; if (on) { c.position.y = Y + 0.5 + Math.sin(T*3 + ph)*0.1; c.rotation.y = T*1.6 + ph; const s = 1 + Math.sin(T*4 + ph)*0.12; rg.scale.set(s, s, 1); } }); }
    else if (t === 'gold') { const k = L.golds.indexOf(o), c = new THREE.Group(); c.position.set(o.x, 0.7, o.z); c.add(cyl(0.42, 0.42, 0.5, 16, X.gold), cyl(0.16, 0.16, 0.52, 10, X.goldIn)); c.rotation.z = 0.5; add(c); const rg = flat(new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 22), basic('#ffe680', { transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }))); rg.position.set(o.x, 0.03, o.z); add(rg);
      K.upd.push((tm, S, dt) => { const on = !S.golds[k]; c.visible = rg.visible = on; if (on) { c.position.y = Y + 0.75 + Math.sin(T*2.6 + ph)*0.14; c.rotation.y = T*2.4 + ph; const s = 1 + Math.sin(T*5 + ph)*0.18; rg.scale.set(s, s, 1); if (near(S, o) && Math.random() < dt*6) emit(o.x + (Math.random() - 0.5), 0.6 + Math.random()*0.8, o.z + (Math.random() - 0.5), 0, 0.6, 0, 0.5, 0.14, 0.02, 1, 0.93, 0.5, 1); } }); }
    else if (t === 'cp') { const k = cpN++, fm = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide }); for (const s of [-1, 1]) { const px = o.cx + o.rx*s*(o.w + 0.7), pz = o.cz + o.rz*s*(o.w + 0.7); add(cyl(0.09, 0.11, 3.2, 6, MAT.dark, px, 1.6, pz)); const fl = new THREE.Mesh(FLAG, fm); fl.scale.setScalar(1.5); fl.position.set(px, 2.3, pz); face(fl, -o.tx, -o.tz); add(fl); }
      const n = Math.round(2*o.w/1.4); for (let i = 1; i < n; i++) { const lat = -o.w + 2*o.w*i/n; add(ball(i % 2 ? MAT.white : MAT.red, 0.16, o.cx + o.rx*lat, 0.07, o.cz + o.rz*lat)); }
      K.upd.push((tm, S) => { fm.color.set(S.cp >= k ? '#39d353' : '#ffffff'); }); } }
  return K;
}

// ---------- lands: every river runs through its own ----------
const srgb = (h) => { const n = parseInt(h.slice(1), 16); return new THREE.Vector3((n >> 16 & 255)/255, (n >> 8 & 255)/255, (n & 255)/255); };
const THEMES = {
  meadow: { sky: '#a6e0f5', ground: ['#7fce58', '#6cbb4b'], top: ['#8ad862', '#74c552'], side: '#a8c860', sand: '#f1dba0', H: 1.7, rough: 0.5, water: ['#1b8fe0', '#5cd3ee', '#ffffff'], glint: 0.1, hemi: [0xffffff, 0x9ad07a, 2.3], sun: [0xfff1cf, 1.9], hue: [0.25, 0.36, 0.55, 0.36],
    deco: [['pine', 5, 'ridge'], ['round', 7, 'ridge'], ['bush', 5, 'bank'], ['flower', 9, 'bank'], ['reed', 6, 'shore'], ['boulder', 2, 'bank'], ['hay', 1.2, 'far'], ['cabin', 0.5, 'far'], ['round', 5, 'far'], ['pine', 4, 'far']] },
  autumn: { sky: '#f3d9a8', ground: ['#c9b950', '#b7a444'], top: ['#d8c85c', '#c4ae4a'], side: '#b99a52', sand: '#ecd49a', H: 2.0, rough: 0.6, water: ['#1a79b8', '#5ec3d6', '#fff7e8'], glint: 0.1, hemi: [0xfff3dc, 0xb99a52, 2.2], sun: [0xffd9a0, 2.0], hue: [0.02, 0.13, 0.75, 0.48],
    deco: [['round', 10, 'ridge'], ['pine', 3, 'ridge'], ['bush', 5, 'bank'], ['stump', 2, 'bank'], ['reed', 4, 'shore'], ['boulder', 2, 'bank'], ['flower', 4, 'bank'], ['round', 8, 'far'], ['cabin', 0.6, 'far'], ['hay', 1.5, 'far']] },
  alpine: { sky: '#bfe3f5', ground: ['#86a873', '#779a66'], top: ['#a3a9b2', '#8d939d'], side: '#7c828c', sand: '#d9d2c0', H: 3.6, rough: 0.95, steep: true, water: ['#1672c9', '#6fd3f2', '#ffffff'], glint: 0.12, hemi: [0xf2f8ff, 0x8a9a8a, 2.3], sun: [0xffffff, 1.9], hue: [0.36, 0.43, 0.4, 0.27],
    deco: [['pine', 11, 'ridge'], ['snowrock', 5, 'ridge'], ['boulder', 5, 'bank'], ['bush', 2, 'bank'], ['pine', 9, 'far'], ['snowrock', 2, 'far']] },
  mill: { sky: '#a6e0f5', ground: ['#8cc257', '#7bb04b'], top: ['#93c95c', '#80b84f'], side: '#9a8a55', sand: '#e6d199', H: 1.5, rough: 0.4, water: ['#1f86c4', '#63c8dd', '#ffffff'], glint: 0.1, hemi: [0xffffff, 0x9ac07a, 2.25], sun: [0xfff1cf, 1.9], hue: [0.28, 0.38, 0.45, 0.3],
    deco: [['pine', 8, 'ridge'], ['stump', 8, 'bank'], ['lumber', 3, 'bank'], ['stump', 5, 'ridge'], ['cabin', 1.2, 'ridge'], ['bush', 3, 'bank'], ['reed', 3, 'shore'], ['pine', 8, 'far'], ['lumber', 1.5, 'far'], ['cabin', 0.8, 'far']] },
  jungle: { sky: '#9fe8d0', ground: ['#3fa84a', '#35983f'], top: ['#4cba55', '#3faa49'], side: '#5a9a4a', sand: '#e8dba0', H: 1.5, rough: 0.6, water: ['#0f8a86', '#52d6b4', '#eafff4'], glint: 0.09, hemi: [0xf4fff0, 0x4a9a5a, 2.3], sun: [0xfff6c0, 1.9], hue: [0.28, 0.4, 0.65, 0.32],
    deco: [['palm', 10, 'ridge'], ['bush', 10, 'bank'], ['reed', 10, 'shore'], ['flower', 6, 'bank'], ['round', 5, 'ridge'], ['shroom', 1.5, 'bank'], ['palm', 8, 'far'], ['round', 6, 'far']] },
  sky: { sky: '#7cc6f5', ground: ['#ffffff', '#eef6ff'], top: ['#c8ccd6', '#b4b9c6'], side: '#8d93a3', sand: '#d8dce6', H: 0, rough: 0, water: ['#2a9df0', '#7fe0ff', '#ffffff'], glint: 0.14, hemi: [0xffffff, 0xbfdcff, 2.6], sun: [0xffffff, 1.7], hue: [0.27, 0.36, 0.55, 0.38],
    deco: [['cloud', 16, 'air'], ['islet', 3, 'air']] },
  dusk: { sky: '#3a2f63', ground: ['#4a4f7c', '#40456e'], top: ['#5b5f90', '#4e5282'], side: '#6a5f8a', sand: '#9b90b4', H: 2.0, rough: 0.7, water: ['#27307e', '#4f74d6', '#d6dcff'], glint: 0.13, hemi: [0xc8ccff, 0x3d376a, 2.2], sun: [0xffc9a0, 1.3], hue: [0.62, 0.74, 0.35, 0.33], fireflies: true,
    deco: [['dead', 6, 'ridge'], ['shroom', 9, 'bank'], ['pine', 6, 'ridge'], ['boulder', 4, 'bank'], ['reed', 4, 'shore'], ['bush', 3, 'bank'], ['pine', 6, 'far'], ['dead', 3, 'far']], glow: true },
  desert: { sky: '#f6e3b0', ground: ['#e9cf8a', '#dcc07a'], top: ['#f0d898', '#e2c682'], side: '#d2a965', sand: '#f6e6b4', H: 1.5, rough: 0.6, water: ['#1397c4', '#63e0e0', '#ffffff'], glint: 0.12, hemi: [0xfffaea, 0xd9b877, 2.4], sun: [0xfff0c0, 2.0], hue: [0.27, 0.36, 0.4, 0.36],
    deco: [['cactus', 7, 'ridge'], ['palm', 2.5, 'bank'], ['boulder', 5, 'bank'], ['tower', 1.1, 'ridge'], ['fortwall', 1.4, 'ridge'], ['dead', 1.5, 'ridge'], ['cactus', 6, 'far'], ['boulder', 3, 'far'], ['tower', 0.5, 'far']], rockHue: '#d6b06a' },
  canyon: { sky: '#f7c79a', ground: ['#d98e55', '#c97d48'], top: ['#dd8850', '#c56e3c'], side: '#b55c34', sand: '#f0c995', H: 4.8, rough: 1.0, steep: true, water: ['#0f7a9e', '#48c4d2', '#fff3e0'], glint: 0.11, hemi: [0xfff0dc, 0xc97d48, 2.2], sun: [0xffd2a0, 2.1], hue: [0.25, 0.33, 0.35, 0.33],
    deco: [['cactus', 5, 'ridge'], ['dead', 4, 'ridge'], ['boulder', 7, 'bank'], ['bush', 2, 'bank'], ['boulder', 5, 'ridge'], ['cactus', 5, 'far'], ['boulder', 4, 'far']], rockHue: '#c8713f' },
};
const WU = { uSpeed: { value: 1 }, uT: U.uT, uDeep: { value: srgb('#1b8fe0') }, uShal: { value: srgb('#5cd3ee') }, uFoam: { value: srgb('#ffffff') }, uGlint: { value: 0.1 } };
const waterMat = new THREE.ShaderMaterial({ uniforms: WU, side: THREE.DoubleSide,
  vertexShader: 'attribute float aLat; attribute float aW; attribute float aS; attribute float aFall; attribute float aFast; varying float vLat; varying float vW; varying float vS; varying float vFall; varying float vFast; void main(){ vLat=aLat; vW=aW; vS=aS; vFall=aFall; vFast=aFast; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `precision highp float; uniform float uT; uniform float uSpeed; uniform vec3 uDeep; uniform vec3 uShal; uniform vec3 uFoam; uniform float uGlint; varying float vLat; varying float vW; varying float vS; varying float vFall; varying float vFast;
    float h(vec2 p){ p = fract(p*vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y)*p.y); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main(){ float e = vW - abs(vLat); vec2 q = vec2(vLat, vS); float tt = uT*uSpeed;
      vec3 c = mix(uShal, uDeep, smoothstep(0.0, 3.8, e));
      float n1 = vn(q*vec2(0.55, 0.22) + vec2(0.0, -tt*0.75)), n2 = vn(q*vec2(1.3, 0.6) + vec2(7.3, -tt*1.5));
      c += uGlint*smoothstep(0.56 - 0.14*vFast, 0.8, n1*0.55 + n2*0.5);
      float mid = smoothstep(0.0, 0.5, e/vW), sl = smoothstep(0.74 - 0.12*vFast, 0.92, vn(vec2(vLat*2.6, vS*0.16 - tt*1.25)))*mid; c = mix(c, uFoam, sl*(0.22 + 0.4*vFast)); c -= 0.05*smoothstep(0.45, 0.2, n1);
      c += uGlint*0.8*smoothstep(0.8, 0.95, vn(q*1.9 + vec2(uT*0.25, -uT*0.9)));
      float wob = (vn(q*vec2(1.2, 0.8) + vec2(0.0, -uT*0.7)) - 0.5)*0.55;
      float foam = 1.0 - smoothstep(0.18, 0.55, e + wob);
      float foam2 = (1.0 - smoothstep(0.7, 1.6, e + wob*2.0))*smoothstep(0.55, 0.8, vn(q*vec2(2.5, 1.1) + vec2(0.0, -uT*1.4)));
      c = mix(c, uFoam, max(foam*0.95, foam2*0.6));
      float ws = smoothstep(0.3, 0.75, vn(vec2(vLat*3.0, vS*1.2 - uT*7.0))); c = mix(c, uFoam, clamp(vFall, 0.0, 1.0)*(0.5 + 0.5*ws));
      gl_FragColor = vec4(c, 1.0); }` });
const landMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
const tintMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), glowMat = new THREE.MeshBasicMaterial({ color: '#ffffff' }), cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#8fa6c4' });
const hsh = (i, j) => { let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0)/4294967295; };
const vnoise = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx*fx*(3 - 2*fx), v = fz*fz*(3 - 2*fz); return lerp(lerp(hsh(i, j), hsh(i + 1, j), u), lerp(hsh(i, j + 1), hsh(i + 1, j + 1), u), v)*2 - 1; };
// a strip of water along the river; steep places (waterfalls) are marked so the picture turns them white
function ribbon(E, f0, f1, yoff) { const n = E.length, pos = new Float32Array(n*6), lat = new Float32Array(n*2), ww = new Float32Array(n*2), ss = new Float32Array(n*2), fl = new Float32Array(n*2), fa = new Float32Array(n*2), idx = [];
  for (let i = 0; i < n; i++) { const e = E[i], a = f0(e), b = f1(e), y = e.y + yoff, st = Math.min(1, Math.abs((E[Math.min(n - 1, i + 1)].y - E[Math.max(0, i - 1)].y))/2.2); pos.set([e.x + e.rx*a, y, e.z + e.rz*a, e.x + e.rx*b, y, e.z + e.rz*b], i*6); lat[i*2] = a; lat[i*2 + 1] = b; ww[i*2] = ww[i*2 + 1] = e.w; ss[i*2] = ss[i*2 + 1] = e.s; fl[i*2] = fl[i*2 + 1] = st; fa[i*2] = fa[i*2 + 1] = e.fast || 0;
    if (i < n - 1 && !e.gap && !E[i + 1].gap) idx.push(i*2, i*2 + 1, i*2 + 2, i*2 + 1, i*2 + 3, i*2 + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aLat', new THREE.BufferAttribute(lat, 1)); g.setAttribute('aW', new THREE.BufferAttribute(ww, 1)); g.setAttribute('aS', new THREE.BufferAttribute(ss, 1)); g.setAttribute('aFall', new THREE.BufferAttribute(fl, 1)); g.setAttribute('aFast', new THREE.BufferAttribute(fa, 1)); g.setIndex(idx); return g; }
// land along one side of the river: rows of points going away from the water, each with its own height and colour
function strips(E, side, rows) { const n = E.length, R = rows.length, pos = new Float32Array(n*R*3), col = new Float32Array(n*R*3), idx = [], c = new THREE.Color();
  for (let i = 0; i < n; i++) for (let r = 0; r < R; r++) { const e = E[i], d = side*(e.w + rows[r].d), x = e.x + e.rx*d, z = e.z + e.rz*d, k = (i*R + r)*3; pos[k] = x; pos[k + 1] = rows[r].y(e, x, z); pos[k + 2] = z; rows[r].c(c, x, z); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    if (i < n - 1 && r < R - 1 && !e.gap && !E[i + 1].gap) { const a = i*R + r, b = a + R; idx.push(a, a + 1, b, a + 1, b + 1, b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }

// ---------- trees, houses and other things that stand around ----------
const PM = (geo, mat, x, y, z, sx, sy, sz, rx, ry, rz, shade) => ({ geo, mat, shade: shade || 1, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx, sy, sz)) });
let PROPS = null;
function props() { if (PROPS) return PROPS; const C = GEO.cylU, B = GEO.boxU, I = GEO.ico1, K = GEO.cone, T = 'tint', P = {};
  P.pine = [PM(C, MAT.wood2, 0, 0, 0, 0.2, 1.2, 0.2), PM(K, T, 0, 0.8, 0, 1.35, 1.15, 1.35), PM(K, T, 0, 2.1, 0, 1.0, 0.95, 1.0, 0, 0.6, 0, 1.1), PM(K, T, 0, 3.2, 0, 0.62, 0.7, 0.62, 0, 1.2, 0, 1.2)];
  P.round = [PM(C, MAT.wood2, 0, 0, 0, 0.24, 1.9, 0.24), PM(I, T, 0, 2.7, 0, 1.5, 1.35, 1.5), PM(I, T, 0.8, 2.1, 0.4, 0.85, 0.75, 0.85, 0, 1, 0, 1.12), PM(I, T, -0.7, 2.3, -0.3, 0.8, 0.7, 0.8, 0, 2, 0, 0.9)];
  P.palm = [PM(C, MAT.wood, 0, 0, 0, 0.17, 3.5, 0.17, 0, 0, 0.14), PM(GEO.ico, MAT.dark, -0.42, 3.3, 0.12, 0.16, 0.16, 0.16), PM(GEO.ico, MAT.dark, -0.55, 3.28, -0.1, 0.16, 0.16, 0.16)];
  for (let i = 0; i < 7; i++) { const a = i*Math.PI*2/7; P.palm.push(PM(I, T, -0.48 + Math.cos(a)*0.95, 3.25, -Math.sin(a)*0.95, 1.25, 0.1, 0.4, 0, a, -0.5, i % 2 ? 1.1 : 0.95)); }
  P.cactus = [PM(C, T, 0, 0, 0, 0.34, 2.3, 0.34), PM(I, T, 0, 2.3, 0, 0.34, 0.3, 0.34), PM(C, T, 0.3, 1.25, 0, 0.19, 0.6, 0.19, 0, 0, -Math.PI/2), PM(C, T, 0.82, 1.1, 0, 0.19, 0.95, 0.19), PM(I, T, 0.82, 2.05, 0, 0.19, 0.17, 0.19), PM(C, T, -0.3, 0.85, 0, 0.19, 0.6, 0.19, 0, 0, Math.PI/2), PM(C, T, -0.8, 0.72, 0, 0.19, 0.75, 0.19), PM(I, T, -0.8, 1.47, 0, 0.19, 0.17, 0.19)];
  P.dead = [PM(C, MAT.dark, 0, 0, 0, 0.17, 2.8, 0.13, 0, 0, 0.08), PM(C, MAT.dark, -0.1, 1.5, 0, 0.08, 1.3, 0.08, 0, 0, -0.9), PM(C, MAT.dark, -0.14, 2.0, 0, 0.07, 1.1, 0.07, 0, 0.5, 0.85), PM(C, MAT.dark, -0.2, 2.5, 0, 0.05, 0.8, 0.05, 0.6, 0, -0.5)];
  P.shroom = [PM(C, MAT.label, 0, 0, 0, 0.16, 0.7, 0.16), PM(GEO.half, 'glow', 0, 0.6, 0, 0.62, 0.5, 0.62), PM(C, MAT.label, 0.5, 0, 0.3, 0.1, 0.4, 0.1), PM(GEO.half, 'glow', 0.5, 0.35, 0.3, 0.36, 0.3, 0.36, 0, 0, 0, 1.15)];
  P.bush = [PM(I, T, 0, 0.35, 0, 0.9, 0.62, 0.9), PM(I, T, 0.6, 0.3, 0.3, 0.6, 0.45, 0.6, 0, 1, 0, 1.12), PM(I, T, -0.5, 0.28, -0.35, 0.55, 0.4, 0.55, 0, 2, 0, 0.92)];
  P.reed = []; for (let i = 0; i < 5; i++) { const a = i*1.9, d = 0.12 + (i % 3)*0.1, h = 1.1 + (i % 3)*0.3; P.reed.push(PM(C, MAT.reed, Math.cos(a)*d, 0, Math.sin(a)*d, 0.035, h, 0.035, (i % 2 - 0.5)*0.2, 0, (i % 3 - 1)*0.14)); if (i % 2 === 0) P.reed.push(PM(C, MAT.dark, Math.cos(a)*d - (i % 3 - 1)*0.14*h*0.85, h*0.82, Math.sin(a)*d + (i % 2 - 0.5)*0.2*h*0.85, 0.075, 0.3, 0.075)); }
  P.flower = [PM(GEO.ico, 'glow', 0, 0.2, 0, 0.17, 0.17, 0.17), PM(GEO.ico, 'glow', 0.35, 0.16, 0.2, 0.14, 0.14, 0.14, 0, 0, 0, 1.1), PM(GEO.ico, 'glow', -0.25, 0.18, 0.3, 0.15, 0.15, 0.15, 0, 0, 0, 0.9), PM(GEO.ico, 'glow', 0.1, 0.15, -0.35, 0.13, 0.13, 0.13)];
  P.boulder = [PM(GEO.ico, 'rock', 0, 0.3, 0, 1, 0.75, 1), PM(GEO.ico, 'rock', 0.8, 0.15, 0.4, 0.5, 0.4, 0.5, 0, 1, 0, 1.1)];
  P.snowrock = [PM(GEO.ico, 'rock', 0, 0.5, 0, 1.3, 1.5, 1.3), PM(GEO.ico, MAT.white, 0, 1.45, 0, 0.85, 0.6, 0.85, 0, 0.5, 0)];
  P.stump = [PM(C, MAT.wood2, 0, 0, 0, 0.42, 0.5, 0.42), PM(C, MAT.cut, 0, 0.5, 0, 0.37, 0.05, 0.37)];
  P.lumber = [PM(C, MAT.wood, -1.3, 0.27, 0.29, 0.27, 2.6, 0.27, 0, 0, -Math.PI/2), PM(C, MAT.wood2, -1.3, 0.27, -0.29, 0.27, 2.6, 0.27, 0, 0, -Math.PI/2), PM(C, MAT.wood, -1.3, 0.74, 0, 0.27, 2.6, 0.27, 0, 0, -Math.PI/2), PM(C, MAT.cut, 1.3, 0.27, 0.29, 0.23, 0.04, 0.23, 0, 0, -Math.PI/2), PM(C, MAT.cut, 1.3, 0.27, -0.29, 0.23, 0.04, 0.23, 0, 0, -Math.PI/2), PM(C, MAT.cut, 1.3, 0.74, 0, 0.23, 0.04, 0.23, 0, 0, -Math.PI/2)];
  P.cabin = [PM(B, MAT.wood2, 0, 0, 0, 2.5, 1.6, 2.1), PM(GEO.pyr, MAT.red, 0, 1.6, 0, 2.1, 1.3, 1.8), PM(B, MAT.dark, 0, 0, 1.06, 0.55, 1.05, 0.06), PM(B, MAT.label, 0.75, 0.75, 1.06, 0.5, 0.45, 0.06), PM(B, MAT.rock, -0.7, 1.7, -0.4, 0.35, 1.0, 0.35)];
  P.hay = [PM(GEO.half, MAT.hay, 0, 0, 0, 1.1, 1.3, 1.1), PM(C, MAT.wood2, 0, 1.1, 0, 0.05, 0.5, 0.05)];
  P.tower = [PM(C, 'rock', 0, 0, 0, 1.2, 4.2, 1.2), PM(C, 'rock', 0, 4.2, 0, 1.45, 0.55, 1.45, 0, 0, 0, 1.1), PM(K, MAT.red, 0, 4.75, 0, 1.35, 0.95, 1.35), PM(B, MAT.dark, 0, 2.6, 1.15, 0.35, 0.7, 0.2), PM(C, MAT.dark, 0, 6.6, 0, 0.05, 1.1, 0.05), PM(B, MAT.red, 0.3, 7.25, 0, 0.6, 0.38, 0.04)];
  P.fortwall = [PM(B, 'rock', 0, 0, 0, 5.2, 2.3, 1.0)]; for (let i = -2; i <= 2; i++) P.fortwall.push(PM(B, 'rock', i*1.1, 2.3, 0, 0.6, 0.55, 1.0, 0, 0, 0, 1.1));
  P.cloud = [PM(I, 'cloud', 0, 0, 0, 2.6, 1.3, 2.0), PM(I, 'cloud', 2.1, 0.2, 0.5, 1.7, 1.0, 1.4, 0, 1, 0), PM(I, 'cloud', -2.0, -0.1, -0.3, 1.9, 1.0, 1.5, 0, 2, 0), PM(I, 'cloud', 0.4, 0.7, -0.2, 1.5, 0.9, 1.3, 0, 3, 0)];
  P.islet = [PM(GEO.ico, 'rock', 0, -1.6, 0, 2.6, 2.4, 2.6), PM(I, T, 0, -0.1, 0, 2.7, 0.5, 2.7), PM(C, MAT.wood2, 0.3, 0.2, 0.2, 0.2, 1.2, 0.2), PM(K, T, 0.3, 1.0, 0.2, 1.2, 1.0, 1.2, 0, 0, 0, 1.15), PM(K, T, 0.3, 2.2, 0.2, 0.8, 0.8, 0.8, 0, 0, 0, 1.25), PM(GEO.ico, 'rock', -1.2, 0.3, -0.6, 0.6, 0.45, 0.6)];
  return PROPS = P; }
const PSCALE = { pine: [0.8, 1.6], round: [0.8, 1.5], palm: [0.85, 1.4], cactus: [0.7, 1.4], dead: [0.8, 1.4], shroom: [0.7, 1.9], bush: [0.6, 1.3], reed: [0.8, 1.4], flower: [0.8, 1.5], boulder: [0.5, 1.6], snowrock: [0.8, 2.0], stump: [0.7, 1.2], lumber: [0.8, 1.1], cabin: [0.9, 1.2], hay: [0.8, 1.2], tower: [0.9, 1.25], fortwall: [0.9, 1.2], cloud: [0.8, 2.6], islet: [0.6, 1.5] };
// put every prop of every kind into the picture in one go: one mesh per part, however many copies
function plant(g, lists, Tm) { const P = props(), rockCol = new THREE.Color(Tm.rockHue || '#9a9ca6'), M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (const kind in lists) { const list = lists[kind]; if (!list.length) continue;
    for (const part of P[kind]) { const mat = part.mat === 'tint' || part.mat === 'rock' ? tintMat : part.mat === 'glow' ? glowMat : part.mat === 'cloud' ? cloudMat : part.mat, im = new THREE.InstancedMesh(part.geo, mat, list.length), colored = typeof part.mat === 'string' && part.mat !== 'cloud';
      list.forEach((t, i) => { q.setFromAxisAngle(UP, t.r); M.compose(V3.set(t.x, t.y, t.z), q, S3.set(t.s, t.s, t.s)).multiply(part.m); im.setMatrixAt(i, M); if (colored) { c.copy(part.mat === 'rock' ? rockCol : t.c).multiplyScalar(part.mat === 'rock' ? part.shade*t.sh : part.shade); im.setColorAt(i, c); } });
      im.frustumCulled = false; g.add(im); } } }

let LV = null;
function buildLevel(i) {
  if (LV && LV.L.i === i) return LV;
  if (LV) { scene.remove(LV.g); LV.g.traverse((o) => { if (o.geometry && !Object.values(GEO).includes(o.geometry) && !SHARED.has(o.geometry)) o.geometry.dispose(); }); }
  const L = G.level(i), P = L.P, g = new THREE.Group(), rnd = rng(77 + i*131), E = [], Tm = THEMES[L.theme] || THEMES.meadow, sky = L.sky, end = G.elev(L, L.len + 10), base = end - 0.03;
  // the look of this land
  scene.background = new THREE.Color(Tm.sky); HEMI.color.set(Tm.hemi[0]); HEMI.groundColor.set(Tm.hemi[1]); HEMI.intensity = Tm.hemi[2]; sun.color.set(Tm.sun[0]); sun.intensity = Tm.sun[1];
  WU.uDeep.value = srgb(Tm.water[0]); WU.uShal.value = srgb(Tm.water[1]); WU.uFoam.value = srgb(Tm.water[2]); WU.uGlint.value = Tm.glint; WU.uSpeed.value = L.flow/2.2; document.body.style.background = Tm.sky;
  // the river a little before the start and a pond after the finish, so the picture has no edge
  const p0 = P[0], pl = P[P.length - 1], inGap = (s) => L.gaps.some((q) => s > q[0] + 0.1 && s < q[1] - 0.1);
  for (let k = sky ? 4 : 16; k >= 1; k--) E.push({ x: p0.x - Math.cos(p0.a)*2*k, z: p0.z - Math.sin(p0.a)*2*k, w: p0.w, s: -2*k, open: p0.open });
  for (const p of P) E.push({ x: p.x, z: p.z, w: p.w, s: p.s, open: p.open, gap: inGap(p.s) });
  for (let k = 1; k <= (sky ? 8 : 26); k++) E.push({ x: pl.x + Math.cos(pl.a)*2*k, z: pl.z + Math.sin(pl.a)*2*k, w: pl.w + Math.min(k, 9)*(sky ? 0.5 : 0.9), s: pl.s + 2*k, open: pl.open });
  for (let k = 0; k < E.length; k++) { const a = E[Math.max(0, k - 1)], b = E[Math.min(E.length - 1, k + 1)], d = Math.hypot(b.x - a.x, b.z - a.z) || 1, e = E[k]; e.tx = (b.x - a.x)/d; e.tz = (b.z - a.z)/d; e.rx = -e.tz; e.rz = e.tx; e.y = G.elev(L, e.s); e.fast = clamp((L.flow*clamp(L.w0/e.w, 0.5, 1.7) - 2)/3.2, 0, 1); }
  let cx = 0, cz = 0; for (const e of E) { cx += e.x; cz += e.z; } cx /= E.length; cz /= E.length;
  g.add(new THREE.Mesh(ribbon(E, (e) => -e.w, (e) => e.w, 0), waterMat));
  const C = (h) => new THREE.Color(h), sand = C(Tm.sand), side = C(Tm.side), top0 = C(Tm.top[0]), top1 = C(Tm.top[1]), gr0 = C(Tm.ground[0]), gr1 = C(Tm.ground[1]);
  // how far a point is from the water's edge, and which bit of the river is nearest
  const edge = (x, z) => { let bd = 1e9, be = null; for (const e of E) { if (e.gap) continue; const d = Math.hypot(x - e.x, z - e.z) - e.w; if (d < bd) { bd = d; be = e; } } return [bd, be]; };
  let bankY = () => base;
  if (!sky) {
    // banks: sand at the water, then a slope up to a ridge, then down to the plain
    const D = Tm.steep ? [-0.1, 0.9, 1.9, 3.8, 8, 14, 19.5] : [-0.1, 1.2, 2.8, 5.4, 9, 14, 19.5], F = [0, 0, 0.6, 0.96, 1, 0.55, 0], Wt = [1, 1, 1, 1, 1, 0.55, 0], H = Tm.H, amp = Tm.rough*H*0.3;
    const hAt = (r, ey, x, z) => r < 2 ? ey + (r ? 0.22 : 0.02) : lerp(base, ey + H*F[r] + (r < 6 ? vnoise(x*0.16, z*0.16)*amp + vnoise(x*0.47, z*0.47)*amp*0.4 : 0), Wt[r]);
    const cAt = (r) => (c, x, z) => { const n = vnoise(x*0.2 + 9, z*0.2)*0.5 + 0.5; if (r < 2) c.copy(sand); else if (r === 2) c.copy(side).lerp(top0, n*0.4); else if (r < 5) c.copy(top0).lerp(top1, n); else if (r === 5) c.copy(top1).lerp(gr0, 0.6); else c.copy(gr0).lerp(gr1, n); };
    const rows = D.map((d, r) => ({ d, y: (e, x, z) => hAt(r, e.y, x, z), c: cAt(r) }));
    g.add(new THREE.Mesh(strips(E, -1, rows), landMat), new THREE.Mesh(strips(E, 1, rows), landMat));
    bankY = (d, e, x, z) => { if (d >= D[6]) return base; let r = 0; while (r < 5 && d > D[r + 1]) r++; const t = clamp((d - D[r])/(D[r + 1] - D[r]), 0, 1); return lerp(hAt(r, e.y, x, z), hAt(r + 1, e.y, x, z), t); };
    // the plain beyond
    const pg = new THREE.PlaneGeometry(1500, 1500, 60, 60); pg.rotateX(-Math.PI/2); const pc = new Float32Array(pg.attributes.position.count*3), cc = new THREE.Color(); for (let k = 0; k < pg.attributes.position.count; k++) { const x = pg.attributes.position.getX(k) + cx, z = pg.attributes.position.getZ(k) + cz, n = vnoise(x*0.05, z*0.05)*0.5 + 0.5; cc.copy(gr0).lerp(gr1, n); pc[k*3] = cc.r; pc[k*3 + 1] = cc.g; pc[k*3 + 2] = cc.b; }
    pg.setAttribute('color', new THREE.BufferAttribute(pc, 3)); const plain = new THREE.Mesh(pg, landMat); plain.position.set(cx, base, cz); g.add(plain);
  } else {
    // a stone trough hanging in the sky: a rim, sides, and a bottom; rails only where the river has them
    const st0 = C(Tm.top[0]), st1 = C(Tm.top[1]), dk = C(Tm.side);
    const rows = [{ d: -0.1, y: (e) => e.y + 0.16, c: (c) => c.copy(st0) }, { d: 0.55, y: (e) => e.y + 0.16, c: (c) => c.copy(st0) }, { d: 0.6, y: (e) => e.y - 0.5, c: (c) => c.copy(st1) }, { d: 0.2, y: (e) => e.y - 2.4, c: (c) => c.copy(dk) }, { d: -1.5, y: (e) => e.y - 3.4, c: (c) => c.copy(dk) }];
    g.add(new THREE.Mesh(strips(E, -1, rows), landMat), new THREE.Mesh(strips(E, 1, rows), landMat));
    const under = strips(E, 1, [{ d: -1.5, y: (e) => e.y - 3.4, c: (c) => c.copy(dk) }, { d: 0, y: (e) => e.y - 3.4, c: (c) => c.copy(dk) }]); g.add(new THREE.Mesh(under, landMat));
    { const pos = under.attributes.position; for (let k = 0; k < E.length; k++) { const e = E[k]; pos.setXYZ(k*2, e.x - e.rx*(e.w - 1.5), e.y - 3.4, e.z - e.rz*(e.w - 1.5)); pos.setXYZ(k*2 + 1, e.x + e.rx*(e.w - 1.5), e.y - 3.4, e.z + e.rz*(e.w - 1.5)); } pos.needsUpdate = true; under.computeVertexNormals(); }
    const posts = [], bars = []; for (let k = 0; k < E.length - 1; k++) { const e = E[k]; if (e.open || e.gap || E[k + 1].open) continue; for (const sd of [-1, 1]) { const x = e.x + e.rx*sd*(e.w + 0.3), z = e.z + e.rz*sd*(e.w + 0.3); posts.push({ x, y: e.y + 0.16, z, r: 0, sx: 0.12, sy: 1.0, sz: 0.12 }); bars.push({ x: x + e.tx, y: e.y + 1.0, z: z + e.tz, r: -Math.atan2(e.tz, e.tx), sx: 2.05, sy: 0.12, sz: 0.1 }); } }
    g.add(insts(GEO.cylU, MAT.dark, posts), insts(GEO.boxU, MAT.wood, bars));
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color: '#d9efff' })); sea.position.set(cx, base - 42, cz); g.add(sea);
  }
  // trees, houses, clouds: everything this land grows, never in the water
  const lists = {}, hue = Tm.hue; let total = 0;
  const add = (kind, x, y, z, small) => { const sc = PSCALE[kind], s = small ? sc[0]*(0.55 + rnd()*0.2) : lerp(sc[0], sc[1], rnd()*rnd()), c = new THREE.Color(); if (kind === 'flower') c.setHSL([0.95, 0.13, 0.0, 0.78, 0.55][Math.floor(rnd()*5)], 0.9, 0.62); else if (kind === 'shroom') c.setHSL(Tm.glow ? 0.45 + rnd()*0.4 : 0.0 + rnd()*0.06, 0.85, Tm.glow ? 0.62 : 0.5); else if (kind === 'cactus') c.setHSL(0.3 + rnd()*0.06, 0.45, 0.36 + rnd()*0.08); else c.setHSL(lerp(hue[0], hue[1], rnd()), hue[2] + rnd()*0.12, hue[3] + rnd()*0.1);
    (lists[kind] || (lists[kind] = [])).push({ x, y, z, r: rnd()*6.3, s, c, sh: 0.85 + rnd()*0.3 }); total++; };
  for (let k = 0; k < E.length; k++) for (const sd of [-1, 1]) for (const [kind, wgt, zone] of Tm.deco) { const e = E[k]; if (e.gap || rnd() > wgt*0.04 || total > 1700) continue;
    const d0 = zone === 'shore' ? -0.5 + rnd()*0.9 : zone === 'bank' ? 1.3 + rnd()*3.4 : zone === 'ridge' ? 3.2 + rnd()*12 : zone === 'far' ? 20 + rnd()*rnd()*46 : 7 + rnd()*44, x = e.x + e.rx*sd*(e.w + d0) + (rnd() - 0.5)*2, z = e.z + e.rz*sd*(e.w + d0) + (rnd() - 0.5)*2, [d, ne] = edge(x, z);
    if (zone === 'shore') { if (d < -1 || d > 0.6) continue; add(kind, x, ne.y, z); } else if (zone === 'air') { if (d < 5) continue; add(kind, x, ne.y - (kind === 'cloud' ? 4 + rnd()*26 : 5 + rnd()*14), z); }
    else { if (d < (kind === 'cabin' || kind === 'tower' || kind === 'fortwall' ? 3.6 : 1.3)) continue; add(kind, x, bankY(d, ne, x, z) - 0.12, z); } }
  // islands get something growing on them too
  for (const o of L.solids) if (o.t === 'isle') for (let q = 1; q < o.pts.length - 1; q += 2) add(L.theme === 'jungle' || L.theme === 'desert' ? 'palm' : L.theme === 'mill' ? 'lumber' : L.theme === 'dusk' ? 'shroom' : L.theme === 'sky' ? 'bush' : 'pine', o.pts[q][0], G.elev(L, o.pts[q][2]) + 0.75, o.pts[q][1], true);
  plant(g, lists, Tm);
  const K = buildThings(L, g, rnd, Tm);
  // the finish: two poles and a chequered banner
  { const sF = L.len - 1.5, m = L.mid(sF), w = m.w, ta = Math.atan2(m.tz, m.tx), y = G.elev(L, sF);
    for (const s of [-1, 1]) { const px = m.x - Math.sin(ta)*s*(w + 0.5), pz = m.z + Math.cos(ta)*s*(w + 0.5); g.add(cyl(0.2, 0.24, 5.2, 8, s < 0 ? MAT.red : MAT.white, px, y + 2.6, pz), ball(xmat().yel, 0.36, px, y + 5.4, pz)); }
    const tex = canvasTex(256, 32, (c2) => { for (let x = 0; x < 16; x++) for (let yy = 0; yy < 2; yy++) { c2.fillStyle = (x + yy) % 2 ? '#222' : '#fff'; c2.fillRect(x*16, yy*16, 16, 16); } });
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(w*2 + 1, 1.3), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); ban.position.set(m.x, y + 4.5, m.z); ban.rotation.y = Math.atan2(-Math.cos(ta), -Math.sin(ta)); g.add(ban); }
  scene.add(g); return LV = { L, g, K, Tm, base };
}

// ---------- the crew: four different characters, each bent over with the business end pointing back ----------
const HEAD = 0.29, SPH = new THREE.SphereGeometry(1, 16, 12), HALF = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI*2, 0, Math.PI/2); SHARED.add(SPH); SHARED.add(HALF);
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
function buildGuy(k, n) {
  const c = new THREE.Group(), B = BUILD[k], col = new THREE.Color(PCOL[k]), size = n <= 2 ? 1.25 : n === 3 ? 1.12 : 1.0;
  c.position.set(0, 0.24, 0); c.scale.setScalar(size);
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
  return { c, k, B, size, bum, body, arms, neck, tilt, eyes, puff, mouth, skull, skin, spin, base: skin.color.clone(), side: k % 2 ? -1 : 1, puffAcc: 0, f: 0, dry: 0, strain: 0, yaw: 0, hop: 0, vy: 0, shock: 0, cheer: 0, party: false, was: false, look: Math.random()*9 };
}
const RED = new THREE.Color('#ff7a66'), BLUE = new THREE.Color('#9aa6ee');
function guyStep(c, j, run, dt, fire) {
  const dryNow = j.on && !fire && run; c.f += ((fire ? 1 : 0) - c.f)*Math.min(1, dt*12); c.dry += ((dryNow ? 1 : 0) - c.dry)*Math.min(1, dt*8);
  c.strain = clamp(c.strain + (fire ? dt*0.7 : -dt*0.9), 0, 1); c.shock = Math.max(0, c.shock - dt); c.cheer = Math.max(0, c.cheer - dt);
  // hop: knocked up by a bump, or dancing at the finish
  if (c.party && c.hop <= 0 && c.vy <= 0 && Math.sin(T*7 + c.k*1.9) > 0.9) c.vy = 3.2; c.vy -= 16*dt; c.hop += c.vy*dt; if (c.hop <= 0) { c.hop = 0; c.vy = 0; }
  const shake = fire ? Math.sin(T*65 + c.k*2)*0.02 : dryNow ? Math.sin(T*40 + c.k)*0.012 : 0;
  const jog = j.run && run ? Math.abs(Math.sin(T*17 + c.k))*0.07 : 0; c.c.position.y = 0.24 + c.hop + shake + jog; c.c.rotation.z = -0.22*c.f + Math.sin(T*2 + c.k)*0.02 + (j.run && run ? Math.sin(T*17 + c.k)*0.1 : 0); c.c.rotation.x = c.hop*0.25*c.side;
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

// ---------- the raft: round, with the crew standing wherever they like on its edge ----------
let RAFT = null;
function label(text, col) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d'); c.font = '900 34px Rubik, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = '#43260f'; c.strokeText(text, 128, 34); c.fillStyle = col; c.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.scale.set(1.9, 0.475, 1); s.renderOrder = 5; return s; }
const RAFT_R = 1.5;
function buildRaft(n, names) {
  if (RAFT) scene.remove(RAFT.g);
  const g = new THREE.Group(), b = new THREE.Group(), deck = new THREE.Group(); g.add(b); b.add(deck);
  const shadow = flat(new THREE.Mesh(GEO.circle, new THREE.MeshBasicMaterial({ color: '#0a3a5c', transparent: true, opacity: 0.22, depthWrite: false }))); shadow.scale.set(1.85, 1.85, 1); shadow.position.y = 0.035; g.add(shadow);
  // logs side by side, cut to a circle, with a rope round them
  for (let i = 0; i < 8; i++) { const z = (i - 3.5)*0.4, half = Math.sqrt(Math.max(0.1, RAFT_R*RAFT_R - z*z)), lg = cyl(0.21, 0.21, half*2, 8, i % 2 ? MAT.wood2 : MAT.wood, 0, 0.12, z); lg.rotation.z = Math.PI/2; deck.add(lg);
    for (const s of [-1, 1]) { const cap = cyl(0.17, 0.17, 0.04, 8, MAT.cut, s*half, 0.12, z); cap.rotation.z = Math.PI/2; deck.add(cap); } }
  const rope = new THREE.Mesh(new THREE.TorusGeometry(RAFT_R - 0.02, 0.085, 6, 30), lam('#ecdcae', { flatShading: false })); rope.rotation.x = Math.PI/2; rope.position.y = 0.24; deck.add(rope);
  for (const z of [-0.75, 0.75]) deck.add(box(2.3, 0.07, 0.2, MAT.dark, 0, 0.35, z));
  deck.add(cyl(0.05, 0.05, 2.2, 6, MAT.dark, 0, 1.35, 0), box(0.5, 0.42, 0.5, MAT.cut, 0.32, 0.58, -0.28), box(0.53, 0.09, 0.53, MAT.dark, 0.32, 0.58, -0.28));
  const flag = new THREE.Mesh(FLAG, MAT.flag); flag.position.set(0, 1.85, 0); deck.add(flag);
  // an arrow on the water: which way my push will send the raft
  const arrow = flat(new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0.9, 0), new THREE.Vector2(0, 0.55), new THREE.Vector2(0, 0.2), new THREE.Vector2(-0.8, 0.2), new THREE.Vector2(-0.8, -0.2), new THREE.Vector2(0, -0.2), new THREE.Vector2(0, -0.55)])), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }))); const ah = new THREE.Group(); ah.add(arrow); arrow.position.x = 3.1; ah.position.y = 0.06; ah.visible = false; g.add(ah);
  const crew = []; for (let k = 0; k < n; k++) { const c = buildGuy(k, n); b.add(c.c); if (names && names[k]) { const l = label(names[k], PCOL[k]); l.position.set(0.1, 1.5 + (k % 2)*0.4, 0); c.c.add(l); } crew.push(c); }
  scene.add(g); return RAFT = { g, b, deck, crew, flag, shadow, arrow: ah };
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
  finish: () => [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.2, 0.15, i*0.12)),
  wipe: () => { tone('sawtooth', 420, 60, 0.7, 0.3); noise(0.5, 0.45, 1400); tone('sine', 300, 90, 0.5, 0.25, 0.25); }, back: () => { tone('square', 330, 660, 0.14, 0.14); tone('square', 660, 990, 0.16, 0.12, 0.12); },
  cp: () => { tone('triangle', 784, 784, 0.12, 0.25); tone('triangle', 1175, 1175, 0.22, 0.25, 0.11); }, gold: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone('triangle', f, f, 0.12, 0.2, i*0.06)),
  boom: () => { noise(0.6, 0.8, 500); tone('sine', 140, 30, 0.6, 0.6); }, jump: () => tone('sine', 300, 1100, 0.45, 0.2), splash: () => noise(0.35, 0.4, 1800), geyser: () => { noise(0.7, 0.45, 3000); tone('sine', 200, 700, 0.5, 0.15); },
  boing: () => { tone('sine', 180, 520, 0.12, 0.35); tone('sine', 520, 260, 0.2, 0.25, 0.1); }, cannon: () => { noise(0.3, 0.5, 700); tone('sine', 110, 40, 0.3, 0.4); } };
function setMute(m) { MUTE = m; store.set('pb_mute', m); if (master) master.gain.value = m ? 0 : 0.7; $('mute').textContent = m ? '🔇' : '🔊'; } setMute(MUTE);

// ---------- one run ----------
let RUN = null, NET = null, BEST = store.get('pb_best', {});
// what my hands are doing: a stick (which way to push the raft, as seen on the screen) and the button
const CTL = { jx: 0, jy: 0, fire: false, kl: false, kr: false, ku: false, kd: false, kf: false, bf: false };
function aimNow() { let jx = CTL.jx + (CTL.kr ? 1 : 0) - (CTL.kl ? 1 : 0), jy = CTL.jy + (CTL.ku ? 1 : 0) - (CTL.kd ? 1 : 0); if (Math.hypot(jx, jy) < 0.28 || !RUN || RUN.camA == null) return null; const ca = RUN.camA, fx = Math.cos(ca), fz = Math.sin(ca); return Math.atan2(fz*jy + fx*jx, fx*jy - fz*jx); }
const fireNow = () => CTL.bf || CTL.kf;
function show(id) { for (const s of ['home', 'over', 'room']) $(s).classList.toggle('on', s === id); }
function begin(mode, lv, n, names, seat) {
  const S = G.newRun(lv, n); buildLevel(S.lv); buildRaft(n, names); clearPuffs(); quiet();
  RUN = { kind: mode, S, px: S.x, pz: S.z, pa: S.a, k: 1, acc: 0, cnt: 4, seat: seat == null ? 0 : seat, shake: 0, camA: null, cy: 0, ey: 0, sx: S.x, sz: S.z, sa: S.a, ex: 0, ez: 0, ea: 0, over: false, why: '', phi: S.crew.map((c) => c.phi), goldShown: -1 };
  CTL.jx = CTL.jy = 0; CTL.bf = CTL.kf = CTL.kl = CTL.kr = CTL.ku = CTL.kd = false; $('knob').style.transform = ''; $('joy').classList.remove('on');
  const play = mode !== 'demo'; $('hud').classList.toggle('on', play); if (play) show(null);
  const mine = mode === 'solo' || (seat != null && seat >= 0); $('pad').classList.toggle('hide', !mine); $('bFart').style.setProperty('--c', PCOL[RUN.seat] || PCOL[0]);
  $('progName').textContent = S.L.name; $('redo').classList.toggle('hide', mode !== 'solo');
  for (const el of Array.from($('prog').querySelectorAll('.tick'))) el.remove(); for (const c of S.L.cps) { const el = document.createElement('div'); el.className = 'tick'; el.style.left = (c.s/S.L.len*100) + '%'; $('prog').insertBefore(el, $('progName')); }
  const crew = $('crew'); crew.innerHTML = ''; if (mode === 'net' && n > 1) (names || []).forEach((nm, k) => { const d = document.createElement('div'); d.className = 'm'; d.innerHTML = '<i style="background:' + PCOL[k] + '"></i><span></span><b><u></u></b>'; d.children[1].textContent = nm + (k === seat ? ' (ты)' : ''); crew.appendChild(d); });
  const h = $('hint'), first = !BEST[G.LEVELS[0].id] && S.lv === 0; if (play) { h.textContent = !mine ? 'Мест на плоту нет — смотришь заплыв. В следующий возьмут.' : first || n > 1 && !store.get('pb_seen') ? (n > 1 ? 'Твой человечек — ' + PNAME[RUN.seat] + '. ' : '') + 'Джойстиком показываешь, куда лететь: человечек перебегает на другой край. Жмёшь ПУК — плот летит туда.' + (n > 1 ? ' Вместе в одну сторону — ЗАЛП!' : '') : S.L.tip; h.classList.remove('hide'); RUN.hintT = 9; if (n > 1) store.set('pb_seen', 1); } else h.classList.add('hide');
}
function splashAt(x, z, n, big) { const y = RUN ? RUN.ey : 0; for (let i = 0; i < n; i++) emit(x + (Math.random() - 0.5)*1.5, y + 0.2, z + (Math.random() - 0.5)*1.5, (Math.random() - 0.5)*8*big, 2.5 + Math.random()*4*big, (Math.random() - 0.5)*8*big, 0.6 + Math.random()*0.3, 0.3, 0.1, 1, 1, 1, 0.95, 0); }
const WHY = { croc: 'ХРУМ!', saw: 'ВЖ-Ж-ЖИК!', pool: 'БУЛЬК!', spike: 'ЛОП!', jaws: 'ХРЯСЬ!', edge: 'А-А-А-А!' };
function handle(ev) { const play = RUN.kind !== 'demo', S = RUN.S, hop = (v, sh, ch) => { for (const c of RAFT.crew) { c.vy = v + Math.random()*v*0.5; c.hop = Math.max(c.hop, 0.01); c.shock = sh; if (ch) c.cheer = ch; } }; for (const e of ev) { const t = e.t;
    if (t === 'bump' || t === 'boing' || t === 'punch') { const f = e.f == null ? 1 : e.f; RUN.shake = Math.max(RUN.shake, 0.25 + f*0.5); hop(2.2 + f*3, 0.6); splashAt(S.x, S.z, 8, 0.8);
      if (t === 'boing') { let best = null, bd = 1e9; for (const b of LV.K.bumps) { const d = Math.hypot(b.o.x - S.x, b.o.z - S.z); if (d < bd) { bd = d; best = b; } } if (best) best.sq = 1; }
      if (play) { if (t === 'boing') { SFX.boing(); shout(S.x, S.z, '#ffffff', 'БОИНГ'); } else if (t === 'punch') { SFX.boing(); SFX.bump(1); shout(S.x, S.z, '#ffffff', 'БАЦ!'); } else { SFX.bump(f); if (f > 0.35) shout(S.x, S.z, '#ffffff', 'БДЫЩ'); } buzz(f > 0.5 ? 'heavy' : 'medium'); } }
    else if (t === 'bean') { const b = LV.L.beans[e.k]; if (b) for (let i = 0; i < 14; i++) emit(b.x, RUN.ey + 0.6, b.z, (Math.random() - 0.5)*6, 3 + Math.random()*3, (Math.random() - 0.5)*6, 0.7, 0.3, 0.12, 1, 0.75 + Math.random()*0.2, 0.2, 1, 0); if (play) { SFX.bean(); pop('🥫 ТУРБО!', true); buzz('light'); } }
    else if (t === 'gold') { const b = LV.L.golds[e.k]; if (b) for (let i = 0; i < 18; i++) emit(b.x, RUN.ey + 0.8, b.z, (Math.random() - 0.5)*5, 3 + Math.random()*4, (Math.random() - 0.5)*5, 0.8, 0.26, 0.08, 1, 0.9, 0.35, 1, 0); if (play) { SFX.gold(); pop('🧻 ' + (G.goldCount(S) || 1) + ' из 3', true); buzz('light'); } }
    else if (t === 'cp') { if (play) { SFX.cp(); pop('✓ чекпойнт', true); buzz('light'); } }
    else if (t === 'volley') { for (const c of RAFT.crew) c.cheer = 0.8; if (play) { SFX.volley(); pop('ЗАЛП!'); buzz('heavy'); } }
    else if (t === 'wipe') { RUN.shake = 1; RUN.why = e.why; hop(5, 1.4); if (e.why !== 'edge') splashAt(S.x, S.z, 34, 1.4); if (play) { SFX.wipe(); pop(WHY[e.why] || 'БУЛЬК!'); buzz('heavy'); } }
    else if (t === 'back') { RUN.camA = null; RUN.ex = RUN.ez = RUN.ea = 0; RUN.why = ''; if (play) SFX.back(); }
    else if (t === 'boom') { const m = LV.L.mines[e.k]; RUN.shake = 1.2; if (m) for (let i = 0; i < 36; i++) { const hot = Math.random() < 0.6; emit(m.x, RUN.ey + 0.5, m.z, (Math.random() - 0.5)*11, 1 + Math.random()*7, (Math.random() - 0.5)*11, 0.5 + Math.random()*0.6, 0.5, hot ? 1.6 : 0.2, hot ? 1 : 0.25, hot ? 0.55 + Math.random()*0.3 : 0.25, hot ? 0.15 : 0.25, 0.95, hot ? 2.5 : 0); } hop(4, 1.2); if (play) { SFX.boom(); pop('БАБАХ!'); buzz('heavy'); } }
    else if (t === 'jump') { for (const c of RAFT.crew) c.cheer = 1; if (play) { SFX.jump(); pop('И-И-ХА!', true); buzz('medium'); } }
    else if (t === 'fall') { hop(3, 1.3, 1.2); if (play) { SFX.jump(); SFX.geyser(); pop('У-У-УХ!', true); buzz('heavy'); } }
    else if (t === 'geyser') { hop(3, 1, 0.9); if (play) { SFX.geyser(); pop('ПШ-Ш-Ш!', true); buzz('heavy'); } }
    else if (t === 'splash') { splashAt(S.x, S.z, 22, 1.1); RUN.shake = Math.max(RUN.shake, 0.4); if (play) SFX.splash(); }
    else if (t === 'finish' && RUN.kind === 'solo') finished({ lv: S.lv, time: e.time, stars: e.stars, bumps: S.bumps, volleys: S.volleys, wipes: S.wipes, gold: G.goldCount(S), n: 1 });
    else if (t === 'finish' && RUN.kind === 'demo') RUN.over = true; } }
function finished(r) {
  if (RUN) RUN.over = true; quiet(); SFX.finish(); buzz('heavy'); const L = G.LEVELS[r.lv], old = BEST[L.id], better = !old || r.time < old.t, gold = r.gold || 0;
  BEST[L.id] = { t: better ? r.time : old.t, g: Math.max(gold, old ? old.g || 0 : 0) }; store.set('pb_best', BEST);
  for (let i = 0; i < 90; i++) { const c = new THREE.Color().setHSL(Math.random(), 0.9, 0.6); emit(RUN.S.x + (Math.random() - 0.5)*8, RUN.ey + 3 + Math.random()*5, RUN.S.z + (Math.random() - 0.5)*8, (Math.random() - 0.5)*5, 2 + Math.random()*5, (Math.random() - 0.5)*5, 1.6 + Math.random(), 0.3, 0.2, c.r, c.g, c.b, 1, 0); }
  const quick = r.time <= L.par, all = gold >= 3, stars = 1 + (quick ? 1 : 0) + (all ? 1 : 0);
  $('oTitle').textContent = stars === 3 ? 'Вот это тяга!' : stars === 2 ? 'Доплыли!' : 'Дотянули…'; $('oStars').innerHTML = starsHtml(stars); $('oTime').textContent = fmt2(r.time);
  $('oBest').textContent = better && old ? 'Новый рекорд! Было ' + fmt2(old.t) : better ? 'Первый заплыв по этой реке' : 'Рекорд: ' + fmt2(old.t);
  $('oRows').innerHTML = '<div class="rw ok"><i>⭐</i>Доплыли до финиша</div><div class="rw' + (quick ? ' ok' : '') + '"><i>⭐</i>Быстрее ' + fmt(L.par).slice(0, -2) + '<b>' + (quick ? '✓' : '+' + (r.time - L.par).toFixed(1) + ' с') + '</b></div><div class="rw' + (all ? ' ok' : '') + '"><i>⭐</i>Все золотые рулоны<b>🧻 ' + gold + '/3</b></div>';
  $('oStat').innerHTML = '<span>💥 ударов: ' + r.bumps + '</span><span>🫧 утонули: ' + (r.wipes || 0) + '</span>' + (r.n > 1 ? '<span>💨 залпов: ' + r.volleys + '</span>' : '');
  const net = RUN.kind === 'net', cap = !net || (NET && NET.you === NET.cap), more = r.lv < G.LEVELS.length - 1;
  $('oNext').classList.toggle('hide', !cap || !more); $('oAgain').classList.toggle('hide', !cap); $('oHome').textContent = net ? (cap ? 'На берег, выбрать реку' : 'Выйти из экипажа') : 'Меню';
  if (!cap) $('oBest').textContent += ' · ждём капитана';
  setTimeout(() => { if (RUN && RUN.over && RUN.kind !== 'demo') show('over'); }, 900); renderLevels();
}
function home() { netLeave(); show('home'); $('hud').classList.remove('on'); quiet(); renderLevels(); begin('demo', Math.floor(Math.random()*G.LEVELS.length), 2); }
const OPEN_ALL = HERE && !TG;   // on the test copy in a plain browser every river is open, to look at them
function renderLevels() { const box = $('levels'); box.innerHTML = ''; G.LEVELS.forEach((d, i) => { const b = BEST[d.id], lock = !OPEN_ALL && i > 0 && !BEST[G.LEVELS[i - 1].id], el = document.createElement('div'); el.className = 'card lv' + (lock ? ' lock' : '');
    const st = b ? 1 + (b.t <= d.par ? 1 : 0) + ((b.g || 0) >= 3 ? 1 : 0) : 0;
    el.innerHTML = '<div class="n">' + (i + 1) + '</div><div class="nm">' + d.name + '</div><div class="st">' + (lock ? '🔒' : starsHtml(st)) + '</div><div class="bt">' + (lock ? 'пройди предыдущую' : b ? fmt2(b.t) + ' · 🧻 ' + (b.g || 0) + '/3' : 'ещё не пройдена') + '</div>';
    el.onclick = () => { if (lock) return toast('Сначала пройди «' + G.LEVELS[i - 1].name + '»'); audio(); begin('solo', i, 1); }; box.appendChild(el); }); }

// ---------- friends: the server runs the river, the phone shows it without waiting for the answer ----------
const qn = /[?&]name=([^&]{1,40})/.exec(location.search); if (qn) store.set('pb_gname', decodeURIComponent(qn[1]));
const initStr = () => TG ? TG.initData : HERE ? 'guest:' + (store.get('pb_gid') || (store.set('pb_gid', Math.random().toString(36).slice(2, 12).padEnd(8, 'x')), store.get('pb_gid'))) + ':' + encodeURIComponent(store.get('pb_gname') || 'Гость') : '';
function netSend(o) { if (NET && NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); }
function netLeave() { if (!NET) return; const N = NET; NET = null; clearInterval(N.ping); try { N.ws.close(); } catch (e) {} }
function netNew() { if (!initStr()) return toast('С друзьями играют в Telegram: @' + BOT, 3500); audio(); toast('Готовлю плот…', 1500);
  fetch(API + '/new', { method: 'POST', body: JSON.stringify({ init: initStr() }) }).then((r) => r.json()).then((r) => { if (r && r.ok) netJoin(r.id); else toast(r && r.err === 'auth' ? 'Открой игру через @' + BOT : 'Не получилось, попробуй ещё раз'); }).catch(() => toast('Нет связи с сервером')); }
function netJoin(room) { netLeave(); const N = NET = { room, ws: null, you: -1, cap: 0, crew: [], lv: 0, ph: 'bank', base: null, baseAt: 0, fresh: false, rtt: 120, lead: 4, log: [], lastA: 99, lastF: -1, sentAt: 0, heard: performance.now(), tries: 0, link: 'https://t.me/' + BOT + '?startapp=r_' + room, warned: false };
  const open = () => { if (NET !== N) return; const ws = N.ws = new WebSocket(API.replace(/^http/, 'ws') + '/ws?room=' + room + '&init=' + encodeURIComponent(initStr()));
    ws.onopen = () => { N.tries = 0; N.lastF = -1; N.heard = performance.now(); }; ws.onmessage = (e) => { if (NET !== N || N.ws !== ws) return; N.heard = performance.now(); let m = null; try { m = JSON.parse(e.data); } catch (err) { return; } netMsg(N, m); };
    ws.onclose = (e) => { if (NET !== N || N.ws !== ws) return; if (e.code === 4001) { toast('Игра открыта в другом окне'); return home(); } if (e.code === 4002) { toast('На этом плоту уже нет места'); return home(); }
      if (++N.tries > 8) { toast('Связь потерялась'); return home(); } toast('Связь пропала, возвращаюсь…', 1500); setTimeout(open, 700 + N.tries*400); }; };
  open(); N.ping = setInterval(() => { const ws = N.ws; if (ws && ws.readyState === 1 && performance.now() - N.heard > 5000) { N.ws = null; try { ws.close(); } catch (e) {} toast('Связь пропала, возвращаюсь…', 1500); return open(); } netSend({ t: 'p', c: performance.now() }); }, 1500); }
function netMsg(N, m) {
  if (m.t === 'q') { const r = performance.now() - m.c; N.rtt = N.rtt*0.7 + r*0.3; N.lead = clamp(N.rtt/STEP_MS + 0.6, 1, 9); }
  else if (m.t === 'room') { N.you = m.you; N.cap = m.cap; N.crew = m.crew; N.lv = m.lv; N.ph = m.ph; if (m.sv && m.sv !== VERSION && !N.warned) { N.warned = true; toast('Вышла новая версия — перезайди, когда будет удобно', 4000); }
    if (m.ph === 'bank') { if (!RUN || RUN.kind !== 'demo' || RUN.S.lv !== m.lv) begin('demo', m.lv, Math.max(2, m.crew.length)); show('room'); renderRoom(N, m); }
    else { const els = $('crew').children; m.crew.forEach((c, k) => { if (els[k]) els[k].classList.toggle('off', !c.on); }); if (m.ph === 'done' && RUN && RUN.over) finishedButtons(); } }
  else if (m.t === 'start') { begin('net', m.lv, m.n, m.names, m.seat); G.load(RUN.S, m.d); N.base = m.d; N.baseAt = performance.now(); N.fresh = false; N.log = []; N.lastF = -1; RUN.px = RUN.S.x; RUN.pz = RUN.S.z; RUN.pa = RUN.S.a; if (RUN.S.ph === 'done') RUN.over = true; }
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
// with my own moves put in at the moments I made them — so my man answers at once, whatever the ping
function netPredict(now) { const N = NET, S = RUN.S; if (!N || !N.base) return;
  G.load(S, N.base); const f = clamp((now - N.baseAt)/STEP_MS + N.lead, 0, 14), n = Math.floor(f); let li = 0;
  while (N.log.length > 1 && (N.log[1].t - N.baseAt)/STEP_MS + N.lead <= 0) N.log.shift();
  for (let i = 0; i <= n; i++) { while (li < N.log.length && (N.log[li].t - N.baseAt)/STEP_MS + N.lead <= i) { if (RUN.seat >= 0) G.input(S, RUN.seat, N.log[li].a, N.log[li].f); li++; }
    if (i === n) { RUN.px = S.x; RUN.pz = S.z; RUN.pa = S.a; } G.step(S); }
  RUN.k = S.ph === 'done' ? 1 : f - n; }

// ---------- every frame ----------
let last = performance.now(), T = 0;
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.1, (now - last)/1000); last = now; T += dt; U.uT.value = T; if (!RUN || !LV) return R.render(scene, cam);
  const S = RUN.S, kind = RUN.kind, play = kind !== 'demo', L = LV.L;
  if (kind === 'net') { if (!NET) return; const a = aimNow(), f = fireNow() ? 1 : 0, qa = a == null ? null : Math.round(a*100);
    if (RUN.seat >= 0 && NET.base && (f !== NET.lastF || (qa !== NET.lastA && (now - NET.sentAt > 45 || qa == null || NET.lastA == null)))) { NET.lastF = f; NET.lastA = qa; NET.sentAt = now; NET.log.push({ t: now, a, f }); netSend({ t: 'i', a: qa, f }); }
    netPredict(now); }
  else { RUN.acc += dt; let guard = 0; while (RUN.acc >= G.DT && guard++ < 5) { RUN.acc -= G.DT; RUN.px = S.x; RUN.pz = S.z; RUN.pa = S.a; if (kind === 'solo') G.input(S, 0, aimNow(), fireNow()); else G.pilot(S); G.step(S); handle(S.ev); if (RUN.S !== S) return; } if (guard >= 5) RUN.acc = 0; RUN.k = S.ph === 'done' ? 1 : RUN.acc/G.DT;
    if (kind === 'demo' && RUN.over && (RUN.end = (RUN.end || 0) + dt) > 2.5) { begin('demo', (S.lv + 1) % G.LEVELS.length, 2); return; } }
  // where to draw the raft: between the last two steps, and with any correction from the server eased in
  const tele = Math.hypot(S.x - RUN.px, S.z - RUN.pz) > 4;
  let x = tele ? S.x : lerp(RUN.px, S.x, RUN.k), z = tele ? S.z : lerp(RUN.pz, S.z, RUN.k), a = RUN.pa + wrap(S.a - RUN.pa)*RUN.k;
  if (kind === 'net' && NET.base) { if (NET.fresh) { NET.fresh = false; const ex = RUN.sx + S.vx*dt - x, ez = RUN.sz + S.vz*dt - z, ea = wrap(RUN.sa + S.w*dt - a); if (Math.hypot(ex, ez) < 4) { RUN.ex = ex; RUN.ez = ez; RUN.ea = ea; } else RUN.ex = RUN.ez = RUN.ea = 0; }
    const kk = Math.exp(-dt*9); RUN.ex *= kk; RUN.ez *= kk; RUN.ea *= kk; x += RUN.ex; z += RUN.ez; a += RUN.ea; }
  RUN.sx = x; RUN.sz = z; RUN.sa = a;
  const tm = S.tm - (1 - RUN.k)*G.DT, hot = S.turbo > 0, vol = S.volley > 0, sp = Math.hypot(S.vx, S.vz), loc = G.locate(L, x, z, S.hint), ey = G.elev(L, loc.s); RUN.ey = ey;
  // countdown
  const cnt = S.tm < 0 ? Math.ceil(-S.tm) : 0; if (cnt !== RUN.cnt) { if (play) { if (cnt > 0) { pop(String(cnt)); SFX.count(); } else if (RUN.cnt === 1) { pop('ПОПЁРЛИ!', true); SFX.go(); } } RUN.cnt = cnt; }
  // the raft: bobbing, flying, sinking or falling off the edge of the sky
  const g = RAFT.g, bob = Math.sin(T*2.3)*0.035, hgt = G.height(S), under = S.dead > 0 ? 1 - S.dead/G.DEAD_T : 0, lift = hgt - (RUN.why === 'edge' ? under*under*26 : under*1.6);
  g.position.set(x, ey + lift, z); g.visible = !(S.safe > 0 && S.ph === 'run' && Math.floor(T*11) % 2); RAFT.deck.rotation.y = -a; RAFT.b.position.y = 0.06 + bob;
  RAFT.b.rotation.x = Math.sin(T*1.7)*0.03 + under*(RUN.why === 'edge' ? 2.5 : 1.3); RAFT.b.rotation.z = Math.sin(T*2.1 + 1)*0.025 + (hgt > 0 ? Math.sin(T*9)*0.12 : 0) - under*0.5;
  RAFT.shadow.position.y = 0.035 - lift; RAFT.shadow.visible = under === 0 && !(loc.open && loc.dist > loc.w); RAFT.shadow.scale.setScalar(1.85/(1 + hgt*0.3)); RAFT.flag.rotation.y = Math.sin(T*9)*0.25*clamp(sp/5, 0.2, 1) + Math.atan2(S.vz, S.vx)*0 ;
  // the crew: each stands where the rules say, but two on the same spot are drawn side by side
  const N = S.crew.length, ang = S.crew.map((c) => a + c.phi); for (let it = 0; it < 3; it++) for (let p = 0; p < N; p++) for (let q = p + 1; q < N; q++) { const d = wrap(ang[q] - ang[p]); if (Math.abs(d) < 0.5) { const push = (0.5 - Math.abs(d))/2*(d >= 0 ? 1 : -1); ang[p] -= push; ang[q] += push; } }
  S.crew.forEach((j, k) => { const c = RAFT.crew[k]; if (!c) return; const fire = j.fire && S.ph === 'run' && S.dead <= 0; if (RUN.over) c.party = true; const al = ang[k], ca = Math.cos(al), sa = Math.sin(al);
    c.c.position.x = ca*1.02; c.c.position.z = sa*1.02; c.c.rotation.y = -(al + Math.PI);
    if (guyStep(c, j, S.ph === 'run', dt, fire) && play) shout(x + ca*1.9, z + sa*1.9, PCOL[k]);
    if (play) fartSound(k, fire, j.g, hot || vol);
    if (fire) { c.puffAcc += dt*(vol ? 70 : hot ? 55 : 34); while (c.puffAcc >= 1) { c.puffAcc -= 1; const v = 4 + Math.random()*3, sx = (Math.random() - 0.5)*2.2, big = vol ? 1.5 : 1, col = hot ? [1, 0.62 + Math.random()*0.2, 0.2] : [0.72 + Math.random()*0.12, 0.88, 0.25 + Math.random()*0.12];
        emit(x + ca*1.75, ey + lift + 0.65 + Math.random()*0.25, z + sa*1.75, ca*v - sa*sx + S.vx*0.5, 0.5 + Math.random()*0.9, sa*v + ca*sx + S.vz*0.5, 0.75 + Math.random()*0.5, 0.25*big, (0.95 + Math.random()*0.6)*big, col[0], col[1], col[2], 0.92); } } });
  // the arrow: where my push would send us
  const me = kind === 'solo' ? 0 : kind === 'net' ? RUN.seat : -1, mc = me >= 0 ? S.crew[me] : null; RAFT.arrow.visible = !!mc && mc.aim != null && S.ph === 'run' && S.dead <= 0; if (RAFT.arrow.visible) { RAFT.arrow.rotation.y = -mc.aim; RAFT.arrow.children[0].material.color.set(PCOL[me]); RAFT.arrow.children[0].material.opacity = mc.fire ? 0.95 : 0.55; RAFT.arrow.position.y = 0.06 - lift; }
  if (sp > 2.5 && hgt === 0 && under === 0 && Math.random() < dt*sp*3) { const b = Math.atan2(S.vz, S.vx) + Math.PI + (Math.random() - 0.5)*1.6; emit(x + Math.cos(b)*1.4, ey + 0.06, z + Math.sin(b)*1.4, 0, 0, 0, 1.0, 0.25, 0.7, 1, 1, 1, 0.55); }
  // flecks of foam and leaves riding the current, so you can see where it runs and how fast
  for (let q = 0; q < 2; q++) if (Math.random() < dt*16) { const fs = clamp(loc.s - 10 + Math.random()*46, 0.5, L.len - 0.5), fm = L.mid(fs), fl = (Math.random()*2 - 1)*(fm.w - 0.4), fx = fm.x - fm.tz*fl, fz = fm.z + fm.tx*fl; if (L.gaps.some((gp) => fs > gp[0] && fs < gp[1])) continue;
    const cu = G.current(L, G.locate(L, fx, fz, Math.floor(fs/2))), leaf = Math.random() < 0.25; emit(fx, G.elev(L, fs) + 0.05, fz, cu[0], 0, cu[1], 1.8 + Math.random()*1.2, leaf ? 0.2 : 0.13, leaf ? 0.18 : 0.08, leaf ? 0.95 : 1, leaf ? 0.8 : 1, leaf ? 0.3 : 1, leaf ? 0.9 : 0.75, 0.02); }
  if (LV.Tm.fireflies && Math.random() < dt*10) emit(x + (Math.random() - 0.5)*30, ey + 0.5 + Math.random()*3, z + (Math.random() - 0.5)*30, (Math.random() - 0.5)*0.8, 0.2, (Math.random() - 0.5)*0.8, 2.2, 0.16, 0.05, 1, 0.95, 0.4, 1);
  puffStep(dt); shoutStep(dt);
  // the river's moving parts
  for (const u of LV.K.upd) u(tm, S, dt); if (LV.K.bang) { LV.K.bang = false; if (play) SFX.cannon(); }
  // camera: behind the raft, looking down the river
  const P = L.P, j2 = Math.min(P.length - 1, loc.i + 5), want = j2 > loc.i + 1 ? Math.atan2(P[j2].z - P[loc.i].z, P[j2].x - P[loc.i].x) : Math.atan2(loc.tz, loc.tx);
  RUN.camA = RUN.camA == null ? want : RUN.camA + wrap(want - RUN.camA)*Math.min(1, dt*2.2); RUN.cy += (ey - RUN.cy)*Math.min(1, dt*3.5);
  const orbit = play ? 0 : Math.sin(T*0.25)*0.5, ca = RUN.camA + orbit, cx = Math.cos(ca), cz = Math.sin(ca), back = CAMD*(play ? 0.54 : 0.66), up = CAMD*(play ? 0.84 : 0.66);
  RUN.shake *= Math.exp(-dt*7); const shx = (Math.random() - 0.5)*RUN.shake, shz = (Math.random() - 0.5)*RUN.shake, fov = FOV0 + (hot || vol ? 5 : 0) + clamp(sp - 7, 0, 5)*0.6; if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov)*Math.min(1, dt*5); cam.updateProjectionMatrix(); }
  cam.position.set(x - cx*back + shx, RUN.cy + up, z - cz*back + shz); cam.lookAt(x + cx*CAMD*0.17 + shx, RUN.cy, z + cz*CAMD*0.17 + shz);
  // the panel
  if (play) { $('hTime').textContent = fmt(S.ph === 'done' ? S.time : S.tm); const pr = clamp(S.s/L.len, 0, 1)*100; $('progFill').style.width = pr + '%'; $('progRaft').style.left = clamp(pr, 5, 92) + '%';
    if (mc) { const el = $('bFart'); el.style.setProperty('--g', Math.round(mc.g*100)); el.classList.toggle('on', mc.fire); el.classList.toggle('dry', mc.on && !mc.fire && S.ph === 'run'); }
    const els = $('crew').children; for (let k = 0; k < els.length; k++) els[k].querySelector('u').style.width = Math.round(S.crew[k].g*100) + '%';
    const gc = G.goldCount(S); if (gc !== RUN.goldShown) { RUN.goldShown = gc; $('goal').innerHTML = '⭐ финиш · ⭐ до ' + fmt(L.par).slice(0, -2) + ' · ⭐ 🧻 <b>' + gc + '/3</b>'; }
    if (RUN.hintT > 0 && (RUN.hintT -= dt) <= 0) $('hint').classList.add('hide'); }
  R.render(scene, cam);
}

// ---------- hands: a stick under the left thumb, the button under the right ----------
{ const zone = $('stickZone'), joy = $('joy'), knob = $('knob'); let id = null, ox = 0, oy = 0; const RAD = 52;
  const move = (e) => { let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy); if (d > RAD) { dx *= RAD/d; dy *= RAD/d; } CTL.jx = dx/RAD; CTL.jy = -dy/RAD; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; };
  zone.addEventListener('pointerdown', (e) => { if (id != null) return; e.preventDefault(); audio(); id = e.pointerId; try { zone.setPointerCapture(id); } catch (err) {} ox = e.clientX; oy = e.clientY; joy.style.left = ox + 'px'; joy.style.top = oy + 'px'; joy.classList.add('on'); move(e); });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) { e.preventDefault(); move(e); } });
  const up = (e) => { if (e.pointerId !== id) return; id = null; CTL.jx = CTL.jy = 0; knob.style.transform = ''; joy.classList.remove('on'); }; zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up); zone.addEventListener('lostpointercapture', up); zone.addEventListener('contextmenu', (e) => e.preventDefault());
  const fb = $('bFart'), down = (e) => { e.preventDefault(); audio(); CTL.bf = true; try { fb.setPointerCapture(e.pointerId); } catch (err) {} }, off = (e) => { e.preventDefault(); CTL.bf = false; };
  fb.addEventListener('pointerdown', down); fb.addEventListener('pointerup', off); fb.addEventListener('pointercancel', off); fb.addEventListener('lostpointercapture', off); fb.addEventListener('contextmenu', (e) => e.preventDefault()); }
const KEY = { KeyA: 'kl', ArrowLeft: 'kl', KeyD: 'kr', ArrowRight: 'kr', KeyW: 'ku', ArrowUp: 'ku', KeyS: 'kd', ArrowDown: 'kd', Space: 'kf', Enter: 'kf', ShiftLeft: 'kf', ShiftRight: 'kf' };
addEventListener('keydown', (e) => { const k = KEY[e.code]; if (k) { e.preventDefault(); audio(); CTL[k] = true; } else if (e.code === 'KeyR' && RUN && RUN.kind === 'solo') begin('solo', RUN.S.lv, 1); else if (e.code === 'Escape' && RUN && RUN.kind === 'solo') home(); });
addEventListener('keyup', (e) => { const k = KEY[e.code]; if (k) CTL[k] = false; });
addEventListener('blur', () => { CTL.kl = CTL.kr = CTL.ku = CTL.kd = CTL.kf = CTL.bf = false; CTL.jx = CTL.jy = 0; });
$('mute').onclick = () => { audio(); setMute(!MUTE); };
$('quit').onclick = () => home();
$('redo').onclick = () => { if (RUN && RUN.kind === 'solo') begin('solo', RUN.S.lv, 1); };
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
const sp0 = (TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || '', rm = /^r_([a-z0-9]{6,12})$/.exec(sp0) || /[?&]room=([a-z0-9]{6,12})/.exec(location.search); if (rm && initStr()) netJoin(rm[1]);
window.__pb = { get RUN() { return RUN; }, get NET() { return NET; }, G, begin, CTL, get LV() { return LV; } };
