Status: ready-for-agent

# Mobile layout: bottom tab bar and touch polish

## Problem Statement

Alcove's audience is high-school and young musicians, who mostly browse on phones. The four pages (Home, Work, About, Contact) already fit a 375px screen with no horizontal overflow, but they still behave like a desktop site on a phone. Navigation sits at the top, out of thumb reach. Nav links are about 32px tall, the carousel dots are 10-12px, and the Themes button is 37px, all below the roughly 44px touch minimum. Nothing accounts for the iPhone home indicator or sets a browser theme colour. The home carousel cannot be swiped.

## Solution

On phones (below about 640px) the site gets a thumb-friendly layout:
- A fixed bottom tab bar with Home, Work, About and Contact replaces the top nav.
- The header shrinks to a slim logo-only bar.
- The Home hero's centered nav is hidden, since the bottom bar replaces it.
- Every interactive element has a hit area of about 44px.
- Fixed UI clears the phone's safe areas.
- The home carousel responds to left/right swipes.

Tablet and desktop layouts are unchanged.

## User Stories

1. As a teen musician on a phone, I want the main navigation at the bottom of the screen, so that I can reach it with my thumb.
2. As a first-time visitor, I want to see Home, Work, About and Contact labelled in plain text, so that I know where to go without guessing icons.
3. As a visitor, I want the current page highlighted in the bottom bar, so that I know where I am.
4. As a visitor, I want the bottom bar to stay visible while I scroll, so that I can switch pages at any time.
5. As an iPhone user, I want the bottom bar to sit above the home indicator, so that I don't trigger the system gesture by accident.
6. As a visitor in landscape on a notched phone, I want the header and bar to respect the side insets, so that nothing is hidden behind the notch.
7. As a visitor, I want a slim header with just the Alcove logo, so that content gets most of the screen.
8. As a visitor on Home, I want the hero to show the wordmark and tagline without a duplicate nav, so that the page feels clean and the bar is the single way to navigate.
9. As a visitor, I want the last lines of every page to be reachable above the bottom bar, so that the footer and the Book a Session button aren't covered.
10. As a visitor, I want Book a Session to remain a clear button in the page content, so that I can start booking without hunting for it.
11. As a visitor, I want tapping any nav link, carousel dot or button to work on the first try, so that I'm not frustrated by tiny targets.
12. As a visitor, I want the tap areas to grow without the design looking boxed or heavier, so that the studio-minimal look stays intact.
13. As a visitor, I want to swipe the home carousel left and right, so that I can browse studio photos the way I do on every other phone site.
14. As a visitor, I want the carousel chevrons and dots to keep working, so that I have more than one way to move between slides.
15. As a visitor, I want vertical page scrolling to keep working when I touch the carousel, so that swiping doesn't trap me.
16. As a visitor who prefers reduced motion, I want the carousel and view transitions to stay calm on mobile, so that I'm not made uncomfortable.
17. As a visitor, I want the browser's address bar colour to match the site, so that the page feels like one piece.
18. As a visitor, I want pages to never scroll sideways, so that the site feels solid.
19. As a visitor, I want the contact and booking form to be easy to fill with my thumbs, so that booking doesn't feel intimidating.
20. As a visitor, I want the audio player and genre filter on Work to be easy to tap, so that I can listen to tracks on my phone.
21. As Seth Miller reviewing on his phone, I want the Themes toolbar to stay available, so that I can preview palettes and fonts on a real device.
22. As Seth reviewing on his phone, I want the Themes button to float above the bottom bar, so that it never covers or hides navigation.
23. As Seth, I want tablet and desktop layouts to look exactly as they do today, so that earlier review feedback still holds.
24. As Seth, I want the placeholder copy and wireframe-phase scope left alone, so that review stays focused on layout.
25. As the developer, I want the changes to use the existing design tokens and shared stylesheet, so that the style guide stays the single source of truth.
26. As the developer, I want each edit to stay small and the site to stay build-free, so that review is easy and hosting stays simple.

