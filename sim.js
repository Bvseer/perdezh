// Пердёж-балдёж: one round raft, and a crew that runs round its edge. The whole game in one place: the server runs
// it for a room of friends, the phone runs it when you play alone. Fixed steps, no randomness: a run is repeatable.

export const VERSION = '0.6';   // one number for the page and the server
export const DT = 1/30;         // seconds a step
export const RR = 1.3;          // the raft is a disc this big
export const MAXP = 4;

// --- how the raft moves ---------------------------------------------------------
// Everyone stands somewhere on the edge. Whoever pushes, pushes the raft away from where they stand, straight
// through its middle, so pushing never turns it. It is turned by the river: waterfalls, whirlpools, knocks. A raft
// that turns carries its crew round with it, and they have to run back to the side they want to push from.
const FT = 8.6;        // push of the whole crew together (m/s2)
const KD = 1.15;       // water drag (the raft is round: the same every way)
const KW = 1.5;        // drag on spinning
export const RUNW = 4.6;   // how fast someone runs round the edge (rad/s)
export const GAS_DRAIN = 0.34, GAS_FILL = 0.5, GAS_WAIT = 0.25;   // a tank lasts about 3 s of holding, refills in 2
export const VOLLEY_WINDOW = 0.25, VOLLEY_TIME = 0.8, VOLLEY_REST = 1.5, TURBO_TIME = 1.3;
export const AIR_T = 0.95, AIR_H = 1.7, DEAD_T = 1.4, SAFE_T = 1.6;   // a jump, sinking, and the moment of safety after coming back

const wrap = (a) => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };
const q2 = (v) => Math.round(v*100)/100, frac = (v) => v - Math.floor(v);

