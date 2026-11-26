// Пердёж-балдёж: one raft, several jets. The whole game in one place: the server runs it for a room of friends,
// the phone runs it when you play alone. Everything is fixed-step and has no randomness, so a run is repeatable.

export const VERSION = '0.1';   // one number for the page and the server
export const DT = 1/30;         // seconds a step
export const RR = 1.25;         // the raft, for bumping into things, is a disc this big
export const MAXP = 4;

// --- how the raft moves ---------------------------------------------------------
const FT = 7.8;        // push of all jets together (m/s2)
const KF = 0.85;       // water drag along the raft
const KL = 2.6;        // water drag sideways (it does not skid like on ice)
const KW = 2.3;        // drag on spinning
const KT = 1.08;       // how hard an off-centre jet turns the raft
export const GAS_DRAIN = 0.34, GAS_FILL = 0.5, GAS_WAIT = 0.25;   // a tank lasts about 3 s of holding, refills in 2
export const VOLLEY_WINDOW = 0.25, VOLLEY_TIME = 0.8, VOLLEY_REST = 1.5, TURBO_TIME = 1.3;
// where the jets sit across the back of the raft, left to right (metres from the middle; + is the right-hand side)
export const SEATS = { 1: [-0.9, 0.9], 2: [-0.9, 0.9], 3: [-1.0, 0, 1.0], 4: [-1.05, -0.38, 0.38, 1.05] };
// alone you work both jets yourself; with friends everyone has one
export const jetOwner = (n, j) => n === 1 ? 0 : j;

const wrap = (a) => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };
const q2 = (v) => Math.round(v*100)/100;

// --- rivers ---------------------------------------------------------------------
// A river is drawn as a path: ['s', metres] straight on, ['t', degrees, radius] a bend (+ to the right), ['w', width]
// the half-width from here on. Things in it are placed by how far along (s) and how far right of the middle (lat).
const STEP = 2;
export const LEVELS = [
  { id: 'brook', name: 'Ручеёк', par: 18, w: 7,
    path: [['s', 30], ['t', 25, 40], ['s', 20], ['t', -25, 40], ['s', 40]],
    rocks: [[52, -2.5, 1.3], [78, 2.8, 1.4]], beans: [[40, 0], [70, -2], [100, 1]] },
  { id: 'bends', name: 'Излучина', par: 38, w: 6.5,
    path: [['s', 24], ['t', 70, 22], ['s', 16], ['t', -110, 20], ['s', 14], ['t', 80, 22], ['s', 22], ['t', -40, 30], ['s', 30]],
    rocks: [[30, 2.5, 1.2], [96, -2.2, 1.3], [150, 2.4, 1.2], [176, -1.5, 1.2]], beans: [[20, 0], [70, 2], [118, -2], [160, 0], [190, 2]] },
  { id: 'rocks', name: 'Каменный слалом', par: 44, w: 7.5,
    path: [['s', 30], ['t', 30, 45], ['s', 50], ['t', -45, 40], ['s', 45], ['t', 20, 50], ['s', 40]],
    rocks: [[28, -3, 1.5], [44, 3, 1.5], [60, -2.6, 1.6], [76, 2.8, 1.6], [92, -3, 1.5], [108, 1.5, 1.4], [108, -4.6, 1.2], [128, 3.4, 1.7], [146, -1, 1.5], [164, 3.6, 1.4], [164, -3.8, 1.4], [186, 0, 1.6], [206, -3, 1.5], [222, 3, 1.5]],
    beans: [[36, 1], [68, 0], [100, 3.6], [136, -3], [176, 3], [198, 2.5], [232, 0]] },
  { id: 'mill', name: 'Лесопилка', par: 52, w: 7.5,
    path: [['s', 34], ['t', -50, 30], ['s', 40], ['t', 90, 26], ['s', 36], ['t', -60, 28], ['s', 30], ['w', 6], ['s', 40]],
    rocks: [[22, 3, 1.4], [70, -3.4, 1.4], [150, 3.2, 1.5], [214, -2.4, 1.3], [236, 2.4, 1.3]],
    logs: [[46, 0, 3.4, 0.9, 0], [96, 0.5, 3.6, -1.0, 1], [128, -0.5, 3.4, 1.1, 2], [176, 0, 3.8, -0.9, 0.5], [258, 0, 3.0, 1.2, 1.5]],
    beans: [[30, -2], [84, 3], [112, -3.4], [160, -3], [196, 2], [246, 0]] },
  { id: 'pools', name: 'Чёртовы воронки', par: 48, w: 8,
    path: [['s', 30], ['t', 60, 28], ['s', 30], ['w', 5.2], ['s', 26], ['w', 8.5], ['t', -100, 24], ['s', 36], ['t', 70, 26], ['w', 5.5], ['s', 30], ['w', 8], ['t', -30, 40], ['s', 40]],
    rocks: [[24, -3.4, 1.4], [70, 3.6, 1.5], [150, -3.8, 1.6], [196, 3.4, 1.4], [276, -3, 1.5], [300, 3, 1.5]],
    pools: [[44, 2.4, 4.2, 9], [132, -1.5, 4.6, 10], [182, -2.6, 4.2, 10], [236, 2.6, 4.4, 11], [288, 0, 4.0, 10]],
    rapids: [[100, 0, 4.5], [258, 0, 4.5]],
    beans: [[34, -3], [88, 0], [118, 3.6], [166, 3.4], [222, -3.4], [270, 3.4], [312, 0]] },
  { id: 'gorge', name: 'Большой каньон', par: 92, w: 7,
    path: [['s', 26], ['t', 80, 22], ['s', 20], ['t', -80, 22], ['w', 5], ['s', 30], ['w', 7.5], ['t', -90, 24], ['s', 30], ['t', 120, 22], ['s', 24], ['w', 5.4], ['t', -60, 26], ['s', 26], ['w', 8], ['t', 50, 30], ['s', 30], ['t', -70, 24], ['s', 40]],
    rocks: [[20, 2.6, 1.3], [60, -2.8, 1.4], [118, 3, 1.4], [150, -3.4, 1.5], [206, 3.2, 1.4], [296, -3.6, 1.5], [314, 3.4, 1.5], [372, -2.6, 1.4], [398, 2.8, 1.4], [420, -1, 1.4]],
    logs: [[136, 0, 3.4, 1.0, 0], [226, 0.4, 3.2, -1.2, 1], [330, 0, 3.8, 1.0, 2], [408, -3.5, 2.6, -1.3, 0]],
    pools: [[174, 1.5, 4.2, 10], [284, 0, 4.4, 11], [352, 2.8, 4.0, 10]],
    rapids: [[88, 0, 4], [258, 0, 4], [386, 0, 4.5]],
    beans: [[34, 0], [76, 2.6], [108, -3], [164, -3], [196, -2.8], [244, 0], [306, 0], [344, -3.2], [380, 3], [430, 2]] },
];

