# Wind Sculptor

A calm, mobile-first hyper-casual game: swipe to create **wind** and blow drifting particles (sand, autumn leaves, snow, confetti, fireflies and bubbles) into a target shape before the timer runs out.

You never touch a particle directly. Loose particles become wind trails, and the wind trails become a finished sculpture.

Made by **Medin Turkes**. Built with TypeScript, Vite and Phaser 3. It has no backend, no accounts and no network calls; everything is drawn and synthesised in code.

---

## Run it

Requires **Node.js 20+** (tested with Node 22) and npm.

```bash
npm install          # once
npm run dev          # dev server → http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
npm run build        # type-check + production build → dist/
npm run preview      # serve dist/ → http://localhost:4173
npm run test         # unit tests (Vitest)
npm run lint         # ESLint
```

Extra quality tools:

```bash
npm run verify:levels                       # an auto-player completes all 30 levels + a week of dailies using only swipes
npm run smoke -- http://localhost:5173/     # browser smoke test (needs the dev server and Edge or Chrome installed)
npm run smoke -- "http://localhost:4173/?debug"   # same against the production build
```

The smoke test plays the game with real pointer events:

- menu, tutorial, level 1 (swiped until complete), results and Next
- a reload, to check that progress persists
- settings, world select, level select, keyboard wind, pause on focus loss, collection, daily challenge, failure screen and confirmed reset
- loading all 30 levels, then 320 px, 360 px and desktop layouts

It fails on any console error and on any request to another host. Screenshots go to `test-results/`.

## Controls

| Input | Action |
| --- | --- |
| Touch / mouse / trackpad drag | Create wind along the swipe. Faster swipes blow harder |
| Arrow keys or WASD | Keyboard gust from the centre of the loose particles |
| F | Finish / check the sculpture |
| H | Hint |
| P or Esc | Pause / resume |
| R | Restart level |
| Tab / Shift+Tab, arrows, Enter / Space | Navigate and press buttons in menus |

## Game content

- **6 worlds × 5 levels = 30 levels.** Each world has its own material, palette and scenery: Sand Dunes, Autumn Park, Winter Peaks, Festival, Night Forest and Deep Ocean.
- **Difficulty rises gradually.** Levels get finer grain (more particles), larger and thinner shapes, and add these challenges:
  - crosswinds (breeze)
  - fans
  - walls
  - ponds and drains that swallow particles
  - limited wind energy
  - moving targets
  - two targets at once
- **Interactive tutorial:** four steps played on a real level.
- **Daily challenge:** today's date seeds a special shape, material and twist, the same on every device. Your best score per day and a streak are saved.
- **Collection:** completing a level unlocks its sculpture card, showing name, material, world, best score, stars and an animated preview.
- **Results:** stars, a count-up score, time left and swipes, plus unlock notices. Failing shows the reason and offers Retry, "Keep sculpting +20 s" after a timeout, or Retry with a hint.

| World | Levels | New mechanics |
| --- | --- | --- |
| 1 Sand Dunes | Circle, Tree, Cactus, Mountain, Camel | basics, gentle breeze |
| 2 Autumn Park | Leaf, Fox, Tree, Squirrel, Windmill | breeze, fans, walls |
| 3 Winter Peaks | Snowball, Snowman, Pine Tree, Penguin, Mountain Cabin | icy ponds, limited energy |
| 4 Festival | Star, Cake, Balloon, Firework, Crown | moving targets, two targets at once |
| 5 Night Forest | Moon, Flower, Owl, Lantern, Magical Tree | scattered fireflies, energy, ponds |
| 6 Deep Ocean | Fish, Seahorse, Coral, Submarine, Whale | rising bubbles, drains, everything combined |

## How it works

### Wind (`src/game/particles/WindField.ts`)

Each pointer move adds a short segment (at most 24 px) to a ring buffer. A segment blows along its own direction for 0.42 s. The force on a particle from one segment is:

```
strength · speedFactor · (1 − d/radius)² · (1 − age/life)^1.5 · min(segmentLength/radius, 1.5)
```

The segment-length weight makes the wind independent of how often the browser reports pointer moves. A small "channel" component pulls particles towards the swipe line, so a swipe gathers particles and carries them. Wind is predictable rather than random.

