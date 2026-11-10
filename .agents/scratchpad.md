# Scratchpad Debugger: Parallax Effect Perception & Resolution

## Problem Statement
The user clarified: "This isn't what I want. I just want the image to scroll at a different speed than the rest of the site."

## Root Cause Analysis
1. `CSS.supports('animation-timeline', 'view()')` evaluated to `true` in Chromium, which disabled the fallback JavaScript scroll handler.
2. The CSS `@supports (animation-timeline: view())` rule failed to animate the absolute `.parallax-media` child because its ancestor (`.parallax-viewport`) had `overflow: hidden`, causing `getComputedStyle(media).transform` to evaluate to `matrix(1, 0, 0, 1, 0, 0)` (static) across all scroll positions.
3. Neither CSS nor JS was moving the image, producing zero parallax.

## Resolution
1. Removed the broken `@supports (animation-timeline: view())` CSS animation.
2. Implemented a robust, cross-browser `requestAnimationFrame` speed differential parallax in `index.html`:
   - Computes viewport-relative distance: `distanceFromCenter = sectionCenter - viewportCenter`.
   - Applies continuous speed differential translation: `offset = -distanceFromCenter * 0.40`.
   - Result: image glides smoothly at 60% of document scroll speed (depth parallax) without any pinning, scroll-locking, or gaps.
3. Verified via headless Chrome CDP:
   - Scroll Y 300: `translate3d(0px, -205.2px, 0px)`
   - Scroll Y 600: `translate3d(0px, -85.2px, 0px)`
   - Scroll Y 850 (centered): `translate3d(0px, 14.8px, 0px)`
   - Scroll Y 1100: `translate3d(0px, 114.8px, 0px)`
   - Scroll Y 1350: `translate3d(0px, 214.8px, 0px)`
   - Scroll Y 1600: `translate3d(0px, 314.8px, 0px)`
