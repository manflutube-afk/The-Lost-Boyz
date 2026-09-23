# The Lost Boyz

The official site for **The Lost Boyz** — a two-piece rock band: Darren Endean and
Andrew Boraston. Mobile-first, static, and hosted on Cloudflare Pages at
<https://thelostboyz.uk>. The `the-lost-boyz.pages.dev` address still works and
still serves the same site; every page names the real domain as its canonical
one, so search engines only ever count the one address.

---

## www

`www.thelostboyz.uk` is set up and redirects to `thelostboyz.uk`, keeping the
path — so `www.thelostboyz.uk/sponsors` lands on the sponsors page.

That redirect lives in `functions/_middleware.js` rather than in the Cloudflare
dashboard. The dashboard is the better place for it: a redirect rule runs at
the edge before Pages is involved and costs nothing, whereas this costs one
Function invocation per request. It is here because the deploy credentials have
no permission over the zone.

**If you would rather move it**, in the dashboard go to **Rules → Redirect
Rules → Create rule**: when `hostname equals www.thelostboyz.uk`, then a **301**
to `https://thelostboyz.uk` with *preserve path and query* switched on. Then
delete `functions/_middleware.js`. The "preserve path and query" part matters —
without it every www address lands on the front page.

## After changing app.js or styles.css, run `npm run stamp`

```
npm run stamp
```

It puts a short hash of each file's contents on the end of its address in
every page — `/app.js?v=3f81e5b9` — and it matters more than it looks.

The custom domain tells browsers to keep those two files for **four hours**.
Cloudflare Pages itself says not to cache them (the pages.dev address still
says so), which means it is the zone rewriting the header on the way out, and
nothing inside this project can override it.

Four hours of held-onto JavaScript against a freshly deployed page is not a
theoretical problem — it has already broken this site twice. The countdown
disappeared when an old script went looking for figures the new page no longer
had, and the sponsor cards stayed unclickable on a phone for the same reason.
Both times the file on the server was perfectly correct.

Because the stamp is a hash of the contents, it only changes when the file
does. Nothing is re-downloaded for no reason.

**The tidier fix is in the dashboard**: Caching → Configuration → Browser Cache
TTL → *Respect Existing Headers*. Pages already sends sensible values and that
stops the zone overriding them. It needs permissions the deploy credentials do
not have, so it has to be done by hand. Once it is, `npm run stamp` is harmless
but no longer necessary.

## The view counter

The number in the header. It lives in `functions/api/views.js` and keeps its
total in a Cloudflare KV store bound as `VIEWS`.

**A visit is counted once per browser session, not once per page.** Somebody
reading four pages is one visit, which is what a counter like this is normally
taken to mean — and it keeps the writes well inside the free daily allowance,
which counting every page would chew through on a busy day. Obvious crawlers
are turned away, and anything that does not run JavaScript never reaches the
endpoint at all.

### Folding in the views from before

`VIEWS_SEED` in `wrangler.jsonc` is added to the live count. It is **0** right
now because there is no record of what came before — the counter can only
count from the day it was built, and nothing was keeping a tally until then.

If Cloudflare's analytics has a figure you trust, put it in:

```jsonc
"VIEWS_SEED": "4200"
```

Changing it only shifts the total. It never touches the stored count, so you
can correct it later without losing a single view.

### What it cannot do

KV has no atomic increment, so the count is read and written back. Two visits
landing in the same instant can come out as one. At this site's traffic that is
a rounding error, and the alternative is a great deal of machinery for a badge
in a header — but it is worth knowing the number is a good count rather than an
exact one.

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
| `public/index.html` — Music section | The single is out. **Apple Music, Spotify & more** is the main button and goes to the release's HyperFollow page, which covers Apple Music, iTunes, Spotify and iHeartRadio and remembers which one a returning visitor used. **Amazon Music** and **Tidal** have buttons of their own because they are not on that page and there is no other way to reach them from here. Anything that does appear on HyperFollow needs no button adding. Which services that page shows, and in what order, is set in DistroKid, not in this repository. The countdown beside the title looks after itself; it reads "Out now" now the date has passed. If the date ever moves, change `data-release` on the countdown and the `<time>` above it. |
| `public/data/gigs.json` | Add your live dates (see below). |
| Cloudflare dashboard | Switch the enquiry emails on — see **The forms** below. Until you do, both forms fall back to opening the visitor's own email app. |

## The forms

There are two: **Book the Boyz** on the home page and **Become a sponsor** on
the sponsors page. Both post to `/api/enquiry`, which is a small piece of code
in `functions/api/enquiry.js`. Cloudflare runs it for you — there is no server
to look after.

It does two things with each enquiry:

1. emails it to the band, with reply-to set to the sender, so hitting reply
   answers them directly;
2. emails the sender a confirmation, with a copy of what they filled in.

### Switching the emails on

**This is done.** `thelostboyz.uk` is verified in Resend, the API key is stored
as a Cloudflare secret on both the production and preview environments, and the
two addresses are in `wrangler.jsonc`. What follows is here so it can be redone
if the key is ever replaced.