### Particles (`src/game/particles/ParticleSystem.ts`)

This is a custom simulation, because Phaser's emitter has no wind fields or targets. It runs at a fixed 60 Hz step and includes:

- velocity and exponential drag
- gravity or buoyancy per material
- smooth turbulence
- soft neighbour repulsion through a spatial hash, so particles fill shapes like a fluid
- walls, fans and sinks
- screen bounds with soft cushions, so particles never stay glued to an edge
- a speed cap

The target catches particles: inside it they slow down, lose most of their gravity and are gently kept away from its edge, so a sculpture holds its shape until you blow it apart.

### Targets (`src/game/targets/`)

Shapes are composed from circles, rings, ellipses, rounded or rotated rectangles, polygons (triangles, letters, symbols), capsules and point clouds, and support cut-outs such as eyes or windows. A `TargetMask` rasterises them into a grid with a signed distance field, used for catching particles, scoring and hints.

### Score (`src/game/targets/ScoreCalculator.ts`)

```
match      = 0.75 · coverage + 0.25 · inside                       (shown live in the HUD)
accuracy   = 0.6 · inside + 0.4 · (1 − min(meanDistance / (8 · spacing), 1))
time       = timeRemaining / timeLimit
efficiency = 1 − min(max(0, swipes − par) / (1.5 · par), 1)
score      = round(1000 · (0.60·coverage + 0.25·accuracy + 0.10·time + 0.05·efficiency))
```

- **Coverage** is the share of the target's cells that hold a particle.
- **Inside** is the share of all particles inside the target. Lost particles count as outside, at maximum distance.
- **Stars:**
  - ★ when match ≥ goal.one (the level is complete)
  - ★★ when match ≥ goal.two
  - ★★★ when match ≥ goal.three with at least 20 % of the time left
- **Ending a level:**
  - Holding the three-star match for 1.2 s completes it automatically.
  - Otherwise press Finish, or wait for the timer.

### Progression (`src/game/progression/`)

- **Level unlocking:** a level opens when the previous one is completed.
- **World unlocking:** a world opens when the previous world is finished and you have enough total stars (0 / 5 / 12 / 20 / 28 / 36).
- **Save data:**
  - Stored in `localStorage` under `wind-sculptor/save`.
  - **Versioned:** old versions are migrated step by step, and every field is sanitised.
  - **Damaged saves:** corrupted JSON is backed up to `…save.corrupt` and the game starts fresh instead of crashing.
- **Reset:** "Reset progress" (with confirmation) deletes progress and keeps settings.

### Performance

- Particles are pooled: allocated once per level, with struct-of-arrays wind segments and no per-frame allocations in the simulation loop.
- Particles are drawn with a single Phaser **Blitter** per level, using a texture atlas baked for the level's particle size.
- The render scale follows the device pixel ratio, capped at 2× (1.5× on weaker devices).
- Weaker devices get a lower particle cap. A frame-time governor lowers it further if a device struggles.
- The simulation pauses when the tab is hidden or loses focus. Per-level textures and input listeners are released when a scene shuts down.

### Accessibility

- **Touch and visual design:**
  - Large touch targets: at least 80 design units, about 44 pt on a phone.
  - Stars use filled versus hollow shapes, switches show ON/OFF text, and walls are hatched, so no information relies on colour alone.
  - Portrait layout with safe-area insets for notches and home indicators; tall phones get extra play height.
- **Keyboard:** full keyboard navigation with a visible focus ring.
- **Screen readers:** events are announced through an `aria-live` region.
- **Reduced motion:** a setting that defaults to on when the OS asks for less motion.

### Audio and haptics

- **Audio:** all sound is synthesised with the Web Audio API. It includes:
  - wind that follows swipe speed
  - a material-specific rustle
  - chimes, star pops and button blips
  - failure tones and splashes
  - generative background music

  Sound and music have separate toggles.
- **Haptics:** vibration feedback for strong gusts, target progress, success and failure, via the Vibration API. It can be swapped for a native backend with `Haptics.setBackend()`.
- **Fallback:** the game works fully with audio or vibration off or unsupported.

