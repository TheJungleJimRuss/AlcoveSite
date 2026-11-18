# 08 Textures, top-down view, standalone player, tape and seated reels

Status: resolved
Blocked by: none (follows 07)

User requests: "Add textures to make it look nicer and more realistic. Render from top down and remove the player around it. It should be standalone on the site." Then: "Connect the spools with tape." and "The spools are also just floating."

## Answer

Status: resolved (2026-11-16).

- Textures (procedural, numpy, baked into `models/cassette-player.glb`, now about 540 KB, about 9.4k triangles; sources `assets-src/cassette-player/tex/`, `LICENSES.md`): brushed anodised shell (colour + normal, streaks along X), fine rubber grain normal on base, keys, feet and the cassette shell, tape-pack winding (rings, colour + normal), 18 speaker slots are now real cuts through the shell with the dark base showing at the bottom, per-face box UVs. Runtime canvas art: door-frame silkscreen text, L/R marks, label paper grain (seeded), door glass with scratches and a diagonal sheen, soft pools under the keys. A small procedural environment (PMREM, three soft boxes) lets the shell read as metal.
- Satin, not gloss: ADR 0001's "metalness 0, roughness 0.7" is relaxed only for the shell (metalness 0.7, roughness >= 0.45). Everything else stays rough dielectric. Recorded in ADR 0007's amendment.
- Top down: perspective camera with a 14 degree field of view straight above the deck (screen up = back of the deck), so it reads as a plan-view photo with slight parallax. Flip adapted: door opens 90 degrees (a flap behind the deck), the cassette rises toward the camera (grows with perspective, its shadow slides away on the ground), rolls over about its front-back axis like a page and drops back.
- Standalone: the dark panel, frame, padding, inset well and reserved space are gone (`.cassette-deck`, `.cassette-stage` have no background/border/padding; stage is `aspect-ratio: 16 / 13.5`). The canvas is transparent; a shadow-map catcher plus a baked blurred contact shadow (fades to 0 at its edges) put the player on the page's brushed-metal surface. Counter, lamps, icon keys, hint and J-card stay as plain page elements beneath. SVG fallback redrawn top-down and standalone with a blurred SVG shadow.
- Tape: a ribbon (three thin boxes, `tape` group under the cassette node, dark brown, roughness 0.42 for a slight sheen) runs from each pack's tangent to its guide post and across the front opening. `cassette-3d.js` recomputes the tangent points from the pack radii on every state change, so it stays attached as the packs grow and shrink and it rides along during the flip. The SVG fallback draws the same line (`#cs-tape`, updated in `ab-compare.js`). The cassette has a front notch in its label face so the tape and the player's head and rollers are visible from above.
- Seated reels (nothing floats): the cassette shell now has an inner back wall with hub holes, hub flanges and front rims, slip sheets around each hub, guide posts; the player's spindles rise from the deck plate through the back-wall holes into the hubs, with dark collars on the deck plate; the bay floor is recessed to the front wall; the cassette was moved forward so the head and pinch rollers meet the tape line. Contact shadows come from a 2048 px soft shadow map (key light from the back left) and the baked pools under the keys and under the player. Checked top-down and mid-flip (`08-topdown-1100.png`, `08-topdown-flip-midair-1100.png`).
- Tests: `tests/ab-check.mjs` adds no panel/frame/padding, tape built (3 segments), tape tangent distance equals the pack radius at progress 0 and 1, SVG tape path. All suites pass; texture-check keeps only its 3 known failures. Screenshots in `screenshots/08-*`.
- Open: not measured on a real phone; software GL in headless only.
