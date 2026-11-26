// Every river must be runnable: a helmsman steering the whole crew finishes each one, for every crew size.
import * as G from '../sim.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
const t0 = Date.now(), wrap = (a) => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };
for (let lv = 0; lv < G.LEVELS.length; lv++) for (const n of [1, 2, 4]) {
  const S = G.newRun(lv, n); let steps = 0, maxOut = 0;
  while (S.ph !== 'done' && steps < 30*400) { G.pilot(S); G.step(S); steps++; const loc = G.locate(S.L, S.x, S.z, S.hint); if (!loc.open && S.dead <= 0) maxOut = Math.max(maxOut, loc.dist - (loc.w - G.RR)); }
  ok(S.ph === 'done', `${S.L.name} n=${n} not finished: s=${S.s.toFixed(0)}/${S.L.len} wipes=${S.wipes}`);
  ok(maxOut < 0.8, `${S.L.name} n=${n} left the river by ${maxOut.toFixed(2)}`);
  ok(S.wipes <= 8, `${S.L.name} n=${n} sinks too often even for a careful helmsman: ${S.wipes}`);
  ok(S.L.golds.length === 3, `${S.L.name} must have three golden rolls`);
  console.log(`${S.L.name.padEnd(18)} n=${n} len=${S.L.len} time=${S.time} par=${S.L.par} stars=${S.stars} bumps=${S.bumps} wipes=${S.wipes} volleys=${S.volleys} gold=${G.goldCount(S)}/3 cp=${S.cp + 1}/${S.L.cps.length}`);
}
console.log('rivers run in', Date.now() - t0, 'ms');
const lvOf = (id) => G.LEVELS.findIndex((d) => d.id === id);
const settle = (S, n) => { for (let i = 0; i < (n || 91); i++) G.step(S); };
const place = (S, s, lat) => { const [x, z] = S.L.at(s, lat), m = S.L.mid(s); S.x = x; S.z = z; S.a = Math.atan2(m.tz, m.tx); S.vx = S.vz = S.w = 0; S.hint = Math.floor(s/2); S.s = s; };
// the same run twice gives the same result
{ const run = () => { const S = G.newRun(2, 2); for (let i = 0; i < 900; i++) { G.pilot(S); G.step(S); } return [S.x, S.z, S.a].join(); }; ok(run() === run(), 'not repeatable'); }
// you push the raft the way you aim, whichever way that is, and pushing does not turn it
for (const aim of [0, 1.2, -2.5, Math.PI]) { const S = G.newRun(0, 1); settle(S); S.L = Object.assign({}, S.L, { flow: 0 }); const a0 = S.a, x0 = S.x, z0 = S.z; for (let i = 0; i < 40; i++) { G.input(S, 0, aim, i > 20); G.step(S); }
  const got = Math.atan2(S.z - z0, S.x - x0); ok(Math.abs(wrap(got - aim)) < 0.12 && Math.hypot(S.x - x0, S.z - z0) > 0.8, 'aim ' + aim + ' moved the raft towards ' + got.toFixed(2)); ok(Math.abs(S.a - a0) < 0.01, 'pushing should not turn the raft'); }
// two people opposite each other get nowhere; side by side they fly, and get a volley
{ const S = G.newRun(0, 2); settle(S); S.L = Object.assign({}, S.L, { flow: 0 }); const x0 = S.x, z0 = S.z; for (let i = 0; i < 60; i++) { G.input(S, 0, 0, i > 30); G.input(S, 1, Math.PI, i > 30); G.step(S); } ok(Math.hypot(S.x - x0, S.z - z0) < 0.3, 'opposite pushes should cancel'); }
{ const S = G.newRun(0, 2); settle(S); const z0 = S.z; let v = 0; for (let i = 0; i < 60; i++) { G.input(S, 0, -Math.PI/2, i > 30); G.input(S, 1, -Math.PI/2, i > 30); G.step(S); v += S.ev.filter((e) => e.t === 'volley').length; } ok(z0 - S.z > 2 && v === 1, 'together: should fly and give one volley, got ' + v); }
// a raft that spins carries its crew round: for a while they push the wrong way
{ const S = G.newRun(0, 1); settle(S); G.input(S, 0, -Math.PI/2, false); for (let i = 0; i < 30; i++) G.step(S); const off = () => Math.abs(wrap(-Math.PI/2 + Math.PI - S.a - S.crew[0].phi)); ok(off() < 0.05, 'should be standing in place'); S.w = 7; let worst = 0; for (let i = 0; i < 25; i++) { G.step(S); worst = Math.max(worst, off()); } ok(worst > 0.3, 'a fast spin should carry the crew off their place: ' + worst.toFixed(2)); for (let i = 0; i < 120; i++) G.step(S); ok(off() < 0.1, 'and they should get back to it'); }
// the current: an idle raft is carried along at a good pace, faster where the river is narrow, and wide on a bend
{ const S = G.newRun(0, 1); settle(S); const s0 = S.s; for (let i = 0; i < 90; i++) G.step(S); ok(S.s - s0 > 5, 'an idle raft should be carried a good way in 3 s: ' + (S.s - s0).toFixed(1));
  const L = G.level(lvOf('rocks')), sp = (s) => G.current(L, G.locate(L, ...L.at(s, 0), Math.floor(s/2)))[2]; ok(sp(100) > sp(20)*1.25, 'the gorge should run faster than the open river: ' + sp(100).toFixed(1) + ' vs ' + sp(20).toFixed(1));
  const mid = sp(20), side = G.current(L, G.locate(L, ...L.at(20, 5), 10))[2]; ok(side < mid*0.75, 'the current should be slower by the bank');
  const B = G.level(lvOf('bends')), T = G.newRun(B.i, 1); settle(T); place(T, 30, 0); for (let i = 0; i < 60; i++) G.step(T); const loc = G.locate(B, T.x, T.z, T.hint); ok(loc.d < -1, 'a right-hand bend should carry an idle raft to the left bank: ' + loc.d.toFixed(2)); }