const BUILT = new Map();
export function level(i) {
  const k = Math.max(0, Math.min(LEVELS.length - 1, i | 0)); if (BUILT.has(k)) return BUILT.get(k);
  const def = LEVELS[k], P = []; let x = 0, z = 0, a = -Math.PI/2, w = def.w, wT = def.w, s = 0;
  const put = () => { w += Math.max(-0.3, Math.min(0.3, wT - w)); P.push({ x: q2(x), z: q2(z), a, w: q2(w), s }); };
  put();
  for (const c of def.path) {
    if (c[0] === 'w') { wT = c[1]; continue; }
    if (c[0] === 's') { const n = Math.round(c[1]/STEP); for (let i = 0; i < n; i++) { x += Math.cos(a)*STEP; z += Math.sin(a)*STEP; s += STEP; put(); } }
    else { const ang = c[1]*Math.PI/180, n = Math.max(1, Math.round(Math.abs(ang)*c[2]/STEP)), da = ang/n;
      for (let i = 0; i < n; i++) { a += da/2; x += Math.cos(a)*STEP; z += Math.sin(a)*STEP; a += da/2; s += STEP; put(); } }
  }
  const L = { i: k, id: def.id, name: def.name, par: def.par, P, len: s, flow: 1.4 };
  const at = (sv, lat) => { const j = Math.max(0, Math.min(P.length - 2, Math.floor(sv/STEP))), t = sv/STEP - j, p = P[j], p2 = P[j + 1], ax = p.x + (p2.x - p.x)*t, az = p.z + (p2.z - p.z)*t, ta = Math.atan2(p2.z - p.z, p2.x - p.x);
    return [q2(ax - Math.sin(ta)*lat), q2(az + Math.cos(ta)*lat)]; };
  L.at = at;
  L.rocks = (def.rocks || []).map(([sv, lat, r]) => { const [ox, oz] = at(sv, lat); return { s: sv, lat, x: ox, z: oz, r }; });
  L.logs = (def.logs || []).map(([sv, lat, hl, sp, ph]) => { const [ox, oz] = at(sv, lat); return { s: sv, lat, x: ox, z: oz, hl, sp, ph }; });
  L.pools = (def.pools || []).map(([sv, lat, r, k2]) => { const [ox, oz] = at(sv, lat); return { s: sv, lat, x: ox, z: oz, r, k: k2 }; });
  L.rapids = (def.rapids || []).map(([sv, lat, r]) => { const [ox, oz] = at(sv, lat); return { s: sv, lat, x: ox, z: oz, r }; });
  L.beans = (def.beans || []).map(([sv, lat]) => { const [ox, oz] = at(sv, lat); return { s: sv, lat, x: ox, z: oz }; });
  BUILT.set(k, L); return L;
}

