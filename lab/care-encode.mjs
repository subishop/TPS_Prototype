/* Encodes the care page flythrough for scrubbing and pulls the scene stills.

   Scrubbing is random access: every seek decodes from the previous keyframe,
   so the source (six keyframes in 27 seconds) scrubs like mud. Dense GOP,
   no B frames, no audio, faststart. Stills come from the ENCODED desktop file,
   because the encode changes the pixels and a still taken from the master
   would not match the frame the browser actually decodes.

   Usage: node lab/care-encode.mjs "<path to full flythrough v2.mp4>"
   Rerun whenever the film changes, then recheck the SCENES table in care.js. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';

const src = process.argv[2];
if (!src) { console.error('usage: node lab/care-encode.mjs <source.mp4>'); process.exit(1); }

const run = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
mkdirSync('assets/video', { recursive: true });

const clips = [
  { out: 'assets/video/care-flight.mp4',   scale: 'scale=1600:-2', gop: 8, crf: 24 },
  { out: 'assets/video/care-flight-m.mp4', scale: 'scale=1024:-2', gop: 4, crf: 27 },
];

for (const c of clips) {
  run(['-i', src, '-an',
    '-vf', `${c.scale}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(c.crf),
    '-bf', '0', '-g', String(c.gop), '-keyint_min', String(c.gop), '-sc_threshold', '0',
    '-movflags', '+faststart', c.out]);
  console.log(c.out, (statSync(c.out).size / 1048576).toFixed(1) + ' MB');
}

// One still per scene, at the middle of its settle. Keep in step with care.js.
const stills = [
  ['care-exterior', 0.0],
  ['care-kitchen',  5.9],
  ['care-living',  10.6],
  ['care-nursery', 15.4],
  ['care-bedroom', 20.8],
  ['care-sky',     26.6],
];
for (const [name, t] of stills) {
  run(['-ss', String(t), '-i', clips[0].out, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '78', `assets/img/${name}.webp`]);
  console.log(`assets/img/${name}.webp`, (statSync(`assets/img/${name}.webp`).size / 1024).toFixed(0) + ' KB');
}