// a tank runs dry and refills
{ const S = G.newRun(0, 2); settle(S); S.beans.fill(true); G.input(S, 0, null, true); for (let i = 0; i < 30*4; i++) G.step(S); ok(S.crew[0].g < 0.03 && !S.crew[0].fire, 'tank should be empty'); G.input(S, 0, null, false); for (let i = 0; i < 30*3; i++) G.step(S); ok(S.crew[0].g > 0.95, 'tank should refill'); }
// a crocodile sinks the raft, and it comes back at the last checkpoint with a moment of safety
{ const S = G.newRun(lvOf('crocs'), 2); settle(S); const L = S.L, cp = L.cps[0], croc = L.solids.find((o) => o.t === 'croc');
  place(S, cp.s + 0.5, 0); G.step(S); ok(S.cp === 0, 'checkpoint not taken'); let sunk = false, backEv = false;
  for (let i = 0; i < 400 && !backEv; i++) { const p = G.where(croc, S.tm); if (!sunk) { S.x = p[0]; S.z = p[1]; S.hint = Math.floor(croc.s/2); } G.step(S); if (S.ev.some((e) => e.t === 'wipe')) sunk = true; if (S.ev.some((e) => e.t === 'back')) backEv = true; }
  ok(sunk && backEv, 'crocodile should sink the raft and it should come back'); ok(Math.abs(S.s - cp.s) < 4 && S.safe > 0 && S.wipes === 1, 'should be back at the checkpoint, safe for a moment: s=' + S.s.toFixed(1)); }
// spikes sink; so does driving off the edge of the sky river, and so does a gap you did not jump
{ const S = G.newRun(lvOf('rocks'), 1); settle(S); const sp = S.L.solids.find((o) => o.t === 'spike'); place(S, sp.s, sp.lat); S.hint = Math.floor(sp.s/2); G.step(S); ok(S.dead > 0, 'spike should sink the raft'); }
{ const S = G.newRun(lvOf('sky'), 1); settle(S); place(S, 30, 0); for (let i = 0; i < 90 && S.dead <= 0; i++) { G.input(S, 0, 0, true); G.step(S); } ok(S.dead > 0, 'should fall off the open edge'); const T = G.newRun(lvOf('sky'), 1); settle(T); place(T, 10, 0); for (let i = 0; i < 90; i++) { G.input(T, 0, 0, true); G.step(T); } ok(T.dead <= 0 && T.wipes === 0, 'a railed stretch should hold the raft'); }
{ const L = G.level(lvOf('sky')), gap = L.gaps[0]; const slow = G.newRun(L.i, 1); settle(slow); place(slow, gap[0] - 1, 0); for (let i = 0; i < 90 && slow.dead <= 0; i++) G.step(slow); ok(slow.dead > 0, 'drifting into a gap should be a fall');
  const fast = G.newRun(L.i, 1); settle(fast); const ramp = L.zones.find((o) => o.t === 'ramp'); place(fast, ramp.s - 3, 0); const m = L.mid(ramp.s); fast.vx = m.tx*8.5; fast.vz = m.tz*8.5; for (let i = 0; i < 50; i++) { G.input(fast, 0, Math.atan2(m.tz, m.tx), true); G.step(fast); } ok(fast.wipes === 0 && fast.s > gap[1], 'a fast raft should jump the gap: s=' + fast.s.toFixed(1) + ' wipes=' + fast.wipes); }