// where is a point relative to the river: how far along, how far right of the middle, how wide the river is there
export function locate(L, x, z, hint) {
  const P = L.P; let best = null, bd = 1e18; const from = Math.max(0, (hint | 0) - 4), to = Math.min(P.length - 2, (hint | 0) + 8);
  for (let i = from; i <= to; i++) { const p = P[i], p2 = P[i + 1], dx = p2.x - p.x, dz = p2.z - p.z, l2 = dx*dx + dz*dz; let t = ((x - p.x)*dx + (z - p.z)*dz)/l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = p.x + dx*t, cz = p.z + dz*t, d2 = (x - cx)*(x - cx) + (z - cz)*(z - cz); if (d2 < bd) { bd = d2; best = { i, t, cx, cz, tx: dx/Math.sqrt(l2), tz: dz/Math.sqrt(l2), w: p.w + (p2.w - p.w)*t, s: p.s + (p2.s - p.s)*t }; } }
  best.d = (x - best.cx)*(-best.tz) + (z - best.cz)*best.tx;   // + to the right of the middle
  best.dist = Math.sqrt(bd); return best;
}

// --- a run ----------------------------------------------------------------------
export function newRun(lv, n) {
  const L = level(lv), N = Math.max(1, Math.min(MAXP, n | 0)), offs = SEATS[N], p0 = L.P[1];
  return { lv: L.i, L, n: N, jets: offs.map((off) => ({ off, g: 1, on: false, fire: false, wait: 0, press: -9 })),
    x: p0.x, z: p0.z, a: -Math.PI/2, vx: 0, vz: 0, w: 0, hint: 1, s: p0.s, tick: 0, tm: -3, ph: 'count',
    beans: L.beans.map(() => false), turbo: 0, volley: 0, rest: 0, volleys: 0, bumps: 0, time: 0, stars: 0, ev: [] };
}
// a player holds or lets go: `bits` are that player's jets (alone: bit 0 the left one, bit 1 the right one; with friends: bit 0)
export function input(S, player, bits) {
  S.jets.forEach((j, k) => { if (jetOwner(S.n, k) !== player) return; j.on = !!(S.n === 1 ? (bits >> k) & 1 : bits & 1); });
}
export const starsFor = (L, t) => t <= L.par ? 3 : t <= L.par*1.45 ? 2 : 1;

function bounce(S, nx, nz, depth, ovx, ovz) {
  S.x += nx*depth; S.z += nz*depth;
  const rvx = S.vx - ovx, rvz = S.vz - ovz, vn = rvx*nx + rvz*nz; if (vn >= 0) return;
  const tx = -nz, tz = nx, vt = rvx*tx + rvz*tz;
  S.vx = ovx + tx*vt*0.9 - nx*vn*0.4; S.vz = ovz + tz*vt*0.9 - nz*vn*0.4;
  S.w += (nx*Math.sin(S.a) - nz*Math.cos(S.a))*Math.min(3, -vn)*0.3;   // a knock off-centre spins the raft a little
  if (-vn > 1.4) { S.bumps++; S.ev.push({ t: 'bump', f: q2(Math.min(1, -vn/7)) }); }
}

