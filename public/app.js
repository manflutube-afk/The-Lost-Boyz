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

  /* ---------- reels ---------- */

  /*
   * Facebook's video plugin renders at whatever width you pass in the URL, so
   * the iframe is built after the tile has been measured rather than being
   * stretched with CSS. Reels are 9:16, hence the height.
   */
  function buildReel(url, width, autoplay) {
    var height = Math.round(width * 16 / 9);
    var src = 'https://www.facebook.com/plugins/video.php'
      + '?href=' + encodeURIComponent(url)
      + '&show_text=false'
      // The plugin defaults this to false. Without it, tapping play on a
      // phone does nothing, because the player wants to go fullscreen.
      + '&allowfullscreen=true'
      // Facebook always starts autoplayed video muted; browsers block it
      // otherwise. Visitors unmute with the player's own control.
      + '&autoplay=' + (autoplay ? 'true' : 'false')
      + '&width=' + width
      + '&height=' + height;

    var frame = document.createElement('iframe');
    frame.className = 'reel__frame';
    frame.src = src;
    frame.width = width;
    frame.height = height;
    frame.loading = 'lazy';
    frame.scrolling = 'no';
    frame.frameBorder = '0';
    // Naming `allow` at all replaces the default permissions policy, so
    // fullscreen has to be listed here too or the iframe is denied it.
    frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write';
    frame.allowFullscreen = true;
    frame.title = 'The Lost Boyz reel';
    return frame;
  }

  var reelBox = document.getElementById('reels');

  if (reelBox) {
    var reelMessage = function (text) {
      var p = document.createElement('p');
      p.className = 'reels__msg';
      p.textContent = text;
      reelBox.replaceChildren(p);
    };

    /*
     * Only one reel is ever loaded at a time. Each Facebook player is a heavy
     * thing to pull down, so tiles start as a placeholder and the player is
     * injected when that tile becomes the one being looked at, then thrown
     * away again when it is not. That is also what stops the video: the
     * player is in a cross-origin iframe, so removing it is the only pause
     * button available to us.
     */
    var playing = null;
    var ratios = new Map();

    var loadTile = function (tile, autoplay) {
      if (tile.dataset.loaded === '1') { return; }
      var shell = tile.querySelector('.reel__shell');
      var width = Math.max(220, Math.min(Math.round(shell.clientWidth) || 320, 480));
      shell.appendChild(buildReel(tile.dataset.url, width, autoplay));
      tile.dataset.loaded = '1';
      tile.classList.add('is-loaded');
    };

    var unloadTile = function (tile) {
      if (tile.dataset.loaded !== '1') { return; }
      var frame = tile.querySelector('.reel__frame');
      if (frame) { frame.remove(); }
      tile.dataset.loaded = '0';
      tile.classList.remove('is-loaded');
    };

    var playTile = function (tile, autoplay) {
      if (playing && playing !== tile) { unloadTile(playing); }
      playing = tile;
      if (tile) { loadTile(tile, autoplay); }
    };

    // Autoplay-on-scroll is a phone behaviour, and only when the visitor has
    // not asked us to go easy on motion or on their data allowance.
    var wantsAutoplay = function () {
      if (window.matchMedia('(min-width: 700px)').matches) { return false; }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return false; }
      var conn = navigator.connection;
      if (conn && conn.saveData) { return false; }
      return true;
    };

    var onIntersect = function (entries) {
      entries.forEach(function (e) { ratios.set(e.target, e.intersectionRatio); });

      var best = null;
      var bestRatio = 0;
      ratios.forEach(function (r, el) {
        if (r > bestRatio) { bestRatio = r; best = el; }
      });

      // Needs to be properly on screen before it takes over.
      if (bestRatio < 0.6) { best = null; }
      if (best === playing) { return; }
      playTile(best, true);
    };

    var buildTile = function (reel) {
      var fig = document.createElement('figure');
      fig.className = 'reel';
      fig.dataset.url = reel.url;
      fig.dataset.loaded = '0';

      var shell = document.createElement('div');
      shell.className = 'reel__shell';

      // Tapping the placeholder plays it, which is the whole interaction on
      // desktop and the fallback when autoplay is off.
      var ph = document.createElement('button');
      ph.type = 'button';
      ph.className = 'reel__ph';
      ph.setAttribute('aria-label', 'Play ' + (reel.title || 'this reel'));

      var mark = document.createElement('img');
      mark.src = '/images/logo-160.webp';
      mark.alt = '';
      mark.width = 96;
      mark.height = 73;
      mark.loading = 'lazy';
      mark.className = 'reel__mark';

      var play = document.createElement('span');
      play.className = 'reel__playbtn';
      play.setAttribute('aria-hidden', 'true');

      ph.append(mark, play);
      ph.addEventListener('click', function () { playTile(fig, true); });

      shell.appendChild(ph);
      fig.appendChild(shell);

      if (reel.title) {
        var cap = document.createElement('figcaption');
        cap.className = 'reel__cap';
        cap.textContent = reel.title;
        fig.appendChild(cap);
      }

      return fig;
    };

    var renderReels = function (reels) {
      reels = reels.filter(function (r) { return r && r.url; });

      if (!reels.length) {
        reelMessage('No reels up yet — check back soon.');
        return;
      }

      var frag = document.createDocumentFragment();
      var tiles = reels.map(function (reel) {
        var tile = buildTile(reel);
        frag.appendChild(tile);
        return tile;
      });
      reelBox.replaceChildren(frag);

      if (wantsAutoplay() && 'IntersectionObserver' in window) {
        var observer = new IntersectionObserver(onIntersect, {
          threshold: [0, 0.25, 0.5, 0.6, 0.75, 1]
        });
        tiles.forEach(function (t) { observer.observe(t); });
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
