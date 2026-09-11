/**
 * Puts a content stamp on the stylesheet and the script in every page.
 *
 *   <script src="/app.js?v=a1b2c3d4">
 *
 * Run it after changing public/app.js or public/styles.css:
 *
 *   npm run stamp
 *
 * Why this is needed
 * ------------------
 * The custom domain tells browsers to keep those two files for four hours.
 * Pages itself says max-age=0 -- the pages.dev address still does -- so it is
 * the zone rewriting it on the way out, and nothing in the project can
 * override that.
 *
 * Four hours of held-onto JavaScript against a freshly deployed page is not a
 * theoretical problem: it has already broken this site twice. The countdown
 * vanished when an old script went looking for figures a new page no longer
 * had, and the sponsor cards stayed unclickable on a phone for the same
 * reason. Both times the file on the server was perfectly correct.
 *
 * The stamp is a hash of the file's own contents, so it only changes when the
 * file does. A visitor who has the current version keeps using it; one who has
 * an old version is asking for a URL that is genuinely new to them and gets
 * the new file at once. Nothing is re-downloaded for no reason.
 *
 * This is a workaround for the zone setting rather than a fix for it. The tidy
 * fix is Caching -> Configuration -> Browser Cache TTL -> "Respect Existing
 * Headers" in the Cloudflare dashboard, which needs permissions the deploy
 * credentials do not have. With that done this script is harmless but no
 * longer necessary.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const PUBLIC = 'public';

/* Eight characters of the file's hash: plenty to tell one build from another. */
const stampOf = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 8);

const assets = [
  { file: 'app.js', attr: 'src' },
  { file: 'styles.css', attr: 'href' },
].map((a) => ({ ...a, stamp: stampOf(`${PUBLIC}/${a.file}`) }));

const pages = readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));
let changed = 0;

for (const page of pages) {
  const path = `${PUBLIC}/${page}`;
  const before = readFileSync(path, 'utf8');
  let after = before;

  for (const { file, attr, stamp } of assets) {
    // matches /app.js, /app.js?v=old, and leaves anything else alone
    const pattern = new RegExp(`${attr}="/${file.replace('.', '\\.')}(?:\\?v=[a-f0-9]+)?"`, 'g');
    after = after.replace(pattern, `${attr}="/${file}?v=${stamp}"`);
  }

  if (after !== before) {
    writeFileSync(path, after);
    changed++;
  }
}

console.log(
  `stamped ${assets.map((a) => a.file + '?v=' + a.stamp).join(' and ')}`
  + ` across ${changed} of ${pages.length} pages`
);