To rotate the key: make a new one in Resend, run

```
npx wrangler pages secret put RESEND_API_KEY --project-name the-lost-boyz
```

paste it when prompted, repeat with `--env preview`, then delete the old key in
Resend. Never put it in a file.

<details>
<summary>Setting it up from scratch</summary>


1. Make an account at **resend.com** (free for the volume a band gets) and add
   `thelostboyz.uk` as a domain. Resend gives you three DNS records to add —
   put them in Cloudflare DNS. This is what lets the emails arrive rather than
   land in spam.
2. Create an API key in Resend.
3. In the Cloudflare dashboard go to **Workers & Pages → the-lost-boyz →
   Settings → Variables and secrets** and add:

   | Name | Type | Value |
   | --- | --- | --- |
   | `RESEND_API_KEY` | Secret | the key from step 2 |
   | `BAND_EMAIL` | Text | where enquiries should land, e.g. `bookings@thelostboyz.uk` |
   | `FROM_EMAIL` | Text | the sender, e.g. `The Lost Boyz <website@thelostboyz.uk>` |

4. Redeploy (any push does it, or use "Retry deployment").

**The key is a secret.** Add it in the dashboard or with `wrangler pages secret
put`, never in a file — everything in `public/` is served to the world, and
anything committed to git stays in the history even after it is deleted.

</details>

### The logo in the emails

Both emails open with `public/images/email-header.png`, built by `npm run
images` from the same cut-out logo as the site. The dark ground is baked into
the picture rather than left to a background colour, because the logo is pale
line-work made for a dark page and email is read on white — dropped in as-is it
would all but disappear. It is a PNG because Outlook still does not handle
webp, and it is built at 1200 wide but shown at 600 so it stays sharp on a
phone.

The image is fetched over the internet when the email is opened, so the address
it is fetched from has to be a live one. That is `SITE_URL` in
`wrangler.jsonc`, and it is set to `https://thelostboyz.uk` now the domain is
pointed at the site. If the site ever moves, that is the line to change or
every email sent afterwards will be asking a dead address for its logo.

### The little round picture next to the sender

Short version: not realistically, and not for the reason you would expect.

That avatar is a standard called **BIMI**, and it needs three things:

1. a DMARC record on the domain set to `p=quarantine` or `p=reject`;
2. the logo as a proper vector SVG in the "SVG Tiny PS" profile — a traced
   copy of a photograph or a JPEG will not do, it has to be real vector
   artwork, so this needs whatever Darren drew the logo in;
3. **for Gmail specifically, a Verified Mark Certificate** — which requires a
   registered trademark and runs to four figures a year.

Without the certificate the avatar appears in Yahoo, AOL and Fastmail, and not
in Gmail, which is where most people will read it. So it is a lot of work and
money for very little.

`public/images/avatar-512.png` is built anyway — the logo on the dark ground,
square, and sized so the wingtips survive a circular crop. Use it for the
Resend account picture, social profiles, or anywhere else that wants one.

### Worth doing: a DMARC record

The domain has SPF and DKIM (Resend set those up) but **no DMARC record at
all**. Adding one is five minutes and makes mail from the domain more trusted.
In Cloudflare DNS add a TXT record:

| Field | Value |
| --- | --- |
| Name | `_dmarc` |
| Type | `TXT` |
| Content | `v=DMARC1; p=none; rua=mailto:bookings@thelostboyz.uk` |

`p=none` only asks for reports and changes nothing about delivery, so it is
safe to add straight away. Tighten it to `p=quarantine` later once the reports
show nothing unexpected is sending as the domain.

### If the key is ever missing or wrong

Nothing breaks. The endpoint answers "not switched on yet", and the page opens
the visitor's own email app with the whole enquiry already written out. They
send it themselves and it still reaches the band. The only thing missing is the
automatic confirmation.

### One thing left to confirm

`BAND_EMAIL` is `bookings@thelostboyz.uk`. Resend verifying the domain lets the
site **send** as that domain; it does not create a mailbox that **receives**.
Send yourself a test through the form and check it arrives. If it does not, set
up Cloudflare Email Routing on the domain (free) to forward `bookings@` to
wherever the band actually reads their email.

### Spam

Each form carries a hidden field that no person can see or tab to. Bots fill it
in; when that happens the endpoint quietly says "thanks" and throws the message
away, so whoever sent it learns nothing from having failed.

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


### Geekz, and the gear

The page is at `/geeks-corner` and is now a **written piece** rather than a
list: the band's own account of the PA, the guitars, the pedalboard, and the
talk box and foot rest Darren built. The words and photographs came from
Darren, and the copy lives in `public/geeks-corner.html` like any other page.

The photographs come from `source-images/Gear/`. Drop one in, run
`npm run images`, and it comes out at `/images/gear/<name>-{640,1200}.webp` with
the name slugged from the filename. Nothing is cropped — a guitar on a stand
and a pedalboard on the floor are opposite shapes, and squaring them off would
cut away the thing being photographed. The tall ones are held to 300px wide in
the stylesheet so they do not become a screen and a half of scrolling.

