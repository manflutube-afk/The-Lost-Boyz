/**
 * Turns the raw clips in source-images/ into web video, and writes the list
 * the Reelz page reads.
 *
 *   npm run videos
 *
 * Phone footage cannot go on a website as it comes off the phone. These clips
 * arrived as .mov, one of them HEVC, which most browsers will not play, at
 * sizes up to 42MB — over Cloudflare Pages' 25 MiB per-file limit. Each one is
 * re-encoded to H.264 MP4, which every browser plays, with the index moved to
 * the front of the file so playback can start before the whole thing has
 * downloaded.
 *
 * A poster frame is pulled from each so a tile shows the clip without
 * downloading any video at all.
 *
 * Titles already in public/data/reels.json are preserved on a re-run, so
 * naming a clip is not undone by rebuilding.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = 'source-images';
const OUT = 'public/videos';
const MANIFEST = 'public/data/reels.json';

/* ffmpeg is not on PATH after a winget install until the shell restarts, so
   look in the usual places before giving up. */
function findBinary(name) {
  const candidates = [
    name,
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin', name + '.exe'),
  ];
  for (const c of candidates) {
    try {
      execFileSync(c, ['-version'], { stdio: 'ignore' });
      return c;
    } catch { /* try the next one */ }
  }
  throw new Error(`${name} not found. Install it with:  winget install Gyan.FFmpeg`);
}

const FFMPEG = findBinary('ffmpeg');
const FFPROBE = findBinary('ffprobe');

const probe = (file) => {
  const out = execFileSync(FFPROBE, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-show_entries', 'format=duration',
    '-of', 'json', file,
  ]).toString();
  const j = JSON.parse(out);
  return {
    width: j.streams[0].width,
    height: j.streams[0].height,
    duration: Math.round(parseFloat(j.format.duration) || 0),
  };
};

const clock = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

if (!existsSync(SRC)) {
  console.error(`Missing ./${SRC}`);
  process.exit(1);
}

const sources = readdirSync(SRC)
  .filter((f) => /\.(mov|mp4|m4v|avi|mkv|webm)$/i.test(f))
  .sort();

if (!sources.length) {
  console.log('No video files in source-images/ — nothing to do.');
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });

// keep any titles already written against a clip
let existingTitles = {};
if (existsSync(MANIFEST)) {
  try {
    const prev = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    (prev.reels || []).forEach((r) => {
      if (r.file && r.title) { existingTitles[r.file] = r.title; }
    });
  } catch { /* a manifest in the old shape; start clean */ }
}

const reels = [];

sources.forEach((file, i) => {
  const src = path.join(SRC, file);
  const name = `reel-${String(i + 1).padStart(2, '0')}`;
  const mp4 = path.join(OUT, `${name}.mp4`);
  const poster = path.join(OUT, `${name}.webp`);

  const before = probe(src);
  process.stdout.write(`${file}  ${before.width}x${before.height} ${before.duration}s -> ${name}.mp4 ... `);

  /*
   * Every file has to come in under Cloudflare Pages' 25 MiB ceiling, and a
   * fixed quality setting cannot promise that: at CRF 26 the near-three-minute
   * clip in this batch sailed past 25 MiB and was still going. So the bitrate
   * is worked out from the clip's own length against a size budget, and used
   * as a ceiling on top of CRF. Short clips stay quality-driven and come out
   * small; long ones get reined in instead of running away.
   */
  const BUDGET_MB = 15;      // what to aim for
  const CEILING_MB = 24;     // where Pages stops accepting it
  const AUDIO_KBPS = 128;

  const budgetKbps = Math.round((BUDGET_MB * 8192) / Math.max(before.duration, 1)) - AUDIO_KBPS;
  const videoKbps = Math.max(500, Math.min(budgetKbps, 2800));

  /*
   * Long clips also come down in size. Spreading a small bitrate over a big
   * frame is what makes video look like wet paint; fewer pixels at the same
   * bitrate looks better.
   */
  const maxDim = before.duration > 100 ? 854 : 1280;

  const encode = (kbps) => execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-i', src,
    /*
     * Nothing is enlarged: several of these are already only 464 or 1024
     * across, and stretching them would just look soft. Both dimensions are
     * forced even, because H.264 will not encode odd ones.
     */
    '-vf', `scale='min(${maxDim},iw)':'min(${maxDim},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium',
    '-crf', '26',
    '-maxrate', `${kbps}k`, '-bufsize', `${kbps * 2}k`,
    '-pix_fmt', 'yuv420p',          // some players show nothing without this
    '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, '-ac', '2',
    '-movflags', '+faststart',      // index at the front, so it can stream
    mp4,
  ]);

  encode(videoKbps);

  // If a clip still overshoots, force it down rather than leaving a file the
  // deploy will refuse.
  let sizeMb = statSync(mp4).size / 1048576;
  if (sizeMb > CEILING_MB) {
    const retryKbps = Math.max(400, Math.floor(videoKbps * (CEILING_MB / sizeMb) * 0.9));
    process.stdout.write(`over budget at ${sizeMb.toFixed(1)}MB, re-encoding at ${retryKbps}k ... `);
    encode(retryKbps);
    sizeMb = statSync(mp4).size / 1048576;
  }

  // a frame a second in, past any black at the very start
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-ss', '1', '-i', src,
    '-frames:v', '1',
    '-vf', "scale='min(720,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
    '-q:v', '80',
    poster,
  ]);

  const after = probe(mp4);

  reels.push({
    file: `/videos/${name}.mp4`,
    poster: `/videos/${name}.webp`,
    width: after.width,
    height: after.height,
    duration: clock(after.duration),
    ...(existingTitles[`/videos/${name}.mp4`] ? { title: existingTitles[`/videos/${name}.mp4`] } : {}),
  });

  console.log(`${after.width}x${after.height} ${sizeMb.toFixed(1)}MB`);

  // Should never fire now the bitrate is budgeted and retried, but a deploy
  // failing on a file size is a miserable thing to debug, so say it here.
  if (sizeMb > CEILING_MB) {
    console.warn(`  !! ${name}.mp4 is ${sizeMb.toFixed(1)}MB — over Cloudflare Pages' 25 MiB limit. Trim the clip.`);
  }
});

writeFileSync(MANIFEST, JSON.stringify({
  _readme: 'Written by "npm run videos" from the clips in source-images/. Add a "title" to any entry and it survives a rebuild. To change the order, rename the source files — they are processed in filename order.',
  reels,
}, null, 2) + '\n');

const total = reels.reduce((n, r) => n + statSync('public' + r.file).size, 0) / 1048576;
console.log(`\n${reels.length} clips, ${total.toFixed(1)}MB total, listed in ${MANIFEST}`);