// --- rivers ---------------------------------------------------------------------
// A river is drawn as a path: ['s', metres] straight on, ['t', degrees, radius] a bend (+ to the right), ['w', width]
// the half-width from here on. A river in the sky also has ['rail', 1|0] (edges you can or cannot fall off from here
// on) and ['gap', metres] (no river at all: jump it). Things in it are placed by how far along (s, metres) and how
// far across (-1 the left bank, 0 the middle, 1 the right bank):
//   rock s across r          a stone                       bump s across r        a buoy that throws you back
//   wall s from to           a pier across part of it      reef s from to         low stones: only a jump clears them
//   thorn s from to          a pier of thorns: sinks       spike s across r       a ball of spikes: sinks
//   log s across half speed phase      a log spinning on a post         mill ...   the same with four arms
//   croc|saw s from to period phase    swims / slides across and back; touching it sinks the raft
//   ball s side period phase           a cannon on the bank (side -1 left, 1 right) shooting across
//   barge s from to period phase half  a ferry going across and back
//   mine s across            blows the raft away, once     gate s period open phase   a barrier that lifts on a timer
//   isle s0 s1 across r      an island: go round it
//   jaws s period phase      two slabs from the banks that close and open: caught between them, the raft sinks
//   arm s side len period phase        a boom on the bank (side -1 left, 1 right) that swings across and punches
//   barrel s0 s1 across period phase   barrels rolling up the river towards you from s1 to s0
//   pool s across r pull     a whirlpool, its middle sinks the raft
//   flow s across r angle strength     a current: 0 downstream, 180 against you, 90 to the right
//   mud s across r   slows   oil s across r   no grip      geyser s across r period phase   throws the raft up
//   ramp s across            a jump, if you are fast enough
//   fall s [drop]            a waterfall: the raft flies off it spinning
//   bean s across   gas and turbo      gold s across   a golden roll (three on every river)      cp s   a checkpoint
//   bridge s                 just for the look
const STEP = 2;
export const LEVELS = [
  { id: 'brook', flow: 2.4, name: 'Ручеёк', theme: 'meadow', par: 33, w: 6.5, tip: 'Течение несёт плот само: посередине быстрее, у берега тише. Притормозить — пукни против течения. Собери три рулона 🧻',
    path: [['s', 30], ['t', 30, 40], ['s', 16], ['w', 10.5], ['s', 44], ['w', 6.5], ['t', -40, 36], ['s', 50]],
    obs: [['bean', 12, 0], ['rock', 24, -0.5, 1.3], ['gold', 24, 0.6], ['bridge', 38], ['bump', 46, 0.5, 0.9], ['bump', 56, -0.4, 0.9], ['cp', 64], ['isle', 80, 100, 0, 2.4], ['gold', 90, -0.8], ['bean', 90, 0.8], ['bump', 108, 0, 1.0],
      ['rock', 122, 0.5, 1.3], ['rock', 130, -0.5, 1.3], ['cp', 138], ['flow', 146, 0, 3.5, 0, 6], ['fall', 158], ['gold', 166, 0.5], ['bean', 174, -0.3]] },
  { id: 'bends', flow: 2.8, name: 'Излучина', theme: 'autumn', par: 54, w: 6.5, tip: 'На повороте течение сносит к внешнему берегу — держись внутреннего. Перчатка на штанге отшвыривает: проскакивай, пока отведена',
    path: [['s', 24], ['t', 90, 18], ['s', 14], ['t', -180, 16], ['s', 14], ['t', 90, 18], ['s', 20], ['w', 9], ['s', 30], ['w', 6], ['t', -60, 26], ['s', 36]],
    obs: [['bean', 10, 0], ['wall', 18, -1, 0.05], ['wall', 30, -0.05, 1], ['gold', 30, -0.7], ['arm', 44, 1, 4.5, 3.2, 0], ['cp', 58], ['mud', 74, 0.4, 3], ['bean', 74, -0.6], ['rock', 88, -0.5, 1.3], ['rock', 98, 0.5, 1.3], ['gold', 92, 0.75], ['bridge', 122], ['cp', 126],
      ['arm', 138, -1, 5, 3, 0], ['arm', 148, 1, 5, 3, 0.5], ['bean', 160, 0], ['wall', 168, 0, 1], ['isle', 184, 202, 0, 2], ['gold', 193, 0.8], ['mud', 193, -0.6, 2.5], ['cp', 206], ['wall', 216, -1, 0], ['wall', 226, 0, 1], ['flow', 244, 0, 3.5, 0, 6], ['fall', 254], ['bean', 262, 0]] },
  { id: 'rocks', flow: 3.4, name: 'Каменный слалом', theme: 'alpine', par: 47, w: 7, tip: 'С водопада плот летит и крутится — успей перебежать. Перед рифом трамплин: разгонись. Шипастые шары трогать нельзя',
    path: [['s', 28], ['t', 35, 40], ['s', 30], ['w', 4.6], ['s', 30], ['w', 8], ['t', -70, 30], ['s', 40], ['t', 50, 34], ['w', 5], ['s', 26], ['w', 7.5], ['s', 40]],
    obs: [['rock', 18, -0.5, 1.4], ['bean', 22, 0.2], ['rock', 30, 0.5, 1.4], ['rock', 42, -0.3, 1.5], ['rock', 42, 0.8, 1.1], ['gold', 42, 0.3], ['bump', 56, -0.6, 0.9], ['rock', 62, 0.3, 1.4], ['spike', 66, -0.75, 0.8], ['cp', 72], ['fall', 84], ['flow', 94, 0, 3, 0, 6], ['barrel', 90, 110, 0.5, 4.5, 0], ['gold', 100, 0.6],
      ['cp', 116], ['pool', 130, -0.3, 4, 9], ['bean', 130, 0.8], ['rock', 142, 0.5, 1.4], ['ramp', 156, 0], ['reef', 162, -1, 0.42], ['gold', 164, -0.1], ['rock', 174, -0.6, 1.5], ['rock', 180, 0.4, 1.5], ['bump', 190, 0, 1], ['rock', 200, 0.6, 1.3], ['rock', 206, -0.5, 1.3], ['cp', 214],
      ['fall', 222], ['barrel', 224, 242, -0.5, 4, 0.5], ['bean', 232, 0.4], ['spike', 248, 0.15, 0.8], ['rock', 254, -0.6, 1.3], ['rock', 258, 0.5, 1.4], ['ramp', 266, 0.2], ['reef', 272, -0.4, 1]] },
  { id: 'mill', flow: 2.8, name: 'Лесопилка', theme: 'mill', par: 58, w: 7.5, tip: 'Пила топит плот — начнёшь с чекпойнта. Мельницу обходи вдоль берега. Давилка сходится и расходится: проскакивай, когда открыта',
    path: [['s', 34], ['t', -50, 30], ['s', 40], ['t', 90, 26], ['s', 36], ['w', 10], ['t', -60, 30], ['s', 26], ['w', 6], ['s', 50]],
    obs: [['bean', 12, 0], ['log', 26, 0, 3.2, 0.9, 0], ['gold', 26, 0.88], ['saw', 44, -0.8, 0.8, 5, 0], ['bridge', 54], ['cp', 60], ['mill', 74, 0, 3.4, 0.7, 0], ['bean', 84, 0.8], ['gate', 96, 5, 0.55, 0], ['gold', 110, -0.7], ['saw', 118, -0.8, 0.2, 3.5, 0], ['saw', 128, -0.2, 0.8, 3.5, 0.5], ['cp', 142],
      ['barge', 156, -0.6, 0.6, 7, 0, 2.2], ['bean', 164, 0], ['log', 170, 0, 3.2, -0.9, 0.5], ['isle', 184, 204, 0, 2.5], ['saw', 194, -0.95, -0.45, 3, 0], ['gold', 200, -0.7], ['barrel', 186, 206, 0.7, 4, 0], ['cp', 212], ['gate', 222, 4.5, 0.5, 0.3], ['jaws', 240, 4, 0], ['bean', 248, 0], ['mill', 258, 0, 2.0, 1.0, 1.5], ['saw', 270, -0.7, 0.7, 3.5, 0.4]] },
  { id: 'crocs', flow: 2.2, name: 'Крокодилья заводь', theme: 'jungle', par: 70, w: 8, tip: 'Крокодилы плавают от берега к берегу и между островами. Мины не топят, но отшвыривают. Боковое течение сносит',
    path: [['s', 30], ['t', 60, 28], ['w', 12], ['s', 60], ['w', 7], ['t', -100, 24], ['s', 36], ['t', 70, 26], ['w', 11], ['s', 44], ['w', 7], ['t', -30, 40], ['s', 40]],
    obs: [['bean', 10, 0], ['croc', 22, -0.8, 0.8, 6, 0], ['mud', 38, -0.4, 3], ['gold', 38, -0.5], ['croc', 50, -0.8, 0.8, 5, 0.3], ['cp', 62], ['isle', 74, 90, -0.45, 2.4], ['isle', 84, 104, 0.5, 2.4], ['croc', 86, -0.12, 0.12, 3, 0], ['mine', 96, -0.75], ['gold', 94, 0.88], ['croc', 100, 0.62, 0.95, 3.2, 0], ['bean', 110, 0], ['cp', 118],
      ['flow', 134, 0, 4.5, 90, 5], ['croc', 146, -0.8, 0.3, 4, 0], ['croc', 154, -0.3, 0.8, 4, 0.5], ['bridge', 166], ['mine', 172, -0.3], ['mine', 178, 0.45], ['mine', 184, -0.5], ['bean', 178, -0.8], ['cp', 196], ['flow', 212, 0, 4.5, -90, 5], ['croc', 222, -0.8, 0.8, 4.5, 0.2],
      ['isle', 240, 262, 0, 2.6], ['mud', 250, -0.62, 3], ['gold', 250, -0.7], ['croc', 256, -0.95, -0.45, 3, 0], ['mine', 246, 0.6], ['mine', 254, 0.75], ['bean', 258, 0.65], ['cp', 272], ['croc', 284, -0.8, 0.8, 4, 0], ['fall', 296], ['croc', 308, -0.8, 0.8, 3.6, 0.5], ['bean', 314, 0], ['mine', 318, -0.5], ['mine', 318, 0.5]] },
  { id: 'sky', flow: 2.8, name: 'Небесная река', theme: 'sky', sky: true, par: 72, w: 5.5, tip: 'Бортов нет: съехал с края — упал. Разрыв в русле перепрыгивай с трамплина на скорости. Ветер сдувает вбок',
    path: [['rail', 1], ['s', 20], ['rail', 0], ['s', 20], ['t', 40, 30], ['s', 16], ['s', 14], ['t', -80, 22], ['rail', 1], ['s', 16], ['rail', 0], ['s', 10], ['gap', 6], ['s', 24], ['w', 8], ['s', 30], ['w', 5], ['t', 70, 24], ['s', 14], ['s', 20], ['t', -50, 28], ['s', 12], ['gap', 6], ['s', 34]],
    obs: [['bean', 10, 0], ['rock', 26, 0.4, 1.0], ['gold', 32, -0.6], ['flow', 48, 0, 3.5, 90, 3.2], ['cp', 62], ['spike', 69, -0.5, 0.7], ['fall', 76, 4], ['bean', 84, 0], ['bump', 98, 0.3, 0.8], ['cp', 118], ['arm', 128, 1, 4, 2.8, 0], ['bean', 135, 0], ['ramp', 141, 0],
      ['cp', 158], ['mine', 167, 0.4], ['isle', 184, 198, 0, 1.8], ['bump', 190, -0.75, 0.8], ['gold', 191, 0.7], ['flow', 198, 0, 4, -90, 3.2], ['cp', 208], ['rock', 220, -0.3, 1.0], ['spike', 232, 0.5, 0.7], ['bean', 240, -0.2], ['fall', 250, 4], ['mine', 259, -0.3], ['cp', 268],
      ['flow', 282, 0, 3.5, 90, 3.6], ['bean', 292, 0], ['ramp', 301, 0], ['gold', 316, 0], ['bump', 326, 0.4, 0.8], ['spike', 336, -0.4, 0.7]] },
  { id: 'pools', flow: 2.8, name: 'Чёртовы воронки', theme: 'dusk', par: 62, w: 8, tip: 'Середина воронки топит. Гейзер пускает пузыри, потом подбрасывает. На масле плот не слушается',
    path: [['s', 30], ['t', 60, 28], ['s', 30], ['w', 5], ['s', 26], ['w', 9], ['t', -100, 24], ['s', 36], ['t', 70, 26], ['w', 5.5], ['s', 30], ['w', 10], ['t', -30, 40], ['s', 44]],
    obs: [['bean', 10, 0], ['pool', 24, 0.45, 4, 9], ['gold', 24, -0.75], ['geyser', 40, -0.35, 2, 4, 0], ['geyser', 49, 0.4, 2, 4, 0.5], ['spike', 56, 0, 0.9], ['cp', 62], ['rock', 71, -0.6, 1.2], ['oil', 76, 0, 4.5], ['rock', 82, 0.6, 1.2], ['bean', 86, 0], ['fall', 92], ['flow', 102, 0, 3.2, 0, 7], ['jaws', 112, 4.5, 0],
      ['pool', 132, -0.35, 4.4, 10], ['pool', 147, 0.5, 4, 10], ['gold', 139, 0.9], ['cp', 160], ['bean', 164, 0], ['flow', 173, 0, 5, 180, 4.2], ['geyser', 185, -0.5, 2, 3.5, 0], ['geyser', 185, 0.5, 2, 3.5, 0.5], ['geyser', 192, 0, 2, 3.5, 0.25], ['spike', 200, -0.65, 0.9], ['oil', 207, 0, 4.5], ['pool', 218, 0.4, 4, 10], ['cp', 228],
      ['geyser', 239, 0, 1.8, 3, 0], ['flow', 247, 0, 3.5, 0, 7], ['gold', 248, 0], ['isle', 270, 290, 0, 2.5], ['pool', 280, -0.65, 3.6, 10], ['geyser', 276, 0.65, 2, 3.5, 0], ['geyser', 286, 0.65, 2, 3.5, 0.5], ['bean', 296, 0], ['spike', 299, 0.6, 0.9], ['pool', 306, -0.3, 4, 10], ['geyser', 312, 0.4, 2, 3.5, 0]] },
  { id: 'fort', flow: 3.0, name: 'Пушечный форт', theme: 'desert', par: 57, w: 7.5, tip: 'Пушки сносят, давилка давит, колючие пирсы и шары лопают плот. Двое ворот подряд открываются по очереди',
    path: [['s', 36], ['t', -45, 36], ['s', 40], ['t', 90, 24], ['s', 30], ['t', -90, 24], ['s', 40], ['t', 45, 36], ['s', 50]],
    obs: [['bean', 10, 0], ['ball', 22, 1, 3, 0], ['ball', 30, -1, 3, 0.5], ['gold', 26, 0.75], ['wall', 44, -1, 0], ['wall', 55, 0, 1], ['cp', 66], ['gate', 78, 5, 0.5, 0], ['ball', 86, 1, 2.6, 0.2], ['ball', 93, -1, 2.6, 0.6], ['bean', 90, 0], ['mine', 99, 0], ['ramp', 112, 0], ['reef', 118, -1, 0.38], ['gold', 120, 0], ['thorn', 134, -1, -0.38], ['thorn', 134, 0.38, 1], ['cp', 144],
      ['arm', 150, 1, 5, 2.6, 0], ['arm', 158, -1, 5, 2.6, 0.5], ['arm', 166, 1, 5, 2.6, 0], ['bean', 162, 0], ['jaws', 182, 4, 0], ['bridge', 190], ['wall', 198, -0.3, 1], ['cp', 212], ['gate', 222, 4, 0.5, 0], ['gate', 234, 4, 0.5, 0.5], ['gold', 228, -0.7], ['spike', 241, 0.55, 0.9], ['ball', 247, -1, 2.5, 0], ['mine', 256, 0.4], ['mine', 263, -0.4], ['bean', 270, 0], ['spike', 276, 0.6, 0.9],
      ['ramp', 284, -0.2], ['reef', 290, -0.38, 1], ['jaws', 302, 3.6, 0.5], ['ball', 310, 1, 2.2, 0], ['ball', 316, -1, 2.2, 0.5], ['mine', 322, 0]] },
  { id: 'gorge', flow: 3.4, name: 'Большой каньон', theme: 'canyon', par: 90, w: 7, tip: 'Здесь всё сразу. Чекпойнтов много — не жадничай',
    path: [['s', 26], ['t', 80, 22], ['s', 20], ['t', -80, 22], ['w', 5], ['s', 30], ['w', 7.5], ['t', -90, 24], ['s', 30], ['t', 120, 22], ['s', 24], ['w', 5.4], ['t', -60, 26], ['s', 26], ['w', 8], ['t', 50, 30], ['s', 30], ['t', -70, 24], ['s', 40]],
    obs: [['bean', 10, 0], ['rock', 20, 0.5, 1.3], ['croc', 34, -0.8, 0.8, 5, 0], ['gold', 45, -0.8], ['spike', 52, 0.5, 0.9], ['mill', 62, 0, 2.6, 0.9, 0], ['cp', 74], ['wall', 84, -1, 0], ['wall', 96, 0, 1], ['fall', 108], ['flow', 116, 0, 3.4, 0, 7], ['barrel', 112, 134, 0.4, 4.5, 0], ['bean', 126, -0.5], ['saw', 147, -0.8, 0.8, 4, 0], ['pool', 161, 0.35, 4, 10], ['spike', 169, -0.65, 0.9], ['cp', 176],
      ['gate', 186, 5, 0.5, 0], ['arm', 194, 1, 4.6, 2.8, 0], ['arm', 202, -1, 4.6, 2.8, 0.5], ['geyser', 214, -0.4, 2, 3.5, 0], ['geyser', 224, 0.4, 2, 3.5, 0.5], ['gold', 219, 0], ['croc', 237, -0.8, 0.8, 4.5, 0.3], ['cp', 251], ['ramp', 258, 0], ['reef', 264, -1, 0.35], ['oil', 271, 0, 3.4], ['bean', 280, 0],
      ['jaws', 290, 4, 0], ['mine', 298, -0.4], ['cp', 304], ['flow', 316, 0, 3.5, 180, 4], ['bridge', 324], ['croc', 335, -0.8, 0.8, 4, 0], ['mud', 347, 0.3, 3.2], ['gold', 347, 0.5], ['spike', 355, -0.6, 0.9], ['barge', 363, -0.6, 0.6, 6, 0, 2.2], ['saw', 375, -0.8, 0.2, 3.5, 0], ['saw', 382, -0.2, 0.8, 3.5, 0.5], ['cp', 390],
      ['pool', 400, -0.35, 4, 10], ['geyser', 410, 0.5, 2, 3.5, 0], ['gate', 421, 4.5, 0.5, 0], ['fall', 428], ['bean', 434, 0], ['mine', 440, -0.5], ['mine', 440, 0.5], ['croc', 446, -0.8, 0.8, 3.6, 0]] },
];

