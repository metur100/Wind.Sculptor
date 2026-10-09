import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');

/** Store screenshot sizes: CSS viewport × device pixel ratio = exact pixel size the store expects. */
export const DEVICES = [
  // App Store Connect
  { key: 'ios-iphone-6.9', store: 'App Store – iPhone 6.9" (required)', css: [440, 956], dpr: 3 }, // 1320 × 2868
  { key: 'ios-iphone-6.3', store: 'App Store – iPhone 6.3"', css: [402, 874], dpr: 3 }, // 1206 × 2622
  { key: 'ios-iphone-6.5', store: 'App Store – iPhone 6.5"', css: [414, 896], dpr: 3 }, // 1242 × 2688
  { key: 'ios-ipad-13', store: 'App Store – iPad 13" (required, iPad supported)', css: [1032, 1376], dpr: 2 }, // 2064 × 2752
  // Google Play
  { key: 'android-phone', store: 'Google Play – Phone', css: [360, 640], dpr: 3 }, // 1080 × 1920
  { key: 'android-tablet-7', store: 'Google Play – 7" tablet', css: [600, 960], dpr: 2 }, // 1200 × 1920
  { key: 'android-tablet-10', store: 'Google Play – 10" tablet', css: [800, 1280], dpr: 2 }, // 1600 × 2560
];
