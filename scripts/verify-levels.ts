/**
 * Headless level verifier: every campaign level (plus a week of daily challenges) is loaded and played
 * by a simple auto-player that only uses wind swipes – exactly like a player. Reports particle counts,
 * the best match reached and the stars earned, and fails if any level cannot be completed.
 *
 * Usage: npm run verify:levels            (all levels)
 *        npm run verify:levels -- w3-2    (levels whose id contains "w3-2")
 */
import { generateDailyLevel } from '../src/game/progression/DailyChallenge';
import { LEVELS } from '../src/game/levels/LevelData';
import type { LevelDefinition } from '../src/game/levels/LevelDefinition';
import { resolveLevel } from '../src/game/levels/LevelManager';
import { planSwipe } from '../src/game/gameplay/HintPlanner';
import { LevelSession } from '../src/game/gameplay/LevelSession';
import { ParticleSystem } from '../src/game/particles/ParticleSystem';
import { WindField } from '../src/game/particles/WindField';
import { SIM_STEP } from '../src/game/utils/Constants';
import { Rng } from '../src/game/utils/MathUtils';

const filter = process.argv[2];
const viewport = { width: 720, height: 1280, playTop: 150, playBottom: 1280 - 124 };
const days = Array.from({ length: 7 }, (_, i) => generateDailyLevel(`2026-10-${String(10 + i).padStart(2, '0')}`));
const levels: LevelDefinition[] = [...LEVELS, ...days].filter((l) => !filter || l.id.includes(filter));

const system = new ParticleSystem(900);
const wind = new WindField();
let failures = 0;

function play(def: LevelDefinition) {
  const resolved = resolveLevel(def, viewport, { maxParticles: 900 });
  const session = new LevelSession(resolved, system, wind);
  const rng = new Rng(7);
  let bestMatch = 0;
  let oneStarAt = -1;
  let stroke: { t: number; duration: number; x1: number; y1: number; x2: number; y2: number } | null = null;
  let cooldown = 0.6;
  const started = performance.now();
  while (session.state === 'playing') {
    if (stroke) {
      stroke.t += SIM_STEP;
      const k = Math.min(1, stroke.t / stroke.duration);
      wind.moveStroke(stroke.x1 + (stroke.x2 - stroke.x1) * k, stroke.y1 + (stroke.y2 - stroke.y1) * k, session.elapsed);
      if (k >= 1) {
        wind.endStroke();
        stroke = null;
        cooldown = 0.35;
      }
    } else if ((cooldown -= SIM_STEP) <= 0) {
      const plan = planSwipe(session, rng);
      if (plan) {
        const length = Math.hypot(plan.x2 - plan.x1, plan.y2 - plan.y1);
        stroke = { t: 0, duration: Math.max(0.08, length / plan.speed), ...plan };
        wind.beginStroke(plan.x1, plan.y1, session.elapsed);
      } else cooldown = 0.3;
    }
    session.step(SIM_STEP);
    bestMatch = Math.max(bestMatch, session.match);
    if (oneStarAt < 0 && session.match >= def.goals.one) oneStarAt = session.elapsed;
    // Finish as a player would once two stars are safe and the sculpture stops improving much.
    if (session.match >= def.goals.two && session.elapsed > def.time * 0.75) session.finish('finished');
    else if (session.match >= def.goals.one && session.timeLeft < 4) session.finish('finished');
  }
  const result = session.result!;
  const ms = performance.now() - started;
  const row = [
    def.id.padEnd(17),
    `${def.name} ${def.material}${'twist' in def ? ` ${String(def.twist)}` : ''}`.padEnd(30),
    String(resolved.particleCount).padStart(4),
    resolved.spacing.toFixed(1).padStart(5),
    `${(bestMatch * 100).toFixed(0)}%`.padStart(5),
    `${'★'.repeat(result.stars)}${'·'.repeat(3 - result.stars)}`,
    result.reason.padEnd(8),
    `${session.elapsed.toFixed(0)}s/${def.time}s`.padStart(9),
    `1★@${oneStarAt.toFixed(0)}s`.padStart(7),
    String(result.breakdown.score).padStart(5),
    `${(ms / (session.elapsed / SIM_STEP)).toFixed(2)}ms/step`,
  ];
  console.log(row.join('  '));
  if (!result.success) failures++;
}

console.log('level              name              N   grain  best  stars reason      time    score  perf');
for (const def of levels) play(def);
if (failures) {
  console.error(`\n${failures} level(s) were not completed by the auto-player.`);
  process.exit(1);
}
console.log(`\nAll ${levels.length} levels completed.`);
