# The Lost Boyz

The official site for **The Lost Boyz** — a two-piece rock band: Darren Endean and
Andrew Boraston. Mobile-first, static, and deployed on Cloudflare Workers.

---

## Running it locally

```bash
npm install
npm run dev
```

That serves the site at <http://localhost:8788> using the same Workers runtime
Cloudflare uses in production.

## Deploying

```bash
npm run deploy
```

The first deploy will ask you to log in to Cloudflare in a browser. After that it
publishes to `the-lost-boyz.<your-subdomain>.workers.dev`.

To put it on a real domain, add the domain to your Cloudflare account and then add
a routes block to `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "thelostboyz.co.uk", "custom_domain": true }
]
```

---

## Things you still need to fill in

These are placeholders. Search the project for `TODO` to find them all.

| Where | What to change |
| --- | --- |
| `public/index.html` — Music section | The three streaming buttons all point at `#`. Swap in your Spotify / Apple Music / YouTube (or pre-save) links. |
| `public/index.html` — Music section | **Check the release date.** It currently reads *20 September 2026*, worked out from the Facebook post of 3 September that said "only 17 days until". Correct it if that is wrong. |
| `public/index.html` — Booking section | Replace `bookings@example.com` and the phone number. The Facebook link is already set. |
| `public/data/gigs.json` | Add your live dates (see below). |

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

Redeploy with `npm run deploy` after editing.

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
  index.html       the whole site — one page, anchored sections
  404.html         not-found page
  styles.css       mobile-first, breakpoints at 700px and 900px
  app.js           nav drawer, sticky header, gig rendering
  data/gigs.json   live dates — the one file you edit regularly
  images/          generated; don't edit by hand
scripts/
  build-images.mjs image pipeline (npm run images)
source-images/     the original full-size photos
wrangler.jsonc     Cloudflare config
```

There is no build step and no framework — the HTML in `public/` is what ships.

---

## A note on the dedication

The footer carries the dedication from the single's sleeve, to Timmy and Kyle,
alongside the band's Cornish motto *Yn agan kolonnow bys vykken* — "in our hearts
forever". It is deliberately quiet and set apart from the rest of the page. Please
keep that in mind if you restyle the bottom of the site.