export function step(S) {
  S.ev = []; if (S.ph === 'done') return;
  const was = S.tm; S.tick++; S.tm = S.tick/30 - 3;
  if (S.tm < 0) { if (Math.ceil(-S.tm) !== Math.ceil(-was)) S.ev.push({ t: 'count', n: Math.ceil(-S.tm) }); return; }
  if (S.ph === 'count') { S.ph = 'run'; S.ev.push({ t: 'go' }); }
  const L = S.L, J = S.jets.length;
  // tanks, and who is really pushing
  for (let k = 0; k < J; k++) { const j = S.jets[k], firing = j.on && j.g > 0.02;
    if (firing && !j.fire) { j.press = S.tm; S.ev.push({ t: 'fart', j: k }); }
    if (j.on && !firing && j.fire) S.ev.push({ t: 'empty', j: k });
    j.fire = firing;
    if (firing) { j.g = Math.max(0, j.g - GAS_DRAIN*DT); j.wait = GAS_WAIT; } else if (!j.on) { j.wait -= DT; if (j.wait <= 0) j.g = Math.min(1, j.g + GAS_FILL*DT); } }
  // all jets started within a quarter of a second of each other: a volley, half as strong again for a moment
  S.rest -= DT; S.volley -= DT; S.turbo -= DT;
  if (S.rest <= 0 && S.jets.every((j) => j.fire && S.tm - j.press < VOLLEY_WINDOW + 0.001) && S.jets.some((j) => S.tm - j.press < DT*1.5)) { S.volley = VOLLEY_TIME; S.rest = VOLLEY_REST; S.volleys++; S.ev.push({ t: 'volley' }); }
  const mult = (S.volley > 0 ? 1.5 : 1)*(S.turbo > 0 ? 1.4 : 1);
  const fx = Math.cos(S.a), fz = Math.sin(S.a), rx = -fz, rz = fx;
  let ax = 0, az = 0, al = 0;
  for (const j of S.jets) if (j.fire) { const F = FT/J*mult; ax += fx*F; az += fz*F; al -= j.off*F*KT; }
  // the water: it flows down the river, races through rapids, and circles into whirlpools
  let loc = locate(L, S.x, S.z, S.hint); S.hint = loc.i;
  let wx = loc.tx*L.flow, wz = loc.tz*L.flow;
  for (const r of L.rapids) { const dx = S.x - r.x, dz = S.z - r.z; if (dx*dx + dz*dz < r.r*r.r) { wx += loc.tx*7; wz += loc.tz*7; } }
  for (const p of L.pools) { const dx = p.x - S.x, dz = p.z - S.z, d = Math.hypot(dx, dz); if (d < p.r && d > 0.01) { const k = 1 - d/p.r; ax += dx/d*p.k*k; az += dz/d*p.k*k; wx += -dz/d*3.2*k; wz += dx/d*3.2*k; al += 1.6*k; } }
  const ux = S.vx - wx, uz = S.vz - wz, uf = ux*fx + uz*fz, ul = ux*rx + uz*rz;
  ax -= KF*uf*fx + KL*ul*rx; az -= KF*uf*fz + KL*ul*rz;
  S.vx += ax*DT; S.vz += az*DT; S.w += (al - KW*S.w)*DT;
  S.x += S.vx*DT; S.z += S.vz*DT; S.a = wrap(S.a + S.w*DT);
  // banks
  loc = locate(L, S.x, S.z, S.hint); S.hint = loc.i;
  const lim = loc.w - RR;
  if (loc.dist > lim) { const d = loc.dist || 1, nx = (loc.cx - S.x)/d, nz = (loc.cz - S.z)/d; bounce(S, nx, nz, loc.dist - lim, 0, 0); }
  // rocks
  for (const r of L.rocks) { const dx = S.x - r.x, dz = S.z - r.z, d = Math.hypot(dx, dz), m = r.r + RR; if (d < m && d > 0.001) bounce(S, dx/d, dz/d, m - d, 0, 0); }
  // spinning logs
  for (const g of L.logs) { const th = g.ph + g.sp*S.tm, cx = Math.cos(th), cz = Math.sin(th); let t = (S.x - g.x)*cx + (S.z - g.z)*cz; t = t < -g.hl ? -g.hl : t > g.hl ? g.hl : t;
    const qx = g.x + cx*t, qz = g.z + cz*t, dx = S.x - qx, dz = S.z - qz, d = Math.hypot(dx, dz), m = RR + 0.4; if (d < m && d > 0.001) bounce(S, dx/d, dz/d, m - d, -g.sp*(qz - g.z), g.sp*(qx - g.x)); }
  // tins of beans: every tank full, and a turbo
  L.beans.forEach((b, k) => { if (S.beans[k]) return; const dx = S.x - b.x, dz = S.z - b.z; if (dx*dx + dz*dz < 2.9) { S.beans[k] = true; for (const j of S.jets) j.g = 1; S.turbo = TURBO_TIME; S.ev.push({ t: 'bean', k }); } });
  S.s = loc.s;
  if (S.s >= L.len - 1.5) { S.ph = 'done'; S.time = Math.round(S.tm*100)/100; S.stars = starsFor(L, S.time); S.ev.push({ t: 'finish', time: S.time, stars: S.stars }); }
}

