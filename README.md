# The Lost Boyz

The official site for **The Lost Boyz** — a two-piece rock band: Darren Endean and
Andrew Boraston. Mobile-first, static, and hosted on Cloudflare Pages at
<https://thelostboyz.uk> (currently served from `the-lost-boyz.pages.dev`
until the domain is pointed at it).

---

## Running it locally

```bash
npm install
npm run dev
```

That serves the site at <http://localhost:8788> using the same runtime Cloudflare
uses in production.

## Deploying

The Pages project is connected to this GitHub repository, so **pushing to `main`
deploys the site**. You do not normally need to run anything.

To push a deploy by hand instead:

```bash
npm run deploy
```

### The one setting that matters

The site lives in `public/`, not at the repository root. That is set by
`pages_build_output_dir` in `wrangler.jsonc`. If that is wrong or missing, Pages
publishes the repository root instead and every page 404s, because there is no
`index.html` up there.

Note that once this repo has a Wrangler config, **that file is the source of
truth** — the matching fields in the Cloudflare dashboard are ignored, so change
the build output directory here rather than there.

To put the site on a real domain, add it under the Pages project's *Custom
domains* tab in the Cloudflare dashboard.

---

## Things you still need to fill in

These are placeholders. Search the project for `TODO` to find them all.

| Where | What to change |
| --- | --- |
| `public/index.html` — Music section | The three streaming buttons all point at `#`. Swap in your Spotify / Apple Music / YouTube (or pre-save) links. |
| `public/index.html` — Music section | **Check the release date.** It currently reads *20 September 2026*, worked out from the Facebook post of 3 September that said "only 17 days until". Correct it if that is wrong. |
| `public/data/gigs.json` | Add your live dates (see below). |

### Adding a reel

The Reelz page lives at `/reelz` and is its own page, reached from the thumbnail
on the home page. Add videos in `public/data/reels.json`:

```json
{
  "reels": [
    {
      "url": "https://www.facebook.com/reel/34991504563830820",
      "title": "Friday night at The Dolphin"
    }
  ]
}
```

Paste the Facebook reel URL exactly as it appears in the address bar — the
`/reel/...` form works as-is. `title` is optional. The reel has to be **public**
on Facebook or it will not play for anyone else, and if a reel is later deleted
or made private its tile will break, since the video is streamed from Facebook
rather than hosted here.

The embeds are deliberately kept off the home page: Facebook's player is slow and
sets its own cookies, so the home page shows only a thumbnail and the videos load
on `/reelz`.

**How playback works.** The reels use Facebook's **JavaScript SDK**, not plain
iframes. This matters: a bare iframe gives the page no control at all — it cannot
start a video, stop one, or even know that a video is playing. The SDK hands back
a player object per video with `play()`, `pause()`, `mute()` and a
`startedPlaying` event, and that is what makes the behaviour on this page
possible:

- **Scroll-to-play is currently switched off.** iOS will not let a video inside
  a cross-origin iframe start itself, and the setup that would allow it — muted
  and inline from before the video loads — happens inside Facebook's player,
  out of reach. The attempt did real harm: to try at all, the reel had to be
  muted first, so tapping one caught it silent and the opening seconds of the
  song were lost. `autoplayWanted()` in `app.js` now returns `false`, with the
  old test kept underneath it in a comment.

  Turn it back on the day the band's own video files exist. A self-hosted
  `<video muted playsinline>` autoplays on iOS without any of this, and the
  scroll watcher is already written and working.

- **Only one plays at a time.** Every player reports `startedPlaying`, and that
  handler pauses all the others. Without it, clicking a second reel on a desktop
  leaves two soundtracks fighting.

  There is a catch worth knowing about. The SDK only hands back a player for a
  video it could actually load — **a reel that has been deleted or made private
  renders a "Video unavailable" frame and reports nothing at all.** That tile
  then cannot be paused, and never pauses anything else, so it plays over the
  top of whatever else is going. Two guards handle it: a tile with no player is
  stopped by rebuilding it instead, and a click into any reel's iframe is picked
  up through the window losing focus, which is the only signal an unreported
  tile gives. If a reel ever misbehaves, check first whether it is still public
  on Facebook.
