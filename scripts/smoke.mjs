/**
 * Browser smoke test (Playwright + the locally installed Microsoft Edge or Chrome).
 *
 *   npm run dev            (or: npm run build && npm run preview, then pass the URL with ?debug)
 *   npm run smoke -- http://localhost:5173/
 *
 * Plays like a user with real pointer events: menu → interactive tutorial → level 1 (swipes until the
 * sculpture is complete) → results → reload (progress must persist) → settings → collection → daily.
 * Then loads all 30 campaign levels, checks narrow and desktop layouts and fails on any console error.
 * Screenshots go to test-results/.
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = path.resolve('test-results');
fs.mkdirSync(out, { recursive: true });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      /* try the next browser */
    }
  }
  throw new Error('Neither Microsoft Edge nor Google Chrome is installed.');
}

function step(name) {
  console.log(`\n▶ ${name}`);
}

async function waitFor(page, predicate, arg, timeout = 15000) {
  await page.waitForFunction(predicate, arg, { timeout, polling: 100 });
}

async function waitScene(page, key, timeout = 15000) {
  await waitFor(page, (k) => window.__WS__?.activeScenes().includes(k), key, timeout);
  await sleep(350);
}

async function buttons(page) {
  return page.evaluate(() => window.__WS__.buttons());
}

async function click(page, label) {
  const list = await buttons(page);
  const hit = list.filter((b) => b.label === label).pop();
  if (!hit) throw new Error(`Button "${label}" not found. Visible: ${list.map((b) => b.label).join(', ')}`);
  await page.mouse.click(hit.x, hit.y);
  console.log(`  clicked "${label}"`);
  await sleep(250);
}

/** Real mouse swipe in design coordinates. */
async function swipe(page, x1, y1, x2, y2, ms = 220) {
  const a = await page.evaluate(([x, y]) => window.__WS__.toPage(x, y), [x1, y1]);
  const b = await page.evaluate(([x, y]) => window.__WS__.toPage(x, y), [x2, y2]);
  const steps = 12;
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
    await sleep(ms / steps);
  }
  await page.mouse.up();
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log(`  screenshot ${name}.png`);
}

/** Lifts the sand pile into the target with upward swipes until `goal` is reached. */
async function sculpt(page, goal, maxSeconds = 70) {
  const profile = await page.evaluate(() => window.__WS__.profile());
  const start = Date.now();
  let i = 0;
  while ((Date.now() - start) / 1000 < maxSeconds) {
    const state = await page.evaluate(() => window.__WS__.gameplay());
    if (!state || state.state !== 'playing' || state.match >= goal) return state;
    const b = state.bounds;
    const x = b.minX + ((i * 0.37) % 1) * (b.maxX - b.minX);
    const bottom = profile.height - profile.safeBottom - 30;
    await swipe(page, x, bottom, x + (i % 2 ? 30 : -30), (b.minY + b.maxY) / 2, 260);
    await sleep(380);
    i++;
  }
  return page.evaluate(() => window.__WS__.gameplay());
}

async function newPage(browser, viewport, options = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, ...options });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  // The game must work offline: any request to another host is a failure.
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (!['localhost', '127.0.0.1'].includes(host) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push(`[network] ${r.url()}`);
  });
  return { context, page };
}

