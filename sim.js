// Пердёж-балдёж: one raft, several jets. The whole game in one place: the server runs it for a room of friends,
// the phone runs it when you play alone. Everything is fixed-step and has no randomness, so a run is repeatable.

export const VERSION = '0.4';   // one number for the page and the server
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
export const AIR_T = 0.95, AIR_H = 1.7, DEAD_T = 1.4, SAFE_T = 1.6;   // a jump, sinking, and the moment of safety after coming back
// where the jets sit across the back of the raft, left to right (metres from the middle; + is the right-hand side)
export const SEATS = { 1: [-0.9, 0.9], 2: [-0.9, 0.9], 3: [-1.0, 0, 1.0], 4: [-1.05, -0.38, 0.38, 1.05] };
// alone you work both jets yourself; with friends everyone has one
export const jetOwner = (n, j) => n === 1 ? 0 : j;

const wrap = (a) => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };
const q2 = (v) => Math.round(v*100)/100, frac = (v) => v - Math.floor(v);

// --- rivers ---------------------------------------------------------------------
// A river is drawn as a path: ['s', metres] straight on, ['t', degrees, radius] a bend (+ to the right), ['w', width]
// the half-width from here on. Things in it are placed by how far along (s, metres) and how far across (-1 the left
// bank, 0 the middle, 1 the right bank):
//   rock s across r          a stone                       bump s across r        a buoy that throws you back
//   wall s from to           a pier across part of it      reef s from to         low stones: only a jump clears them
//   log s across half speed phase      a log spinning on a post
//   croc|saw s from to period phase    swims / slides across and back; touching it sinks the raft
//   ball s side period phase           a cannon on the bank (side -1 left, 1 right) shooting across
//   barge s from to period phase half  a ferry going across and back
//   mine s across            blows the raft away, once     gate s period open phase   a barrier that lifts on a timer
//   pool s across r pull     a whirlpool, its middle sinks the raft
//   flow s across r angle strength     a current: 0 downstream, 180 against you, 90 to the right
//   mud s across r   slows   oil s across r   no grip      geyser s across r period phase   throws the raft up
//   ramp s across            a jump, if you are fast enough
//   bean s across   gas and turbo      gold s across   a golden roll (three on every river)      cp s   a checkpoint
const STEP = 2;
export const LEVELS = [
  { id: 'brook', name: 'Ручеёк', par: 18, w: 7, tip: 'Камни обходи, от буйков отлетаешь. Собери три золотых рулона 🧻',
    path: [['s', 30], ['t', 25, 40], ['s', 24], ['t', -25, 40], ['s', 44]],
    obs: [['bean', 16, 0], ['rock', 30, -0.5, 1.3], ['gold', 30, 0.55], ['bump', 46, 0.55, 0.9], ['bean', 52, -0.3], ['cp', 62], ['rock', 72, 0.55, 1.4], ['rock', 82, -0.6, 1.2], ['gold', 82, 0.15], ['bump', 96, -0.15, 0.9], ['flow', 106, 0, 4, 0, 6], ['gold', 114, -0.65], ['bean', 120, 0.4]] },
  { id: 'bends', name: 'Излучина', par: 38, w: 6.5, tip: 'Пирсы торчат то слева, то справа — змейкой. В тине плот вязнет: помогает залп',
    path: [['s', 24], ['t', 70, 22], ['s', 18], ['t', -110, 20], ['s', 16], ['t', 80, 22], ['s', 24], ['t', -40, 30], ['s', 30]],
    obs: [['bean', 10, 0], ['wall', 20, -1, 0.1], ['wall', 34, -0.1, 1], ['gold', 34, -0.6], ['mud', 58, 0.3, 3], ['bean', 58, -0.65], ['cp', 66], ['rock', 80, 0.5, 1.3], ['rock', 92, -0.5, 1.3], ['gold', 86, 0], ['flow', 112, 0, 4, 0, 6],
      ['wall', 130, -1, 0], ['bump', 142, 0.45, 0.9], ['cp', 152], ['wall', 162, 0, 1], ['wall', 174, -1, 0], ['gold', 174, 0.6], ['bean', 186, 0], ['rock', 204, -0.45, 1.2], ['rock', 212, 0.5, 1.2]] },
  { id: 'rocks', name: 'Каменный слалом', par: 38, w: 7.5, tip: 'Перед рифом — трамплин. Разгонись, и плот перелетит. Не разогнался — ищи щель у берега',
    path: [['s', 30], ['t', 30, 45], ['s', 50], ['t', -45, 40], ['s', 45], ['t', 20, 50], ['s', 40]],
    obs: [['rock', 20, -0.5, 1.4], ['bean', 26, 0], ['rock', 32, 0.5, 1.4], ['rock', 46, -0.4, 1.5], ['rock', 46, 0.8, 1.1], ['gold', 46, 0.2], ['rock', 60, 0.2, 1.5], ['bump', 60, -0.7, 0.9], ['cp', 68], ['bean', 74, 0], ['ramp', 82, 0], ['reef', 88, -1, 0.55], ['gold', 90, 0],
      ['rock', 104, -0.6, 1.5], ['rock', 113, 0.5, 1.5], ['pool', 127, -0.25, 4, 9], ['bean', 127, 0.8], ['cp', 140], ['rock', 150, 0.6, 1.3], ['rock', 157, -0.2, 1.4], ['rock', 165, 0.5, 1.4], ['rock', 172, -0.7, 1.3], ['gold', 164, -0.75], ['bump', 182, 0, 1.0],
      ['ramp', 196, 0.3], ['reef', 202, -0.55, 1], ['rock', 218, -0.5, 1.4], ['rock', 225, 0.5, 1.4], ['bean', 212, 0]] },
  { id: 'mill', name: 'Лесопилка', par: 55, w: 7.5, tip: 'Пилы ездят поперёк реки — попал под пилу, начинаешь с чекпойнта. Шлагбаум ждём, пока поднимется',
    path: [['s', 34], ['t', -50, 30], ['s', 40], ['t', 90, 26], ['s', 36], ['t', -60, 28], ['s', 30], ['w', 6], ['s', 44]],
    obs: [['bean', 12, 0], ['log', 26, 0, 3.2, 0.9, 0], ['gold', 26, 0.85], ['saw', 46, -0.8, 0.8, 5, 0], ['cp', 58], ['log', 70, -0.3, 3.2, -1.0, 1], ['log', 86, 0.3, 3.2, 1.1, 2], ['bean', 78, 0.8], ['gate', 97, 5, 0.55, 0], ['gold', 110, -0.7],
      ['saw', 120, -0.8, 0.2, 3.5, 0], ['saw', 129, -0.2, 0.8, 3.5, 0.5], ['cp', 142], ['barge', 156, -0.6, 0.6, 7, 0, 2.2], ['bean', 165, 0], ['log', 174, 0, 3.4, -0.9, 0.5], ['wall', 188, -1, -0.1], ['wall', 199, 0.1, 1], ['gold', 193, 0.7], ['cp', 209],
      ['gate', 222, 4.5, 0.5, 0.3], ['saw', 240, -0.7, 0.7, 4, 0], ['bean', 247, 0], ['log', 254, 0, 2.5, 1.2, 1.5], ['saw', 267, -0.7, 0.7, 3.5, 0.4]] },
  { id: 'crocs', name: 'Крокодилья заводь', par: 52, w: 8, tip: 'Крокодилы плавают от берега к берегу. Мины не топят, но отшвыривают. Боковое течение сносит',
    path: [['s', 30], ['t', 60, 28], ['s', 34], ['t', -100, 24], ['s', 36], ['t', 70, 26], ['s', 34], ['t', -30, 40], ['s', 40]],
    obs: [['bean', 10, 0], ['croc', 24, -0.8, 0.8, 6, 0], ['mud', 40, -0.4, 3.2], ['gold', 40, -0.5], ['croc', 54, -0.8, 0.8, 5, 0.3], ['cp', 64], ['mine', 72, -0.3], ['mine', 79, 0.45], ['mine', 86, -0.5], ['bean', 79, -0.8],
      ['flow', 104, 0, 4.5, 90, 5], ['croc', 116, -0.8, 0.3, 4, 0], ['croc', 125, -0.3, 0.8, 4, 0.5], ['gold', 120, 0.85], ['cp', 138], ['mud', 150, 0.35, 3.5], ['croc', 150, -0.9, -0.25, 3.5, 0], ['mine', 162, 0.6], ['mine', 167, -0.6], ['bean', 160, 0],
      ['flow', 184, 0, 4.5, -90, 5], ['croc', 197, -0.8, 0.8, 4.5, 0.2], ['cp', 207], ['croc', 217, -0.8, 0.8, 5, 0], ['croc', 226, -0.8, 0.8, 5, 0.5], ['gold', 221, 0], ['mine', 236, 0], ['mud', 247, -0.3, 3], ['croc', 263, -0.8, 0.8, 4, 0], ['bean', 269, 0], ['mine', 274, -0.5], ['mine', 274, 0.5], ['croc', 284, -0.8, 0.8, 3.6, 0.5]] },
  { id: 'pools', name: 'Чёртовы воронки', par: 52, w: 8, tip: 'Середина воронки топит. Гейзер пускает пузыри, потом подбрасывает. На масле плот не слушается',
    path: [['s', 30], ['t', 60, 28], ['s', 30], ['w', 5.2], ['s', 26], ['w', 8.5], ['t', -100, 24], ['s', 36], ['t', 70, 26], ['w', 5.5], ['s', 30], ['w', 8], ['t', -30, 40], ['s', 40]],
    obs: [['bean', 10, 0], ['pool', 24, 0.45, 4, 9], ['gold', 24, -0.75], ['geyser', 40, -0.35, 2, 4, 0], ['geyser', 49, 0.4, 2, 4, 0.5], ['cp', 62], ['rock', 71, -0.6, 1.2], ['oil', 76, 0, 4.5], ['rock', 82, 0.6, 1.2], ['bean', 86, 0], ['flow', 102, 0, 3.5, 0, 7],
      ['pool', 130, -0.35, 4.4, 10], ['pool', 145, 0.5, 4, 10], ['gold', 138, 0.9], ['cp', 160], ['bean', 164, 0], ['flow', 173, 0, 5, 180, 4.2], ['geyser', 185, -0.5, 2, 3.5, 0], ['geyser', 185, 0.5, 2, 3.5, 0.5], ['geyser', 192, 0, 2, 3.5, 0.25], ['oil', 207, 0, 4.5], ['pool', 218, 0.4, 4, 10], ['cp', 229],
      ['geyser', 239, 0, 1.8, 3, 0], ['flow', 247, 0, 3.5, 0, 7], ['gold', 248, 0], ['pool', 265, -0.35, 4.2, 11], ['bean', 280, -0.6], ['rock', 285, 0.5, 1.4], ['pool', 294, -0.4, 4, 10], ['geyser', 304, 0.35, 2, 3.5, 0]] },
  { id: 'fort', name: 'Пушечный форт', par: 80, w: 7.5, tip: 'Пушки бьют с берега: ядро не топит, но сносит. Двое ворот подряд открываются по очереди',
    path: [['s', 36], ['t', -45, 36], ['s', 40], ['t', 90, 24], ['s', 30], ['t', -90, 24], ['s', 40], ['t', 45, 36], ['s', 44]],
    obs: [['bean', 10, 0], ['ball', 22, 1, 3, 0], ['ball', 30, -1, 3, 0.5], ['gold', 26, 0.75], ['wall', 44, -1, 0], ['wall', 55, 0, 1], ['cp', 66], ['gate', 78, 5, 0.5, 0], ['ball', 86, 1, 2.6, 0.2], ['ball', 93, -1, 2.6, 0.6], ['bean', 90, 0], ['mine', 99, 0],
      ['ramp', 112, 0], ['reef', 118, -1, 0.6], ['gold', 120, 0], ['cp', 144], ['ball', 150, 1, 2.4, 0], ['ball', 156, 1, 2.4, 0.33], ['ball', 162, 1, 2.4, 0.66], ['mine', 156, -0.7], ['bean', 166, -0.5], ['wall', 180, -1, -0.28], ['wall', 180, 0.28, 1], ['wall', 197, -0.3, 1], ['cp', 212],
      ['gate', 222, 4, 0.5, 0], ['gate', 234, 4, 0.5, 0.5], ['gold', 228, -0.7], ['ball', 245, -1, 2.5, 0], ['mine', 256, 0.4], ['mine', 263, -0.4], ['bean', 270, 0], ['ramp', 284, -0.2], ['reef', 290, -0.7, 1], ['ball', 300, 1, 2.2, 0], ['ball', 306, -1, 2.2, 0.5], ['mine', 313, 0]] },
  { id: 'gorge', name: 'Большой каньон', par: 98, w: 7, tip: 'Здесь всё сразу. Чекпойнтов много — не жадничай',
    path: [['s', 26], ['t', 80, 22], ['s', 20], ['t', -80, 22], ['w', 5], ['s', 30], ['w', 7.5], ['t', -90, 24], ['s', 30], ['t', 120, 22], ['s', 24], ['w', 5.4], ['t', -60, 26], ['s', 26], ['w', 8], ['t', 50, 30], ['s', 30], ['t', -70, 24], ['s', 40]],
    obs: [['bean', 10, 0], ['rock', 20, 0.5, 1.3], ['croc', 34, -0.8, 0.8, 5, 0], ['gold', 45, -0.8], ['log', 62, 0, 3.0, 1.0, 0], ['cp', 74], ['wall', 84, -1, 0], ['wall', 96, 0, 1], ['flow', 116, 0, 3.4, 0, 7], ['mine', 128, 0.3], ['bean', 132, -0.4], ['saw', 147, -0.8, 0.8, 4, 0], ['pool', 161, 0.35, 4, 10], ['cp', 176],
      ['gate', 186, 5, 0.5, 0], ['ball', 194, 1, 2.6, 0], ['ball', 200, -1, 2.6, 0.5], ['geyser', 214, -0.4, 2, 3.5, 0], ['geyser', 224, 0.4, 2, 3.5, 0.5], ['gold', 219, 0], ['croc', 237, -0.8, 0.8, 4.5, 0.3], ['cp', 251], ['ramp', 258, 0], ['reef', 264, -1, 0.55], ['oil', 271, 0, 3.4], ['bean', 280, 0],
      ['log', 289, 0, 2.2, -1.1, 1], ['mine', 298, -0.4], ['cp', 304], ['flow', 316, 0, 3.5, 180, 4], ['croc', 335, -0.8, 0.8, 4, 0], ['mud', 347, 0.3, 3.2], ['gold', 347, 0.5], ['barge', 363, -0.6, 0.6, 6, 0, 2.2], ['saw', 375, -0.8, 0.2, 3.5, 0], ['saw', 382, -0.2, 0.8, 3.5, 0.5], ['cp', 390],
      ['pool', 400, -0.35, 4, 10], ['geyser', 410, 0.5, 2, 3.5, 0], ['gate', 421, 4.5, 0.5, 0], ['bean', 427, 0], ['mine', 432, -0.5], ['mine', 432, 0.5], ['croc', 442, -0.8, 0.8, 3.6, 0]] },
];