- **Playback is inline.** `data-allowfullscreen` is deliberately `false`. With
  fullscreen allowed, tapping play on a phone hijacks the whole screen and the
  visitor cannot scroll on to the next reel.
- **No "related reels" panel at the end.** Facebook covers a finished video with
  a grid of suggestions pointing back to Facebook. Seeking to the start does not
  clear it, so when `finishedPlaying` fires the tile's player is rebuilt from
  scratch, which restores the poster frame. A finished reel is not restarted
  while it stays on screen, or it would loop and re-download its player each
  time; scrolling away and back arms it again.

Every tile loads its player rather than something lighter because **there is no
public way to fetch a reel's poster image on its own** — Facebook's oEmbed needs
an app token, so the player is the only thing that knows what the video looks
like. An earlier version used a cheap placeholder and every tile was a black
rectangle until clicked.

**The cost of this** is Facebook's SDK: a few hundred KB of script, and Facebook
cookies, on this page. That is the price of the behaviour above, and it is
confined to `/reelz` — the home page loads no Facebook code at all. If the site
ever needs a cookie banner, this page is the reason. Self-hosting the video files
would remove the SDK, the cookies and the Facebook branding in one go.

### Adding a sponsor

The Sponsors page is at `/sponsors`. Add businesses in `public/data/sponsors.json`:

```json
{
  "sponsors": [
    {
      "name": "Corner Cafe",
      "url": "https://cornercafeparmarket.uk",
      "blurb": "Breakfast, lunch and the best flat white in town.",
      "tier": "Featured",
      "logo": "/images/sponsors/corner-cafe.webp"
    }
  ]
}
```

Only `name` is required. Put any sponsor logos in `public/images/sponsors/`.

**Where the enquiries go.** The "Become a sponsor" form currently opens the
visitor's own email app with everything filled in, addressed to `SPONSOR_EMAIL`
at the top of `app.js`. That needs no accounts or API keys, but it does rely on
the visitor having email set up on their device.

To collect enquiries properly instead, set `SPONSOR_ENDPOINT` in `app.js` to a
URL that accepts a JSON `POST`, and the form will send there and show an error if
it fails. Nothing else needs changing.

**Prices.** Supporter is £5 a month and Featured is £10 a month, both from the
band. The £50 one-off tier in `sponsors.html` is still a placeholder — get it
signed off before the site goes live. Prices appear twice in that file: on the
plan cards and in the enquiry form's dropdown, so change both.

The sponsors themselves are listed **above** the sponsorship plans, so visitors
see who is already backing the band before they are asked for anything.

### Adding a gig

Edit `public/data/gigs.json` and add entries to the `gigs` list:

```json
{
  "gigs": [
    {
      "date": "2026-10-17",
      "venue": "The Dolphin Inn",
      "town": "Penzance",
      "time": "9pm",
      "ticketUrl": "https://example.com/tickets"
    }
  ]
}
```

Only `date` (as `YYYY-MM-DD`) and `venue` are required. The site sorts the list
soonest-first and hides anything already in the past, so you can just keep adding
to the bottom and never have to tidy up. With an empty list the section shows a
"no dates in the diary" message instead.

Commit and push after editing — Pages redeploys on its own.

---

## SEO

The site is set up for search engines:

- `public/sitemap.xml` lists all three pages, and `public/robots.txt` points
  crawlers at it
- Every page has a canonical URL, an `og:url`, and a single `<h1>` (on the home
  page the `<h1>` is visually hidden, because the logo image carries the name)
- `index.html` carries `MusicGroup` structured data — the members, the Facebook
  page, and the *Two Lost Souls* release with its two tracks — so search engines
  can identify the band rather than guessing. `reelz.html` and `sponsors.html`
  carry page data with a breadcrumb back to the home page
- Every image has descriptive alt text

### If the domain ever changes

Four places hold the site address, and all four need updating together:

1. `public/sitemap.xml` — all three `<loc>` entries
2. `public/robots.txt` — the `Sitemap:` line
3. `public/index.html` — the canonical link, `og:url`, and the URLs inside the
   JSON-LD block at the bottom
4. `public/reelz.html` and `public/sponsors.html` — the same three things

