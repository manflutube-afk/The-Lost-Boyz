# The Lost Boyz

The official site for **The Lost Boyz** — a two-piece rock band: Darren Endean and
Andrew Boraston. Mobile-first, static, and hosted on Cloudflare Pages at
<https://the-lost-boyz.pages.dev>.

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
| `public/index.html` — Booking section | Replace `bookings@example.com` and the phone number. The Facebook link is already set. |
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

## Photos

Originals live in `source-images/`. The versions the site actually serves are
generated into `public/images/` — resized, converted to WebP, with JPEG fallbacks.
If you add or replace a photo in `source-images/`, regenerate them with:

```bash
npm run images
```

The band logo gets special treatment in that script: the artwork is light
line-work on a solid black square, so the script uses the image's own brightness
as an alpha channel. That knocks the black out and leaves a transparent logo that
sits cleanly on photos, so the same file works in the header, the hero and the
footer.

---

## Layout of the project

```
public/            everything served to the browser
  index.html       the main site — one page, anchored sections
  reelz.html       the Reelz page, served at /reelz
  404.html         not-found page
  styles.css       mobile-first, breakpoints at 700px and 900px
  app.js           nav drawer, sticky header, reel and gig rendering
  data/gigs.json   live dates — the one file you edit regularly
  data/reels.json  Facebook reel links for the Reelz page
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
