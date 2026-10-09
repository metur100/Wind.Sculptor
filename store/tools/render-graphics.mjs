/**
 * Renders app icons, splash image and store graphics from the game's own logo (public/icon.svg design),
 * and composes captioned store screenshots from the raw captures.
 *
 *   node store/tools/capture-screenshots.mjs   (first)
 *   node store/tools/render-graphics.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright-core';

import { DEVICES, ROOT } from './devices.mjs';

const font = (weight) =>
  fs.readFileSync(path.join(ROOT, `node_modules/@fontsource/fredoka/files/fredoka-latin-${weight}-normal.woff2`)).toString('base64');
const FONTS = `
@font-face { font-family: Fredoka; font-weight: 600; src: url(data:font/woff2;base64,${font(600)}) format('woff2'); }
@font-face { font-family: Fredoka; font-weight: 700; src: url(data:font/woff2;base64,${font(700)}) format('woff2'); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; font-family: Fredoka, sans-serif; }`;

const png = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

// ── Logo pieces (512 × 512 design space, same as public/icon.svg) ─────────────────────────────
const SKY = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9a0"/><stop offset="1" stop-color="#ff9f7a"/></linearGradient>`;
const strokes = (mono = false) => `
  <g fill="none" stroke-linecap="round" stroke-width="30">
    <path d="M86 196 H316 a48 48 0 1 0 -48 -48" stroke="${mono ? '#fff' : '#ffffff'}"/>
    <path d="M86 268 H370 a48 48 0 1 1 -48 48" stroke="${mono ? '#fff' : '#24324a'}"/>
    <path d="M86 340 H230" stroke="${mono ? '#fff' : '#3ec7e0'}"/>
  </g>
  <g fill="#ffffff" opacity="0.9">
    <circle cx="390" cy="160" r="12"/><circle cx="420" cy="205" r="9"/><circle cx="380" cy="400" r="10"/><circle cx="140" cy="410" r="8"/>
  </g>`;
/** Full-bleed square icon (stores and iOS apply their own corner mask). */
const squareIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${SKY}</defs><rect width="512" height="512" fill="url(#sky)"/>${strokes()}</svg>`;
const roundedIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${SKY}</defs><rect width="512" height="512" rx="112" fill="url(#sky)"/>${strokes()}</svg>`;
/** Android adaptive icon layers: logo kept inside the 66 % safe zone. */
const adaptiveView = 'viewBox="-124 -124 760 760"';
const adaptiveForeground = `<svg xmlns="http://www.w3.org/2000/svg" ${adaptiveView}>${strokes()}</svg>`;
const adaptiveMonochrome = `<svg xmlns="http://www.w3.org/2000/svg" ${adaptiveView}>${strokes(true)}</svg>`;
const adaptiveBackground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${SKY}</defs><rect width="512" height="512" fill="url(#sky)"/></svg>`;

const svgPage = (svg, bg = 'transparent') => `<style>${FONTS} body{background:${bg}} svg{display:block;width:100%;height:100%}</style>${svg}`;

// ── Captioned screenshots ─────────────────────────────────────────────────────────────────────
const SHOTS = {
  '01-swipe-wind': { title: 'Swipe to make wind', sub: 'Blow drifting particles into shape', bg: ['#ffe2b8', '#ff9f7a'], ink: '#24324a' },
  '02-result-stars': { title: 'Sculpt it. Earn 3 stars.', sub: 'Beat your best score on every level', bg: ['#dcebfb', '#8fb8ea'], ink: '#24324a' },
  '03-festival': { title: 'Confetti, snow, leaves & more', sub: 'Six materials with their own physics', bg: ['#ffd6ea', '#c3b2f3'], ink: '#24324a' },
  '04-night-forest': { title: 'Calm, cozy and beautiful', sub: 'Glowing fireflies and soothing music', bg: ['#34477d', '#121a33'], ink: '#fffaf0' },
  '05-deep-ocean': { title: '30 handcrafted levels', sub: 'Fans, walls, drains and moving targets', bg: ['#5ccbea', '#1b6b94'], ink: '#fffaf0' },
  '06-worlds': { title: 'Explore 6 dreamy worlds', sub: 'From sand dunes to the deep ocean', bg: ['#fff0dc', '#ffc9a3'], ink: '#24324a' },
  '07-collection': { title: 'Collect every sculpture', sub: 'A card for each shape you complete', bg: ['#f1ebff', '#cfdff8'], ink: '#24324a' },
  '08-menu-daily': { title: 'A new challenge every day', sub: 'Play offline · No account needed', bg: ['#e5f7ea', '#7fd3a0'], ink: '#24324a' },
};

function captionPage(device, name, file) {
  const s = SHOTS[name];
  const [W, H] = [device.css[0], device.css[1]];
  const wide = W / H > 0.7;
  const titleSize = Math.round(W * (wide ? 0.06 : 0.083));
  const subSize = Math.round(titleSize * 0.52);
  return `<style>${FONTS}
    body { width:${W}px; height:${H}px; background: linear-gradient(180deg, ${s.bg[0]}, ${s.bg[1]}); color:${s.ink};
      display:flex; flex-direction:column; align-items:center; }
    header { height:${Math.round(H * 0.17)}px; display:flex; flex-direction:column; justify-content:center; align-items:center;
      text-align:center; padding: 0 ${Math.round(W * 0.06)}px; gap:${Math.round(H * 0.008)}px; }
    h1 { font-weight:700; font-size:${titleSize}px; line-height:1.08; letter-spacing:-0.01em; }
    p { font-weight:600; font-size:${subSize}px; opacity:0.78; }
    .frame { flex:1; width:100%; display:flex; justify-content:center; align-items:flex-start; padding-bottom:${Math.round(H * 0.035)}px; min-height:0; }
    img { height:100%; max-width:${Math.round(W * 0.9)}px; object-fit:contain; border-radius:${Math.round(W * (wide ? 0.025 : 0.06))}px;
      box-shadow: 0 ${Math.round(H * 0.012)}px ${Math.round(H * 0.04)}px rgba(20, 30, 60, 0.32); border: ${Math.max(3, Math.round(W * 0.012))}px solid rgba(255,255,255,0.85); }
  </style>
  <header><h1>${s.title}</h1><p>${s.sub}</p></header>
  <div class="frame"><img src="${png(file)}"></div>`;
}

// ── Feature graphic (Google Play, 1024 × 500) ─────────────────────────────────────────────────
function featureGraphic() {
  const shot = (n) => png(path.join(ROOT, 'store/screenshots/raw/android-phone', `${n}.png`));
  return `<style>${FONTS}
    body { width:1024px; height:500px; background: linear-gradient(120deg, #ffe2b8 0%, #ffb987 55%, #ff9f7a 100%); position:relative; color:#24324a; }
    .icon { position:absolute; left:64px; top:92px; width:132px; height:132px; filter: drop-shadow(0 10px 20px rgba(150,70,30,0.3)); }
    h1 { position:absolute; left:64px; top:246px; font-size:76px; font-weight:700; line-height:0.95; }
    h1 span { color:#f2733f; display:block; }
    p { position:absolute; left:68px; top:420px; font-size:25px; font-weight:600; opacity:0.8; }
    .phone { position:absolute; width:206px; height:366px; border-radius:30px; border:7px solid #fffaf0; overflow:hidden;
      box-shadow: 0 18px 40px rgba(60,30,20,0.35); background-size:cover; background-position:center top; }
    .a { left:560px; top:96px; transform: rotate(-7deg); background-image:url(${shot('01-swipe-wind')}); }
    .b { left:770px; top:52px; transform: rotate(6deg); background-image:url(${shot('04-night-forest')}); }
  </style>
  <div class="icon">${roundedIcon}</div>
  <h1>Wind<span>Sculptor</span></h1>
  <p>Shape the wind. Sculpt the world.</p>
  <div class="phone a"></div><div class="phone b"></div>`;
}

// ── Header image (Google Play "Kopfzeilenbild", 5244 × 2950 and 3840 × 1646) ────────────────────
// Rendered at half size with deviceScaleFactor 2. Key content stays in the centre in case Play crops.
function headerImage(W, H) {
  const shot = (n) => png(path.join(ROOT, 'store/screenshots/raw/ios-iphone-6.9', `${n}.png`));
  // Four overlapping phones between `right` and 94 % of the width.
  const right = Math.round(W * 0.5);
  const span = W * 0.94 - right;
  const pw = Math.round(Math.min((H * 0.74 * 1320) / 2868, span / (1 + 3 * 0.72)));
  const ph = Math.round((pw * 2868) / 1320);
  const step = (span - pw) / 3;
  const phones = ['01-swipe-wind', '04-night-forest', '03-festival', '05-deep-ocean']
    .map((n, i) => {
      const x = right + i * step;
      const lift = [0.06, -0.02, 0.1, 0.02][i] * H;
      const rot = [-8, -2, 4, 9][i];
      return `<div class="phone" style="left:${x}px; top:${(H - ph) / 2 + lift}px; transform:rotate(${rot}deg); z-index:${i}; background-image:url(${shot(n)})"></div>`;
    })
    .join('');
  const title = Math.round(Math.min(H * 0.17, W * 0.08));
  return `<style>${FONTS}
    body { width:${W}px; height:${H}px; position:relative; color:#24324a;
      background: radial-gradient(circle at 78% 22%, #fff3d6 0, rgba(255,243,214,0) 30%), linear-gradient(120deg, #ffe2b8 0%, #ffb987 55%, #ff9f7a 100%); }
    .text { position:absolute; left:${Math.round(W * 0.08)}px; top:50%; transform:translateY(-50%); }
    .icon { width:${Math.round(H * 0.2)}px; height:${Math.round(H * 0.2)}px; margin-bottom:${Math.round(H * 0.04)}px; filter: drop-shadow(0 ${H * 0.02}px ${H * 0.04}px rgba(150,70,30,0.3)); }
    .icon svg { width:100%; height:100%; display:block; }
    h1 { font-size:${title}px; font-weight:700; line-height:0.95; }
    h1 span { color:#f2733f; display:block; }
    p { margin-top:${Math.round(H * 0.045)}px; font-size:${Math.round(title * 0.3)}px; font-weight:600; opacity:0.82; }
    .phone { position:absolute; width:${pw}px; height:${ph}px; border-radius:${Math.round(pw * 0.13)}px; border:${Math.max(4, Math.round(pw * 0.035))}px solid #fffaf0;
      background-size:cover; background-position:center top; box-shadow: 0 ${H * 0.03}px ${H * 0.07}px rgba(60,30,20,0.35); }
  </style>
  <div class="text"><div class="icon">${roundedIcon}</div><h1>Wind<span>Sculptor</span></h1><p>Shape the wind. Sculpt the world.</p></div>
  ${phones}`;
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const render = async (html, file, w, h, { transparent = false, scale = 1 } = {}) => {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: transparent });
  await page.close();
  console.log(`  ${path.relative(ROOT, file)}`);
};

try {
  const assets = path.join(ROOT, 'mobile/assets');
  const graphics = path.join(ROOT, 'store/graphics');
  console.log('App icons & splash');
  await render(svgPage(squareIcon), path.join(assets, 'icon.png'), 1024, 1024);
  await render(svgPage(adaptiveForeground), path.join(assets, 'android-icon-foreground.png'), 1024, 1024, { transparent: true });
  await render(svgPage(adaptiveBackground), path.join(assets, 'android-icon-background.png'), 1024, 1024);
  await render(svgPage(adaptiveMonochrome), path.join(assets, 'android-icon-monochrome.png'), 1024, 1024, { transparent: true });
  await render(svgPage(roundedIcon), path.join(assets, 'splash-icon.png'), 1024, 1024, { transparent: true });
  await render(svgPage(roundedIcon), path.join(assets, 'favicon.png'), 48, 48, { transparent: true });

  console.log('Store graphics');
  await render(svgPage(squareIcon), path.join(graphics, 'app-store-icon-1024.png'), 1024, 1024);
  await render(svgPage(squareIcon), path.join(graphics, 'play-store-icon-512.png'), 512, 512);
  await render(featureGraphic(), path.join(graphics, 'play-feature-graphic-1024x500.png'), 1024, 500);
  await render(headerImage(2622, 1475), path.join(graphics, 'play-header-5244x2950.png'), 2622, 1475, { scale: 2 });
  await render(headerImage(1920, 823), path.join(graphics, 'play-header-3840x1646.png'), 1920, 823, { scale: 2 });
  if (process.argv[2] === 'graphics') process.exit(0);

  console.log('Captioned screenshots');
  for (const device of DEVICES) {
    for (const name of Object.keys(SHOTS)) {
      const raw = path.join(ROOT, 'store/screenshots/raw', device.key, `${name}.png`);
      const out = path.join(ROOT, 'store/screenshots', device.key, `${name}.png`);
      await render(captionPage(device, name, raw), out, device.css[0], device.css[1], { scale: device.dpr });
    }
  }
} finally {
  await browser.close();
}
