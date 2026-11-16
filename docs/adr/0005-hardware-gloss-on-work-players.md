# 0005: Allow real-hardware gloss on the Work page players

Status: accepted (2026-11-13)

ADR 0001 set a matte skeuomorphic look (no glossy or gradient keys). The user asked for the Work page players to look like real hardware.

**Decision:** the two `.audio-widget` decks (sampler and A/B) may use brushed-metal gradients, bevels, screws, a glass VFD window with a reflection, glowing readouts and spinning reels. Gloss stays scoped to `.audio-widget`; the rest of the site stays matte. Reels stop under `prefers-reduced-motion`; decoration is hidden under forced colors.

**Consequences:** the "NO glossy/gradient keys" note in the project notes applies everywhere except these players. Seth has not reviewed it.