const BUILT = new Map();
const SOLID = { rock: 1, bump: 1, wall: 1, reef: 1, log: 1, croc: 1, saw: 1, ball: 1, barge: 1, mine: 1, gate: 1 }, LOW = { rock: 1, bump: 1, reef: 1, log: 1, croc: 1, mine: 1, barge: 1 };
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
  const L = { i: k, id: def.id, name: def.name, par: def.par, tip: def.tip, P, len: s, flow: 1.4 };
  // the middle of the river at s, the direction it runs there and its half-width
  const mid = (sv) => { const j = Math.max(0, Math.min(P.length - 2, Math.floor(sv/STEP))), t = sv/STEP - j, p = P[j], p2 = P[j + 1], d = Math.hypot(p2.x - p.x, p2.z - p.z) || 1; return { x: p.x + (p2.x - p.x)*t, z: p.z + (p2.z - p.z)*t, tx: (p2.x - p.x)/d, tz: (p2.z - p.z)/d, w: p.w + (p2.w - p.w)*t }; };
  L.at = (sv, lat) => { const m = mid(sv); return [q2(m.x - m.tz*lat), q2(m.z + m.tx*lat)]; };
  L.mid = mid;
  L.zones = []; L.solids = []; L.beans = []; L.golds = []; L.cps = []; L.mines = []; L.all = [];
  for (const o of def.obs) { const t = o[0], m = mid(o[1]), b = { t, s: o[1], cx: m.x, cz: m.z, tx: m.tx, tz: m.tz, rx: -m.tz, rz: m.tx, w: m.w, reach: 12 };
    const pt = (f, r) => { b.lat = f*(m.w - (r || 0) - 0.2); b.x = q2(b.cx + b.rx*b.lat); b.z = q2(b.cz + b.rz*b.lat); };
    if (t === 'rock' || t === 'bump') { b.r = o[3]; pt(o[2], b.r); }
    else if (t === 'wall' || t === 'reef') { b.l0 = o[2]*m.w; b.l1 = o[3]*m.w; b.x0 = b.cx + b.rx*b.l0; b.z0 = b.cz + b.rz*b.l0; b.x1 = b.cx + b.rx*b.l1; b.z1 = b.cz + b.rz*b.l1; b.th = t === 'wall' ? 0.3 : 0.45; }
    else if (t === 'log') { pt(o[2], 0); b.hl = o[3]; b.sp = o[4]; b.ph = o[5]; }
    else if (t === 'croc' || t === 'saw') { b.r = t === 'croc' ? 0.85 : 0.8; b.l0 = o[2]*(m.w - b.r); b.l1 = o[3]*(m.w - b.r); b.per = o[4]; b.ph = o[5]; }
    else if (t === 'ball') { b.r = 0.55; b.dir = o[2]; b.per = o[3]; b.ph = o[4]; b.fly = 1.5; }
    else if (t === 'barge') { b.hl = o[6]; b.th = 0.85; b.l0 = o[2]*(m.w - 1); b.l1 = o[3]*(m.w - 1); b.per = o[4]; b.ph = o[5]; }
    else if (t === 'mine') { b.r = 0.6; pt(o[2], b.r); b.k = L.mines.length; L.mines.push(b); }
    else if (t === 'gate') { b.per = o[2]; b.open = o[3]; b.ph = o[4]; b.x0 = b.cx - b.rx*m.w; b.z0 = b.cz - b.rz*m.w; b.x1 = b.cx + b.rx*m.w; b.z1 = b.cz + b.rz*m.w; b.th = 0.3; }
    else if (t === 'pool') { b.r = o[3]; b.k = o[4]; pt(o[2], b.r*0.5); }
    else if (t === 'flow') { b.r = o[3]; pt(o[2], 0); const an = o[4]*Math.PI/180, c = Math.cos(an), sn = Math.sin(an); b.fx = (b.tx*c + b.rx*sn)*o[5]; b.fz = (b.tz*c + b.rz*sn)*o[5]; b.ang = o[4]; }
    else if (t === 'mud' || t === 'oil') { b.r = o[3]; pt(o[2], b.r*0.5); }
    else if (t === 'geyser') { b.r = o[3]; b.per = o[4]; b.ph = o[5]; pt(o[2], b.r*0.6); b.k = L.all.length; }
    else if (t === 'ramp') { b.r = 1.9; pt(o[2], 1.4); }
    else if (t === 'bean') { pt(o[2], 0.8); L.beans.push(b); }
    else if (t === 'gold') { pt(o[2], 0.8); L.golds.push(b); }
    else if (t === 'cp') { L.cps.push(b); }
    b.low = !!LOW[t]; L.all.push(b); if (SOLID[t]) L.solids.push(b); else if (t !== 'bean' && t !== 'gold' && t !== 'cp') L.zones.push(b); }
  L.cps.sort((p, q) => p.s - q.s);
  BUILT.set(k, L); return L;
}
// moving things are a matter of the clock alone, so the server and every phone agree where they are
const sway = (o, tm) => 0.5 - 0.5*Math.cos(2*Math.PI*(tm/o.per + o.ph));
export function where(o, tm) {   // -> [x, z, vx, vz, there]
  if (o.t === 'croc' || o.t === 'saw' || o.t === 'barge') { const u = sway(o, tm), lat = o.l0 + (o.l1 - o.l0)*u, v = (o.l1 - o.l0)*Math.PI/o.per*Math.sin(2*Math.PI*(tm/o.per + o.ph)); return [o.cx + o.rx*lat, o.cz + o.rz*lat, o.rx*v, o.rz*v, true, lat]; }
  if (o.t === 'ball') { const p = frac(tm/o.per + o.ph)*o.per, span = 2*o.w + 3, v = span/o.fly, lat = -o.dir*(-o.w - 1.5 + v*p); return [o.cx + o.rx*lat, o.cz + o.rz*lat, -o.dir*o.rx*v, -o.dir*o.rz*v, p < o.fly, lat]; }
  return [o.x, o.z, 0, 0, true, o.lat];
}
export const gateOpen = (o, tm) => frac(tm/o.per + o.ph) < o.open;
export const geyserAt = (o, tm) => frac(tm/o.per + o.ph);   // 0..0.14 blowing, 0.72..1 bubbling up

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
  return { lv: L.i, L, n: N, jets: offs.map((off) => ({ off, g: 1, on: false, fire: false, wait: 0, press: -9, rest: false })),
    x: p0.x, z: p0.z, a: -Math.PI/2, vx: 0, vz: 0, w: 0, hint: 1, s: p0.s, tick: 0, tm: -3, ph: 'count',
    beans: L.beans.map(() => false), golds: L.golds.map(() => false), mines: L.mines.map(() => false), cp: -1, dead: 0, air: 0, safe: 0,
    turbo: 0, volley: 0, rest: 0, volleys: 0, bumps: 0, wipes: 0, time: 0, stars: 0, ev: [] };
}
// a player holds or lets go: `bits` are that player's jets (alone: bit 0 the left one, bit 1 the right one; with friends: bit 0)
export function input(S, player, bits) {
  S.jets.forEach((j, k) => { if (jetOwner(S.n, k) !== player) return; j.on = !!(S.n === 1 ? (bits >> k) & 1 : bits & 1); });
}
export const goldCount = (S) => S.golds.reduce((n, g) => n + (g ? 1 : 0), 0);
// three stars: got there, got there in time, brought all the golden rolls
export const starsOf = (L, time, gold) => 1 + (time <= L.par ? 1 : 0) + (gold >= L.golds.length ? 1 : 0);

