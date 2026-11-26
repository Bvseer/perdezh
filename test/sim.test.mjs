// Every river must be runnable: a helmsman steering all jets finishes each one, for every crew size.
import * as G from '../sim.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
const t0 = Date.now();
for (let lv = 0; lv < G.LEVELS.length; lv++) for (const n of [1, 3, 4]) {
  const S = G.newRun(lv, n); let steps = 0, maxOut = 0;
  while (S.ph !== 'done' && steps < 30*400) { G.pilot(S); G.step(S); steps++; const loc = G.locate(S.L, S.x, S.z, S.hint); maxOut = Math.max(maxOut, loc.dist - (loc.w - G.RR)); }
  ok(S.ph === 'done', `${S.L.name} n=${n} not finished: s=${S.s.toFixed(0)}/${S.L.len} wipes=${S.wipes}`);
  ok(maxOut < 0.8, `${S.L.name} n=${n} left the river by ${maxOut.toFixed(2)}`);
  ok(S.wipes <= 6, `${S.L.name} n=${n} sinks too often even for a careful helmsman: ${S.wipes}`);
  ok(S.L.golds.length === 3, `${S.L.name} must have three golden rolls`);
  console.log(`${S.L.name.padEnd(18)} n=${n} len=${S.L.len} time=${S.time} par=${S.L.par} stars=${S.stars} bumps=${S.bumps} wipes=${S.wipes} volleys=${S.volleys} gold=${G.goldCount(S)}/3 cp=${S.cp + 1}/${S.L.cps.length}`);
}
console.log('rivers run in', Date.now() - t0, 'ms');
const settle = (S, n) => { for (let i = 0; i < (n || 91); i++) G.step(S); };
const place = (S, s, lat) => { const [x, z] = S.L.at(s, lat), m = S.L.mid(s); S.x = x; S.z = z; S.a = Math.atan2(m.tz, m.tx); S.vx = S.vz = S.w = 0; S.hint = Math.floor(s/2); S.s = s; };
// the same run twice gives the same result
{ const run = () => { const S = G.newRun(2, 2); for (let i = 0; i < 900; i++) { G.pilot(S); G.step(S); } return [S.x, S.z, S.a].join(); }; ok(run() === run(), 'not repeatable'); }
// one jet alone turns the raft; both together go straight and make a volley
{ const S = G.newRun(0, 2); settle(S); G.input(S, 0, 1); const a0 = S.a; for (let i = 0; i < 30; i++) G.step(S); ok(wrap(S.a - a0) > 0.3, 'left jet should turn the bow to the right: ' + (S.a - a0)); }
{ const S = G.newRun(0, 2); settle(S); G.input(S, 0, 1); G.input(S, 1, 1); const a0 = S.a; let v = 0; for (let i = 0; i < 45; i++) { G.step(S); v += S.ev.filter((e) => e.t === 'volley').length; } ok(Math.abs(S.a - a0) < 0.05, 'both jets should go straight'); ok(v === 1, 'pressing together should give one volley, got ' + v); }
// a tank runs dry and refills
{ const S = G.newRun(0, 2); settle(S); G.input(S, 0, 1); for (let i = 0; i < 30*4; i++) G.step(S); ok(S.jets[0].g < 0.03 && !S.jets[0].fire, 'tank should be empty'); G.input(S, 0, 0); for (let i = 0; i < 30*3; i++) G.step(S); ok(S.jets[0].g > 0.95, 'tank should refill'); }
// a crocodile sinks the raft, and it comes back at the last checkpoint with a moment of safety
{ const S = G.newRun(4, 2); settle(S); const L = S.L, cp = L.cps[0], croc = L.solids.find((o) => o.t === 'croc' && o.s > cp.s) || L.solids.find((o) => o.t === 'croc');
  place(S, cp.s + 0.5, 0); G.step(S); ok(S.cp === 0, 'checkpoint not taken'); let sunk = false, backEv = false;
  for (let i = 0; i < 400 && !backEv; i++) { const p = G.where(croc, S.tm); if (!sunk) { S.x = p[0]; S.z = p[1]; S.hint = Math.floor(croc.s/2); } G.step(S); if (S.ev.some((e) => e.t === 'wipe')) sunk = true; if (S.ev.some((e) => e.t === 'back')) backEv = true; }
  ok(sunk && backEv, 'crocodile should sink the raft and it should come back'); ok(Math.abs(S.s - cp.s) < 4 && S.safe > 0 && S.wipes === 1, 'should be back at the checkpoint, safe for a moment: s=' + S.s.toFixed(1)); }
