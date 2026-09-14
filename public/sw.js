/*
 * A service worker that does nothing at all, on purpose.
 *
 * Why it exists
 * -------------
 * Chrome will not offer to install a site to the home screen unless one of
 * these is registered with a fetch handler. That is the whole reason this file
 * is here: without it the "Add to home screen" bar can only tell an Android
 * visitor where to find the menu item, and with it the button sets off Chrome's
 * own one-tap install dialog.
 *
 * Why it caches nothing
 * ---------------------
 * Because caching is exactly what this site does not need another of.
 *
 * The custom domain already tells browsers to hold the stylesheet and the
 * script for four hours, which has broken this site twice -- the countdown
 * vanished once and the sponsor cards stayed unclickable on a phone -- and is
 * the reason `npm run stamp` exists at all. A service worker that kept its own
 * copy of anything would add a third layer of staleness, one that outlives a
 * hard refresh and has to be reasoned about on every deploy.
 *
 * So the fetch handler below is empty. An empty listener is enough to satisfy
 * the install criteria, and because it never calls respondWith(), every request
 * goes to the network exactly as it would if this file did not exist. Nothing
 * is stored, nothing goes stale, and there is no offline mode -- which is
 * honest, because a site whose whole job is telling you tonight's gig is still
 * on would be worse than useless serving yesterday's answer from a cache.
 *
 * Taking over straight away
 * -------------------------
 * skipWaiting and clients.claim mean a new version replaces the old one
 * immediately rather than waiting for every tab to close. With nothing cached
 * there is no reason to be careful about the handover.
 *
 * If this ever needs to go
 * ------------------------
 * Deleting the file is not enough -- a registered worker stays registered on
 * everybody's phone. Replace the body of this file with:
 *
 *   self.addEventListener('install', () => self.skipWaiting());
 *   self.addEventListener('activate', (e) => e.waitUntil(
 *     self.registration.unregister().then(() => self.clients.claim())
 *   ));
 *
 * leave it deployed for a few weeks so everybody picks it up, and then remove
 * the registration from app.js.
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/*
 * Deliberately empty. Its presence is what counts; calling respondWith() is
 * what would start intercepting traffic, and that is not wanted here.
 */
self.addEventListener('fetch', () => {});
