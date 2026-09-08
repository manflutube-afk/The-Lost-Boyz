/* The Lost Boyz — nav drawer, sticky header, gig list */

(function () {
  'use strict';

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

    var discObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.35) {
          discObserver.disconnect();
          spinDisc();
        }
      });
    }, { threshold: [0.35] });

    discObserver.observe(disc);
  }

  /* ---------- reels ---------- */

  /*
   * The reels use Facebook's JS SDK rather than plain iframes, because a bare
   * iframe gives the page no control at all: it cannot start a video, stop
   * one, or even know that a video is playing. The SDK hands back a player
   * instance per video with play(), pause() and mute(), plus a startedPlaying
   * event. That is what makes three things possible:
   *
   *   - reels play as you scroll onto them on a phone, muted, and stop again
   *     when they scroll away
   *   - only one ever plays at a time, so they cannot talk over each other
   *   - playback happens inline. allowfullscreen is deliberately off; with it
   *     on, tapping play on a phone hijacks the screen and the visitor cannot
   *     scroll on to the next reel.
   *
   * Autoplay only works while the video is muted, which is why mute() is
   * called before every scroll-triggered play. Tapping a reel yourself leaves
   * the sound alone.
   */
  var reelBox = document.getElementById('reels');

  if (reelBox) {
    var FB_SDK = 'https://connect.facebook.net/en_GB/sdk.js';
    var FB_VERSION = 'v21.0';

    var anyStarted = false;
    var autoStarting = {};  // id -> true while the scroll handler is starting it
    var players = {};    // tile id -> Facebook player instance
    var reelCfg = {};    // tile id -> { url, width } so a tile can be rebuilt
    var spent = {};      // tile id -> true once it has played to the end
    var tileIds = [];
    var activeId = null;

    var makeVideoDiv = function (id) {
      var cfg = reelCfg[id];
      var v = document.createElement('div');
      v.className = 'fb-video';
      v.id = id;
      v.dataset.href = cfg.url;
      v.dataset.width = cfg.width;
      v.dataset.showText = 'false';
      // inline playback: fullscreen would trap the visitor on a phone
      v.dataset.allowfullscreen = 'false';
      return v;
    };

    /*
     * The SDK builds its own iframe, and gives it allow="encrypted-media" —
     * no autoplay. The default permissions policy for autoplay is "self", so
     * a cross-origin frame without allow="autoplay" is refused outright, no
     * matter how muted it is. That is why scrolling never started anything on
     * a phone while a desktop, which is far more forgiving, looked fine.
     *
     * A frame's permissions are fixed when it loads, so the attribute has to
     * go on and the frame has to load again for it to count.
     */
    var grantAutoplay = function (shell) {
      var patch = function () {
        var f = shell.querySelector('iframe');
        if (!f || f.dataset.autoplayGranted) { return; }
        f.dataset.autoplayGranted = '1';

        if ((f.getAttribute('allow') || '').indexOf('autoplay') !== -1) { return; }

        f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
        f.setAttribute('allowfullscreen', 'false');
        f.src = f.src; // eslint-disable-line no-self-assign -- forces the reload
      };

      new MutationObserver(patch).observe(shell, { childList: true, subtree: true });
      patch();
    };

    /*
     * Builds a tile's player again from scratch. Facebook drops a panel of
     * "related reels" over a finished video, pointing away to Facebook, and
     * seeking back to the start does not clear it — only a fresh player does.
     */
    var rebuildTile = function (id) {
      var shell = document.querySelector('[data-reel-id="' + id + '"] .reel__shell');
      if (!shell || typeof FB === 'undefined') { return; }
      delete players[id];
      shell.replaceChildren(makeVideoDiv(id));
      try { FB.XFBML.parse(shell); } catch (e) { /* leave the tile as it is */ }
    };

    var reelMessage = function (text) {
      var p = document.createElement('p');
      p.className = 'reels__msg';
      p.textContent = text;
      reelBox.replaceChildren(p);
    };

    var pauseAllBut = function (keepId) {
      tileIds.forEach(function (id) {
        if (id === keepId || !players[id]) { return; }
        try { players[id].pause(); } catch (e) { /* player not ready */ }
      });
    };

    // Scroll-to-play is a phone behaviour, and only when the visitor has not
    // asked us to go easy on motion or on their data.
    var autoplayWanted = function () {
      // Phones only. Deliberately not gated on prefers-reduced-motion: that
      // setting is about interface animation, and plenty of people leave
      // "Reduce Motion" switched on in iOS accessibility settings, which was
      // quietly turning this feature off for them entirely.
      if (window.matchMedia('(min-width: 700px)').matches) { return false; }
      var conn = navigator.connection;
      if (conn && conn.saveData) { return false; }
      return true;
    };

    /*
     * Starting a video from code, with no tap behind it, is only allowed
     * while it is muted — and mobile browsers are far stricter about this
     * than a desktop one, which will often let a video through on the
     * strength of how much video you have watched on that site before. That
     * difference is why this can look fine on a desktop and do nothing on a
     * phone.
     *
     * So: mute first, then play, then check whether it actually moved, and
     * try again a few times if it did not. The SDK reports a player ready
     * slightly before it will reliably act on play().
     */
    var startMuted = function (id, attempt) {
      var p = players[id];
      if (!p || id !== activeId || spent[id]) { return; }

      attempt = attempt || 1;
      autoStarting[id] = true;

      try {
        p.mute();
        p.play();
      } catch (e) { delete autoStarting[id]; return; }

      setTimeout(function () {
        // Give up quietly, and stop treating it as ours — so if the visitor
        // presses play on it later, it plays with sound.
        if (id !== activeId || spent[id] || attempt >= 4) {
          delete autoStarting[id];
          return;
        }

        var pos = 0;
        try { pos = p.getCurrentPosition() || 0; } catch (e) { delete autoStarting[id]; return; }

        // still sitting at the start, so it never really began
        if (pos <= 0.05) { startMuted(id, attempt + 1); }
      }, 700);
    };

    var watchScroll = function () {
      if (!('IntersectionObserver' in window)) { return; }

      var ratios = new Map();

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { ratios.set(e.target, e.intersectionRatio); });

        var best = null;
        var bestRatio = 0;
        ratios.forEach(function (r, el) {
          if (r > bestRatio) { bestRatio = r; best = el; }
        });

        // has to be properly on screen before it takes over
        var bestId = (bestRatio >= 0.6 && best) ? best.dataset.reelId : null;
        if (bestId === activeId) { return; }

        // Scrolling away from a finished reel arms it again, so coming back
        // to it later plays it rather than leaving a dead tile.
        if (activeId) { delete spent[activeId]; }

        activeId = bestId;

        if (!bestId) { pauseAllBut(null); return; }

        startMuted(bestId, 1);
      }, { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] });

      reelBox.querySelectorAll('.reel').forEach(function (t) { observer.observe(t); });
    };

    var wirePlayer = function (id, instance) {
      players[id] = instance;


      // Whenever anything starts — a tap, or the scroll handler — everything
      // else stops. This is what keeps them from clashing on a desktop.
      try {
        instance.subscribe('startedPlaying', function () {
          anyStarted = true;

          /*
           * Only a reel the scroll handler started stays muted, and only
           * because browsers insist on it. Anything a visitor pressed play
           * on themselves gets its sound — which is every reel on a desktop,
           * where nothing autoplays at all.
           */
          if (!autoStarting[id]) {
            try { instance.unmute(); } catch (e) { /* leave it as it is */ }
          }
          delete autoStarting[id];

          activeId = id;
          pauseAllBut(id);
        });

        /*
         * Left alone, Facebook covers a finished video with a grid of
         * "related reels" that sends the visitor off to Facebook. Winding
         * the video back to the start and pausing puts the poster frame
         * back and takes that panel away with it.
         */
        instance.subscribe('finishedPlaying', function () {
          // Do not start it again on the way back in, or a reel sitting on
          // screen would loop and re-download its player every time round.
          spent[id] = true;
          rebuildTile(id);
        });
      } catch (e) { /* older SDK shape; one-at-a-time just won't apply */ }

      /*
       * The SDK takes a few seconds to hand these back, by which time the
       * scroll watcher has usually already decided which reel is on screen
       * and found no player to start. So a player that arrives late and is
       * the one being looked at has to start itself.
       */
      if (id === activeId && autoplayWanted() && !spent[id]) {
        startMuted(id, 1);
      }
    };

    var loadSdk = function () {
      if (document.getElementById('fb-root')) { return; }

      var root = document.createElement('div');
      root.id = 'fb-root';
      document.body.appendChild(root);

      window.fbAsyncInit = function () {
        FB.init({ xfbml: true, version: FB_VERSION });
        FB.Event.subscribe('xfbml.ready', function (msg) {
          if (msg.type === 'video' && msg.id) { wirePlayer(msg.id, msg.instance); }
        });
      };

      var s = document.createElement('script');
      s.async = true;
      s.defer = true;
      s.crossOrigin = 'anonymous';
      s.src = FB_SDK;
      document.body.appendChild(s);
    };

    var renderReels = function (reels) {
      reels = reels.filter(function (r) { return r && r.url; });

      if (!reels.length) {
        reelMessage('No reels up yet — check back soon.');
        return;
      }

      // First pass: tiles, so a shell has a real width to measure.
      var frag = document.createDocumentFragment();
      var shells = [];

      reels.forEach(function (reel, i) {
        var id = 'reel-' + i;
        tileIds.push(id);

        var fig = document.createElement('figure');
        fig.className = 'reel';
        fig.dataset.reelId = id;

        var shell = document.createElement('div');
        shell.className = 'reel__shell';
        fig.appendChild(shell);
        shells.push(shell);

        if (reel.title) {
          var cap = document.createElement('figcaption');
          cap.className = 'reel__cap';
          cap.textContent = reel.title;
          fig.appendChild(cap);
        }

        frag.appendChild(fig);
      });

      reelBox.replaceChildren(frag);

      // Second pass: measure once, then place the players.
      var width = Math.max(220, Math.min(Math.round(shells[0].clientWidth) || 320, 480));

      shells.forEach(function (shell, i) {
        var id = tileIds[i];
        reelCfg[id] = { url: reels[i].url, width: width };
        grantAutoplay(shell);
        shell.appendChild(makeVideoDiv(id));
      });

      // The markup is in the page now, so the SDK will find it on init.
      loadSdk();

      if (autoplayWanted()) {
        watchScroll();

        /*
         * Last resort. If the browser has refused every attempt so far, a
         * genuine touch satisfies it, and the reel already on screen can
         * start. Skipped once anything has played, so it can never mute or
         * restart a reel the visitor chose to play themselves.
         */
        var nudge = function () {
          if (!anyStarted && activeId) { startMuted(activeId, 1); }
        };
        document.addEventListener('touchstart', nudge, { once: true, passive: true });
        document.addEventListener('click', nudge, { once: true });
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
        reelMessage('Reels are not loading right now — you can watch them on our Facebook page.');
      });
  }


  /* ---------- sponsors ---------- */

  /*
   * Where sponsor enquiries go. Left empty, the form opens the visitor's own
   * email app with everything filled in, which needs no accounts or keys.
   * Set this to a POST endpoint later to collect them properly instead.
   */
  var SPONSOR_ENDPOINT = '';
  var SPONSOR_EMAIL = 'bookings@example.com'; // TODO: the band's real address

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

      var venue = document.createElement('div');
      venue.className = 'gig__venue';
      venue.textContent = g.venue || 'TBC';

      var meta = document.createElement('div');
      meta.className = 'gig__meta';
      meta.textContent = [g.town, g.time].filter(Boolean).join(' · ');

      card.append(date, venue, meta);

      if (g.ticketUrl) {
        var a = document.createElement('a');
        a.className = 'btn gig__cta';
        a.href = g.ticketUrl;
        a.rel = 'noopener';
        a.target = '_blank';
        a.textContent = 'Tickets';
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
