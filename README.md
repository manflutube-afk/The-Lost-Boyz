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
| `public/index.html` — Music section | Apple Music is linked as a **pre-add** — the single is not out until 20 September. On release day change the "Pre-add the single" label to "Listen on", and add Spotify and YouTube next to it as those links arrive, deleting the line underneath that says they are to follow. |
| `public/data/gigs.json` | Add your live dates (see below). |

### Adding a video to Reelz

The clips are **hosted here**, not embedded from Facebook. Drop the files into
`source-images/` and run:

```bash
npm run videos
```

That re-encodes every clip, pulls a poster frame from each, and rewrites
`public/data/reels.json` with the list the page reads. Videos are shown in
filename order, so rename the sources if you want a different order.

To caption a clip, add a `title` to its entry in `public/data/reels.json`.
Titles survive a rebuild — the script reads the existing file and keeps them.

**Sound.** A clip that starts itself has to start silent. No browser will let a
page begin playing audio before the visitor has interacted with it — ask for
sound and `play()` is simply refused, so you get no video at all rather than a
quiet one. This is not a setting; it is the rule everywhere.

So the page turns the sound on at the visitor's first touch, and on a phone
their first scroll counts as one. In practice the opening clip runs quiet for a
second or two, that gesture unlocks it, and everything after plays with sound —
including the one already running. A line above the videos says so, and removes
itself the moment the sound comes on. If a play with sound is ever refused
anyway, it falls back to silent rather than leaving a tile doing nothing.

**Controls.** A clip that starts itself plays with the native controls off. A
phone keeps those controls sitting over a playing video, with a dark scrim
behind them, until it is tapped — which made every autoplaying clip look dimmed,
as though it were waiting to be started. Tapping brings the controls in, and
that same tap turns the sound on. On a desktop nothing autoplays, so the
controls are the only way to start a clip and are there from the outset. If
autoplay is ever refused outright the controls come back too, so a tile is never
left with a poster and no way to play it.

**Why the clips are re-encoded rather than used as they are.** Phone footage
cannot go straight onto a website:

- They arrive as `.mov`, and one in this batch was **HEVC**, which most
  browsers refuse to play at all.
- One was **42MB**. Cloudflare Pages rejects any file over **25 MiB**, so it
  could not have been deployed.
- The index in a raw `.mov` sits at the end of the file, so nothing plays until
  the whole thing has downloaded. The re-encode moves it to the front.

Each clip is given a bitrate worked out from its own length against a size
budget, capped on top of a quality setting. A fixed quality setting cannot
promise a size: the near-three-minute clip in the first batch went past 25 MiB
and was still climbing. Anything over 100 seconds is also scaled down, because
spreading a small bitrate over a big frame is what makes video look like wet
paint. If a clip somehow still overshoots, it is re-encoded lower rather than
left as a file the deploy would refuse.

**The originals are not in this repository.** Ten clips came to 130MB, and git
never forgets a file, so `source-images/*.mov` is ignored. Only the transcoded
copies in `public/videos/` are committed and served. Keep your own backup of the
originals — you need them to re-run the script.

**What this replaced, and why it is worth not going back.** The reels used to be
embedded from Facebook through their JavaScript SDK. That version could not
autoplay on an iPhone at all — iOS will not let a video inside a cross-origin
iframe start itself, and the setup that would allow it lives inside Facebook's
player, out of reach. It threw a grid of "related reels" over the end of every
clip, pointing people away to Facebook. A reel that was deleted or made private
appeared as a broken tile and, because Facebook reported no player for it, could
not be stopped and played over the top of everything else. It loaded a few
hundred KB of Facebook script and set Facebook cookies on the page. And the
videos counted for Facebook's search ranking, not this site's.

Owning the files makes all of that go away, and the code is a third of the size.


### Adding gear to Geeks Corner

The page is at `/geeks-corner`, listed in the nav as **Gear** — the full name
would not fit alongside eight other items. Edit `public/data/gear.json`:

```json
{
  "groups": [
    {
      "name": "Darren — guitars",
      "blurb": "Optional line introducing the group.",
      "items": [
        {
          "name": "Make and model",
          "what": "Electric guitar",
          "note": "Why this one, what it does, how long he has had it."
        }
      ]
    }
  ]
}
```

A group is a heading with items under it — one per player, or per category,
whatever reads best. Only `name` is required on an item. A group with no items
is skipped, so half-finished sections do not show as empty headings, and with no
groups at all the page shows a short holding message.

**The kit is not filled in yet, and it should not be guessed at.** All that is
listed is KJM Studio, which is on the record sleeve. Everything else needs to
come from the band: guitars, amps, pedals, drums, cymbals, PA, microphones. A
gear page that gets the models wrong is worse than no gear page — the people who
read it are exactly the people who will notice.

Worth asking for the `note` on each item too. "Marshall JCM800" is a list; "the
JCM800 he has had since he was seventeen and refuses to replace" is the reason
anyone reads a page like this.

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

Only `name` is required.

**Adding a sponsor's logo.** Drop whatever they send into
`source-images/sponsors/` and run `npm run images`. Each file is fitted inside
320x160 without cropping or stretching, with transparent space around it so it
sits on the card whatever shape it is, and written to
`public/images/sponsors/<name>.webp`. Then point the sponsor's `logo` field at
that path. The card shows logos at 160 wide, so 320 is the two-times version a
phone screen needs.

**Ask the sponsor for the file — do not lift it off their Facebook.** A Facebook
profile picture is 192px at best, which looks soft at the size the card uses,
and those image URLs are signed and expire. Any business will have their own
artwork; a printer or embroiderer will have vector originals.

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

### Adding a charity or a fundraiser

The Charities page is at `/charities`. Edit `public/data/charities.json`, which
holds two separate lists:

- **`charities`** — the organisations themselves. Brake is in there already.
- **`fundraisers`** — individual appeals to point people at: a Facebook
  fundraiser, a JustGiving page, someone doing a sponsored walk.

```json
{
  "charities": [
    {
      "name": "Brake",
      "tagline": "The road safety charity",
      "blurb": "A sentence or two about them.",
      "url": "https://www.brake.org.uk/",
      "donateUrl": "https://www.brake.org.uk/donate",
      "charityNo": "1093244",
      "helpline": "0808 8000 401"
    }
  ],
  "fundraisers": [
    {
      "name": "Sam's London Marathon run",
      "who": "Sam Trewin",
      "forCharity": "Brake",
      "blurb": "Running the marathon in April.",
      "url": "https://www.facebook.com/donate/000000000/"
    }
  ]
}
```

Only `name` and `url` are required in either list. With `fundraisers` empty, that
section shows a short holding message instead.

A fundraiser's button is built from `who`: "Paul Walker" gives **Support Paul**,
because it is a person doing the fundraising and naming them reads as backing
someone rather than clicking a link. Entries that are not one person — a family,
a team, a pub — fall back to the whole name, and adding `supportLabel` overrides
the button text entirely when neither is right.

**Every donation link goes straight to the charity's own page**, and the intro
on the page says so plainly. Keep it that way. Collecting money on the band's
behalf is a different thing entirely: it brings in the Fundraising Regulator's
code and rules about handling other people's donations, and none of that is
worth taking on to save a click.

Charity numbers are worth filling in where you have them — they let people check
a charity on the Charity Commission register, which is the sort of thing that
makes a donations page trustworthy rather than suspicious.

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

Optional extras: `note` for a line about what makes the night different,
`linkLabel` for the button text, and `infoUrl` pointing at a page on this site
with the full story. `infoUrl` wins over `ticketUrl` and opens in the same tab,
the way an internal link should; `ticketUrl` opens in a new one.

**A gig with its own page.** `pauls-big-shave.html` is the pattern: a single
event page with the date, venue, what is on and links out. It carries `Event`
structured data, which is what puts a gig into Google's event listings, so copy
that block and change the details rather than starting from scratch. Add the new
page to `sitemap.xml` too. These pages are deliberately **not** in the main nav —
they are reached from the gig on the home page, and the nav is full enough.

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