const browser = await launch();
try {
  const { context, page } = await newPage(browser, { width: 390, height: 844 });

  step('Main menu opens');
  await page.goto(url);
  await waitScene(page, 'Menu', 20000);
  await shot(page, '01-menu');
  const H = (await page.evaluate(() => window.__WS__.profile())).height;

  step('Interactive tutorial');
  await click(page, 'Play');
  await waitScene(page, 'Tutorial');
  await shot(page, '02-tutorial');
  const tutorialStart = Date.now();
  let finished = false;
  for (let i = 0; i < 80 && Date.now() - tutorialStart < 90000; i++) {
    const list = await buttons(page);
    if (list.some((b) => b.label === 'Finish')) {
      finished = true;
      break;
    }
    const x = 200 + ((i * 97) % 320);
    await swipe(page, x, H - 40, x + (i % 2 ? 40 : -40), H * 0.45, 260);
    await sleep(350);
  }
  if (!finished) throw new Error('Tutorial did not reach the final step');
  await shot(page, '03-tutorial-finish');
  await click(page, 'Finish');
  await sleep(2200);
  await click(page, 'Play Level 1');

  step('Level 1 can be played and completed with swipes');
  await waitScene(page, 'Gameplay');
  await sleep(600);
  await shot(page, '04-level1-start');
  const before = await page.evaluate(() => window.__WS__.gameplay());
  await click(page, 'Hint 3');
  await sleep(700);
  await shot(page, '05a-hint');
  // Screenshot in the middle of a swipe to see the wind trail.
  {
    const a = await page.evaluate(([x, y]) => window.__WS__.toPage(x, y), [200, H - 200]);
    const b = await page.evaluate(([x, y]) => window.__WS__.toPage(x, y), [520, H * 0.45]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
      await sleep(18);
    }
    await shot(page, '05b-wind-trail');
    await page.mouse.up();
  }
  await swipe(page, 360, H - 40, 360, H * 0.5, 240);
  await sleep(500);
  await shot(page, '05-level1-swipe');
  const state = await sculpt(page, 0.6);
  console.log(`  match ${Math.round(before.match * 100)}% → ${Math.round(state.match * 100)}%`);
  if (state.match <= before.match) throw new Error('Swipes did not move particles into the target');
  if (state.state === 'playing') await click(page, 'Finish');
  await waitScene(page, 'Result', 10000);
  await sleep(2800);
  await shot(page, '06-level1-result');
  const saved = await page.evaluate(() => window.__WS__.save().levels['w1-1']);
  console.log('  saved record', saved);
  if (!saved?.completed) throw new Error('Level 1 result was not saved');
  await click(page, 'Next');
  await waitFor(page, () => window.__WS__.gameplay()?.levelId === 'w1-2');
  console.log('  "Next" opened level 1-2');

  step('Progress survives a reload');
  await page.reload();
  await waitScene(page, 'Menu', 20000);
  const reloaded = await page.evaluate(() => window.__WS__.save());
  if (!reloaded.levels['w1-1']?.completed || !reloaded.tutorialDone) throw new Error('Progress lost after reload');
  console.log(`  ok – ${reloaded.totalStars} star(s), collection: ${reloaded.collection.join(', ')}`);
  await shot(page, '07-menu-after-reload');

  step('Settings work');
  await click(page, 'Settings');
  await waitScene(page, 'Settings');
  await click(page, 'Sound');
  await click(page, 'Reduced motion');
  const settings = await page.evaluate(() => window.__WS__.save().settings);
  if (settings.sound !== false || settings.reducedMotion !== true) throw new Error(`Settings not applied: ${JSON.stringify(settings)}`);
  await shot(page, '08-settings');
  await click(page, 'Sound');
  await click(page, 'Reduced motion');
  for (const toggle of ['Music', 'Vibration']) {
    const was = await page.evaluate(() => window.__WS__.save().settings);
    await click(page, toggle);
    const now = await page.evaluate(() => window.__WS__.save().settings);
    if (JSON.stringify(was) === JSON.stringify(now)) throw new Error(`${toggle} toggle did nothing`);
    await click(page, toggle);
  }
  await click(page, 'Reset progress');
  await shot(page, '09-reset-confirm');
  await click(page, 'Cancel');
  await click(page, 'back');
  await waitScene(page, 'Menu');

  step('World select, level select, collection');
  await click(page, 'Levels');
  await waitScene(page, 'WorldSelect');
  await shot(page, '10-worlds');
  await click(page, 'Sand Dunes');
  await waitScene(page, 'LevelSelect');
  await shot(page, '11-levels');
  await click(page, 'Level 1-2');
  await waitScene(page, 'Gameplay');
  await sleep(500);

  step('Keyboard wind and pause on focus loss');
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowRight']) {
    await page.keyboard.press(key);
    await sleep(200);
  }
  const keyed = await page.evaluate(() => window.__WS__.gameplay());
  if (keyed.swipes < 3) throw new Error(`Keyboard gusts not registered (${keyed.swipes})`);
  console.log(`  ${keyed.swipes} keyboard gusts`);
  await page.evaluate(() => window.__WS__.game.events.emit('blur'));
  await sleep(300);
  await click(page, 'Resume');
  await page.evaluate(() => window.__WS__.game.events.emit('hidden'));
  await sleep(300);
  await click(page, 'Restart');
  await waitFor(page, () => window.__WS__.gameplay()?.swipes === 0);
  await click(page, 'pause');
  await shot(page, '12-paused');
  await click(page, 'Main menu');
  await waitScene(page, 'Menu');
  await click(page, 'Collection');
  await waitScene(page, 'Collection');
  await sleep(500);
  await shot(page, '13-collection');
  await click(page, 'Next');
  await click(page, 'Prev');
  await click(page, 'back');
  await waitScene(page, 'Menu');
  await click(page, 'Tutorial');
  await waitScene(page, 'Tutorial');
  await click(page, 'Skip');
  await waitScene(page, 'Menu');

  step('Daily challenge');
  await click(page, 'Daily Challenge');
  await waitScene(page, 'Gameplay');
  await sleep(800);
  await shot(page, '14-daily');

  step('Failure screen');
  await click(page, 'Finish');
  await waitScene(page, 'Result', 8000);
  await sleep(600);
  await shot(page, '15-failure');
  await click(page, 'Retry with a hint');
  await waitScene(page, 'Gameplay');
  await sleep(1300);
  await shot(page, '15b-retry-with-hint');

  step('Reset progress (confirmed)');
  await page.evaluate(() => window.__WS__.start('Settings'));
  await waitScene(page, 'Settings');
  await click(page, 'Reset progress');
  await click(page, 'Yes, reset everything');
  await waitScene(page, 'Menu');
  const reset = await page.evaluate(() => window.__WS__.save());
  if (Object.keys(reset.levels).length || reset.tutorialDone || reset.totalStars) throw new Error('Reset did not clear progress');
  console.log('  progress cleared, settings kept');

  step('All 30 levels load');
  for (let index = 0; index < 30; index++) {
    await page.evaluate((i) => window.__WS__.start('Gameplay', { mode: 'campaign', index: i }), index);
    await waitFor(page, () => window.__WS__.particles()?.active > 0, undefined, 10000);
    await sleep(250);
    const p = await page.evaluate(() => window.__WS__.particles());
    process.stdout.write(`  ${index + 1}:${p.active} `);
    if ([5, 12, 18, 24, 29].includes(index)) await shot(page, `16-level-${String(index + 1).padStart(2, '0')}`);
  }
  console.log();
  await context.close();

  step('Narrow phone and desktop layouts');
  for (const [name, viewport] of [
    ['narrow-320x568', { width: 320, height: 568 }],
    ['phone-360x780', { width: 360, height: 780 }],
    ['desktop-1440x900', { width: 1440, height: 900 }],
  ]) {
    const { context: ctx, page: p } = await newPage(browser, viewport, name.startsWith('desktop') ? { hasTouch: false, deviceScaleFactor: 1 } : {});
    await p.goto(url);
    await waitScene(p, 'Menu', 20000);
    await shot(p, `17-${name}-menu`);
    await p.evaluate(() => window.__WS__.start('Gameplay', { mode: 'campaign', index: 9 }));
    await waitScene(p, 'Gameplay');
    await sleep(700);
    await shot(p, `17-${name}-gameplay`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (errors.length) {
  console.error(`\n✖ ${errors.length} browser error(s):\n${[...new Set(errors)].join('\n')}`);
  process.exit(1);
}
console.log('\n✔ Smoke test passed');