**The warning at the top is not decoration.** Somebody who skims that page and
then opens up an amplifier can be killed by what is still stored in it after it
is unplugged. It is marked up as an alert so a screen reader announces it, and
it sits above everything else on purpose. Do not quietly move it or tone it
down.

#### The gear list, which is now dormant

`public/data/gear.json` and its renderer are still in the project but **nothing
draws them any more**, because the page that used to show the list is the piece
above instead. The renderer is guarded, so it simply does nothing and breaks
nothing. If a plain list of kit is ever wanted alongside the writing, put a
`<div id="gear">` back on the page and fill the file in — that is all it takes.
The format is:

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

### The Kernow Pages tip panel

An amber panel above the footer on the home page, Our Story, Geekz, Sponsors and
Charities, saying the site was built and is hosted for free and inviting a tip
at [ko-fi.com/kernow](https://ko-fi.com/kernow). It is the one thing on the site
that is not about the band, so it is the one thing allowed to look slightly
different: the site's own shapes, spacing, fonts and pill, but the warm side of
the palette instead of the violet.

Amber and not a stronger red on purpose. Red already means the safety warning on
the Geekz page, and two loud reds meaning two different things is how a warning
stops being read.

**Where it sits, and why not lower.** Above the footer, so it reads with the
footer's own "Powered by Kernow Pages" as one band of small print about the
website. On the home page it goes one step higher still, *above* the dedication:
that page is meant to close on "In loving memory of Timmy and Kyle", and an ask
for money underneath that is the wrong order.

The last line points at the sponsors page, where Kernow Pages is listed — except
on the sponsors page itself, where it says "They are listed above" rather than
sending somebody to the page they are already reading.

The mark is their own white-on-transparent logo from
kernowpages.leodiablo.com, kept in `source-images/KernowPages/` and resized by
`npm run images`. It is not the black one from the sponsors card recoloured:
that mark has Cornwall knocked out of the middle, so inverting it would fill the
county in and lose the whole idea.

To change the wording, the panel is written out in full in each of the five
pages rather than built by JavaScript, so it is there with the scripts off and
a search engine can read it. Change one, change all five — searching for
`sec--tip` finds them.

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

### Taking sponsorship payments with Stripe

The page is wired for **Stripe Payment Links**, and nothing is switched on until
the band creates them. Put each link in `public/data/payments.json` against its
plan, and that plan's button changes from opening the enquiry form to going
straight to Stripe. Leave one empty and it carries on using the form, so the
page works whether none, some or all three are set up.

**What the band needs to do**, once, in their own Stripe account:

1. Create the account at stripe.com and finish verification — business details
   and a bank account. This has to be the band's account, not yours: it is their
   money and their obligation to whoever pays.
2. Create three Payment Links: two **recurring monthly** ones at £5 and £10, and
   one **one-off** at £50.
3. Paste each link into `payments.json`. They look like
   `https://buy.stripe.com/xxxxxxxx`.

**Why Payment Links rather than anything cleverer.** They need no API key, no
server and no card details ever reaching this site — Stripe hosts the payment
page itself. A static site on Cloudflare Pages has nowhere safe to keep a secret
key, and three fixed prices do not need one.

**Never put a Stripe secret key in this repository.** Anything beginning
`sk_live_` or `sk_test_` grants full control of the account, and every file
under `public/` is served to the world. Payment Links need no key at all, which
is the main reason for choosing them.

**The keys in `payments.json` must match the plan text exactly** — the same
string as on the card and in the enquiry form. That one string ties all three
together.

**Money creates obligations the code cannot handle.** Once real payments are
taken, someone has to actually do what was sold: put a sponsor's logo up, and —
for the £50 one-off — take them down again after two weeks. Monthly sponsors can
cancel, and Stripe's customer portal is the tidiest way to let them. Worth the
band deciding who does that before the first payment lands, not after.

**Where the enquiries go.** The "Become a sponsor" form currently opens the
visitor's own email app with everything filled in, addressed to `SPONSOR_EMAIL`
at the top of `app.js`. That needs no accounts or API keys, but it does rely on
the visitor having email set up on their device.

To collect enquiries properly instead, set `SPONSOR_ENDPOINT` in `app.js` to a
URL that accepts a JSON `POST`, and the form will send there and show an error if
it fails. Nothing else needs changing.

**Prices.** Supporter £5 a month, Featured £10 a month, and a £50 one-off that
puts a business on the site for two weeks. All three came from the band.

Each plan appears twice in `sponsors.html`: on its card, and as an option in the
enquiry form. **The two strings must match word for word** — the form preselects
whichever plan was clicked by matching that text, so a stray comma in one and
not the other quietly breaks the preselect.

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

**Every gig gets its own page.** This is the house rule, not an optional extra:
each date has a page here, and `infoUrl` points at it. `welcome-home-par-nov-2026.html`
is the pattern to copy — the date and full address, a few lines of copy, a fold-out
"Where it is, and how to get there" with a photo of the venue, a map and directions
buttons, then links out. It carries `Event` structured data, which is what puts a gig
into Google's event listings, so copy that block and change the details rather than
starting from scratch. Add the new page to `sitemap.xml` too. These pages are
deliberately **not** in the main nav — they are reached from the gig on the home
page, and the nav is full enough.

Linking the button straight out to the venue's own website instead is not the way to
do it, even as a stopgap.

**When you do not know something yet, write `TBC`.** A start time that has not been
settled shows as TBC whether it is written that way or simply left empty — a
booking added in Backstage with the time box blank says TBC on the website by
itself, so there is nothing to remember. The card then reads
"Par · TBC", the page says "time TBC", and Add to calendar puts the gig in as an
all-day entry with "Start time to be confirmed" in the notes. That tells the reader
the band know about it and the answer is coming, which an empty line does not — and
it is a great deal better than guessing an hour nobody has confirmed. Fill the real
time in later and everything picks it up.

Only `date` (as `YYYY-MM-DD`) and `venue` are required. The site sorts the list
soonest-first and hides anything already played, so you can just keep adding
to the bottom and never have to tidy up. With an empty list the section shows a
"no dates in the diary" message instead.

**When a gig comes off the site.** Four hours after it starts, so an 8pm is gone
by midnight and the list is never headed by a night that has already happened.
A gig whose time still says TBC has no start to count from, so it holds its place
for the whole of its day and goes at 4am the next morning. If `durationHours` is
set to more than four, that wins — a gig stays listed for as long as the band
say they are playing, because pulling a listing while they are still on stage
would be the worse mistake. Nothing is deleted by any of this: the booking stays
in Backstage, and the gig's own page stays on the site at the same address. It
simply stops being listed.

The rule lives in `lib/when.js` and runs on the server, so a finished gig is
gone from `/api/gigs` itself rather than merely hidden by the page. The same
rule is repeated in the gig block of `public/app.js`, because the list can also
come from the cached `gigs.json` fallback and because a phone left open all
night should not still be showing last night's gig. **Change one and you must
change the other.** Both work in Cornwall time whatever the clocks are doing
and wherever the visitor is.

Commit and push after editing — Pages redeploys on its own.

---

#### The Add to calendar button

Every gig gets one automatically. It points at `/calendar?date=...`, which is
`functions/calendar.js` -- that reads this same `gigs.json`, so adding a date to
the file is still the only thing anyone has to do.

Two things it works out for itself, and one you can set:

- **The time** is read from whatever you wrote: "8pm", "7.30pm", "Doors 7pm"
  and "20:00" are all understood. If it cannot make sense of it, the gig goes
  in as an all-day entry rather than being given a start time nobody said.
- **Summer time** is handled. An 8pm gig in October goes in the file as 19:00
  UTC and one in January as 20:00 UTC, so both show as 8pm in somebody's diary.
- **How long it runs** defaults to three hours, which is a guess. Put
  `"durationHours": 2` on a gig to change it.


## Backstage, at /admin

Darren and Andrew have their own page at **thelostboyz.uk/admin**, called
Backstage. It holds
every booking they have -- the public gigs that show in Live Dates, and the
private ones that do not. A wedding, a works do, a birthday party: it goes in
here with the address, what time to turn up, who to ask for and what the fee is,
and none of that ever reaches the website.

It is built for a phone, because that is where it gets read: in a van, or in a
car park half an hour before a soundcheck.

### It all works from a phone, anywhere

Nothing is stored on the device. Backstage is a page that talks to endpoints,
the bookings live in Cloudflare KV, and the public gig list is served from that
same store -- so a date added on Darren's phone in a car park is on the website
before he has put it back in his pocket, and Andrew sees it on his the next time
he opens Backstage. There is no syncing, no app to update, and no "publish"
step to forget.

### Getting to it

There is no "Members" button in the menu, because the website is for the public
and a link nobody else can use only raises questions. **The view counter in the
header is the way in** -- it is an ordinary link to /admin wearing no badge of
office, so the band can reach Backstage from any page and a visitor has no
reason to press it.

Nothing is hidden by being secret, which matters: /admin is behind a password
whoever finds it, robots.txt asks crawlers not to follow it, and the link's
accessible name says plainly where it goes, so a screen reader user is not the
only person kept in the dark. It takes a keyboard focus ring like any other
link; it simply does not advertise itself with an underline or a pointer
cursor.

### What they can do

- **See what is coming up**, soonest first. Dates that have been and gone are
  folded away under a **Show been and gone (n)** button at the bottom of the
  list. It is a real button, the full width of the column, with an arrow saying
  which way it will go; it was a `<summary>` with a heading inside it and read
  as a heading, so nobody could tell it could be pressed. Once opened it stays
  open while the page is up, including across a save.

  A booking that has been and gone is tagged **For your information only**
  rather than "On the website", because by then it is not on the website -- it
  came off four hours after it started. It keeps *Edit*, *Add to calendar* and
  *Delete*; it loses *Take off the site*, which would do nothing, and its
  "See it on the site" becomes **See its page**, since the gig's own page is
  still up even though Live Dates has moved on. Whether a booking has been and
  gone is decided by the server, with the rule in `lib/when.js` that the
  website itself uses, so the two can never disagree.
- **Add a booking, and choose there and then whether the world sees it.** The
  form asks straight out: *Private -- just the two of you*, or *Live on the
  website*. Pick the second and it is in Live Dates the moment Save is pressed;
  there is no publishing step and nothing to push. Pick the first and it stays
  in Backstage. Either way the page says which of the two just happened rather
  than leaving it to be checked, and a public gig gets a "See it on the site"
  button on its card.

  Private is preselected, because of which mistake costs more: a private do that
  quietly appears on the website cannot be taken back once somebody has seen it,
  whereas a gig that should have been public and is not is fixed by opening the
  form again.

  It needs a date and either a venue or something to call
  it -- a private do often goes in the diary as "Shane's Summer Bash, 10 July"
  months before anybody knows which hall it is in. That name is the headline in
  Backstage and never reaches the website, whatever the switch says.
  New bookings are private until the "Show this one in Live Dates" switch is
  turned on. That way round on purpose: putting a private
  party on the website by accident is the one mistake here that cannot be
  taken back.
- **Change anything**, or take a gig off the website without losing it.
  *Take off the site* and *Delete* are deliberately two different buttons: a
  date that falls through is off the website that minute, but the band still
  want the address, the contact and what they were owed. Deleting it to achieve
  the first throws away the second. A gig that is off the site sits in Backstage
  tagged Private with a *Put on the site* button, and everything about it --
  time, info page, ticket link -- survives the round trip.

  Only one of those two directions asks first. Taking something off the site
  undoes itself. Putting a private booking *on* the site cannot be undone in the
  same way, because by then somebody may have seen it, so that way round is
  confirmed by name. Delete asks too, and says which of the two it is about to
  do.
- **Add to calendar** on any row, including the private ones -- and a private
  booking's calendar entry carries the address, the arrival time, the contact
  and the fee, which a public gig's does not.
- **Read enquiries** that have come in through the booking and sponsor forms,
  and delete them.

### Setting the password

One password, shared by both of them. It is a Cloudflare secret, never a file:

```
npx wrangler pages secret put ADMIN_PASSWORD
```

That sets it for production, which is what thelostboyz.uk serves. Preview
deployments -- the ones a branch other than `main` produces -- keep their own
separate set of secrets, and this version of Wrangler has no flag for them, so
if you ever need the diary to open on a preview build, add ADMIN_PASSWORD by
hand under Workers & Pages -> the-lost-boyz -> Settings -> Variables and
Secrets, with the environment set to Preview.

Until it is set, /admin says so plainly and lets nobody in, so there is no
window where it is sitting there unprotected.

**Changing it signs everybody out.** The session cookie is signed with a key
worked out from the password, so an old cookie stops verifying the moment the
password changes. That is the way to lock somebody out if a phone goes missing.

### How the lock works, and what it is not

Getting the password right once exchanges it for a signed cookie that lasts a
fortnight; every request after that is judged on the cookie, so the password
crosses the wire once rather than on every page. Ten wrong guesses from one
address in a quarter of an hour and that address is turned away for a while.

Two honest limitations:

- It is **one password for two people**, so it cannot tell you which of them
  changed something.
- A cookie copied off a device stays good until it lapses. Changing the
  password is what revokes it.

If that is ever not enough, **Cloudflare Access** can go in front of /admin
without touching any of this code. In the Zero Trust dashboard: Access →
Applications → Add a self-hosted application, path `thelostboyz.uk/admin`, with
a policy allowing Darren's and Andrew's email addresses. They then each sign in
with a code sent to their own address, and the password here stays as a second
lock behind it. Free for up to 50 people.

### Where the bookings are kept

In Cloudflare KV, in the `DIARY` namespace, under one key called `events`.

The public gig list is served from there too, through `/api/gigs`, which is
what the home page reads now. Only the gigs with the switch turned on come out
of it, and that endpoint rebuilds each gig from a named list of fields rather
than stripping the private ones out -- so a field added to the diary later
cannot leak by having been forgotten.

**`public/data/gigs.json` is still there, and still matters.** It is the safety
net: if the diary cannot be reached, the site falls back to that file rather
than Live Dates going blank. It is also what the diary was first filled in
from -- the first time the band opened /admin, the dates already on the website
were imported so they found their gigs rather than an empty page.

The practical upshot is that **adding a gig no longer needs a commit**. Doing it
in the diary is now the normal way. Editing `gigs.json` still works and is worth
keeping in step if you want the fallback to stay current, but nothing breaks if
it drifts.

One thing to know: the whole list is saved as a single record, so if both of
them happened to save a change in the same few seconds, one change could be
overwritten. With two people and a handful of gigs a year this is not worth
engineering around, but it is the reason not to hand the password to a dozen
people.

### The enquiries

Every enquiry that reaches the band through the website is now also kept, so
they can look back through them instead of hunting in a mailbox. This is real
personal data -- somebody's name, their email address, often a phone number --
so:

- it is only ever readable by a signed-in request;
- there is a delete button on each one, and it really deletes;
- nothing expires on its own, so if the band want a tidy-up habit, that is a
  conversation worth having with them.

Enquiries that arrived before this was built are not in here. They are in the
band's email, where they always were.

One quirk worth knowing if you ever go poking at this with curl: the listing is
cached at Cloudflare's edge for about a minute, so an enquiry deleted a moment
ago can still show up in `/api/admin/enquiries` for a little while even though
it is genuinely gone. The diary page does not show that, because it takes the
row off the screen itself rather than asking for the list again -- and it does
the same after saving a gig, for the same reason.

---

## The "Never miss a gig" bar

Ten seconds into a visit on a phone, a strip slides up along the bottom offering
to put the site on the home screen. It is built by `app.js` rather than written
into all twelve pages, so the wording lives in one place, and it is a bar rather
than a pop-up on purpose -- nothing is blocked, and scrolling past it is a
perfectly good answer.

### It stays out of the way

It does not appear at all if the site is already running from somebody's home
screen, or if the screen is wider than 780px. It waits if the menu or a photo is
open, and gives up after a minute of waiting.

**Tapping the x means no for 30 days.** That is the only thing that buys a long
silence, and it is remembered in that browser's own storage, so it never leaves
their phone.

**Tapping the button does not**, on an iPhone. It only showed them where the
Share button is, and they may never have followed through -- silencing the offer
for a month on the strength of a glance at the instructions is the wrong
reading of that tap. So it goes quiet for the rest of that visit only, and asks
again tomorrow. It stops for good once they actually add the site, because a
page opened from the home screen never gets that far. On Android the button
*does* buy the long silence, because there it hands over to a real install
dialog and the person has genuinely been asked.

If a change here ever needs to reach phones that have already gone quiet, there
is no reaching in to clear their storage -- bump the number on the `REMEMBER`
key in `app.js` and every browser forgets it was asked.

### The button installs it. Except on iPhone, where it cannot.

This is the part worth understanding before anybody reports it as broken.

**On Android it is automatic.** Chrome offers the page its own install prompt,
the button fires it, and the phone puts the site on the home screen. One tap, a
proper system dialog, no instructions. Everything Chrome asks for before it will
make that offer is in place: the manifest with an `id`, a `scope`, 192px and
512px icons and a maskable one, HTTPS, and a service worker.

**On an iPhone it is impossible, and not for want of trying.** Safari exposes no
equivalent of `beforeinstallprompt`, and iOS will not let a website put itself on
the home screen under any circumstances -- there is no API, no permission to ask
for, and no workaround. Only the person can do it, through Share -> Add to Home
Screen.

So on iOS the button does the smallest honest thing instead: one short line and
the share glyph drawn rather than named, because "the share button" means
nothing until you have seen which one it is. The alternative was a button that
looks like it will work and then does nothing at all.

If that is not wanted, the fix is to not show the bar on iPhones -- the `isApple`
check in `app.js` already knows which they are. That trade is real either way:
no bar means no iPhone visitor ever finds out they could.

**Anywhere else**, or on an Android that Chrome decided did not qualify, it
falls back to naming the menu item.

### Why there is a service worker

`public/sw.js` exists for one reason: Chrome will not offer the install prompt
without one. It **caches nothing**, and that is deliberate -- this site already
fights a four-hour browser cache on the stylesheet and the script (see
`npm run stamp`), and a service worker keeping its own copy of anything would
add a third layer of staleness that outlives a hard refresh. Its fetch handler
is empty, so every request goes to the network exactly as it would if the file
were not there. There is no offline mode, which is honest: a site whose job is
telling you whether tonight's gig is on would be worse than useless serving
yesterday's answer.

If it ever needs removing, deleting the file is not enough -- the file itself
explains what to do instead.

---

### The Visitors tab

A third tab in Backstage, showing how many people are coming and roughly where
from. It is built from the visit the counter already records, so it costs no
extra requests and nothing was added to the pages visitors load.

It shows the all-time total, the last 7, 30 or 90 days as a bar a day, which
page people arrived on, what they came from (Facebook, Google, typed it in),
which country, and phone against desktop.

**What is kept, and what deliberately is not.** One record a day, holding
nothing but counts:

```
stats:2026-09-15  { visits, pages:{}, countries:{}, from:{}, devices:{} }
```

The shape is the privacy policy. There is no row per person to join up, because
there are no rows per person -- a visit adds one to four tallies and is then
indistinguishable from every other visit that day. No IP addresses, no
identifiers, no third-party scripts, no cookies beyond the flag already in the
visitor's own browser that stops them being counted twice. Referring URLs are
cut down to a bare host before anything is written, because a full one can carry
a search somebody typed or the name of a private group. Countries come from
Cloudflare, which knows them anyway from routing the request, and are kept as a
two-letter code. Days expire on their own after about a year.

The band learn that eleven people came from Facebook on Saturday and nine of
them were on phones. They do not learn who, and neither does anyone who ever
gets hold of the store.

**Three things it is honest about.**

*Arrived on* is the first page of each visit, not every page read. A visit is
counted once per browser session -- counting every page would multiply the
writes by five for a number nobody was asking for.

*The ceiling is around 500 visits a day.* KV allows a limited number of writes a
day on the free plan and each visit now spends two. Well past anything this site
will see, but it is the number to watch if a gig ever goes viral.

*Two visits in the same instant can count as one*, because the daily record is
read-modify-write. A rounding error at this traffic, and the same trade the view
counter already makes.

**If it ever needs to be properly accurate**, Cloudflare Web Analytics is free,
already available on the account, filters bots far better than a regex, and
misses nothing to races. The reason it is not what is shown here is that pulling
its figures into this page needs an account-scoped API token to manage, and for
a band's website this was the smaller thing to own. Switching later would not
disturb anything else in Backstage.

---

## What the crowd think

People who have been to a gig can send in a few words, a photograph, or a link
to a clip. It sits on the home page above the gallery, and there is a **Crowd**
tab in Backstage where the band say yes or no to each one.

On a yes: the words appear in that section, the photograph is added to the end
of the gallery, and a clip is listed on Reelz under "Clips from the crowd". On a
no, the message and the photograph are deleted for good.

### Approve, and send it on to whoever keeps the project

Each waiting submission has two yes buttons. **Yes, put it up** approves it.
**Yes, and send to Kernow Pages** approves it *and* opens a box for a title and
any notes, then emails the lot over with the photograph attached as a real file.

That second one exists because there is a difference between a photograph being
*on the website* and a photograph being *in the project*. An approved one is
served from storage at whatever size the sender's phone produced. One that has
been through `source-images/` gets built at every size the site uses, gets
proper alt text written for it, and lives in the repository with the rest.
Approving puts it up today; sending it on is how it ends up done properly.

The attachment is named after the gig rather than its id, because a folder full
of `c_1a2b3c4d.jpg` is no use a fortnight later. The address is
`DESIGNER_EMAIL` in `wrangler.jsonc` -- one line to change if it is ever
somebody else.

The two halves can fail separately and are reported separately. If the email
does not go, the submission is still on the website and Backstage says so
plainly, rather than leaving somebody waiting for a message that is not coming.

### Everyone is asked which gig it was

The form asks **which gig** (required) and **roughly when** (optional) as well
as a name. A photograph with no idea where it was taken is very little use to
anybody -- it cannot be captioned, it cannot be filed with the rest of that
night, and whoever adds it to the gallery has to guess at the alt text. With it,
the alt text writes itself and the title of the email is filled in before the
band type a word.

### What the sender sees afterwards

A dialog, not a line of green text. It thanks them by name and then answers the
one question somebody actually has at that moment: **where does my photo go?**

It lists only what they actually sent — words go to What the crowd think, a
photo to the Gallery, a video to Reelz under Clips from the crowd — so nobody
who sent a photograph is told about a video they never sent. A **Rock on**
button closes it and folds the form away.

It says the boyz will have a read and it will be on the site *shortly*, which is
true. It does not say it is up, because it is not: one of them has to say yes
first, and a thank-you that lied about that would have somebody refreshing the
gallery all evening looking for a photo that is still in a queue.

It is a real `<dialog>`, so the browser handles the focus trap, the Escape key
and the stacking. A browser too old for `showModal` falls back to the line under
the button, which still says the same thing.

### The band get told, without being shown

When something arrives, an email goes to `BAND_EMAIL` saying **"Check your
Backstage"**, with a button straight to `/admin`.

**It deliberately contains none of what was sent** -- not the words, not the
sender's name, not the gig they said it was. That is the whole point of the
queue, and an email would go straight round it: something vile arrives, and a
notification carrying it puts the sender's own words in the band's inbox, past
the approval and in front of exactly the two people the queue exists to protect.
So the email says only what a machine knows -- that something came in, whether
it was a review, a photo or a video, and how many are waiting.

**One every quarter of an hour at most.** After a gig ten people might send a
photo within the hour, and ten emails is a nuisance; a nuisance gets filtered,
and then the notification stops working at all. The count of what is waiting
means a quiet gap is never a missed message.

It is sent with `waitUntil`, after the reply has gone back, so nobody on pub
wifi watches a spinner while a mail provider is talked to — and a failure there
cannot turn a submission that was safely stored into an error on their phone.

**Booking and sponsor enquiries carry the whole message**, and that difference is
on purpose. An enquiry is somebody asking to book the band and the answer is a
reply -- the email has reply-to set to the enquirer, so hitting reply answers
them. There is nothing to approve and no reason to send the band looking
elsewhere for it.

They end with the same **Open Backstage** button as the crowd notification, so
every email this site sends the band ends the same way and there is one place to
go whatever has arrived. A copy is kept there under Enquiries.

**One email per thing, either way.** An enquiry sends its own email and nothing
else; a crowd submission sends the nudge and nothing else. The band are never
told about the same event twice. Nothing is sent by hand — there is no button
for it, and no endpoint behind one.

### Nothing appears until somebody says yes, and that is structural

This is worth understanding properly, because it is the part that matters on a
site like this one.

A submission is written to a queue that only the signed-in endpoints can read.
The public endpoint, `/api/crowd`, reads a *different* record -- `crowd:live` --
which nothing but an approval ever writes to. The public side does not read the
queue and filter it; it has no way of reaching the queue at all.

That is a stronger guarantee than a `pending` flag everybody remembers to check.
A flag can be got wrong in one place a year from now. This cannot: there is no
code path from the form to the page except a person in Backstage pressing Yes.

Photographs are the same. `/crowd/photo/<id>` checks whether that id is in the
approved list and, if it is not, answers exactly as it would for an id that does
not exist -- so the queue cannot be probed either. An unapproved photo is
readable only with the admin cookie, and is served `no-store` so no copy of it
can outlive a rejection.

### Photographs are shrunk on the sender's phone

Before a photo is uploaded it is redrawn through a canvas at 1600px, which does
two things. It turns four megabytes into about three hundred kilobytes, and it
**throws away the EXIF** -- which on a phone photo routinely carries the exact
spot it was taken. Somebody sending a snap from a pub should not be handing over
their location, and the band should not be storing it.

The bytes are checked again on the server by their actual file signature rather
than by what the sender said they were, because anything the browser does can be
skipped by whoever is not using a browser.

### What keeps the rubbish down

- A honeypot field no person ever sees. A submission that fills it in gets a
  cheerful 200 and goes nowhere, so a bot learns nothing from failing.
- Six submissions an hour from one address. Generous for a pub full of people
  on the same wifi, useless to anybody scripting it.
- Photographs and videos are checked by their own first bytes, not by what the
  sender's phone called them. A text file renamed `.mp4` is turned away.
- Everything is rendered with `textContent`, never as markup.

### Video, and the twenty megabyte ceiling

People upload the footage itself, straight off their phone. There are no links
to Facebook or anywhere else -- the file is what arrives, and an approved one
plays on Reelz from this site, next to the band's own reels.

**The limit is 20MB, and that is a hard edge rather than a preference.** Video
is kept in KV, a KV value cannot exceed 25MB, and 20 leaves room for the record
itself. In practice that is about fifteen seconds of 1080p, or half a minute at
720p. The form says so, the size is checked in the browser before anything is
sent, and the server says how far over it was if one slips through.

The reason it is in KV at all is that **R2 -- Cloudflare's actual file storage
-- is not switched on for this account**. It has a free tier that would hold far
more than this site will ever need, but enabling it is a step in the Cloudflare
dashboard that has to be done by hand. When it is, the ceiling goes and almost
nothing else changes: the queue, the approval, the serving and the emailing all
work the same.

One thing worth knowing either way: an iPhone set to "High Efficiency" records
HEVC inside a `.mov`, which plays on Apple devices and often nowhere else. Those
files are accepted, because they are genuine footage and the band are looking at
them on a phone, but it is why a clip can look fine in Backstage on an iPhone
and refuse to play for somebody on Android. Fixing that needs a transcoder, and
there is no transcoder here.

### Mics, not stars

The rating is out of five **microphones**, drawn from the artwork the band
supplied -- one gold, one dark, cut off their black ground by `npm run images`
and saved as `mic-on.png` and `mic-off.png`.

The cut is worth a note. The background could not be keyed out by colour,
because the dark mic's own body is black too. What separates them is the white
sticker outline around each one, so the build floods inwards from the edges of
the picture and stops wherever that outline is met; whatever the flood never
reaches -- the inside of the mic, black body and all -- is kept.

**A review needs a rating.** Words with no mic count are refused, on the form and
again on the server. A wall of reviews with a number on some and nothing on
others reads as broken, and there is nothing sensible to draw for the missing
ones: five empty mics says one mic, and no mics at all leaves a hole. Somebody
who has written a paragraph can pick a number.

**A photo or a clip on its own needs neither**, which is the other half of the
rule. Those are a different kind of thing and sit outside the review box on the
form. The only submission refused outright is one that is entirely empty.

The five on the form are radio buttons with a microphone drawn over each --
real controls, so they work by keyboard, read properly to a screen reader and
submit with the form. They are written into the HTML backwards, five down to
one, and flipped by the stylesheet: CSS can style the siblings after an element
but not before it, and "fill this mic and every one to its left" needs exactly
that. There is a note in the markup saying so, because it looks like a mistake
otherwise.

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
  data/gigs.json   live dates — the fallback list, and what the diary was seeded from
  admin.html       the band's diary; only reachable signed in
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
