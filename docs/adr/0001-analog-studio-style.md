# 0001: Move from minimalist "unboxed" to analog studio style

Status: accepted (2026-11-11)

Seth Miller's updated brief asks for a colorful, skeuomorphic, grainy, textured site with a scroll bar fader, aimed at teens and mobile. This contradicts the earlier minimalist "unboxed" rules (no pills, fill boxes or shadows).

**Decision:** replace the minimalist direction with a stylized analog studio look (equal mix of recording gear and printed ephemera), CSS and SVG only, using Seth's two palettes in light and dark. Spec: `.agents/issues/analog-studio-style/spec.md`.

**Consequences:** STYLE_GUIDE.md sections on pills, fill boxes and shadows are rewritten. Guardrails remain: AA contrast, reduced-motion, reduced-transparency, no inline styles, no horizontal overflow, lightweight textures.
