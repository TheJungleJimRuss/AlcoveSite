# 04: Scroll bar fader (all screen sizes)

**What to build:** A console-style fader follows page scroll and can be dragged, on every screen size.

**Blocked by:** 01

**Status:** done

- [x] Fader mirrors scroll position and dragging it scrolls the page
- [x] Keyboard operable (arrows, Page Up/Down, Home, End) with slider semantics
- [x] Mobile: slim right-edge fader, ~44px target, hides when idle, avoids tab bar and safe areas; native touch scroll unaffected
- [x] Respects prefers-reduced-motion; native scrollbar fallback without JS
- [x] Browser check covers drag, keys and mobile
