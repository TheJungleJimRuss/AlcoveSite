# 03: Record motion

**What to build:** The Record player moves like the real thing: choosing a Sleeve slides the record out and onto the platter, then the arm swings in; the record spins while playing (33 rpm feel); pause lifts the arm and the platter eases to a stop; swapping records returns the old one first. Under `prefers-reduced-motion` nothing spins, slides or swings (states jump). Under forced colors, decoration drops away and controls stay visible.

**Blocked by:** 01

**Status:** resolved

- [x] Slide-out, arm swing, spin and ease-to-stop animations
- [x] Rapid clicks between Sleeves never leave the player in a mixed state
- [x] Reduced motion: no running animations (tested)
- [x] Forced colors: controls visible, decoration hidden
- [x] `npm run check` passes
