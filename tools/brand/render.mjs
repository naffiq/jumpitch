// Renders the animated neopitch brand scenes to looping MP4 videos (+ poster PNGs).
//
// Each scene is a self-contained HTML file whose CSS animations all share a 6s
// period. We drive the installed Microsoft Edge (Chromium) via playwright-core,
// then step every animation deterministically through one full period using the
// Web Animations API — so the captured frames form a perfectly seamless loop
// regardless of how fast the machine renders. Frames are encoded to H.264 with
// the bundled ffmpeg-static binary.
//
//   node tools/brand/render.mjs
//
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, rm, readdir, copyFile } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', '..', 'public', 'brand');
const framesDir = join(here, '.frames');

const PERIOD_MS = 6000; // every scene's animations loop within this window
const FPS = 30;
const FRAMES = (PERIOD_MS / 1000) * FPS; // 180

// width/height must match each HTML's stage and be even (yuv420p requirement).
const SCENES = [
  { name: 'app-icon',     file: 'favicon.html',      width: 512,  height: 512  },
  { name: 'share-og',     file: 'share-og.html',     width: 1200, height: 630  },
  { name: 'promo-square', file: 'promo-square.html',  width: 1080, height: 1080 },
  { name: 'promo-story',  file: 'promo-story.html',   width: 1080, height: 1920 },
];

function encode(scene) {
  return new Promise((resolve, reject) => {
    const out = join(outDir, `${scene.name}.mp4`);
    const args = [
      '-y',
      '-framerate', String(FPS),
      '-i', join(framesDir, 'frame-%04d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '18',
      '-preset', 'slow',
      '-movflags', '+faststart',
      out,
    ];
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--force-color-profile=srgb', '--hide-scrollbars'],
});

await mkdir(outDir, { recursive: true });

for (const scene of SCENES) {
  process.stdout.write(`\n▶ ${scene.name} (${scene.width}×${scene.height})\n`);
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const page = await browser.newPage({
    viewport: { width: scene.width, height: scene.height },
    deviceScaleFactor: 1,
  });
  await page.goto('file://' + join(here, scene.file).replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Freeze all CSS animations so we can scrub them frame by frame.
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));

  const clip = { x: 0, y: 0, width: scene.width, height: scene.height };
  for (let i = 0; i < FRAMES; i++) {
    const t = (i * PERIOD_MS) / FRAMES;
    await page.evaluate((time) => {
      document.getAnimations().forEach((a) => { a.currentTime = time; });
    }, t);
    const idx = String(i + 1).padStart(4, '0');
    await page.screenshot({ path: join(framesDir, `frame-${idx}.png`), clip });
  }
  await page.close();

  await encode(scene);
  await copyFile(join(framesDir, 'frame-0001.png'), join(outDir, `${scene.name}.png`));
  process.stdout.write(`  ✓ ${scene.name}.mp4 + ${scene.name}.png\n`);
}

await rm(framesDir, { recursive: true, force: true });
await browser.close();

const written = (await readdir(outDir)).sort().join(', ');
process.stdout.write(`\nDone → public/brand/\n  ${written}\n`);