const BUILT = new Map();
const SOLID = { rock: 1, bump: 1, wall: 1, reef: 1, thorn: 1, spike: 1, log: 1, croc: 1, saw: 1, ball: 1, barge: 1, mine: 1, gate: 1, isle: 1, mill: 1, jaws: 1, arm: 1, barrel: 1 }, LOW = { rock: 1, bump: 1, reef: 1, log: 1, mill: 1, croc: 1, mine: 1, barge: 1, barrel: 1, spike: 1 }, PASSIVE = { bean: 1, gold: 1, cp: 1, bridge: 1, fall: 1 };
export function level(i) {
  const k = Math.max(0, Math.min(LEVELS.length - 1, i | 0)); if (BUILT.has(k)) return BUILT.get(k);
  const def = LEVELS[k], P = [], gaps = []; let x = 0, z = 0, a = -Math.PI/2, w = def.w, wT = def.w, s = 0, open = !!def.sky;
  const put = () => { w += Math.max(-0.6, Math.min(0.6, wT - w)); P.push({ x: q2(x), z: q2(z), a, w: q2(w), s, open }); };
  put();
  for (const c of def.path) {
    if (c[0] === 'w') { wT = c[1]; continue; }
    if (c[0] === 'rail') { open = !c[1]; P[P.length - 1].open = open; continue; }
    if (c[0] === 's' || c[0] === 'gap') { if (c[0] === 'gap') gaps.push([s, s + c[1]]); const n = Math.round(c[1]/STEP); for (let i = 0; i < n; i++) { x += Math.cos(a)*STEP; z += Math.sin(a)*STEP; s += STEP; put(); } }
    else { const ang = c[1]*Math.PI/180, n = Math.max(1, Math.round(Math.abs(ang)*c[2]/STEP)), da = ang/n;
      for (let i = 0; i < n; i++) { a += da/2; x += Math.cos(a)*STEP; z += Math.sin(a)*STEP; a += da/2; s += STEP; put(); } }
  }
  // how sharply the river bends at every point (+ to the right), smoothed: the current swings wide on a bend
  for (let i = 0; i < P.length; i++) { const p = P[Math.max(0, i - 1)], q = P[Math.min(P.length - 1, i + 1)]; P[i].k0 = q.s > p.s ? wrap(q.a - p.a)/(q.s - p.s) : 0; }
  for (let i = 0; i < P.length; i++) { let sum = 0, n = 0; for (let j = Math.max(0, i - 3); j <= Math.min(P.length - 1, i + 3); j++) { sum += P[j].k0; n++; } P[i].k = sum/n; }
  const L = { i: k, id: def.id, name: def.name, theme: def.theme, sky: !!def.sky, par: def.par, tip: def.tip, P, len: s, flow: def.flow || 2.6, w0: def.w, bend: def.sky ? 0.9 : 1.6, gaps };
  // the middle of the river at s, the direction it runs there and its half-width
  const mid = (sv) => { const j = Math.max(0, Math.min(P.length - 2, Math.floor(sv/STEP))), t = sv/STEP - j, p = P[j], p2 = P[j + 1], d = Math.hypot(p2.x - p.x, p2.z - p.z) || 1; return { x: p.x + (p2.x - p.x)*t, z: p.z + (p2.z - p.z)*t, tx: (p2.x - p.x)/d, tz: (p2.z - p.z)/d, w: p.w + (p2.w - p.w)*t }; };
  L.at = (sv, lat) => { const m = mid(sv); return [q2(m.x - m.tz*lat), q2(m.z + m.tx*lat)]; };
  L.mid = mid;
  L.zones = []; L.solids = []; L.beans = []; L.golds = []; L.cps = []; L.mines = []; L.falls = []; L.all = [];
  for (const o of def.obs) { const t = o[0], m = mid(o[1]), b = { t, s: o[1], cx: m.x, cz: m.z, tx: m.tx, tz: m.tz, rx: -m.tz, rz: m.tx, w: m.w, reach: 12 };
    const pt = (f, r) => { b.lat = f*(m.w - (r || 0) - 0.2); b.x = q2(b.cx + b.rx*b.lat); b.z = q2(b.cz + b.rz*b.lat); };
    if (t === 'rock' || t === 'bump' || t === 'spike') { b.r = o[3]; pt(o[2], b.r); }
    else if (t === 'wall' || t === 'reef' || t === 'thorn') { b.l0 = o[2]*m.w; b.l1 = o[3]*m.w; b.x0 = b.cx + b.rx*b.l0; b.z0 = b.cz + b.rz*b.l0; b.x1 = b.cx + b.rx*b.l1; b.z1 = b.cz + b.rz*b.l1; b.th = t === 'reef' ? 0.45 : 0.3; }
    else if (t === 'log' || t === 'mill') { pt(o[2], 0); b.hl = o[3]; b.sp = o[4]; b.ph = o[5]; }
    else if (t === 'isle') { b.r = o[4]; b.s = (o[1] + o[2])/2; b.reach = (o[2] - o[1])/2 + 12; b.pts = []; for (let sv = o[1]; sv <= o[2] + 0.01; sv += 2.5) { const q = mid(sv), lat = o[3]*(q.w - b.r - 0.2); b.pts.push([q2(q.x - q.tz*lat), q2(q.z + q.tx*lat), sv]); } }
    else if (t === 'jaws') { b.per = o[2]; b.ph = o[3]; b.g0 = 0.2; b.g1 = m.w - 0.9; b.th = 0.4; }
    else if (t === 'arm') { b.side = o[2]; b.len = o[3]; b.per = o[4]; b.ph = o[5]; b.px = b.cx + b.rx*b.side*(m.w - 0.1); b.pz = b.cz + b.rz*b.side*(m.w - 0.1); b.th = 0.45; }
    else if (t === 'barrel') { b.r = 0.8; b.per = o[4]; b.ph = o[5]; b.s0 = o[1]; b.s = (o[1] + o[2])/2; b.reach = (o[2] - o[1])/2 + 12; b.len = o[2] - o[1]; b.path = []; for (let sv = o[1]; sv <= o[2] + 0.01; sv += 1) { const q = mid(sv), lat = o[3]*(q.w - b.r - 0.2); b.path.push([q.x - q.tz*lat, q.z + q.tx*lat]); } }
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
    else if (t === 'fall') { b.drop = o[2] || 3; b.k = L.falls.length; L.falls.push(b); }
    else if (t === 'bean') { pt(o[2], 0.8); L.beans.push(b); }
    else if (t === 'gold') { pt(o[2], 0.8); L.golds.push(b); }
    else if (t === 'cp') { L.cps.push(b); }
    b.low = !!LOW[t]; L.all.push(b); if (SOLID[t]) L.solids.push(b); else if (!PASSIVE[t]) L.zones.push(b); }
  L.cps.sort((p, q) => p.s - q.s); L.falls.sort((p, q) => p.s - q.s);
  BUILT.set(k, L); return L;
}
// how far the river has come down by s (for the picture: the river really drops at its waterfalls)
export function elev(L, s) { let y = 0; for (const f of L.falls) { if (s <= f.s) break; const u = Math.min(1, (s - f.s)/2.6); y -= f.drop*u*u*(3 - 2*u); } return y; }
// moving things are a matter of the clock alone, so the server and every phone agree where they are
const sway = (o, tm) => 0.5 - 0.5*Math.cos(2*Math.PI*(tm/o.per + o.ph));
export function where(o, tm) {   // -> [x, z, vx, vz, there]
  if (o.t === 'croc' || o.t === 'saw' || o.t === 'barge') { const u = sway(o, tm), lat = o.l0 + (o.l1 - o.l0)*u, v = (o.l1 - o.l0)*Math.PI/o.per*Math.sin(2*Math.PI*(tm/o.per + o.ph)); return [o.cx + o.rx*lat, o.cz + o.rz*lat, o.rx*v, o.rz*v, true, lat]; }
  if (o.t === 'ball') { const p = frac(tm/o.per + o.ph)*o.per, span = 2*o.w + 3, v = span/o.fly, lat = -o.dir*(-o.w - 1.5 + v*p); return [o.cx + o.rx*lat, o.cz + o.rz*lat, -o.dir*o.rx*v, -o.dir*o.rz*v, p < o.fly, lat]; }
  if (o.t === 'barrel') { const p = frac(tm/o.per + o.ph), n = o.path.length - 1, u = (1 - p)*n, i = Math.min(n - 1, Math.floor(u)), f = u - i, a = o.path[i], b = o.path[i + 1], v = o.len/o.per, d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + (b[0] - a[0])*f, a[1] + (b[1] - a[1])*f, -(b[0] - a[0])/d*v, -(b[1] - a[1])/d*v, true, o.s0 + u]; }
  return [o.x, o.z, 0, 0, true, o.lat];
}
export const gateOpen = (o, tm) => frac(tm/o.per + o.ph) < o.open;
export const geyserAt = (o, tm) => frac(tm/o.per + o.ph);   // 0..0.14 blowing, 0.72..1 bubbling up
// how far each slab of the jaws stands from the middle of the river
export const jawGap = (o, tm) => o.g0 + (o.g1 - o.g0)*Math.max(0, Math.min(1, 0.5 + 1.25*Math.sin(2*Math.PI*(tm/o.per + o.ph))));
// the boom: from its post on the bank to its glove, and how fast the glove is going
export function armAt(o, tm) { const p = 2*Math.PI*(tm/o.per + o.ph), a = 1.15*Math.sin(p), c = Math.cos(a), sn = Math.sin(a), dx = -o.side*o.rx*c + o.tx*sn, dz = -o.side*o.rz*c + o.tz*sn, om = 1.15*2*Math.PI/o.per*Math.cos(p)*o.len;
  return [o.px, o.pz, o.px + dx*o.len, o.pz + dz*o.len, (o.side*o.rx*sn + o.tx*c)*om, (o.side*o.rz*sn + o.tz*c)*om, a]; }

