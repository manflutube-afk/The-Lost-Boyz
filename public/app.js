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
   * Facebook's plugin renders at whatever width the URL asks for, so the
   * iframes are built after the tiles are in the page and can be measured.
   *
   * Every tile loads its player. The player is the only thing that knows what
   * the video looks like: it draws the reel's own thumbnail and play button.
   * There is no public way to fetch a reel's poster image on its own, so a
   * lighter placeholder would mean no thumbnails at all. loading="lazy" keeps
   * the ones further down the page from loading until they are near.
   *
   * There is deliberately no autoplay here. Facebook's embedded player
   * ignores the autoplay parameter outside facebook.com -- tested both
   * spellings, on a phone-sized viewport, and the video simply sits on its
   * poster. Real scroll-autoplay needs the video files themselves.
   */
  function buildReel(url, width) {
    var height = Math.round(width * 16 / 9);
    var src = 'https://www.facebook.com/plugins/video.php'
      + '?href=' + encodeURIComponent(url)
      + '&show_text=false'
      // The plugin defaults this to false. Without it, tapping play on a
      // phone does nothing, because the player wants to go fullscreen.
      + '&allowfullscreen=true'
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

    var renderReels = function (reels) {
      reels = reels.filter(function (r) { return r && r.url; });

      if (!reels.length) {
        reelMessage('No reels up yet -- check back soon.');
        return;
      }

      // First pass: put the tiles in, so a shell has a real width to measure.
      var frag = document.createDocumentFragment();
      var shells = [];

      reels.forEach(function (reel) {
        var fig = document.createElement('figure');
        fig.className = 'reel';

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

      // Second pass: measure once, then drop a player into every shell.
      var width = Math.max(220, Math.min(Math.round(shells[0].clientWidth) || 320, 480));
      shells.forEach(function (shell, i) {
        shell.appendChild(buildReel(reels[i].url, width));
      });
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
        reelMessage('Reels are not loading right now -- you can watch them on our Facebook page.');
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