function bounce(S, nx, nz, depth, ovx, ovz, spring) {
  S.x += nx*depth; S.z += nz*depth;
  const rvx = S.vx - ovx, rvz = S.vz - ovz, vn = rvx*nx + rvz*nz; if (vn >= 0 && !spring) return;
  const tx = -nz, tz = nx, vt = rvx*tx + rvz*tz, out = spring ? Math.max(spring, -vn*1.1) : -vn*0.4, rub = -vn > 1 ? 0.9 : 0.995;   // a hard knock scrubs off some speed, leaning on something does not: the raft slides along it
  S.vx = ovx + tx*vt*rub + nx*out; S.vz = ovz + tz*vt*rub + nz*out;
  S.w += (nx*Math.sin(S.a) - nz*Math.cos(S.a))*Math.min(3, Math.abs(vn) + (spring ? 2 : 0))*0.3;   // a knock off-centre spins the raft a little
  if (-vn > 1.4 || spring) { S.bumps++; S.ev.push({ t: spring ? 'boing' : 'bump', f: q2(Math.min(1, Math.abs(vn)/7)) }); }
}
function sink(S, why) { if (S.safe > 0 || S.dead > 0) return; S.dead = DEAD_T; S.wipes++; S.air = 0; S.ev.push({ t: 'wipe', why }); }
function back(S) { const L = S.L, s = S.cp >= 0 ? L.cps[S.cp].s + 1.5 : 2, m = L.mid(s); S.x = m.x; S.z = m.z; S.a = Math.atan2(m.tz, m.tx); S.vx = m.tx*2; S.vz = m.tz*2; S.w = 0; S.hint = Math.floor(s/STEP); S.s = s; S.safe = SAFE_T; S.air = 0; S.turbo = S.volley = 0;
  for (const j of S.jets) { j.g = 1; j.wait = 0; j.fire = false; } S.ev.push({ t: 'back' }); }
