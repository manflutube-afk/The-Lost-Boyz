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
