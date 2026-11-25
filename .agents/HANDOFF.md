# Handoff: iPhone 15 / iOS 26 Safari phone fixes, round 2 (2026-11-24)

Project context: `.agents/PROJECT_NOTES.md` (the Status lines dated 2026-11-24 cover the earlier work). This folder is NOT a git repo, so there is no diff; changed files are listed below. The user tests on a real iPhone 15 (iOS 26, Safari) via the Mac's LAN dev server at http://192.168.50.46:8790/ (launch config `alcove-site-alt`, port 8790). github.io is NOT updated from this folder. NOTHING below is verified on the device.

## Where things stand

### 1. Fader touch drag (`fader.js`, now `?v=10`)
History of user reports:
- First: "Scroll fader just doesn't work."
- After the touch drag landed: "The scroll issue is back."
- User's theory: when you pull the fader cap down, the page also scrolls natively the opposite way, and the two fight.

Current design:
- Only the visible cap takes touches. CSS sets `@media (pointer: coarse)`: `.fader` has `pointer-events: none`, and the cap gets `pointer-events: auto` only when it is neither idle nor away.
- The cap moves by relative per-touchmove deltas. Any step over 90px is dropped.
- Scrolling is applied once per rAF.

Added this turn, to address the user's theory. Not yet confirmed on the device; it may or may not be the real cause:
- If `touchstart` is not cancelable, the fader ignores the touch. That happens when Safari already owns the gesture as a page scroll.
- If a `touchmove` is not cancelable, the drag aborts (`abortTouch`).
- In the rAF, if `scrollY` is more than 4px away from the last value we set (`lastSet`), something else scrolled the page and the drag aborts.

Tests:
- `tests/fader-check.mjs` has a CDP touch-drag test (scrolls down, never backwards, no throw to the end).
- It also has a synthetic-TouchEvent test: a non-cancelable `touchmove` makes the fader let go.
- Note: a test that calls `scrollTo` mid-drag doesn't work in Chromium. The touch gesture restores the scroll position, so that path is only covered by the cancelable test.

If the jump persists on the device, consider:
- Re-adding an on-screen scroll log (the old `scroll-debug.js` was deleted; see the PROJECT_NOTES history).
- Locking native scroll during a drag.
- Making the phone fader display-only again. That was the user's complaint earlier, so ask first.

### 2. Hero photo edge to edge on Home: camera cut-out to home indicator (`wireframe.css`, end-of-file phone block)
The user asked twice: "the image doesn't reach far enough", then "should fill all the way from the mic to the camera cutout".

Done while the hero fills the screen (`.site-header--smart:not(.site-header--visible)`):
- The tab bar is hidden.
- `html::after` (film grain) and `body::after` (fixed sheen) are `visibility: hidden` after a 0.45s delay.
- `.fader.is-away` is `visibility: hidden`.
- The phone scrim's fade to page colour starts at 92%, not 60%. This is the `.hero-media::after` override at the end of the file.

Background from Ben Frain's Safari 26 article (see References):
- Safari 26 tints the screen edges from the page background colour when no fixed layer sits there.
- It uses a fixed element's background colour when one does sit there.

Last edit (WRITTEN, but tests not re-run after it):
- `:root:has(.site-header--smart:not(.site-header--visible)) { background-color: rgb(28 14 8); }` sets the photo scrim's dark brown on the root while the hero shows. Any tint then blends into the photo instead of drawing a cream band.
- `body` has no background of its own; `html` supplies it. On phones that is `--bg-surface` (~line 914).
- A fully transparent root was tried and dropped, because Safari might fall back to white.
- Unknown: whether Safari draws the photo itself under the status bar or a solid tint. Ask the user for a screenshot.

### 3. Navbar "suddenly disappears when you scroll back up" (user's answer: only back at the top of Home)
- Cause, guessed: the bar slid down off-screen, and Safari 26 stops drawing fixed elements that move under its bottom controls.
- Now the hidden state fades out in place: `opacity 0`, `translateY(1.5rem)`, 0.45s ease-in, then `visibility: hidden`. Arriving slides up and fades in.
- In `index.html`, phones show the bar past 8px and hide it only at `scrollY <= 1`. The gap stops momentum flicker near the top.
- Headless check passed: opacity is 0.87 at 150ms and the bar is hidden at 650ms.

## Next steps
1. Run the checks after the last edit:
   - `node tests/fader-check.mjs`
   - `node tests/browser-check.mjs`
   - `node tests/contrast-check.mjs`

   All three passed just before the dark-root edit.
2. Ask the user to reload http://192.168.50.46:8790/ on the iPhone and report on:
   - the fader jump,
   - the photo at the edges (ask for a screenshot),
   - the bar fade at the top.
3. Update `.agents/PROJECT_NOTES.md` Status with items 2 and 3 (item 1 is partly there: the touch drag line, but not the cancelable/abort guard).
4. Cache-bust strings in all 4 pages: `wireframe.css?v=edge5`, `textures.css?v=ios26`, `fader.js?v=10`. Bump them after any edit.

## Gotchas
- The in-app browser pane throttles rAF and transitions when in the background (1 frame per 500ms), so transitions look frozen there. Check animation timing with headless Playwright scripts placed in `tests/`; `playwright` only resolves from inside the project.
- `.site-header--smart` exists only on Home, so the edge and fade rules affect Home only.

## References
- Safari 26 tinting: https://benfrain.com/ios26-safari-theme-color-tab-tinting-with-fixed-position-elements/ (WebKit bug 300965, possibly fixed in iOS 26.2)
- Fixed elements not drawn under iOS 26 controls: https://developer.apple.com/forums/thread/800798

## Suggested skills
- `diagnosing-bugs`: if the fader jump persists (build an on-device log before guessing again).
- `web-runtime-verification`: after layout changes (375/768/1200).
- `modern-web-guidance`: before more viewport, safe-area or scroll CSS.