// push the raft out of a thick line from (x0,z0) to (x1,z1) that itself moves at (ovx,ovz)
function hitLine(S, x0, z0, x1, z1, th, ovx, ovz) { const dx = x1 - x0, dz = z1 - z0, l2 = dx*dx + dz*dz || 1; let t = ((S.x - x0)*dx + (S.z - z0)*dz)/l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = x0 + dx*t, qz = z0 + dz*t, ex = S.x - qx, ez = S.z - qz, d = Math.hypot(ex, ez), m = RR + th; if (d < m && d > 0.001) { bounce(S, ex/d, ez/d, m - d, ovx, ovz); return true; } return false; }

export function step(S) {
  S.ev = []; if (S.ph === 'done') return;
  S.tick++; S.tm = S.tick/30 - 3; if (S.tm < 0) return;
  if (S.ph === 'count') { S.ph = 'run'; S.ev.push({ t: 'go' }); }
  const L = S.L, J = S.jets.length, tm = S.tm;
  // sunk: the raft goes under, then it is back at the last checkpoint
  if (S.dead > 0) { S.dead -= DT; S.vx *= 0.9; S.vz *= 0.9; S.w *= 0.96; S.x += S.vx*DT; S.z += S.vz*DT; S.a = wrap(S.a + S.w*DT); for (const j of S.jets) j.fire = false; if (S.dead <= 0) { S.dead = 0; back(S); } return; }
  if (S.safe > 0) S.safe -= DT;
  // tanks, and who is really pushing
  for (let k = 0; k < J; k++) { const j = S.jets[k], firing = j.on && j.g > 0.02;
    if (firing && !j.fire) j.press = tm;
    j.fire = firing;
    if (firing) { j.g = Math.max(0, j.g - GAS_DRAIN*DT); j.wait = GAS_WAIT; } else if (!j.on) { j.wait -= DT; if (j.wait <= 0) j.g = Math.min(1, j.g + GAS_FILL*DT); } }
  // all jets started within a quarter of a second of each other: a volley, half as strong again for a moment
  S.rest -= DT; S.volley -= DT; S.turbo -= DT;
  if (S.rest <= 0 && S.jets.every((j) => j.fire && tm - j.press < VOLLEY_WINDOW + 0.001) && S.jets.some((j) => tm - j.press < DT*1.5)) { S.volley = VOLLEY_TIME; S.rest = VOLLEY_REST; S.volleys++; S.ev.push({ t: 'volley' }); }
  const mult = (S.volley > 0 ? 1.5 : 1)*(S.turbo > 0 ? 1.4 : 1);
  const fx = Math.cos(S.a), fz = Math.sin(S.a), rx = -fz, rz = fx, air = S.air > 0;
  let ax = 0, az = 0, al = 0;
  for (const j of S.jets) if (j.fire) { const F = FT/J*mult; ax += fx*F; az += fz*F; al -= j.off*F*KT; }
  // the water: it flows down the river, and every kind of patch does its own thing to a raft that sits in it
  let loc = locate(L, S.x, S.z, S.hint); S.hint = loc.i;
  let wx = loc.tx*L.flow, wz = loc.tz*L.flow, kf = KF, kl = KL, kw = KW;
  if (air) { wx = wz = 0; kf = kl = 0.22; kw = 0.7; }
  else for (const o of L.zones) { if (o.s - S.s > o.reach || S.s - o.s > o.reach) continue; const dx = o.x - S.x, dz = o.z - S.z, d = Math.hypot(dx, dz); if (d >= o.r) continue;
    if (o.t === 'flow') { wx += o.fx; wz += o.fz; }
    else if (o.t === 'pool') { const k = 1 - d/o.r; if (d > 0.01) { ax += dx/d*o.k*k; az += dz/d*o.k*k; wx += -dz/d*3.2*k; wz += dx/d*3.2*k; } al += 1.6*k; if (d < 0.9) sink(S, 'pool'); }
    else if (o.t === 'mud') { kf = 4.2; kl = 5; kw = 4; }
    else if (o.t === 'oil') { kl = 0.25; kw = 0.35; }
    else if (o.t === 'geyser') { if (geyserAt(o, tm) < 0.14 && S.safe <= 0) { S.air = AIR_T*0.85; const nx = d > 0.2 ? -dx/d : loc.tx, nz = d > 0.2 ? -dz/d : loc.tz; S.vx += nx*4.5; S.vz += nz*4.5; S.w += (o.k % 2 ? 5.5 : -5.5); S.ev.push({ t: 'geyser' }); } }
    else if (o.t === 'ramp') { const v = S.vx*loc.tx + S.vz*loc.tz; if (v > 5.2) { S.air = AIR_T; S.vx += loc.tx*2.2; S.vz += loc.tz*2.2; S.w *= 0.3; S.ev.push({ t: 'jump' }); } } }
  const ux = S.vx - wx, uz = S.vz - wz, uf = ux*fx + uz*fz, ul = ux*rx + uz*rz;
  ax -= kf*uf*fx + kl*ul*rx; az -= kf*uf*fz + kl*ul*rz;
  S.vx += ax*DT; S.vz += az*DT; S.w += (al - kw*S.w)*DT;
  S.x += S.vx*DT; S.z += S.vz*DT; S.a = wrap(S.a + S.w*DT);
  if (air) { S.air -= DT; if (S.air <= 0) { S.air = 0; S.ev.push({ t: 'splash' }); } }
  // banks
  loc = locate(L, S.x, S.z, S.hint); S.hint = loc.i;
  const lim = loc.w - RR;
  if (loc.dist > lim) { const d = loc.dist || 1; bounce(S, (loc.cx - S.x)/d, (loc.cz - S.z)/d, loc.dist - lim, 0, 0); }
  // everything you can run into
  const up = S.air > 0;
  for (const o of L.solids) { if (o.s - loc.s > o.reach || loc.s - o.s > o.reach || (up && o.low)) continue; const t = o.t;
    if (t === 'rock' || t === 'bump') { const dx = S.x - o.x, dz = S.z - o.z, d = Math.hypot(dx, dz), m = o.r + RR; if (d < m && d > 0.001) bounce(S, dx/d, dz/d, m - d, 0, 0, t === 'bump' ? 8.5 : 0); }
    else if (t === 'wall' || t === 'reef') hitLine(S, o.x0, o.z0, o.x1, o.z1, o.th, 0, 0);
    else if (t === 'gate') { if (!gateOpen(o, tm)) hitLine(S, o.x0, o.z0, o.x1, o.z1, o.th, 0, 0); }
    else if (t === 'log') { const th = o.ph + o.sp*tm, cx = Math.cos(th), cz = Math.sin(th); let u = (S.x - o.x)*cx + (S.z - o.z)*cz; u = u < -o.hl ? -o.hl : u > o.hl ? o.hl : u; const qx = o.x + cx*u, qz = o.z + cz*u, dx = S.x - qx, dz = S.z - qz, d = Math.hypot(dx, dz), m = RR + 0.4; if (d < m && d > 0.001) bounce(S, dx/d, dz/d, m - d, -o.sp*(qz - o.z), o.sp*(qx - o.x)); }
    else if (t === 'barge') { const p = where(o, tm); hitLine(S, p[0] - o.tx*o.hl, p[1] - o.tz*o.hl, p[0] + o.tx*o.hl, p[1] + o.tz*o.hl, o.th, p[2], p[3]); }
    else if (t === 'croc' || t === 'saw') { const p = where(o, tm), dx = S.x - p[0], dz = S.z - p[1]; if (dx*dx + dz*dz < (o.r + RR - 0.25)*(o.r + RR - 0.25)) sink(S, t); if (S.dead > 0) break; }
    else if (t === 'ball') { const p = where(o, tm); if (!p[4]) continue; const dx = S.x - p[0], dz = S.z - p[1], d = Math.hypot(dx, dz), m = o.r + RR; if (d < m && d > 0.001 && S.safe <= 0) { S.x += dx/d*(m - d); S.z += dz/d*(m - d); S.vx = S.vx*0.4 + p[2]*0.75; S.vz = S.vz*0.4 + p[3]*0.75; S.w += -o.dir*3.5; S.bumps++; S.ev.push({ t: 'bump', f: 1 }); } }
    else if (t === 'mine') { if (S.mines[o.k]) continue; const dx = S.x - o.x, dz = S.z - o.z, d = Math.hypot(dx, dz), m = o.r + RR; if (d < m && S.safe <= 0) { S.mines[o.k] = true; const nx = d > 0.01 ? dx/d : -loc.tx, nz = d > 0.01 ? dz/d : -loc.tz; S.vx = nx*11; S.vz = nz*11; S.w += (o.k % 2 ? 6 : -6); S.bumps++; S.ev.push({ t: 'boom', k: o.k }); } } }
  // tins of beans (every tank full, and a turbo), golden rolls, checkpoints
  for (let k = 0; k < L.beans.length; k++) { const b = L.beans[k]; if (S.beans[k] || b.s - loc.s > 6 || loc.s - b.s > 6) continue; const dx = S.x - b.x, dz = S.z - b.z; if (dx*dx + dz*dz < 3.2) { S.beans[k] = true; for (const j of S.jets) j.g = 1; S.turbo = TURBO_TIME; S.ev.push({ t: 'bean', k }); } }
  for (let k = 0; k < L.golds.length; k++) { const b = L.golds[k]; if (S.golds[k] || b.s - loc.s > 6 || loc.s - b.s > 6) continue; const dx = S.x - b.x, dz = S.z - b.z; if (dx*dx + dz*dz < 3.4) { S.golds[k] = true; S.ev.push({ t: 'gold', k }); } }
  S.s = loc.s;
  if (S.dead <= 0) while (S.cp + 1 < L.cps.length && S.s >= L.cps[S.cp + 1].s) { S.cp++; S.ev.push({ t: 'cp', k: S.cp }); }
  if (S.dead <= 0 && S.s >= L.len - 1.5) { S.ph = 'done'; S.time = Math.round(tm*100)/100; S.stars = starsOf(L, S.time, goldCount(S)); S.ev.push({ t: 'finish', time: S.time, stars: S.stars }); }
}
// how high the raft is off the water (for the picture)
export const height = (S) => S.air > 0 ? 4*AIR_H*(S.air/AIR_T)*(1 - Math.min(1, S.air/AIR_T)) : 0;