// the current at a place in the river (loc is what locate() gives): fast in the middle and slow at the banks, faster
// where the river is narrow and slower where it spreads out, and on a bend it carries you towards the outer bank
export function current(L, loc) { const P = L.P, p = P[loc.i], q = P[loc.i + 1] || p, kap = p.k + (q.k - p.k)*loc.t, u = Math.max(-1, Math.min(1, loc.d/loc.w));
  const sp = Math.min(6.5, L.flow*Math.max(0.5, Math.min(1.7, L.w0/loc.w))*(1.15 - 0.75*u*u)), out = Math.max(-2.2, Math.min(2.2, -kap*sp*sp*L.bend));
  return [loc.tx*sp - loc.tz*out, loc.tz*sp + loc.tx*out, sp]; }

// where is a point relative to the river: how far along, how far right of the middle, how wide the river is there
export function locate(L, x, z, hint) {
  const P = L.P; let best = null, bd = 1e18; const from = Math.max(0, (hint | 0) - 4), to = Math.min(P.length - 2, (hint | 0) + 8);
  for (let i = from; i <= to; i++) { const p = P[i], p2 = P[i + 1], dx = p2.x - p.x, dz = p2.z - p.z, l2 = dx*dx + dz*dz; let t = ((x - p.x)*dx + (z - p.z)*dz)/l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = p.x + dx*t, cz = p.z + dz*t, d2 = (x - cx)*(x - cx) + (z - cz)*(z - cz); if (d2 < bd) { bd = d2; best = { i, t, cx, cz, tx: dx/Math.sqrt(l2), tz: dz/Math.sqrt(l2), w: p.w + (p2.w - p.w)*t, s: p.s + (p2.s - p.s)*t, open: p.open && p2.open }; } }
  best.d = (x - best.cx)*(-best.tz) + (z - best.cz)*best.tx;   // + to the right of the middle
  best.dist = Math.sqrt(bd); return best;
}