### Monetisation hooks (not active)

`src/game/monetization/MonetizationManager.ts` defines `AdProvider` and `PurchaseProvider` interfaces. There are integration points for:

- a rewarded hint
- a "remove ads" purchase
- cosmetic particle packs
- a bonus daily level

The default providers report "not available". Nothing in the game requires ads or purchases, and hints are free.

## Project structure

```
src/
  main.ts                    entry: fonts, CSS, Phaser game
  styles/global.css
  game/
    GameConfig.ts            Phaser config (FIT scaling, all scenes)
    GameContext.ts           device profile, save data, settings
    scenes/                  Boot, Loading, Menu, Tutorial, WorldSelect, LevelSelect,
                             Gameplay, Result, Collection, Settings (+ BaseScene)
    gameplay/                LevelSession (rules, engine-independent), PlayField (rendering + input),
                             HintPlanner, FxPool, AmbientParticles
    particles/               Particle, ParticleSystem, ParticleMaterial, WindField
    targets/                 TargetDefinition, TargetShapes, TargetMask, ScoreCalculator
    levels/                  LevelDefinition, LevelData (6 worlds, 30 levels), LevelManager
    progression/             SaveManager, ProgressionManager, DailyChallenge
    rendering/               TextureFactory, Scenery, TargetRenderer (procedural canvas art)
    ui/                      Button, ProgressBar, StarRating, Modal, FocusManager, Icons, Logo, Draw, Typography
    audio/AudioManager.ts
    monetization/MonetizationManager.ts
    utils/                   Constants, MathUtils, DeviceUtils, Haptics, TestHooks
tests/                       Vitest unit tests
scripts/verify-levels.ts     headless auto-player for every level
scripts/smoke.mjs            Playwright browser smoke test
```

## Android (Capacitor)

The web build is ready to be wrapped with [Capacitor](https://capacitorjs.com/):

- Asset paths are relative (`base: './'`).
- The game runs fully offline.
- It is portrait only.
- `capacitor.config.json` is already included, with app ID `com.certidevelopment.windsculptor` and `webDir: dist`.

This prepares the project for packaging; the game is **not** published on Google Play.

Prerequisites: Android Studio (with an SDK and platform tools) and JDK 17+.

**1. Build the web version**

```bash
npm run build
```

**2. Add Capacitor**

```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
```

**3. Create the Android project**

```bash
npx cap add android
npx cap sync android
```

Lock the activity to portrait in `android/app/src/main/AndroidManifest.xml`:

```xml
<activity ... android:screenOrientation="portrait">
```

Optional, for native vibration: run `npm install @capacitor/haptics`, then at start-up call:

```ts
Haptics.setBackend(kind => CapHaptics.impact({ style: kind === 'success' ? ImpactStyle.Heavy : ImpactStyle.Light }))
```

**4. Run on an Android device**

1. Enable *Developer options → USB debugging* on the phone and connect it.
2. Run:

```bash
npx cap run android          # pick the device from the list
# or: npx cap open android   # then press Run in Android Studio
```

After every code change, run `npm run build && npx cap sync android`.

**5. Create a release build**

Create an upload keystore once and keep it and its passwords safe:

```bash
keytool -genkey -v -keystore wind-sculptor-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias windsculptor
```

Then build a signed Android App Bundle for Google Play:

```bash
npm run build && npx cap sync android
npx cap build android --androidreleasetype AAB \
  --keystorepath ../wind-sculptor-upload.jks --keystorealias windsculptor \
  --keystorepass <store-password> --keystorealiaspass <key-password>
```

Alternatively, use Android Studio → *Build → Generate Signed Bundle / APK*. The bundle ends up in `android/app/build/outputs/bundle/release/`.

Before each upload, raise `versionCode` and `versionName` in `android/app/build.gradle`.

## Credits

- Game design, code and art: **Medin Turkes**. All graphics and sounds are generated procedurally.
- Engine: [Phaser 3](https://phaser.io) (MIT).
- Font: [Fredoka](https://fonts.google.com/specimen/Fredoka) via Fontsource (SIL Open Font License), bundled for offline use.
