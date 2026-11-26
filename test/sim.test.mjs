// Every river must be runnable: a helmsman steering all jets finishes each one, for every crew size.
import * as G from '../sim.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
for (let lv = 0; lv < G.LEVELS.length; lv++) for (const n of [1, 2, 3, 4]) {
  const S = G.newRun(lv, n); let steps = 0, vol = 0, maxOut = 0;
  while (S.ph !== 'done' && steps < 30*240) { G.pilot(S); G.step(S); steps++; const loc = G.locate(S.L, S.x, S.z, S.hint); maxOut = Math.max(maxOut, loc.dist - (loc.w - G.RR)); }
  ok(S.ph === 'done', `${S.L.name} n=${n} not finished: s=${S.s.toFixed(0)}/${S.L.len}`);
  ok(maxOut < 0.6, `${S.L.name} n=${n} left the river by ${maxOut.toFixed(2)}`);
  console.log(`${S.L.name.padEnd(18)} n=${n} len=${S.L.len} time=${S.time} par=${S.L.par} stars=${S.stars} bumps=${S.bumps} volleys=${S.volleys} beans=${S.beans.filter(Boolean).length}/${S.beans.length}`);
}
// the same run twice gives the same result
{ const run = () => { const S = G.newRun(2, 2); for (let i = 0; i < 900; i++) { G.pilot(S); G.step(S); } return [S.x, S.z, S.a].join(); }; ok(run() === run(), 'not repeatable'); }
// one jet alone turns the raft; both together go straight
{ const S = G.newRun(0, 2); for (let i = 0; i < 90; i++) G.step(S); G.input(S, 0, 1); const a0 = S.a; for (let i = 0; i < 30; i++) G.step(S); ok(G_wrap(S.a - a0) > 0.3, 'left jet should turn the bow to the right: ' + (S.a - a0)); }
{ const S = G.newRun(0, 2); for (let i = 0; i < 90; i++) G.step(S); G.input(S, 0, 1); G.input(S, 1, 1); const a0 = S.a; let v = 0; for (let i = 0; i < 45; i++) { G.step(S); v += S.ev.filter((e) => e.t === 'volley').length; } ok(Math.abs(S.a - a0) < 0.05, 'both jets should go straight'); ok(v === 1, 'pressing together should give one volley, got ' + v); }
// a tank runs dry and refills
{ const S = G.newRun(0, 2); for (let i = 0; i < 90; i++) G.step(S); G.input(S, 0, 1); for (let i = 0; i < 30*4; i++) G.step(S); ok(S.jets[0].g < 0.03 && !S.jets[0].fire, 'tank should be empty'); G.input(S, 0, 0); for (let i = 0; i < 30*3; i++) G.step(S); ok(S.jets[0].g > 0.95, 'tank should refill'); }
// a phone that loads a message and carries on by itself stays with the server
{ const S = G.newRun(3, 3), C = G.newRun(3, 3); let worst = 0; for (let i = 0; i < 1500; i++) { G.pilot(S); G.step(S); if (i % 6 === 0) G.load(C, JSON.parse(JSON.stringify(G.save(S)))); else { for (let k = 0; k < 3; k++) C.jets[k].on = S.jets[k].on; G.step(C); } worst = Math.max(worst, Math.hypot(C.x - S.x, C.z - S.z)); }
  ok(worst < 0.15, 'phone drifts from the server: ' + worst.toFixed(3)); console.log('phone drift', worst.toFixed(3)); }
function G_wrap(a) { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; }
console.log(bad ? `${bad} FAILED` : 'all ok'); process.exit(bad ? 1 : 0);