// --- a run ----------------------------------------------------------------------
export function newRun(lv, n) {
  const L = level(lv), N = Math.max(1, Math.min(MAXP, n | 0)), p0 = L.P[1];
  return { lv: L.i, L, n: N, crew: Array.from({ length: N }, (_, k) => ({ phi: wrap(Math.PI + (k - (N - 1)/2)*0.55), aim: null, g: 1, on: false, fire: false, wait: 0, press: -9, rest: false, run: false })),
    x: p0.x, z: p0.z, a: -Math.PI/2, vx: 0, vz: 0, w: 0, hint: 1, s: p0.s, tick: 0, tm: -3, ph: 'count',
    beans: L.beans.map(() => false), golds: L.golds.map(() => false), mines: L.mines.map(() => false), cp: -1, dead: 0, air: 0, safe: 0,
    turbo: 0, volley: 0, rest: 0, volleys: 0, bumps: 0, wipes: 0, time: 0, stars: 0, ev: [] };
}
// what a player wants: `aim` is the way the raft should be pushed (an angle on the map, or null: stay where you are),
// `fire` is the button
export function input(S, player, aim, fire) { const c = S.crew[player]; if (!c) return; c.aim = aim == null || !isFinite(aim) ? null : wrap(aim); c.on = !!fire; }
export const goldCount = (S) => S.golds.reduce((n, g) => n + (g ? 1 : 0), 0);
// three stars: got there, got there in time, brought all the golden rolls
export const starsOf = (L, time, gold) => 1 + (time <= L.par ? 1 : 0) + (gold >= L.golds.length ? 1 : 0);

