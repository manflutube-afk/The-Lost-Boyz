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

    /*
     * Stop one reel.
     *
     * Normally that is just pause(). But the SDK only hands back a player for
     * a video it could actually load — a reel that has been deleted or made
     * private renders a "Video unavailable" frame and reports nothing. Such a
     * tile cannot be paused through the API, so it is rebuilt instead, which
     * destroys the iframe and stops whatever it was doing.
     */
    var settleBy = 0;   // players take a few seconds to arrive after render

    var stopTile = function (id) {
      var p = players[id];
      if (p) {
        try { p.pause(); return; } catch (e) { /* fall through to a rebuild */ }
      }
      // Before the players have had time to arrive, a missing one means "not
      // ready yet", not "broken" — rebuilding then would reload half the page.
      if (Date.now() < settleBy) { return; }
      rebuildTile(id);
    };

    var pauseAllBut = function (keepId) {
      tileIds.forEach(function (id) {
        if (id === keepId) { return; }
        stopTile(id);
      });
    };

    // Scroll-to-play is a phone behaviour, and only when the visitor has not
    // asked us to go easy on motion or on their data.
    /*
     * Scroll-to-play is switched off.
     *
     * iOS will not let a video in a cross-origin iframe start itself, and the
     * setup that would allow it — muted and inline from before the video
     * loads — happens inside Facebook's player, out of reach from here. The
     * attempt was doing real harm: to try at all the reel had to be muted
     * first, so tapping one caught it silent and the opening seconds of the
     * song were lost.
     *
     * Flip this back to the commented-out test the day the band's own video
     * files exist. A self-hosted <video muted playsinline> autoplays on iOS
     * without any of this, and the scroll watcher below is ready for it.
     */
    var autoplayWanted = function () {
      return false;

      // if (window.matchMedia('(min-width: 700px)').matches) { return false; }
      // var conn = navigator.connection;
      // if (conn && conn.saveData) { return false; }
      // return true;
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
    /*
     * Hand a reel back with its sound on. Whenever we stop trying to start
     * something ourselves, it has to be left unmuted, or the visitor presses
     * play later and gets a silent video — which is exactly what our own
     * mute() caused.
     */
    var giveUp = function (id) {
      delete autoStarting[id];
      var p = players[id];
      if (!p) { return; }
      try { p.unmute(); } catch (e) { /* nothing sensible left to do */ }
    };

    var startMuted = function (id, attempt) {
      var p = players[id];
      if (!p || id !== activeId || spent[id]) { return; }

      attempt = attempt || 1;
      autoStarting[id] = true;

      /*
       * mute() travels to the player by postMessage, so it is not in force
       * the moment the call returns. Playing on the very next line looks to
       * the browser like an unmuted video starting itself with no tap behind
       * it, which is the thing it blocks. So wait until the player confirms
       * it is actually muted, and only then play.
       */
      try { p.mute(); } catch (e) { giveUp(id); return; }

      var waited = 0;

      var playWhenMuted = function () {
        if (id !== activeId || spent[id]) { giveUp(id); return; }

        var muted = false;
        try { muted = p.isMuted(); } catch (e) { muted = false; }

        if (!muted && waited < 1200) {
          waited += 100;
          setTimeout(playWhenMuted, 100);
          return;
        }

        try { p.play(); } catch (e) { giveUp(id); return; }

        setTimeout(function () {
          // Two tries, not four. Every attempt is time the reel sits muted, and
        // a tap landing in that window is what made tapped reels silent.
        if (id !== activeId || spent[id] || attempt >= 2) { giveUp(id); return; }

          var pos = 0;
          try { pos = p.getCurrentPosition() || 0; } catch (e) { giveUp(id); return; }

          // still sitting at the start, so it never really began
          if (pos <= 0.05) { startMuted(id, attempt + 1); }
        }, 800);
      };

      playWhenMuted();
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
        /*
         * Subscribe *before* init. FB.init({xfbml:true}) starts parsing the
         * page straight away, so anything that finished between the init call
         * and the subscription was never heard about — that tile then had no
         * player object, could not be paused by the others, and never paused
         * them either, so two reels ended up playing over each other.
         */
        FB.Event.subscribe('xfbml.ready', function (msg) {
          if (msg.type === 'video' && msg.id) { wirePlayer(msg.id, msg.instance); }
        });

        FB.init({ xfbml: true, version: FB_VERSION });
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
        shell.appendChild(makeVideoDiv(id));
      });

      settleBy = Date.now() + 10000;

      // The markup is in the page now, so the SDK will find it on init.
      loadSdk();

      /*
       * A click into any reel's iframe pulls focus out of the page and into
       * that frame. That is the only signal available for a tile the SDK
       * never reported — without it, playing a broken reel would leave a
       * working one still going underneath it.
       */
      window.addEventListener('blur', function () {
        setTimeout(function () {
          var el = document.activeElement;
          if (!el || el.tagName !== 'IFRAME') { return; }

          var tile = el.closest ? el.closest('.reel') : null;
          if (!tile) { return; }

          var id = tile.dataset.reelId;
          if (id && id !== activeId) {
            activeId = id;
            pauseAllBut(id);
          }
        }, 0);
      });

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
