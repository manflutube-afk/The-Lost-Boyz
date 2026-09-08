/**
 * Regenerates the responsive images in public/images from the originals.
 *
 * Put the full-size photos in ./source-images (same filenames as below),
 * then run:  npm run images
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';

const SRC = 'source-images';
const OUT = 'public/images';

// [output name, source file, widths to emit]
const JOBS = [
  ['hero',   'hero.jpg', [640, 1024, 1600]],
  ['live1',  '1.jpg',    [640, 1024]],
  ['amps',   '2.jpg',    [640, 1024]],
  ['cover',  'A2.jpg',   [480, 800]],
  ['sleeve', 'a1.jpg',   [480, 800]],
  ['disc',   'cd.jpg',   [480, 800]],
];
// logo.jpg is handled separately below — it gets cut out rather than resized.

if (!existsSync(SRC)) {
  console.error(`Missing ./${SRC} — drop the original photos in there first.`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

for (const [name, file, widths] of JOBS) {
  const src = `${SRC}/${file}`;
  if (!existsSync(src)) {
    console.warn(`skipping ${name}: ${src} not found`);
    continue;
  }

  const { width: srcWidth } = await sharp(src).metadata();

  for (const w of widths) {
    if (w > srcWidth) continue;
    await sharp(src).resize({ width: w }).webp({ quality: 78 })
      .toFile(`${OUT}/${name}-${w}.webp`);
  }

  // one JPEG fallback for browsers without webp
  const fallbackWidth = Math.min(widths.at(-1), srcWidth);
  await sharp(src).resize({ width: fallbackWidth }).jpeg({ quality: 76, mozjpeg: true })
    .toFile(`${OUT}/${name}-${fallbackWidth}.jpg`);

  console.log(`${name}: ${srcWidth}px source -> ${widths.join(', ')}`);
}

/*
 * Cut-out logo.
 *
 * The logo art is light line-work on a solid black square. Using its own
 * luminance as an alpha channel drops the black out and keeps the soft
 * shading in the wings, so the mark sits on photos and flat panels alike
 * without relying on CSS blend modes.
 */
const LOGO = `${SRC}/logo.jpg`;
const { data: rgb, info } = await sharp(LOGO)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const px = info.width * info.height;
const rgba = Buffer.allocUnsafe(px * 4);

for (let i = 0; i < px; i++) {
  const s = i * info.channels;
  const d = i * 4;
  const r = rgb[s], g = rgb[s + 1], b = rgb[s + 2];
  rgba[d] = r;
  rgba[d + 1] = g;
  rgba[d + 2] = b;
  // Rec. 709 luma becomes the alpha: the black backing goes clear. The 1.35
  // lift pushes the bone-coloured ink (luma ~230) to fully opaque without
  // bringing the dark background back with it.
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) * 1.35;
  rgba[d + 3] = luma > 255 ? 255 : luma | 0;
}

const cutoutPng = await sharp(rgba, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ threshold: 2 }) // shave the now-transparent margin
  .png({ compressionLevel: 9 })
  .toBuffer();

// The wings are dense line-work, so alpha webp stays chunky at high quality.
// Several widths let phones pull a much smaller file than the hero needs.
for (const w of [96, 160, 320, 480, 640]) {
  await sharp(cutoutPng).resize({ width: w })
    .webp({ quality: 62, alphaQuality: 75, effort: 6 })
    .toFile(`${OUT}/logo-${w}.webp`);
}

// one PNG for browsers without alpha-webp support
await sharp(cutoutPng).resize({ width: 480 }).png({ compressionLevel: 9, palette: true })
  .toFile(`${OUT}/logo-480.png`);

console.log('logo: cut out and resized');

/*
 * The disc artwork already comes with a transparent background, so it only
 * needs trimming and resizing. It spins on the home page, so it has to stay
 * a true circle on a clear background — no JPEG fallback for this one.
 */
const DISC = `${SRC}/lostcd.png`;
if (existsSync(DISC)) {
  const disc = await sharp(DISC).trim({ threshold: 2 }).png().toBuffer();

  // Pad to a centred square. Trimming leaves slightly uneven margins, and an
  // off-centre disc visibly wobbles once it starts spinning.
  const square = (w) => sharp(disc).resize({
    width: w,
    height: w,
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  for (const w of [320, 480, 640, 800]) {
    await square(w).webp({ quality: 80, alphaQuality: 90, effort: 6 })
      .toFile(`${OUT}/lostcd-${w}.webp`);
  }
  await square(640).png({ compressionLevel: 9, palette: true })
    .toFile(`${OUT}/lostcd-640.png`);
  console.log('lostcd: trimmed and resized');
} else {
  console.warn('skipping lostcd: source-images/lostcd.png not found');
}

/*
 * Gallery snaps (d1..d10). These arrive as 206px squares — Facebook-sized
 * thumbnails rather than full photos — so there is nothing to resize down to
 * and no point inventing pixels by scaling up. They are converted as they
 * are, and the gallery lays them out small enough to stay sharp.
 */
let snaps = 0;
for (let i = 1; i <= 10; i++) {
  const src = `${SRC}/d${i}.jpg`;
  if (!existsSync(src)) { continue; }
  await sharp(src).webp({ quality: 82 }).toFile(`${OUT}/d${i}.webp`);
  snaps++;
}
console.log(`gallery snaps: ${snaps} converted`);

// favicons / PWA icons — keep the black backing so the icon reads on any OS
await sharp(LOGO).resize(512, 512, { fit: 'cover' }).png()
  .toFile(`${OUT}/icon-512.png`);
await sharp(LOGO).resize(192, 192, { fit: 'cover' }).png()
  .toFile(`${OUT}/icon-192.png`);

/*
 * Social sharing card, 1200x630 — the size Facebook, WhatsApp, X and the
 * rest crop to. Built from the cut-out logo on the site's own violet glow,
 * rather than a crop of the album art, so a shared link is recognisably the
 * band rather than an arbitrary slice of a picture.
 */
const OG_W = 1200;
const OG_H = 630;

const ogBackground = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="44%" r="72%">
      <stop offset="0%"   stop-color="#4a1878"/>
      <stop offset="52%"  stop-color="#170b26"/>
      <stop offset="100%" stop-color="#07040c"/>
    </radialGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${OG_W}" height="6" fill="#a855f7"/>
</svg>`);

// Sized to leave clear air around the wingtips: social platforms crop these
// cards differently, and anything tight to an edge is the first thing lost.
const ogLogoWidth = 600;
const ogLogo = await sharp(cutoutPng).resize({ width: ogLogoWidth }).png().toBuffer();
const ogLogoMeta = await sharp(ogLogo).metadata();

await sharp(ogBackground)
  .composite([{
    input: ogLogo,
    left: Math.round((OG_W - ogLogoWidth) / 2),
    top: Math.round((OG_H - ogLogoMeta.height) / 2),
  }])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(`${OUT}/og.jpg`);

console.log(`og card: ${OG_W}x${OG_H} from the logo`);

console.log('done');