// --- the wire: the whole state is small, so the server sends all of it and a phone can carry on from any message ---
const PH = ['count', 'run', 'done'];
export function save(S) {
  let beans = 0; S.beans.forEach((b, k) => { if (b) beans |= 1 << k; });
  return [S.tick, Math.round(S.x*100), Math.round(S.z*100), Math.round(S.a*1000), Math.round(S.vx*100), Math.round(S.vz*100), Math.round(S.w*1000),
    S.jets.map((j) => [Math.round(j.g*1000), (j.on ? 1 : 0) | (j.fire ? 2 : 0), Math.round(Math.max(-1, j.wait)*1000), Math.round(j.press*1000)]),
    beans, Math.round(Math.max(-1, S.turbo)*1000), Math.round(Math.max(-1, S.volley)*1000), Math.round(Math.max(-1, S.rest)*1000), PH.indexOf(S.ph), S.bumps, S.volleys, S.hint, Math.round(S.time*100)];
}
export function load(S, o) {
  S.tick = o[0]; S.tm = S.tick/30 - 3; S.x = o[1]/100; S.z = o[2]/100; S.a = o[3]/1000; S.vx = o[4]/100; S.vz = o[5]/100; S.w = o[6]/1000;
  for (let k = 0; k < S.jets.length; k++) { const j = S.jets[k], q = o[7][k]; if (!q) continue; j.g = q[0]/1000; j.on = !!(q[1] & 1); j.fire = !!(q[1] & 2); j.wait = q[2]/1000; j.press = q[3]/1000; }
  for (let k = 0; k < S.beans.length; k++) S.beans[k] = !!(o[8] >> k & 1);
  S.turbo = o[9]/1000; S.volley = o[10]/1000; S.rest = o[11]/1000; S.ph = PH[o[12]] || 'run'; S.bumps = o[13]; S.volleys = o[14]; S.hint = o[15]; S.time = (o[16] || 0)/100; S.stars = S.ph === 'done' ? starsFor(S.L, S.time) : 0;
  S.s = locate(S.L, S.x, S.z, S.hint).s; S.ev = []; return S;
}

// --- a helmsman: steers a whole raft by itself. Used to prove every river can be run, to set the star times, and to
// work the jet of a friend whose phone dropped out. `only` limits it to some jets (the rest are left as they are).
export function pilot(S, only) {
  const L = S.L, loc = locate(L, S.x, S.z, S.hint), sp = Math.hypot(S.vx, S.vz);
  // aim at the middle of the river some way ahead, shifted sideways round whatever is in the way
  const ahead = loc.s + 5 + sp*0.7; let lat = 0, near = 1e9;
  const avoid = (o, r) => { const ds = o.s - loc.s; if (ds < -2 || ds > 13 || ds > near) return; const j = Math.max(0, Math.min(L.P.length - 1, Math.round(o.s/STEP))), w = L.P[j].w - RR - 0.4, need = r + RR + 0.9;
    const left = o.lat - need, right = o.lat + need; near = ds; lat = (Math.abs(left) < Math.abs(right) ? (left > -w ? left : right) : (right < w ? right : left)); lat = Math.max(-w, Math.min(w, lat)); };
  for (const o of L.rocks) avoid(o, o.r); for (const o of L.logs) avoid(o, o.hl*0.9); for (const o of L.pools) avoid(o, o.r*0.75);
  if (near > 12) for (let k = 0; k < L.beans.length; k++) { const b = L.beans[k], ds = b.s - loc.s; if (!S.beans[k] && ds > 1 && ds < 12) { lat = b.lat; break; } }
  const [tx, tz] = L.at(Math.min(L.len, ahead), lat), want = Math.atan2(tz - S.z, tx - S.x);
  const e = wrap(want - S.a) - S.w*0.35;   // + : the bow must come round to the right
  S.jets.forEach((j, k) => { if (only && !only.includes(k)) return;
    let on = Math.abs(e) < 0.22 ? true : e > 0 ? j.off < 0.01 : j.off > -0.01;      // right turn: the left-hand jets push
    if (Math.abs(e) > 0.5 && Math.abs(j.off) < 0.01) on = false;
    if (j.g < 0.06) j.rest = true; if (j.g > 0.3) j.rest = false; j.on = on && !j.rest; });
}