function bounce(S, nx, nz, depth, ovx, ovz, spring) {
  S.x += nx*depth; S.z += nz*depth;
  const rvx = S.vx - ovx, rvz = S.vz - ovz, vn = rvx*nx + rvz*nz; if (vn >= 0 && !spring) return;
  const tx = -nz, tz = nx, vt = rvx*tx + rvz*tz, out = spring ? Math.max(spring, -vn*1.1) : -vn*0.4, rub = -vn > 1 ? 0.9 : 0.995;   // a hard knock scrubs off some speed, leaning on something does not: the raft slides along it
  S.vx = ovx + tx*vt*rub + nx*out; S.vz = ovz + tz*vt*rub + nz*out;
  if (-vn > 1 || spring) S.w -= Math.max(-5, Math.min(5, vt))*0.3;   // a round raft that scrapes along something starts to turn
  if (-vn > 1.4 || spring) { S.bumps++; S.ev.push({ t: spring ? 'boing' : 'bump', f: q2(Math.min(1, Math.abs(vn)/7)) }); }
}
function sink(S, why, always) { if ((S.safe > 0 && !always) || S.dead > 0) return; S.dead = DEAD_T; S.wipes++; S.air = 0; S.ev.push({ t: 'wipe', why }); }
function back(S) { const L = S.L, s = S.cp >= 0 ? L.cps[S.cp].s + 1.5 : 2, m = L.mid(s); S.x = m.x; S.z = m.z; S.a = Math.atan2(m.tz, m.tx); S.vx = m.tx*2; S.vz = m.tz*2; S.w = 0; S.hint = Math.floor(s/STEP); S.s = s; S.safe = SAFE_T + 0.6; S.air = 0; S.turbo = S.volley = 0;
  S.crew.forEach((c, k) => { c.g = 1; c.wait = 0; c.fire = false; c.phi = wrap(Math.PI + (k - (S.n - 1)/2)*0.55); }); S.ev.push({ t: 'back' }); }
// push the raft out of a thick line from (x0,z0) to (x1,z1) that itself moves at (ovx,ovz)
function nearLine(S, x0, z0, x1, z1) { const dx = x1 - x0, dz = z1 - z0, l2 = dx*dx + dz*dz || 1; let t = ((S.x - x0)*dx + (S.z - z0)*dz)/l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const qx = x0 + dx*t, qz = z0 + dz*t; return [S.x - qx, S.z - qz, Math.hypot(S.x - qx, S.z - qz)]; }
function hitLine(S, x0, z0, x1, z1, th, ovx, ovz) { const q = nearLine(S, x0, z0, x1, z1), m = RR + th; if (q[2] < m && q[2] > 0.001) { bounce(S, q[0]/q[2], q[1]/q[2], m - q[2], ovx, ovz); return true; } return false; }