Then submit the sitemap once in [Google Search Console](https://search.google.com/search-console).

### A limitation worth knowing

The reels are embedded from Facebook, which means **the videos do no SEO work for
this site** — Google attributes them to Facebook, not to you. Self-hosting the
video files would fix that and let the pages carry `VideoObject` markup, which is
what gets a video into Google's video results.

## The gallery

Every tile is the same size. On a phone the gallery is a swipeable row so each
photo gets most of the screen; on wider screens the same tiles become a grid.

Tapping one opens the photo viewer, which steps through all twelve with the
arrows, the left and right keys, or a swipe, and wraps around at either end.

The viewer sizes each photo from its own resolution, allowing up to twice its
natural width. That detail matters: `max-width` on its own never *enlarges*
anything, so the small gig snaps opened smaller than the tile that had just been
tapped. The arrows also sit on top of the photo rather than beside it — flanking
it stole about 130px on a phone, with the same result.

## Photos

Originals live in `source-images/`. The versions the site actually serves are
generated into `public/images/` — resized, converted to WebP, with JPEG fallbacks.
If you add or replace a photo in `source-images/`, regenerate them with:

```bash
npm run images
```

Two images get special treatment in that script.

`lostcd.png` — the disc on the home page — already has a transparent
background, so it is only trimmed and then padded out to a **centred square**.
That padding matters: trimming leaves slightly uneven margins, and an off-centre
disc visibly wobbles once it starts spinning.

The gallery snaps (`d1.jpg` … `d10.jpg`) are 206px squares — Facebook-sized
thumbnails rather than full photos. There is nothing to resize down to and no
point inventing pixels by scaling up, so they are converted as they are and the
gallery shows them at around 278px in the tiles, and up to twice their natural
width in the photo viewer. **If the band can supply the originals, replace them
and they will sharpen up straight away** — nothing else needs changing.

The **social sharing card** (`og.jpg`, 1200x630 — the size Facebook, WhatsApp
and the rest crop to) is built in that script from the cut-out logo on the
site's own violet glow, rather than being a crop of a photo. The logo is sized
to leave clear air around the wingtips, because platforms crop these cards
differently and anything tight to an edge is the first thing lost.

The band logo gets special treatment too: the artwork is light
line-work on a solid black square, so the script uses the image's own brightness
as an alpha channel. That knocks the black out and leaves a transparent logo that
sits cleanly on photos, so the same file works in the header, the hero and the
footer.

### The spinning disc

When the single first scrolls into view, the page is held still for about a
second and a half while the disc spins up and settles the right way up, then
scrolling carries on.

Holding someone's scroll is a rude thing to get wrong, so it is built to fail
open. A timer releases the page whether or not the animation finishes, any key
press or click lets the visitor straight out, and the whole thing is skipped for
anyone whose system asks for reduced motion. It cancels scroll events rather
than freezing the page body, so nothing shifts underneath the reader. It also
only ever happens once per visit.

If you want it gone, remove the `is-spinning` handling in `app.js` — the disc
still displays perfectly well without it.

---

## Layout of the project

```
public/            everything served to the browser
  index.html       the main site — one page, anchored sections
  reelz.html       the Reelz page, served at /reelz
  sponsors.html    the Sponsors page, served at /sponsors
  404.html         not-found page
  styles.css       mobile-first, breakpoints at 700px and 900px
  app.js           nav drawer, reels, sponsors, the sponsor form, gigs
  data/gigs.json   live dates — the one file you edit regularly
  data/reels.json  Facebook reel links for the Reelz page
  data/sponsors.json  businesses listed on the Sponsors page
  sitemap.xml      / robots.txt for search engines
  images/          generated; don't edit by hand
scripts/
  build-images.mjs image pipeline (npm run images)
source-images/     the original full-size photos
wrangler.jsonc     Cloudflare Pages config (sets the build output directory)
```

There is no build step and no framework — the HTML in `public/` is what ships.

---

## A note on the dedication

The footer carries the dedication from the single's sleeve, to Timmy and Kyle,
alongside the band's Cornish motto *Yn agan kolonnow bys vykken* — "in our hearts
forever". It is deliberately quiet and set apart from the rest of the page. Please
keep that in mind if you restyle the bottom of the site.
