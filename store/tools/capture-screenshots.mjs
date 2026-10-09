/**
 * Captures raw in-game screenshots for every App Store / Google Play size from the exact HTML that ships
 * in the app (mobile/src/gameHtml.ts, opened with ?debug for the automation hooks).
 *
 *   npm run build:mobile && node store/tools/capture-screenshots.mjs
 *
 * Output: store/screenshots/raw/<device>/NN-name.png at the store's exact pixel size.
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright-core';

import { DEVICES, ROOT } from './devices.mjs';

const BASE = 'https://windsculptor.local/';
const src = fs.readFileSync(path.join(ROOT, 'mobile/src/gameHtml.ts'), 'utf8');
const html = JSON.parse(src.slice(src.indexOf('= "') + 2, src.lastIndexOf(';')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2];

/** A believable mid-game save: three worlds done, the fourth started, a daily streak. */
function seedSave() {
  const levels = {};
  const stars = { 'w1-1': 3, 'w1-2': 3, 'w1-3': 2, 'w1-4': 3, 'w1-5': 3, 'w2-1': 3, 'w2-2': 3, 'w2-3': 2, 'w2-4': 3, 'w2-5': 3, 'w3-1': 3, 'w3-2': 3, 'w3-3': 3, 'w3-4': 2, 'w3-5': 3, 'w4-1': 3, 'w4-2': 2 };
  let total = 0;
  for (const [id, s] of Object.entries(stars)) {
    levels[id] = { completed: true, stars: s, bestScore: 700 + s * 80 + (id.charCodeAt(1) % 7) * 9, plays: 2 };
    total += s;
  }
  const today = new Date();
  const best = {};
  for (let d = 1; d <= 5; d++) {
    const day = new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
    best[day] = { score: 820 + d * 13, stars: 3 };
  }
  return {
    version: 2,
    tutorialDone: true,
    levels,
    totalStars: total,
    unlockedWorlds: [0, 1, 2, 3],
    collection: Object.keys(stars),
    settings: { sound: true, music: true, vibration: true, reducedMotion: false },
    daily: { best, streak: 5, lastCompleted: Object.keys(best)[0] },
    stats: { swipes: 1240, sculptures: 22, playSeconds: 5400 },
    entitlements: { removeAds: false, particlePacks: [], bonusDaily: false },
  };
}

/** Moves a share of the particles into the target shape, like a player who has nearly finished. */
function fillTarget(coverage) {
  const field = window.__WS__.game.scene.getScene('Gameplay').field;
  const sys = field.system;
  const mask = field.level.mask;
  const s = sys.spacing;
  const b = mask.bounds;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const points = [];
  for (let y = b.minY; y <= b.maxY; y += s * 0.92) {
    for (let x = b.minX; x <= b.maxX; x += s * 0.92) {
      const jx = x + (rnd() - 0.5) * s * 0.35;
      const jy = y + (rnd() - 0.5) * s * 0.35;
      if (mask.signedDistance(jx, jy) < -s * 0.35) points.push([jx, jy]);
    }
  }
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }
  const particles = sys.particles.filter((p) => p.active && !p.lost);
  const n = Math.min(particles.length, Math.round(points.length * coverage));
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    p.x = points[i][0];
    p.y = points[i][1];
    p.vx = 0;
    p.vy = 0;
  }
  return { placed: n, particles: particles.length, cells: points.length };
}

async function waitScene(page, key, timeout = 20000) {
  await page.waitForFunction((k) => window.__WS__?.activeScenes().includes(k), key, { timeout, polling: 100 });
  await sleep(500);
}

async function startLevel(page, index) {
  await page.evaluate((i) => window.__WS__.start('Gameplay', { mode: 'campaign', index: i }), index);
  await page.waitForFunction(() => window.__WS__.particles()?.active > 0, undefined, { timeout: 15000 });
  await sleep(2600); // let the level intro banner fade
}

/** Holds a swipe mid-air so the wind trail is visible in the shot. */
async function holdSwipe(page, from, to) {
  const H = await page.evaluate(() => window.__WS__.profile().height);
  const a = await page.evaluate(([x, y]) => window.__WS__.toPage(x, y), [from[0], from[1] * H]);
  const b = await page.evaluate(([x, y]) => window.__WS__.toPage(x, y), [to[0], to[1] * H]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 12, a.y + ((b.y - a.y) * i) / 12);
    await sleep(16);
  }
}

async function capture(browser, device) {
  const dir = path.join(ROOT, 'store/screenshots/raw', device.key);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: device.css[0], height: device.css[1] },
    deviceScaleFactor: device.dpr,
    hasTouch: true,
    isMobile: true,
  });
  await context.route(`${BASE}**`, (r) => r.fulfill({ body: html, contentType: 'text/html' }));
  const save = seedSave();
  await context.addInitScript((data) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('wind-sculptor/save', JSON.stringify(data));
      sessionStorage.setItem('seeded', '1');
    }
  }, save);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}?debug`);
  await waitScene(page, 'Menu');
  const shot = async (name) => {
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
    process.stdout.write(` ${name}`);
  };

  // 1. Mid-sculpt with a visible wind trail – Autumn Park fox.
  await startLevel(page, 6);
  await page.evaluate(fillTarget, 0.72);
  await sleep(500);
  await holdSwipe(page, [140, 0.86], [330, 0.6]);
  await shot('01-swipe-wind');
  await page.mouse.up();

  // 2. Finished sculpture → 3-star result – Winter Peaks snowman.
  await startLevel(page, 11);
  await page.evaluate(fillTarget, 1);
  await waitScene(page, 'Result', 15000);
  await sleep(3200);
  await shot('02-result-stars');

  // 3. Festival confetti – two fireworks at once.
  await startLevel(page, 18);
  await page.evaluate(fillTarget, 0.88);
  await sleep(650);
  await shot('03-festival');

  // 4. Night Forest fireflies – owl.
  await startLevel(page, 22);
  await page.evaluate(fillTarget, 0.86);
  await sleep(650);
  await shot('04-night-forest');

  // 5. Deep Ocean bubbles – whale.
  await startLevel(page, 29);
  await page.evaluate(fillTarget, 0.84);
  await sleep(650);
  await shot('05-deep-ocean');

  // 6. World select.
  await page.evaluate(() => window.__WS__.start('WorldSelect'));
  await waitScene(page, 'WorldSelect');
  await sleep(400);
  await shot('06-worlds');

  // 7. Collection.
  await page.evaluate(() => window.__WS__.start('Collection'));
  await waitScene(page, 'Collection');
  await sleep(900);
  await shot('07-collection');

  // 8. Main menu with the daily challenge.
  await page.evaluate(() => window.__WS__.start('Menu'));
  await waitScene(page, 'Menu');
  await sleep(900);
  await shot('08-menu-daily');

  await context.close();
  if (errors.length) throw new Error(`${device.key}: ${errors.join('; ')}`);
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const device of DEVICES) {
    if (only && device.key !== only) continue;
    process.stdout.write(`${device.key} (${device.css[0] * device.dpr}×${device.css[1] * device.dpr}):`);
    await capture(browser, device);
    console.log();
  }
} finally {
  await browser.close();
}