// --- the wire: the whole state is small, so the server sends all of it and a phone can carry on from any message ---
const PH = ['count', 'run', 'done'];
const bitsOf = (a) => { let b = 0; for (let k = 0; k < a.length; k++) if (a[k]) b += Math.pow(2, k); return b; }, setBits = (a, b) => { for (let k = 0; k < a.length; k++) a[k] = Math.floor(b/Math.pow(2, k)) % 2 === 1; };
export function save(S) {
  return [S.tick, Math.round(S.x*100), Math.round(S.z*100), Math.round(S.a*1000), Math.round(S.vx*100), Math.round(S.vz*100), Math.round(S.w*1000),
    S.jets.map((j) => [Math.round(j.g*1000), (j.on ? 1 : 0) | (j.fire ? 2 : 0) | (j.rest ? 4 : 0), Math.round(Math.max(-1, j.wait)*1000), Math.round(j.press*1000)]),
    bitsOf(S.beans), Math.round(Math.max(-1, S.turbo)*1000), Math.round(Math.max(-1, S.volley)*1000), Math.round(Math.max(-1, S.rest)*1000), PH.indexOf(S.ph), S.bumps, S.volleys, S.hint, Math.round(S.time*100),
    bitsOf(S.golds), bitsOf(S.mines), S.cp, Math.round(S.dead*1000), Math.round(S.air*1000), Math.round(Math.max(0, S.safe)*1000), S.wipes];
}
export function load(S, o) {
  S.tick = o[0]; S.tm = S.tick/30 - 3; S.x = o[1]/100; S.z = o[2]/100; S.a = o[3]/1000; S.vx = o[4]/100; S.vz = o[5]/100; S.w = o[6]/1000;
  for (let k = 0; k < S.jets.length; k++) { const j = S.jets[k], q = o[7][k]; if (!q) continue; j.g = q[0]/1000; j.on = !!(q[1] & 1); j.fire = !!(q[1] & 2); j.rest = !!(q[1] & 4); j.wait = q[2]/1000; j.press = q[3]/1000; }
  setBits(S.beans, o[8]); S.turbo = o[9]/1000; S.volley = o[10]/1000; S.rest = o[11]/1000; S.ph = PH[o[12]] || 'run'; S.bumps = o[13]; S.volleys = o[14]; S.hint = o[15]; S.time = (o[16] || 0)/100;
  setBits(S.golds, o[17] || 0); setBits(S.mines, o[18] || 0); S.cp = o[19] == null ? -1 : o[19]; S.dead = (o[20] || 0)/1000; S.air = (o[21] || 0)/1000; S.safe = (o[22] || 0)/1000; S.wipes = o[23] || 0;
  S.stars = S.ph === 'done' ? starsOf(S.L, S.time, goldCount(S)) : 0; S.s = locate(S.L, S.x, S.z, S.hint).s; S.ev = []; return S;
}

