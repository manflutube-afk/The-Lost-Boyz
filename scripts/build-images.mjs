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
 * The "Read our story" button art.
 *
 * The artwork arrived as a PNG with no alpha channel — the transparency
 * checkerboard had been flattened into the pixels, so the drum kit sat on a
 * grid of grey and white squares. That grid is put back to transparent here
 * so the button can sit on the page's dark panel.
 *
 * The squares are light and neutral; the artwork is dark and purple, so the
 * two separate cleanly. The fill starts from the border and spreads inwards,
 * which keeps the chrome on the cymbals and the pale lettering — both light,
 * but both walled in by artwork — safely opaque.
 */
const STORY_BTN = `${SRC}/story button.png`;

if (existsSync(STORY_BTN)) {
  const { data: btn, info: btnInfo } = await sharp(STORY_BTN)
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });

  const W = btnInfo.width, H = btnInfo.height, C = btnInfo.channels;
  const isChecker = (i) => {
    const r = btn[i * C], g = btn[i * C + 1], b = btn[i * C + 2];
    const mx = Math.max(r, g, b);
    return mx >= 215 && mx - Math.min(r, g, b) <= 18;
  };

  const bg = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }

  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || !isChecker(i)) continue;
    bg[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }

  /*
   * The gap between the guitar neck and the cymbal is checkerboard as well,
   * but it is walled in, so the border fill never reaches it. An island of
   * light pixels is only really the checkerboard if it carries both of the
   * grid's two tones — a chrome highlight is a smooth gradient and will not,
   * which is what keeps this from punching holes in the drum hardware.
   */
  const seen = new Uint8Array(W * H);
  for (let start = 0; start < W * H; start++) {
    if (bg[start] || seen[start] || !isChecker(start)) continue;
    const island = [];
    const todo = [start];
    seen[start] = 1;
    let light = 0, mid = 0;

    while (todo.length) {
      const i = todo.pop();
      island.push(i);
      const mx = Math.max(btn[i * C], btn[i * C + 1], btn[i * C + 2]);
      if (mx >= 248) light++; else if (mx <= 242) mid++;

      const x = i % W, y = (i / W) | 0;
      const near = [];
      if (x > 0) near.push(i - 1);
      if (x < W - 1) near.push(i + 1);
      if (y > 0) near.push(i - W);
      if (y < H - 1) near.push(i + W);
      for (const j of near) {
        if (!seen[j] && !bg[j] && isChecker(j)) { seen[j] = 1; todo.push(j); }
      }
    }

    const both = light >= island.length * 0.15 && mid >= island.length * 0.15;
    if (island.length >= 200 && both) { for (const i of island) bg[i] = 1; }
  }

  // Two pixels of the artwork side go with it, which takes the pale fringe
  // where the art was blended into the squares. At 1716px across, that is
  // nothing; left in, it shows as a light halo on a dark background.
  for (let pass = 0; pass < 2; pass++) {
    const grown = Uint8Array.from(bg);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (bg[i]) continue;
        if ((x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) ||
            (y > 0 && bg[i - W]) || (y < H - 1 && bg[i + W])) grown[i] = 1;
      }
    }
    bg.set(grown);
  }

  const btnRgba = Buffer.allocUnsafe(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const s = i * C, d = i * 4;
    btnRgba[d] = btn[s];
    btnRgba[d + 1] = btn[s + 1];
    btnRgba[d + 2] = btn[s + 2];
    btnRgba[d + 3] = bg[i] ? 0 : 255;
  }

  const cutout = await sharp(btnRgba, { raw: { width: W, height: H, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();

  for (const w of [340, 460, 680, 920]) {
    await sharp(cutout).resize({ width: w })
      .webp({ quality: 84, alphaQuality: 90, effort: 6 })
      .toFile(`${OUT}/story-button-${w}.webp`);
  }
  await sharp(cutout).resize({ width: 680 }).png({ compressionLevel: 9 })
    .toFile(`${OUT}/story-button-680.png`);

  const cutMeta = await sharp(cutout).metadata();
  console.log(`story button: cut out at ${cutMeta.width}x${cutMeta.height}`);
} else {
  console.warn('skipping story button: source-images/story button.png not found');
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

/*
 * Sponsor logos. Drop whatever a sponsor sends into source-images/sponsors/
 * and run this; each one is fitted inside 320x160 without being cropped or
 * stretched, and the surrounding space is left transparent so it sits on the
 * card's panel whatever shape the logo is.
 *
 * 320 wide is deliberate: the card shows them at 160, so this is the two-times
 * version a phone screen needs.
 */
const SPONSOR_SRC = `${SRC}/sponsors`;
const SPONSOR_OUT = `${OUT}/sponsors`;

if (existsSync(SPONSOR_SRC)) {
  const { readdirSync } = await import('node:fs');
  mkdirSync(SPONSOR_OUT, { recursive: true });

  const files = readdirSync(SPONSOR_SRC)
    .filter((f) => /\.(png|jpe?g|webp|gif|tiff?)$/i.test(f));

  for (const file of files) {
    const name = file.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await sharp(`${SPONSOR_SRC}/${file}`)
      /*
       * Flattened onto white, and the card gives every logo a white plate to
       * sit on. Business logos are drawn for white paper — this one has dark
       * navy lettering, which would vanish against the card's dark panel.
       * Keying the white out is not an option for the same reason.
       */
      .flatten({ background: '#ffffff' })
      // never enlarge: blowing a small logo up just makes it mushy
      .resize({ width: 320, height: 160, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toFile(`${SPONSOR_OUT}/${name}.webp`);
    console.log(`sponsor logo: ${file} -> sponsors/${name}.webp`);
  }

  if (!files.length) { console.log('sponsor logos: none to do'); }
}

/*
 * Portraits for the Our Story page. Anything in source-images/people/ is
 * resized to two widths so a phone and a retina screen each get a sensible
 * file. Nothing is cropped: these are photographs of people, and deciding
 * where to cut someone's head off is not a job for a script.
 */
const PEOPLE_SRC = `${SRC}/people`;
const PEOPLE_OUT = `${OUT}/people`;

if (existsSync(PEOPLE_SRC)) {
  const { readdirSync } = await import('node:fs');
  mkdirSync(PEOPLE_OUT, { recursive: true });

  const files = readdirSync(PEOPLE_SRC).filter((f) => /\.(png|jpe?g|webp|tiff?)$/i.test(f));

  for (const file of files) {
    // "Kyle Endean.jpg" -> kyle-endean
    const name = file.replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    for (const w of [480, 960]) {
      await sharp(`${PEOPLE_SRC}/${file}`)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(`${PEOPLE_OUT}/${name}-${w}.webp`);
    }
    console.log(`portrait: ${file} -> people/${name}-{480,960}.webp`);
  }

  if (!files.length) { console.log('portraits: none to do'); }
}

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