export function step(S) {
  S.ev = []; if (S.ph === 'done') return;
  S.tick++; S.tm = S.tick/30 - 3; if (S.tm < 0) return;
  if (S.ph === 'count') { S.ph = 'run'; S.ev.push({ t: 'go' }); }
  const L = S.L, N = S.crew.length, tm = S.tm;
  // sunk: the raft goes under, then it is back at the last checkpoint
  if (S.dead > 0) { S.dead -= DT; S.vx *= 0.9; S.vz *= 0.9; S.w *= 0.96; S.x += S.vx*DT; S.z += S.vz*DT; S.a = wrap(S.a + S.w*DT); for (const c of S.crew) c.fire = false; if (S.dead <= 0) { S.dead = 0; back(S); } return; }
  if (S.safe > 0) S.safe -= DT;
  // everyone runs to the side they want to push from, as fast as legs allow; then tanks, and who is really pushing
  let ax = 0, az = 0, al = 0, sx = 0, sz = 0, firing = 0;
  S.rest -= DT; S.volley -= DT; S.turbo -= DT;
  for (const c of S.crew) { c.run = false; if (c.aim != null) { const d = wrap(c.aim + Math.PI - S.a - c.phi), st = RUNW*DT; c.run = Math.abs(d) > st; c.phi = wrap(c.phi + (c.run ? Math.sign(d)*st : d)); }
    const fire = c.on && c.g > 0.02; if (fire && !c.fire) c.press = tm; c.fire = fire;
    if (fire) { c.g = Math.max(0, c.g - GAS_DRAIN*DT); c.wait = GAS_WAIT; firing++; sx -= Math.cos(S.a + c.phi); sz -= Math.sin(S.a + c.phi); } else if (!c.on) { c.wait -= DT; if (c.wait <= 0) c.g = Math.min(1, c.g + GAS_FILL*DT); } }
  // the whole crew pushing the same way, having started within a quarter of a second of each other: a volley
  if (N > 1 && S.rest <= 0 && firing === N && Math.hypot(sx, sz) > N*0.8 && S.crew.every((c) => tm - c.press < VOLLEY_WINDOW + 0.001) && S.crew.some((c) => tm - c.press < DT*1.5)) { S.volley = VOLLEY_TIME; S.rest = VOLLEY_REST; S.volleys++; S.ev.push({ t: 'volley' }); }
  const F = FT/N*(S.volley > 0 ? 1.5 : 1)*(S.turbo > 0 ? 1.4 : 1); ax += sx*F; az += sz*F;
  // the water: it flows down the river, and every kind of patch does its own thing to a raft that sits in it
  const air = S.air > 0;
  let loc = locate(L, S.x, S.z, S.hint); S.hint = loc.i;
  const cur = current(L, loc); let wx = cur[0], wz = cur[1], kd = KD, kw = KW;
  if (air) { wx = wz = 0; kd = 0.2; kw = 0.45; }
  else for (const o of L.zones) { if (o.s - S.s > o.reach || S.s - o.s > o.reach) continue; const dx = o.x - S.x, dz = o.z - S.z, d = Math.hypot(dx, dz); if (d >= o.r) continue;
    if (o.t === 'flow') { wx += o.fx; wz += o.fz; }
    else if (o.t === 'pool') { const k = 1 - d/o.r; if (d > 0.01) { ax += dx/d*o.k*k; az += dz/d*o.k*k; wx += -dz/d*3.2*k; wz += dx/d*3.2*k; } al += 3.2*k; if (d < 0.9) sink(S, 'pool'); }
    else if (o.t === 'mud') { kd = 4.6; kw = 4; }
    else if (o.t === 'oil') { kd = 0.16; kw = 0.3; }
    else if (o.t === 'geyser') { if (geyserAt(o, tm) < 0.14 && S.safe <= 0) { S.air = AIR_T*0.85; const nx = d > 0.2 ? -dx/d : loc.tx, nz = d > 0.2 ? -dz/d : loc.tz; S.vx += nx*4.5; S.vz += nz*4.5; S.w += (o.k % 2 ? 6 : -6); S.ev.push({ t: 'geyser' }); } }
    else if (o.t === 'ramp') { const v = S.vx*loc.tx + S.vz*loc.tz; if (v > 5.2) { S.air = AIR_T; S.vx += loc.tx*2.2; S.vz += loc.tz*2.2; S.ev.push({ t: 'jump' }); } } }
  ax -= kd*(S.vx - wx); az -= kd*(S.vz - wz);
  S.vx += ax*DT; S.vz += az*DT; S.w += (al - kw*S.w)*DT;
  S.x += S.vx*DT; S.z += S.vz*DT; S.a = wrap(S.a + S.w*DT);
  if (air) { S.air -= DT; if (S.air <= 0) { S.air = 0; S.ev.push({ t: 'splash' }); } }
  // banks; in the sky there may be none, and then there is only the edge
  loc = locate(L, S.x, S.z, S.hint); S.hint = loc.i;
  const lim = loc.w - RR;
  if (loc.open) { if (loc.dist > loc.w - 0.25 && S.air <= 0) sink(S, 'edge', true); }
  else if (loc.dist > lim) { const d = loc.dist || 1; bounce(S, (loc.cx - S.x)/d, (loc.cz - S.z)/d, loc.dist - lim, 0, 0); }
  if (S.air <= 0) for (const g of L.gaps) if (loc.s > g[0] + 0.5 && loc.s < g[1] - 0.5) sink(S, 'edge', true);
  // everything you can run into
  const up = S.air > 0;
  if (S.dead <= 0) for (const o of L.solids) { if (o.s - loc.s > o.reach || loc.s - o.s > o.reach || (up && o.low)) continue; const t = o.t;
    if (t === 'rock' || t === 'bump') { const dx = S.x - o.x, dz = S.z - o.z, d = Math.hypot(dx, dz), m = o.r + RR; if (d < m && d > 0.001) bounce(S, dx/d, dz/d, m - d, 0, 0, t === 'bump' ? 8.5 : 0); }
    else if (t === 'spike') { const dx = S.x - o.x, dz = S.z - o.z; if (dx*dx + dz*dz < (o.r + RR - 0.2)*(o.r + RR - 0.2)) sink(S, 'spike'); }
    else if (t === 'thorn') { if (nearLine(S, o.x0, o.z0, o.x1, o.z1)[2] < RR + o.th - 0.1) sink(S, 'spike'); }
    else if (t === 'wall' || t === 'reef') hitLine(S, o.x0, o.z0, o.x1, o.z1, o.th, 0, 0);
    else if (t === 'gate') { if (!gateOpen(o, tm)) hitLine(S, o.x0, o.z0, o.x1, o.z1, o.th, 0, 0); }
    else if (t === 'log' || t === 'mill') { for (let q = 0; q < (t === 'mill' ? 2 : 1); q++) { const th = o.ph + o.sp*tm + q*Math.PI/2, cx = Math.cos(th), cz = Math.sin(th); let u = (S.x - o.x)*cx + (S.z - o.z)*cz; u = u < -o.hl ? -o.hl : u > o.hl ? o.hl : u; const qx = o.x + cx*u, qz = o.z + cz*u, dx = S.x - qx, dz = S.z - qz, d = Math.hypot(dx, dz), m = RR + 0.4; if (d < m && d > 0.001) bounce(S, dx/d, dz/d, m - d, -o.sp*(qz - o.z), o.sp*(qx - o.x)); } }
    else if (t === 'isle') { for (let q = 0; q < o.pts.length - 1; q++) hitLine(S, o.pts[q][0], o.pts[q][1], o.pts[q + 1][0], o.pts[q + 1][1], o.r, 0, 0); }
    else if (t === 'jaws') { const g = jawGap(o, tm), v = (g - jawGap(o, tm - DT))/DT, al2 = (S.x - o.cx)*o.tx + (S.z - o.cz)*o.tz, la = (S.x - o.cx)*o.rx + (S.z - o.cz)*o.rz;
      if (g < RR*0.75 && Math.abs(al2) < RR*0.7 + o.th && Math.abs(la) < g + RR) sink(S, 'jaws');
      else { hitLine(S, o.cx - o.rx*(o.w + 1), o.cz - o.rz*(o.w + 1), o.cx - o.rx*g, o.cz - o.rz*g, o.th, -o.rx*v, -o.rz*v); hitLine(S, o.cx + o.rx*g, o.cz + o.rz*g, o.cx + o.rx*(o.w + 1), o.cz + o.rz*(o.w + 1), o.th, o.rx*v, o.rz*v); } }
    else if (t === 'arm') { const p = armAt(o, tm); if (hitLine(S, p[0], p[1], p[2], p[3], o.th, p[4]*0.6, p[5]*0.6) && S.safe <= 0 && Math.hypot(p[4], p[5]) > 2) { S.vx += p[4]*0.45; S.vz += p[5]*0.45; S.w += o.side*3; S.ev.push({ t: 'punch' }); } }
    else if (t === 'barrel') { const p = where(o, tm), dx = S.x - p[0], dz = S.z - p[1], d = Math.hypot(dx, dz), m = o.r + RR; if (d < m && d > 0.001 && S.safe <= 0) { S.x += dx/d*(m - d); S.z += dz/d*(m - d); S.vx = S.vx*0.3 + p[2]*1.25 + dx/d*2; S.vz = S.vz*0.3 + p[3]*1.25 + dz/d*2; S.w += (dx*p[3] - dz*p[2] > 0 ? 4 : -4); S.bumps++; S.ev.push({ t: 'bump', f: 1 }); } }
    else if (t === 'barge') { const p = where(o, tm); hitLine(S, p[0] - o.tx*o.hl, p[1] - o.tz*o.hl, p[0] + o.tx*o.hl, p[1] + o.tz*o.hl, o.th, p[2], p[3]); }
    else if (t === 'croc' || t === 'saw') { const p = where(o, tm), dx = S.x - p[0], dz = S.z - p[1]; if (dx*dx + dz*dz < (o.r + RR - 0.25)*(o.r + RR - 0.25)) sink(S, t); }
    else if (t === 'ball') { const p = where(o, tm); if (!p[4]) continue; const dx = S.x - p[0], dz = S.z - p[1], d = Math.hypot(dx, dz), m = o.r + RR; if (d < m && d > 0.001 && S.safe <= 0) { S.x += dx/d*(m - d); S.z += dz/d*(m - d); S.vx = S.vx*0.4 + p[2]*0.75; S.vz = S.vz*0.4 + p[3]*0.75; S.w += -o.dir*4; S.bumps++; S.ev.push({ t: 'bump', f: 1 }); } }
    else if (t === 'mine') { if (S.mines[o.k]) continue; const dx = S.x - o.x, dz = S.z - o.z, d = Math.hypot(dx, dz), m = o.r + RR; if (d < m && S.safe <= 0) { S.mines[o.k] = true; const nx = d > 0.01 ? dx/d : -loc.tx, nz = d > 0.01 ? dz/d : -loc.tz; S.vx = nx*11; S.vz = nz*11; S.w += (o.k % 2 ? 7 : -7); S.bumps++; S.ev.push({ t: 'boom', k: o.k }); } }
    if (S.dead > 0) break; }
  // a waterfall: the raft flies off the lip, spinning, and nobody knows which way it will land
  if (S.air <= 0 && S.dead <= 0) for (const f of L.falls) if (loc.s >= f.s && loc.s < f.s + 1.6) { S.air = AIR_T*0.9; S.vx += loc.tx*2.6; S.vz += loc.tz*2.6; S.w = ((S.tick + f.k) % 2 ? 1 : -1)*(5.5 + (S.tick % 5)*0.5); S.ev.push({ t: 'fall' }); break; }
  // tins of beans (every tank full, and a turbo), golden rolls, checkpoints
  for (let k = 0; k < L.beans.length; k++) { const b = L.beans[k]; if (S.beans[k] || b.s - loc.s > 6 || loc.s - b.s > 6) continue; const dx = S.x - b.x, dz = S.z - b.z; if (dx*dx + dz*dz < 3.4) { S.beans[k] = true; for (const c of S.crew) c.g = 1; S.turbo = TURBO_TIME; S.ev.push({ t: 'bean', k }); } }
  for (let k = 0; k < L.golds.length; k++) { const b = L.golds[k]; if (S.golds[k] || b.s - loc.s > 6 || loc.s - b.s > 6) continue; const dx = S.x - b.x, dz = S.z - b.z; if (dx*dx + dz*dz < 3.6) { S.golds[k] = true; S.ev.push({ t: 'gold', k }); } }
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
    S.crew.map((c) => [Math.round(c.g*1000), (c.on ? 1 : 0) | (c.fire ? 2 : 0) | (c.rest ? 4 : 0), Math.round(Math.max(-1, c.wait)*1000), Math.round(c.press*1000), Math.round(c.phi*1000), c.aim == null ? null : Math.round(c.aim*1000)]),
    bitsOf(S.beans), Math.round(Math.max(-1, S.turbo)*1000), Math.round(Math.max(-1, S.volley)*1000), Math.round(Math.max(-1, S.rest)*1000), PH.indexOf(S.ph), S.bumps, S.volleys, S.hint, Math.round(S.time*100),
    bitsOf(S.golds), bitsOf(S.mines), S.cp, Math.round(S.dead*1000), Math.round(S.air*1000), Math.round(Math.max(0, S.safe)*1000), S.wipes];
}
export function load(S, o) {
  S.tick = o[0]; S.tm = S.tick/30 - 3; S.x = o[1]/100; S.z = o[2]/100; S.a = o[3]/1000; S.vx = o[4]/100; S.vz = o[5]/100; S.w = o[6]/1000;
  for (let k = 0; k < S.crew.length; k++) { const c = S.crew[k], q = o[7][k]; if (!q) continue; c.g = q[0]/1000; c.on = !!(q[1] & 1); c.fire = !!(q[1] & 2); c.rest = !!(q[1] & 4); c.wait = q[2]/1000; c.press = q[3]/1000; c.phi = q[4]/1000; c.aim = q[5] == null ? null : q[5]/1000; }
  setBits(S.beans, o[8]); S.turbo = o[9]/1000; S.volley = o[10]/1000; S.rest = o[11]/1000; S.ph = PH[o[12]] || 'run'; S.bumps = o[13]; S.volleys = o[14]; S.hint = o[15]; S.time = (o[16] || 0)/100;
  setBits(S.golds, o[17] || 0); setBits(S.mines, o[18] || 0); S.cp = o[19] == null ? -1 : o[19]; S.dead = (o[20] || 0)/1000; S.air = (o[21] || 0)/1000; S.safe = (o[22] || 0)/1000; S.wipes = o[23] || 0;
  S.stars = S.ph === 'done' ? starsOf(S.L, S.time, goldCount(S)) : 0; S.s = locate(S.L, S.x, S.z, S.hint).s; S.ev = []; return S;
}