// --- a helmsman: steers a whole raft by itself. It tries a handful of simple plans a couple of seconds into the
// future on a copy of the river and takes the one that gets furthest in one piece. Used to prove every river can be
// run, behind the menu, and to work the jet of a friend whose phone dropped out (`only` limits it to those jets).
const PLANS = []; for (const lat of [-0.85, -0.55, -0.25, 0, 0.25, 0.55, 0.85]) PLANS.push({ lat, go: 1 }); for (const lat of [-0.5, 0, 0.5]) PLANS.push({ lat, go: 0 });
function drive(S, plan, only) {
  const L = S.L, loc = locate(L, S.x, S.z, S.hint), sp = Math.hypot(S.vx, S.vz), ahead = Math.min(L.len + 4, loc.s + 4.5 + sp*0.6), m = L.mid(ahead), w = m.w - RR - 0.35;
  const tx = m.x - m.tz*plan.lat*w, tz = m.z + m.tx*plan.lat*w, e = wrap(Math.atan2(tz - S.z, tx - S.x) - S.a) - S.w*0.35;   // + : the bow must come round to the right
  S.jets.forEach((j, k) => { if (only && !only.includes(k)) return;
    let on = Math.abs(e) < 0.22 ? !!plan.go : e > 0 ? j.off < 0.01 : j.off > -0.01;      // right turn: the left-hand jets push
    if (Math.abs(e) > 0.5 && Math.abs(j.off) < 0.01) on = false;
    if (j.g < 0.06) j.rest = true; if (j.g > 0.3) j.rest = false; j.on = on && !j.rest; });
}
export function pilot(S, only) {
  if (S.ph !== 'run' || S.dead > 0) { for (const j of S.jets) if (!only || only.includes(S.jets.indexOf(j))) j.on = false; return; }
  if (!S.plan || S.tick >= (S.planAt || 0)) { const T = S.scratch || (S.scratch = newRun(S.lv, S.n)), base = save(S), gold0 = goldCount(S); let best = null, bs = -1e9;
    // held up behind something: look further ahead, the way round may take a while
    if (S.tick - (S.markT || 0) >= 45) { S.stuck = Math.abs(S.s - (S.markS == null ? -99 : S.markS)) < 2.5; S.markT = S.tick; S.markS = S.s; } const far = S.stuck ? 190 : 80;
    for (const p of PLANS) { load(T, base); let score = 0, i = 0; const b0 = T.bumps, beans0 = bitsOf(T.beans);
      for (; i < far; i++) { drive(T, p); step(T); if (T.dead > 0) { score -= 400 - i*3; break; } if (T.ph === 'done') { score += 60; break; } }
      score += (T.dead > 0 ? 0 : T.s - S.s) - (T.bumps - b0)*(S.stuck ? 0 : 3) + (S.stuck && T.dead <= 0 ? 0.6*Math.hypot(T.x - S.x, T.z - S.z) : 0) + (goldCount(T) - gold0)*9 + (bitsOf(T.beans) !== beans0 ? 4 : 0) + (p === S.plan ? 1.2 : 0) - (S.stuck ? 0 : Math.abs(p.lat)*0.5);
      if (score > bs) { bs = score; best = p; } }
    S.plan = best; S.planAt = S.tick + 5; }
  drive(S, S.plan, only);
}