## Implementation Decisions

- **Breakpoint:** the mobile layout applies below about 640px. The existing 540px and 768px rules stay as they are unless they conflict.
- **Bottom tab bar:**
  - It is the existing nav, restyled by CSS at the phone breakpoint, not a second nav added to the markup.
  - It is fixed to the bottom.
  - Items are text labels only, spread evenly.
  - A hairline top border separates it from content.
  - The active page shows a top-border indicator.
  - No pills, badges, fills or icons, per the unboxed style in the style guide.
  - Constant font weight and pre-allocated transparent borders are kept to avoid hover layout shift.
- **Header:** the slim header keeps the logo at the left and drops the nav. It stays sticky.
- **Home hero nav:** the centered hero nav is hidden on phones.
- **Book a Session:** it is not part of the bar and stays as a content button.
- **Content clearance:** page content gets bottom padding equal to the bar height plus the safe-area inset, so the footer and last actions are never covered.
- **Safe areas:** the viewport meta on all four pages gains the cover fit. The bar, header and Themes button use the environment safe-area insets for padding and offsets.
- **Theme colour:** all four pages get a theme-color meta tag matching the page background token.
- **Tap targets:** nav links, carousel dots and the Themes button get hit areas of about 44px using invisible padding or pseudo-element extension, with no visible change. Existing colours and spacing use design tokens only; no new hard-coded hex values.
- **Themes toolbar:** it stays visible on phones. Its tap size is fixed, and its floating position sits above the bottom bar plus the safe-area inset.
- **Carousel swipe:**
  - A small touch handler on the home page, about 20 lines, moves to the previous or next slide on a horizontal swipe past a distance threshold.
  - It hooks into the existing slide-change behaviour rather than duplicating it.
  - Vertical scrolling must stay native, so the carousel area keeps vertical panning enabled.
  - Chevrons, dots, keyboard arrows and the scroll-dwell behaviour are unchanged.
  - Reduced motion is honoured.
  - This adds client JS during a phase whose rules discourage it; it was explicitly approved for this spec.
- **Pages touched:** all four pages (meta tags), the shared stylesheet, the theme toolbar stylesheet, and the home page script.
- **Edit size:** each edit is at most 150 lines.

## Testing Decisions

- **Single seam:** the rendered pages in a real browser. A good test checks only what a visitor can observe, not implementation details.
- **Widths:** 375px (phone), 768px (tablet) and desktop.
- **Checks per page:**
  - No horizontal overflow.
  - Bottom bar visible and fixed at phone width; absent at tablet and desktop.
  - Active page indicated.
  - Last content not covered by the bar.
  - Interactive elements (nav links, carousel dots, Themes button, form controls) have at least a 44px hit area at phone width.
  - Zero console errors.
  - The Themes button does not overlap the bar.
- **Carousel:** simulated horizontal swipe changes the slide; vertical scroll still scrolls the page.
- **Visual confirmation:** screenshots at each width are presented.
- **Prior art:** none; the repo has no test suite and no build. A real-device check is left to the client or developer.

## Out of Scope

- Redesigning tablet or desktop layouts.
- New pages, content or copy changes.
- Icons for the bottom bar.
- Hiding the Themes toolbar on phones.
- Booking submission backend and the visual aesthetic decision.
- A scripted or automated test suite.
- PWA features, offline support and native app behaviour.

## Further Notes

- The site was copied from the Downloads working repo into this folder; the Downloads git repo is untouched and changes must be reconciled by the developer.
- The audit at 375px showed no horizontal overflow on any page, so this is polish and a layout change, not a rescue.
- `AGENTS.md` requires an explicit "Approved" or "Proceed" before any HTML, CSS or JS edits; this spec does not grant that.
- The unboxed style, design tokens and fluid typography in the style guide apply to everything above.
