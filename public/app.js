/* The Lost Boyz — nav drawer, sticky header, gig list */

(function () {
  'use strict';

  /* ---------- start at the top on a refresh ---------- */

  /*
   * Browsers put you back where you were when a page is reloaded. On a long
   * single-page site that means a refresh drops you into the middle of
   * whatever section you happened to be reading, which feels broken.
   *
   * This is deliberately limited to reloads. Scroll restoration going *back*
   * to a page is the behaviour people expect — losing your place after
   * tapping back would be its own annoyance — so back and forward are left
   * alone. A link with a #section on the end is left alone too: that is
   * someone asking for a particular part of the page, refresh or not.
   */
  (function () {
    if (!('scrollRestoration' in history)) { return; }

    var entries = (performance.getEntriesByType && performance.getEntriesByType('navigation')) || [];
    var isReload = entries.length
      ? entries[0].type === 'reload'
      // older browsers, where performance.navigation.type 1 means reload
      : (performance.navigation && performance.navigation.type === 1);

    if (isReload && !window.location.hash) {
      history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);

      /*
       * Setting it to manual is not quite enough on its own. The browser's
       * own restore lands after this script has run, and because the page is
       * still short at that point — images not in yet — it clamps the old
       * position to whatever height exists and drops you part way down.
       *
       * A fixed timer was not enough either: on a desktop, with the big hero
       * and gallery images taking longer, the restore arrives after any
       * sensible delay has expired. So instead of guessing when it lands,
       * watch for it — any scroll we did not ask for gets put straight back
       * to the top, until the page has finished loading.
       *
       * It gives up the instant the visitor touches anything, so it can
       * never fight someone scrolling of their own accord.
       */
      var pinning = true;
      var moves = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

      var stopPinning = function () {
        if (!pinning) { return; }
        pinning = false;
        window.removeEventListener('scroll', onScroll);
        moves.forEach(function (ev) { window.removeEventListener(ev, stopPinning); });
      };

      var pinTop = function () {
        if (pinning && window.scrollY !== 0) { window.scrollTo(0, 0); }
      };

      function onScroll() { pinTop(); }

      window.addEventListener('scroll', onScroll, { passive: true });
      moves.forEach(function (ev) {
        window.addEventListener(ev, stopPinning, { passive: true });
      });

      window.addEventListener('load', function () {
        pinTop();
        // a short grace after load, for a restore that lands right on the line
        setTimeout(stopPinning, 500);
      });

      // and a hard stop, so nothing can hold the page hostage
      setTimeout(stopPinning, 3000);

      return;
    }

    /*
     * Put it back otherwise. scrollRestoration sticks to the history entry,
     * so a "manual" left over from an earlier refresh would go on suppressing
     * restoration for every later visit to this entry — including the back
     * button, which is exactly what this is trying not to break.
     */
    history.scrollRestoration = 'auto';
  })();

  /* ---------- mobile nav drawer ---------- */

  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');
  var scrim = null;

  function openNav() {
    nav.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('nav-open');

    scrim = document.createElement('div');
    scrim.className = 'nav-scrim';
    scrim.addEventListener('click', closeNav);
    document.body.appendChild(scrim);
    // next frame so the opacity transition actually runs
    requestAnimationFrame(function () { scrim.classList.add('is-on'); });
  }

  function closeNav() {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('nav-open');

    if (scrim) {
      var dying = scrim;
      scrim = null;
      dying.classList.remove('is-on');
      setTimeout(function () { dying.remove(); }, 300);
    }
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      if (nav.classList.contains('is-open')) { closeNav(); } else { openNav(); }
    });

    // tapping a link in the drawer should close it
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { closeNav(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        closeNav();
        toggle.focus();
      }
    });

    // if the viewport grows past the desktop breakpoint, drop the drawer state
    window.matchMedia('(min-width: 900px)').addEventListener('change', function (e) {
      if (e.matches) { closeNav(); }
    });
  }

  /* ---------- sticky header shading ---------- */

  var hdr = document.getElementById('hdr');
  if (hdr) {
    var onScroll = function () {
      hdr.classList.toggle('is-stuck', window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- footer year ---------- */

  var year = document.getElementById('year');
  if (year) { year.textContent = new Date().getFullYear(); }

  /* ---------- the disc spins in ---------- */

  /*
   * When the single first scrolls into view the page is held still for a
   * moment while the disc spins up and settles the right way up, then
   * scrolling carries on.
   *
   * Holding someone's scroll is a rude thing to get wrong, so this is built
   * to fail open: a timer releases the page whether or not the animation
   * ever finishes, any key or click lets the visitor straight out, and the
   * whole thing is skipped for anyone who prefers reduced motion. Scroll
   * events are cancelled rather than the body being frozen, so the page
   * never shifts underneath them.
   */
  var disc = document.getElementById('disc');

  if (disc && 'IntersectionObserver' in window) {
    var SPIN_MS = 1600;
    var FAILSAFE_MS = 2400;
    var SCROLL_KEYS = [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'End', 'Home'];

    var held = false;
    var failsafe = null;

    var swallow = function (e) { e.preventDefault(); };

    var onKey = function (e) {
      if (SCROLL_KEYS.indexOf(e.key) !== -1) { e.preventDefault(); }
      releaseScroll();
    };

    function holdScroll() {
      if (held) { return; }
      held = true;
      document.addEventListener('wheel', swallow, { passive: false });
      document.addEventListener('touchmove', swallow, { passive: false });
      document.addEventListener('keydown', onKey);
      document.addEventListener('click', releaseScroll);
      failsafe = setTimeout(releaseScroll, FAILSAFE_MS);
    }

    function releaseScroll() {
      if (!held) { return; }
      held = false;
      clearTimeout(failsafe);
      document.removeEventListener('wheel', swallow);
      document.removeEventListener('touchmove', swallow);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', releaseScroll);
    }

    var spinDisc = function () {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { return; }

      var go = function () {
        disc.classList.add('is-spinning');
        holdScroll();
        disc.addEventListener('animationend', releaseScroll, { once: true });
        // belt and braces, in case animationend never arrives
        setTimeout(releaseScroll, SPIN_MS + 120);
      };

      // the disc is lazy-loaded, so wait for the pixels before spinning them
      if (disc.complete && disc.naturalWidth) { go(); }
      else { disc.addEventListener('load', go, { once: true }); }
    };

    /*
     * How much of the disc has to be on screen before it is allowed to spin.
     *
     * It used to be a third, which meant that jumping straight to the single
     * on a short phone started the spin while the bottom of the disc was
     * still below the fold — you watched half a record turn. It now waits
     * until the whole thing is in the clear space under the header. If the
     * disc is somehow taller than that space it settles for as much of it as
     * can be shown, so the spin never simply fails to happen.
     */
    var spinThresholds = [];
    for (var t = 0; t <= 20; t++) { spinThresholds.push(t / 20); }

    var enoughOnScreen = function () {
      var tall = disc.getBoundingClientRect().height || 1;
      var header = document.getElementById('hdr');
      var room = window.innerHeight - (header ? header.getBoundingClientRect().height : 0) - 8;
      if (room < 1) { return 0.35; }
      return tall <= room ? 0.95 : (room / tall) * 0.95;
    };

    var discObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= enoughOnScreen()) {
          discObserver.disconnect();
          spinDisc();
        }
      });
    }, { threshold: spinThresholds });

    discObserver.observe(disc);
  }

  /* ---------- the gallery strip only snaps while it is being swiped ---------- */

  /*
   * A scroll-snap container re-snaps every time the viewport is resized, and
   * on a phone the address bar sliding away as you scroll *is* a resize. The
   * gallery strip was therefore sliding sideways on its own while somebody
   * was scrolling vertically past it, which made the whole page feel loose.
   *
   * So snapping is only on while a finger is actually on the strip. The delay
   * before switching it off again lets the flick's momentum run out and the
   * strip settle on a photo first.
   */
  var strip = document.getElementById('shots');

  if (strip) {
    var settle = null;

    var snapOn = function () {
      clearTimeout(settle);
      strip.classList.add('is-swiping');
    };

    var snapOffSoon = function () {
      clearTimeout(settle);
      settle = setTimeout(function () { strip.classList.remove('is-swiping'); }, 700);
    };

    strip.addEventListener('touchstart', snapOn, { passive: true });
    strip.addEventListener('pointerdown', snapOn);
    ['touchend', 'touchcancel', 'pointerup', 'pointercancel']
      .forEach(function (name) { strip.addEventListener(name, snapOffSoon, { passive: true }); });

    // a mouse wheel or a keyboard on the strip deserves the same treatment
    strip.addEventListener('wheel', function () { snapOn(); snapOffSoon(); }, { passive: true });
    strip.addEventListener('keydown', function () { snapOn(); snapOffSoon(); });
  }

  /* ---------- the story button presses ---------- */

  /*
   * :active is not dependable on a link on touch — some mobile browsers
   * never apply it to an anchor at all, others leave it stuck on after the
   * finger has lifted — so the pressed state is driven from the pointer
   * events instead. The CSS keeps :active as the fallback for anyone
   * without JavaScript.
   */
  var storyBtn = document.querySelector('.story-btn');

  if (storyBtn && window.PointerEvent) {
    var pressOn = function () { storyBtn.classList.add('is-pressing'); };
    var pressOff = function () { storyBtn.classList.remove('is-pressing'); };

    storyBtn.addEventListener('pointerdown', pressOn);
    ['pointerup', 'pointercancel', 'pointerleave', 'blur', 'dragstart']
      .forEach(function (name) { storyBtn.addEventListener(name, pressOff); });

    // and for anyone arriving on it with the keyboard
    storyBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { pressOn(); }
    });
    storyBtn.addEventListener('keyup', pressOff);
  }

  /* ---------- reels ---------- */

  /*
   * Self-hosted video, played by the browser's own <video> element.
   *
   * This replaced a Facebook embed, and the contrast is the point. Everything
   * that was impossible through their player -- starting a clip as you scroll
   * onto it on a phone, stopping one when another starts, no grid of "related
   * reels" thrown over the end, no Facebook cookies -- takes a few lines here,
   * because the page actually owns the video.
   */
  var reelBox = document.getElementById('reels');

  if (reelBox) {
    var reelMessage = function (text) {
      var p = document.createElement('p');
      p.className = 'reels__msg';
      p.textContent = text;
      reelBox.replaceChildren(p);
    };

    var videos = [];

    var pauseOthers = function (keep) {
      videos.forEach(function (v) {
        if (v !== keep && !v.paused) { v.pause(); }
      });
    };

    /*
     * Sound.
     *
     * No browser will let a page start a video with sound before the visitor
     * has interacted with it — try, and play() is refused and nothing happens
     * at all. So a clip that starts itself has to start silent. That is not a
     * setting anywhere; it is the rule.
     *
     * What can be done is to turn the sound on the moment the visitor touches
     * the screen, and on a phone their first scroll counts. So the first clip
     * runs quiet for a moment, then that gesture unlocks it and everything
     * from then on plays with sound, including the one already running.
     */
    var soundAllowed = false;
    var soundHint = null;

    var clearHint = function () {
      if (soundHint) { soundHint.remove(); soundHint = null; }
    };

    var unlockSound = function () {
      if (soundAllowed) { return; }
      soundAllowed = true;
      clearHint();

      /*
       * Every clip, not just the one playing. Unmuting only what was playing
       * at this instant left a clip silent whenever the visitor's first touch
       * landed while its play() was still pending — play() is asynchronous,
       * so the video is still "paused" for a moment after being asked to
       * start, and it fell through the gap and stayed muted for good.
       */
      videos.forEach(function (v) { v.muted = false; });
    };

    // the events that actually count as an interaction; scrolling on a phone
    // produces touchend, so a swipe is enough
    ['touchend', 'pointerup', 'click', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, unlockSound, { passive: true });
    });

    /*
     * Play-as-you-scroll is a phone behaviour. On a desktop the tiles sit
     * still showing their poster frame and wait to be clicked, which is what
     * people expect of a wall of videos on a big screen.
     */
    var autoplayWanted = function () {
      if (window.matchMedia('(min-width: 700px)').matches) { return false; }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return false; }
      var conn = navigator.connection;
      if (conn && conn.saveData) { return false; }
      return true;
    };

    var buildTile = function (reel) {
      var fig = document.createElement('figure');
      fig.className = 'reel';

      var shell = document.createElement('div');
      shell.className = 'reel__shell';

      /*
       * Each clip keeps its own shape. These were filmed both ways up -- some
       * portrait, some landscape -- and forcing a single aspect on all of them
       * would crop half the set to pieces. Setting it here also means the
       * space is reserved before the poster loads, so nothing jumps about.
       */
      if (reel.width && reel.height) {
        shell.style.aspectRatio = reel.width + ' / ' + reel.height;
        // the same ratio as a plain number, so the stylesheet can work out
        // how wide the clip may be when the screen is too short for it
        shell.style.setProperty('--reel-ratio', reel.width / reel.height);
      }

      var video = document.createElement('video');
      video.className = 'reel__video';
      video.setAttribute('playsinline', '');  // iOS plays it in the tile rather than seizing the screen
      video.preload = 'none';                 // not a byte of video until someone asks for it

      /*
       * Controls are left off wherever clips start themselves.
       *
       * A phone keeps the native controls sitting over a playing video, with
       * a dark scrim behind them, until the video is tapped. That made every
       * autoplaying clip look dimmed, as though it were waiting to be
       * started. So a clip that plays on its own plays clean, and the
       * controls arrive the moment the visitor taps — which is also the
       * gesture that turns the sound on.
       *
       * On a desktop nothing autoplays, so the controls are the only way to
       * start a clip and belong there from the outset.
       */
      var selfStarting = autoplayWanted();
      video.controls = !selfStarting;

      if (selfStarting) {
        video.addEventListener('click', function () {
          video.controls = true;
        });
      }
      if (reel.poster) { video.poster = reel.poster; }

      var source = document.createElement('source');
      source.src = reel.file;
      source.type = 'video/mp4';
      video.appendChild(source);

      video.addEventListener('play', function () {
        // one at a time, however it was started — a tap, a click, or the
        // scroll watcher below
        pauseOthers(video);

        /*
         * Settle the sound here, where playback genuinely begins, rather than
         * trusting what was decided before play() was called. Those two
         * moments are not the same, and a clip asked to start just before the
         * visitor's first touch would otherwise keep the muted state it was
         * given a moment earlier.
         */
        if (soundAllowed) { video.muted = false; }
      });

      shell.appendChild(video);
      fig.appendChild(shell);

      var caption = [reel.title, reel.duration].filter(Boolean).join(' \u00b7 ');
      if (caption) {
        var cap = document.createElement('figcaption');
        cap.className = 'reel__cap';
        cap.textContent = caption;
        fig.appendChild(cap);
      }

      videos.push(video);
      return fig;
    };

    var watchScroll = function () {
      if (!('IntersectionObserver' in window)) { return; }

      var ratios = new Map();
      var playing = null;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { ratios.set(e.target, e.intersectionRatio); });

        var best = null;
        var bestRatio = 0;
        ratios.forEach(function (r, el) {
          if (r > bestRatio) { bestRatio = r; best = el; }
        });

        // has to be properly on screen before it takes over
        if (bestRatio < 0.6) { best = null; }
        if (best === playing) { return; }

        if (playing) { playing.pause(); }
        playing = best;
        if (!best) { return; }

        /*
         * Muted, because no browser lets a video start itself with sound.
         * That is the one real constraint left, and the controls hand the
         * sound back with a single tap.
         */
        // with sound if the visitor has already touched the page, silent if not
        best.muted = !soundAllowed;

        var started = best.play();
        if (started && started.catch) {
          started.catch(function () {
            /*
             * Refused. If we asked for sound, that is almost certainly why —
             * so fall back to silent rather than leaving a tile sitting there
             * doing nothing. Better quiet than dead.
             */
            if (!best.muted) {
              best.muted = true;
              var retry = best.play();
              if (retry && retry.catch) {
                retry.catch(function () {
                  // Even muted it will not go. Give the tile its controls
                  // back, or there is a poster on screen with no way to
                  // start it.
                  best.controls = true;
                });
              }
            } else {
              best.controls = true;
            }
          });
        }
      }, { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] });

      videos.forEach(function (v) { observer.observe(v); });
    };

    var renderReels = function (reels) {
      reels = reels.filter(function (r) { return r && r.file; });

      if (!reels.length) {
        reelMessage('No videos up yet — check back soon.');
        return;
      }

      var frag = document.createDocumentFragment();
      reels.forEach(function (reel) { frag.appendChild(buildTile(reel)); });
      reelBox.replaceChildren(frag);

      if (autoplayWanted()) {
        watchScroll();

        // say why the first one is quiet, rather than leaving people to wonder
        if (!soundAllowed) {
          soundHint = document.createElement('p');
          soundHint.className = 'reels__hint';
          soundHint.textContent = 'Tap the screen to turn the sound on.';
          reelBox.parentNode.insertBefore(soundHint, reelBox);
        }
      }
    };

    fetch('/data/reels.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      })
      .then(function (data) {
        renderReels(Array.isArray(data) ? data : (data.reels || []));
      })
      .catch(function () {
        reelMessage('The videos are not loading right now — please try again shortly.');
      });
  }


  /* ---------- geeks corner: the gear ---------- */

  var gearBox = document.getElementById('gear');

  if (gearBox) {
    var gearMsg = function (text) {
      var p = document.createElement('p');
      p.className = 'gear__msg';
      p.textContent = text;
      gearBox.replaceChildren(p);
    };

    var gearItem = function (item) {
      var card = document.createElement('article');
      card.className = 'kit';

      var name = document.createElement('h3');
      name.className = 'kit__name';
      name.textContent = item.name;
      card.appendChild(name);

      if (item.what) {
        var what = document.createElement('p');
        what.className = 'kit__what';
        what.textContent = item.what;
        card.appendChild(what);
      }

      if (item.note) {
        var note = document.createElement('p');
        note.className = 'kit__note';
        note.textContent = item.note;
        card.appendChild(note);
      }

      return card;
    };

    var renderGear = function (groups) {
      groups = (groups || []).filter(function (g) {
        return g && g.name && Array.isArray(g.items) && g.items.length;
      });

      if (!groups.length) {
        gearMsg('The boyz are still writing this one up — check back soon.');
        return;
      }

      var frag = document.createDocumentFragment();

      groups.forEach(function (group) {
        var heading = document.createElement('h2');
        heading.className = 'h3';
        heading.textContent = group.name;
        frag.appendChild(heading);

        if (group.blurb) {
          var blurb = document.createElement('p');
          blurb.className = 'lead';
          blurb.textContent = group.blurb;
          frag.appendChild(blurb);
        }

        var list = document.createElement('div');
        list.className = 'kits';
        group.items
          .filter(function (i) { return i && i.name; })
          .forEach(function (item) { list.appendChild(gearItem(item)); });
        frag.appendChild(list);
      });

      gearBox.replaceChildren(frag);
    };

    fetch('/data/gear.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      })
      .then(function (data) {
        renderGear(Array.isArray(data) ? data : data.groups);
      })
      .catch(function () {
        gearMsg('That is not loading right now. Please try again shortly.');
      });
  }

  /* ---------- sponsors ---------- */

  /*
   * Where sponsor enquiries go. Left empty, the form opens the visitor's own
   * email app with everything filled in, which needs no accounts or keys.
   * Set this to a POST endpoint later to collect them properly instead.
   */
  var SPONSOR_ENDPOINT = '';
  var SPONSOR_EMAIL = 'bookings@thelostboyz.uk';

  var sponsorBox = document.getElementById('sponsors');

  if (sponsorBox) {
    var renderSponsors = function (list) {
      list = list.filter(function (s) { return s && s.name; });

      if (!list.length) {
        var p = document.createElement('p');
        p.className = 'sponsors__msg';
        p.textContent = 'No sponsors on board just yet — this could be your business.';
        sponsorBox.replaceChildren(p);
        return;
      }

      var frag = document.createDocumentFragment();

      list.forEach(function (s) {
        var card = document.createElement('article');
        card.className = 'sponsor';

        if (s.logo) {
          var img = document.createElement('img');
          img.className = 'sponsor__logo';
          img.src = s.logo;
          img.alt = s.name;
          img.loading = 'lazy';
          card.appendChild(img);
        }

        var name = document.createElement('h3');
        name.className = 'sponsor__name';
        if (s.url) {
          var a = document.createElement('a');
          a.href = s.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = s.name;
          name.appendChild(a);
        } else {
          name.textContent = s.name;
        }
        card.appendChild(name);

        if (s.tier) {
          var tier = document.createElement('p');
          tier.className = 'sponsor__tier';
          tier.textContent = s.tier;
          card.appendChild(tier);
        }

        if (s.blurb) {
          var blurb = document.createElement('p');
          blurb.className = 'sponsor__blurb';
          blurb.textContent = s.blurb;
          card.appendChild(blurb);
        }

        frag.appendChild(card);
      });

      sponsorBox.replaceChildren(frag);
    };

    fetch('/data/sponsors.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      })
      .then(function (data) {
        renderSponsors(Array.isArray(data) ? data : (data.sponsors || []));
      })
      .catch(function () {
        renderSponsors([]);
      });
  }

  /* ---------- charities and fundraisers ---------- */

  var charityBox = document.getElementById('charities');
  var fundraiserBox = document.getElementById('fundraisers');

  if (charityBox || fundraiserBox) {
    var charityMsg = function (box, text) {
      if (!box) { return; }
      var p = document.createElement('p');
      p.className = 'charities__msg';
      p.textContent = text;
      box.replaceChildren(p);
    };

    var outLink = function (href, text, solid) {
      var a = document.createElement('a');
      a.className = 'btn' + (solid ? ' btn--solid' : '');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = text;
      return a;
    };

    /*
     * "Support Paul" rather than "Support this" — it is a person doing the
     * fundraising, and naming them reads as backing someone rather than
     * clicking a link. Uses their first name, since that is how the band
     * would say it.
     *
     * Some entries will not be one person: a family, a team, a pub. Those
     * fall back to the whole name, and 'supportLabel' in the JSON overrides
     * the lot when neither is right.
     */
    var supportLabel = function (item) {
      if (item.supportLabel) { return item.supportLabel; }
      if (!item.who) { return 'Support this'; }

      var who = item.who.trim();
      var first = who.split(/\s+/)[0];

      if (!first || /^(the|team|friends|family|staff)$/i.test(first)) {
        return 'Support ' + who;
      }
      return 'Support ' + first;
    };

    var charityCard = function (item, isFundraiser) {
      var card = document.createElement('article');
      card.className = 'charity';

      var h = document.createElement('h3');
      h.className = 'charity__name';
      if (item.url) {
        var a = document.createElement('a');
        a.href = item.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = item.name;
        h.appendChild(a);
      } else {
        h.textContent = item.name;
      }
      card.appendChild(h);

      // charities carry a tagline; a fundraiser says who is doing it, and for whom
      var sub = isFundraiser
        ? [item.who, item.forCharity ? 'for ' + item.forCharity : ''].filter(Boolean).join(' · ')
        : (item.tagline || '');

      if (sub) {
        var s = document.createElement('p');
        s.className = 'charity__sub';
        s.textContent = sub;
        card.appendChild(s);
      }

      if (item.blurb) {
        var b = document.createElement('p');
        b.className = 'charity__blurb';
        b.textContent = item.blurb;
        card.appendChild(b);
      }

      var facts = [];
      if (item.charityNo) { facts.push('Registered charity ' + item.charityNo); }
      if (item.helpline) { facts.push('Helpline ' + item.helpline); }
      if (facts.length) {
        var f = document.createElement('p');
        f.className = 'charity__facts';
        f.textContent = facts.join(' · ');
        card.appendChild(f);
      }

      var actions = document.createElement('div');
      actions.className = 'charity__actions';

      /*
       * Donation links go straight to the charity's own page. The band never
       * handle the money, and the page says so — anything else would need to
       * be registered with the Fundraising Regulator.
       */
      if (item.donateUrl) { actions.appendChild(outLink(item.donateUrl, 'Donate', true)); }
      if (item.url) {
        actions.appendChild(outLink(item.url, isFundraiser ? supportLabel(item) : 'Visit site', !item.donateUrl));
      }
      if (actions.childNodes.length) { card.appendChild(actions); }

      return card;
    };

    var renderCharityList = function (box, list, isFundraiser, emptyText) {
      if (!box) { return; }

      list = (list || []).filter(function (c) { return c && c.name; });
      if (!list.length) { charityMsg(box, emptyText); return; }

      var frag = document.createDocumentFragment();
      list.forEach(function (item) { frag.appendChild(charityCard(item, isFundraiser)); });
      box.replaceChildren(frag);
    };

    fetch('/data/charities.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      })
      .then(function (data) {
        renderCharityList(charityBox, data.charities, false,
          'Nothing listed here just yet.');
        renderCharityList(fundraiserBox, data.fundraisers, true,
          'No fundraisers on the go at the moment — if you are running one for these causes, get in touch and we will put it up here.');
      })
      .catch(function () {
        charityMsg(charityBox, 'That is not loading right now. Please try again shortly.');
        charityMsg(fundraiserBox, 'That is not loading right now. Please try again shortly.');
      });
  }

  /* ---------- sponsor enquiry form ---------- */

  var dialog = document.getElementById('sponsorDialog');

  if (dialog) {
    var form = document.getElementById('sponsorForm');
    var planField = document.getElementById('spPlan');
    var errBox = document.getElementById('sponsorErr');
    var lastOpener = null;

    var openDialog = function (btn) {
      lastOpener = btn;
      var plan = btn && btn.dataset.plan;
      if (plan) {
        // preselect whichever plan card was clicked
        Array.prototype.forEach.call(planField.options, function (o) {
          if (o.value === plan) { planField.value = plan; }
        });
      }
      errBox.hidden = true;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    };

    var closeDialog = function () {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
      if (lastOpener) { lastOpener.focus(); }
    };

    document.querySelectorAll('[data-sponsor-open]').forEach(function (btn) {
      btn.addEventListener('click', function () { openDialog(btn); });
    });

    document.getElementById('sponsorClose').addEventListener('click', closeDialog);
    document.getElementById('sponsorCancel').addEventListener('click', closeDialog);

    // click on the backdrop closes it
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) { closeDialog(); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var data = {
        plan: planField.value,
        business: document.getElementById('spBusiness').value.trim(),
        name: document.getElementById('spName').value.trim(),
        email: document.getElementById('spEmail').value.trim(),
        phone: document.getElementById('spPhone').value.trim(),
        message: document.getElementById('spMessage').value.trim()
      };

      if (!data.business || !data.name || !data.email) {
        errBox.textContent = 'Please fill in your business name, your name and an email address.';
        errBox.hidden = false;
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errBox.textContent = 'That email address does not look right — please check it.';
        errBox.hidden = false;
        return;
      }
      errBox.hidden = true;

      if (SPONSOR_ENDPOINT) {
        fetch(SPONSOR_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
          .then(function (r) {
            if (!r.ok) { throw new Error('HTTP ' + r.status); }
            form.reset();
            closeDialog();
          })
          .catch(function () {
            errBox.textContent = 'Sorry, that did not send. Please email us instead at ' + SPONSOR_EMAIL + '.';
            errBox.hidden = false;
          });
        return;
      }

      // No endpoint set: hand it to the visitor's email app, filled in.
      var body = 'Plan: ' + data.plan
        + '\nBusiness: ' + data.business
        + '\nName: ' + data.name
        + '\nEmail: ' + data.email
        + (data.phone ? '\nPhone: ' + data.phone : '')
        + (data.message ? '\n\n' + data.message : '');

      window.location.href = 'mailto:' + SPONSOR_EMAIL
        + '?subject=' + encodeURIComponent('Sponsorship enquiry — ' + data.business)
        + '&body=' + encodeURIComponent(body);

      closeDialog();
    });
  }

  /* ---------- sponsor payments ---------- */

  /*
   * Stripe Payment Links, one per plan.
   *
   * A link is just a URL Stripe hosts, so there is no secret key anywhere,
   * no server to run and no card details ever touching this site — which
   * matters, because everything under public/ is served to the world.
   *
   * A plan with a link gets a button that goes to Stripe. A plan without one
   * keeps the enquiry form, so the page works whether none, some or all of
   * the three have been set up.
   */
  var planButtons = document.querySelectorAll('.plan__btn[data-plan]');

  if (planButtons.length) {
    fetch('/data/payments.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      })
      .then(function (data) {
        var links = (data && data.links) || {};
        var wired = 0;

        Array.prototype.forEach.call(planButtons, function (btn) {
          var url = links[btn.dataset.plan];

          // Only a real Stripe link counts. An empty string, or a placeholder
          // someone has half-filled in, leaves the enquiry form alone.
          if (!url || url.indexOf('https://') !== 0) { return; }

          var pay = document.createElement('a');
          pay.className = btn.className;
          pay.href = url;
          pay.target = '_blank';
          pay.rel = 'noopener';
          pay.textContent = btn.textContent;
          btn.replaceWith(pay);
          wired++;
        });

        if (!wired) { return; }

        // Say who is taking the money, once, under the plans.
        var plans = document.querySelector('.plans');
        if (plans && !document.querySelector('.plans__note')) {
          var note = document.createElement('p');
          note.className = 'plans__note';
          note.textContent = 'Payments are handled by Stripe. Your card details never touch this website.';
          plans.parentNode.insertBefore(note, plans.nextSibling);
        }
      })
      .catch(function () { /* no payment links yet; the enquiry form stands */ });
  }

  /* ---------- photo viewer ---------- */

  var lb = document.getElementById('lightbox');
  var shotsBox = document.getElementById('shots');

  if (lb && shotsBox) {
    var shots = Array.prototype.slice.call(shotsBox.querySelectorAll('.shot'));
    var lbImg = document.getElementById('lbImg');
    var lbAlt = document.getElementById('lbAlt');
    var lbCount = document.getElementById('lbCount');
    var shotIndex = 0;
    var lbOpener = null;

    /*
     * Size the photo from its own resolution. The gig snaps are only 206px
     * squares, so left to a plain max-width they opened *smaller* than the
     * tile that had just been tapped. Allowing up to twice their natural
     * width makes them properly viewable without blowing them up so far
     * that they turn to mush; the big shots still fill the screen.
     */
    var sizeShot = function () {
      var natural = lbImg.naturalWidth || 0;
      if (!natural) { return; }
      var cap = Math.min(natural * 2, 560);
      lbImg.style.width = 'min(92vw, ' + cap + 'px)';
    };

    lbImg.addEventListener('load', sizeShot);

    var showShot = function (i) {
      shotIndex = (i + shots.length) % shots.length;  // wraps around both ways
      var img = shots[shotIndex].querySelector('img');
      lbImg.style.width = '';   // drop the last photo's size before swapping
      lbImg.src = shots[shotIndex].dataset.full || img.src;
      lbImg.alt = img.alt || '';
      lbAlt.textContent = img.alt || '';
      lbCount.textContent = (shotIndex + 1) + ' of ' + shots.length;
      if (lbImg.complete) { sizeShot(); }   // cached images fire no load event
    };

    var openShot = function (i, btn) {
      lbOpener = btn || null;
      showShot(i);
      if (typeof lb.showModal === 'function') { lb.showModal(); }
      else { lb.setAttribute('open', ''); }
    };

    var closeShot = function () {
      if (typeof lb.close === 'function') { lb.close(); }
      else { lb.removeAttribute('open'); }
      // put the visitor back on the tile they came from
      if (lbOpener) { lbOpener.focus(); }
    };

    shots.forEach(function (btn, i) {
      btn.addEventListener('click', function () { openShot(i, btn); });
    });

    document.getElementById('lbClose').addEventListener('click', closeShot);
    document.getElementById('lbPrev').addEventListener('click', function () { showShot(shotIndex - 1); });
    document.getElementById('lbNext').addEventListener('click', function () { showShot(shotIndex + 1); });

    // Escape is handled by <dialog> itself; these are the arrows.
    document.addEventListener('keydown', function (e) {
      if (!lb.open) { return; }
      if (e.key === 'ArrowLeft') { showShot(shotIndex - 1); }
      else if (e.key === 'ArrowRight') { showShot(shotIndex + 1); }
    });

    // tapping the dark area around the photo closes it
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target === lbImg.parentNode) { closeShot(); }
    });

    /* swipe between photos */
    var touchX = null;
    var touchY = null;

    lb.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      touchX = t.clientX;
      touchY = t.clientY;
    }, { passive: true });

    lb.addEventListener('touchend', function (e) {
      if (touchX === null) { return; }

      var t = e.changedTouches[0];
      var dx = t.clientX - touchX;
      var dy = t.clientY - touchY;
      touchX = null;

      // only a decisive, mostly-sideways flick counts, so scrolling and
      // pinching are not mistaken for swipes
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        showShot(dx < 0 ? shotIndex + 1 : shotIndex - 1);
      }
    }, { passive: true });
  }

  /* ---------- gig dates ---------- */

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var box = document.getElementById('gigs');
  if (!box) { return; }

  function message(text) {
    var p = document.createElement('p');
    p.className = 'gigs__msg';
    p.textContent = text;
    box.replaceChildren(p);
  }

  function render(gigs) {
    // Drop anything already past, then show soonest first.
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var upcoming = gigs
      .filter(function (g) {
        var d = new Date(g.date);
        return !isNaN(d) && d >= today;
      })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });

    if (!upcoming.length) {
      message('No dates in the diary right now — check back soon, or get in touch to book us.');
      return;
    }

    var frag = document.createDocumentFragment();

    upcoming.forEach(function (g) {
      var d = new Date(g.date);

      var card = document.createElement('article');
      card.className = 'gig';

      var date = document.createElement('div');
      date.className = 'gig__date';
      var day = document.createElement('span');
      day.className = 'gig__day';
      day.textContent = d.getDate();
      var mon = document.createElement('span');
      mon.className = 'gig__mon';
      mon.textContent = MONTHS[d.getMonth()];
      date.append(day, mon);

      /*
       * The year is only shown when the gig is not in the current one. With
       * dates either side of new year in the list, a bare "16 JAN" sitting
       * under "17 OCT" reads as a date that has already gone by.
       */
      if (d.getFullYear() !== today.getFullYear()) {
        var yr = document.createElement('span');
        yr.className = 'gig__yr';
        yr.textContent = d.getFullYear();
        date.append(yr);
      }

      var venue = document.createElement('div');
      venue.className = 'gig__venue';
      venue.textContent = g.venue || 'TBC';

      var meta = document.createElement('div');
      meta.className = 'gig__meta';
      meta.textContent = [g.town, g.time].filter(Boolean).join(' · ');

      /*
       * Venue, town and note live in one wrapper rather than being three
       * separate grid children. Auto-placement had been doing the layout,
       * and adding a fourth child pushed the venue into the button's column
       * on wide screens. One block keeps the card to [date][details][button]
       * at every width, however many lines the details run to.
       */
      var body = document.createElement('div');
      body.className = 'gig__body';
      body.append(venue, meta);

      // an optional line for anything that makes the night different —
      // a charity do, a support act, a birthday
      if (g.note) {
        var note = document.createElement('div');
        note.className = 'gig__note';
        note.textContent = g.note;
        body.appendChild(note);
      }

      card.append(date, body);

      /*
       * A gig can point at a page on this site (infoUrl) or straight out to
       * a ticket seller or Facebook event (ticketUrl). The internal one wins
       * as the main button and opens in the same tab, the way a link within
       * a site should; anything external opens in a new one.
       *
       * Not every gig sells tickets either, so the label is settable — a free
       * pub night should not have a button promising something to buy.
       */
      if (g.infoUrl) {
        var info = document.createElement('a');
        info.className = 'btn gig__cta';
        info.href = g.infoUrl;
        info.textContent = g.linkLabel || 'More info';
        card.appendChild(info);
      } else if (g.ticketUrl) {
        var a = document.createElement('a');
        a.className = 'btn gig__cta';
        a.href = g.ticketUrl;
        a.rel = 'noopener';
        a.target = '_blank';
        a.textContent = g.linkLabel || 'Tickets';
        card.appendChild(a);
      }

      frag.appendChild(card);
    });

    box.replaceChildren(frag);
  }

  fetch('/data/gigs.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    })
    .then(function (data) {
      render(Array.isArray(data) ? data : (data.gigs || []));
    })
    .catch(function () {
      message('Dates are not loading right now — drop us a message and we will let you know what is coming up.');
    });
})();