// a waterfall throws the raft off spinning
{ const L = G.level(lvOf('rocks')), f = L.falls[0], S = G.newRun(L.i, 1); settle(S); place(S, f.s - 1, 0); let fell = false, spin = 0; for (let i = 0; i < 70; i++) { G.step(S); if (S.ev.some((e) => e.t === 'fall')) fell = true; spin = Math.max(spin, Math.abs(S.w)); } ok(fell && spin > 4 && S.s > f.s + 2, 'waterfall should throw and spin the raft'); ok(G.elev(L, f.s + 5) < -2.5 && G.elev(L, f.s - 1) === 0, 'the river should be lower after its waterfall'); }
// a fast raft jumps the reef from the ramp; a slow one does not
{ const L = G.level(lvOf('rocks')), ramp = L.zones.find((o) => o.t === 'ramp'), reef = L.solids.find((o) => o.t === 'reef' && o.s > ramp.s);
  const tryIt = (speed) => { const S = G.newRun(L.i, 2); settle(S); place(S, ramp.s - 3, ramp.lat); const m = L.mid(ramp.s), aim = Math.atan2(m.tz, m.tx); S.vx = m.tx*speed; S.vz = m.tz*speed; let jumped = false; for (let i = 0; i < (speed > 4 ? 60 : 200); i++) { if (speed > 4) { G.input(S, 0, aim, true); G.input(S, 1, aim, true); } G.step(S); if (S.ev.some((e) => e.t === 'jump')) jumped = true; } return { jumped, s: S.s }; };
  const fast = tryIt(8), slow = tryIt(1); ok(fast.jumped && fast.s > reef.s + 1, 'fast raft should clear the reef: ' + JSON.stringify(fast)); ok(!slow.jumped && slow.s < reef.s, 'slow raft should be stopped by the reef: ' + JSON.stringify(slow)); }
// a shut gate holds the raft, an open one lets it through; the jaws crush what is between them when they shut
{ const L = G.level(lvOf('mill')), gate = L.solids.find((o) => o.t === 'gate'); const S = G.newRun(L.i, 2); settle(S); let through = 0, held = 0;
  for (let k = 0; k < 2; k++) { place(S, gate.s - 2.2, 0); S.safe = 0; const open = G.gateOpen(gate, S.tm); const m = L.mid(gate.s); for (let i = 0; i < 25; i++) { S.vx = m.tx*6; S.vz = m.tz*6; G.step(S); } if (S.s > gate.s + 0.5) through++; else held++; S.ph = 'run'; while (G.gateOpen(gate, S.tm) === open) G.step(S); }
  ok(through === 1 && held === 1, 'gate should hold once and let through once: ' + through + '/' + held);
  const jaws = L.solids.find((o) => o.t === 'jaws'), T = G.newRun(L.i, 1); settle(T); let crushed = false; for (let i = 0; i < 30*8 && !crushed; i++) { T.x = jaws.cx; T.z = jaws.cz; T.vx = T.vz = 0; T.hint = Math.floor(jaws.s/2); T.safe = 0; G.step(T); if (T.dead > 0) crushed = true; } ok(crushed, 'jaws should crush a raft that sits between them'); }
// a mine throws the raft away, once; golden rolls make the third star
{ const S = G.newRun(lvOf('crocs'), 2); settle(S); const mine = S.L.mines[0]; place(S, mine.s - 1, mine.lat); let boom = 0; for (let i = 0; i < 20; i++) { G.step(S); boom += S.ev.filter((e) => e.t === 'boom').length; } ok(boom === 1 && Math.hypot(S.x - mine.x, S.z - mine.z) > 3 && S.wipes === 0, 'mine should blow the raft away once'); }
{ ok(G.starsOf(G.level(0), 5, 3) === 3 && G.starsOf(G.level(0), 5, 2) === 2 && G.starsOf(G.level(0), 999, 3) === 2 && G.starsOf(G.level(0), 999, 0) === 1, 'stars'); }
// a phone that loads a message and carries on by itself stays with the server
{ const lv = G.LEVELS.length - 1, S = G.newRun(lv, 3), C = G.newRun(lv, 3); let worst = 0; for (let i = 0; i < 2400; i++) { G.pilot(S); G.step(S); if (i % 6 === 0) G.load(C, JSON.parse(JSON.stringify(G.save(S)))); else { for (let k = 0; k < 3; k++) { C.crew[k].on = S.crew[k].on; C.crew[k].aim = S.crew[k].aim; } G.step(C); } if (S.dead <= 0) worst = Math.max(worst, Math.hypot(C.x - S.x, C.z - S.z)); }
  ok(worst < 0.25, 'phone drifts from the server: ' + worst.toFixed(3)); console.log('phone drift', worst.toFixed(3)); }
console.log(bad ? `${bad} FAILED` : 'all ok', Date.now() - t0, 'ms'); process.exit(bad ? 1 : 0);