// a fast raft jumps the reef from the ramp; a slow one does not
{ const L = G.level(2), ramp = L.zones.find((o) => o.t === 'ramp'), reef = L.solids.find((o) => o.t === 'reef' && o.s > ramp.s);
  const tryIt = (speed) => { const S = G.newRun(2, 2); settle(S); place(S, ramp.s - 3, ramp.lat); const m = L.mid(ramp.s); S.vx = m.tx*speed; S.vz = m.tz*speed; let jumped = false; for (let i = 0; i < (speed > 4 ? 60 : 200); i++) { if (speed > 4) { G.input(S, 0, 1); G.input(S, 1, 1); } G.step(S); if (S.ev.some((e) => e.t === 'jump')) jumped = true; } return { jumped, s: S.s }; };
  const fast = tryIt(8), slow = tryIt(1); ok(fast.jumped && fast.s > reef.s + 1, 'fast raft should clear the reef: ' + JSON.stringify(fast)); ok(!slow.jumped && slow.s < reef.s, 'slow raft should be stopped by the reef: ' + JSON.stringify(slow)); }
// a shut gate holds the raft, an open one lets it through
{ const L = G.level(3), gate = L.solids.find((o) => o.t === 'gate'); const S = G.newRun(3, 2); settle(S); let through = 0, held = 0;
  for (let k = 0; k < 2; k++) { place(S, gate.s - 2.2, 0); S.safe = 0; const open = G.gateOpen(gate, S.tm); const m = L.mid(gate.s); for (let i = 0; i < 25; i++) { S.vx = m.tx*6; S.vz = m.tz*6; G.step(S); } if (S.s > gate.s + 0.5) through++; else held++; S.ph = 'run'; while (G.gateOpen(gate, S.tm) === open) G.step(S); }
  ok(through === 1 && held === 1, 'gate should hold once and let through once: ' + through + '/' + held); }
// a mine throws the raft away, once; golden rolls make the third star
{ const S = G.newRun(4, 2); settle(S); const mine = S.L.mines[0]; place(S, mine.s - 1, mine.lat); let boom = 0; for (let i = 0; i < 20; i++) { G.step(S); boom += S.ev.filter((e) => e.t === 'boom').length; } ok(boom === 1 && Math.hypot(S.x - mine.x, S.z - mine.z) > 3 && S.wipes === 0, 'mine should blow the raft away once'); }
{ ok(G.starsOf(G.level(0), 5, 3) === 3 && G.starsOf(G.level(0), 5, 2) === 2 && G.starsOf(G.level(0), 999, 3) === 2 && G.starsOf(G.level(0), 999, 0) === 1, 'stars'); }
// a phone that loads a message and carries on by itself stays with the server
{ const S = G.newRun(7, 3), C = G.newRun(7, 3); let worst = 0; for (let i = 0; i < 2400; i++) { G.pilot(S); G.step(S); if (i % 6 === 0) G.load(C, JSON.parse(JSON.stringify(G.save(S)))); else { for (let k = 0; k < 3; k++) C.jets[k].on = S.jets[k].on; G.step(C); } worst = Math.max(worst, Math.hypot(C.x - S.x, C.z - S.z)); }
  ok(worst < 0.2, 'phone drifts from the server: ' + worst.toFixed(3)); console.log('phone drift', worst.toFixed(3)); }
function wrap(a) { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; }
console.log(bad ? `${bad} FAILED` : 'all ok', Date.now() - t0, 'ms'); process.exit(bad ? 1 : 0);