// --- a helmsman: steers a whole raft by itself. It tries a handful of simple plans a couple of seconds into the
// future on a copy of the river and takes the one that gets furthest in one piece. Used to prove every river can be
// run, behind the menu, and to stand in for a friend whose phone dropped out (`only` limits it to those people).
const PLANS = []; for (const lat of [-0.85, -0.55, -0.25, 0, 0.25, 0.55, 0.85]) PLANS.push({ lat, go: 1 }); for (const lat of [-0.5, 0, 0.5]) PLANS.push({ lat, go: 0 });
function drive(S, plan, only) {
  const L = S.L, loc = locate(L, S.x, S.z, S.hint), sp = Math.hypot(S.vx, S.vz), ahead = Math.min(L.len + 4, loc.s + 5 + sp*0.5), m = L.mid(ahead), w = Math.max(0.5, m.w - RR - (loc.open ? 1.3 : 0.35));
  // the speed we would like, as an arrow; push towards whatever is missing from the speed we have
  const tx = m.x - m.tz*plan.lat*w - S.x, tz = m.z + m.tx*plan.lat*w - S.z, d = Math.hypot(tx, tz) || 1, want = plan.go ? 10 : 2.2, ex = tx/d*want - S.vx, ez = tz/d*want - S.vz, need = Math.hypot(ex, ez), aim = Math.atan2(ez, ex);
  S.crew.forEach((c, k) => { if (only && !only.includes(k)) return; c.aim = aim; const off = Math.abs(wrap(aim + Math.PI - S.a - c.phi));
    if (c.g < 0.06) c.rest = true; if (c.g > 0.3) c.rest = false; c.on = off < 0.55 && need > (plan.go ? 0.5 : 1.6) && !c.rest; });
}
export function pilot(S, only) {
  if (S.ph !== 'run' || S.dead > 0) { S.crew.forEach((c, k) => { if (!only || only.includes(k)) c.on = false; }); return; }
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
