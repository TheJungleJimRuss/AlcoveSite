# 02: Drag the tonearm to seek

**What to build:** The Tonearm becomes a `role="slider"` (0 to duration, `aria-valuetext` like "1:12 of 2:45"). Dragging it across the record moves the needle along the groove band (outer edge = 0:00, inner = end) and seeks on release while audio keeps playing; arrow keys step 5s, Home/End jump. Disabled until a record is loaded. The timeline below the turntable becomes a real slider too, kept in sync with the arm.

**Blocked by:** 01

**Status:** resolved

- [x] Pointer drag on the arm (mouse and touch) changes `currentTime` proportionally to the groove position
- [x] Arrow keys step 5s, Home/End jump; `aria-valuenow`/`aria-valuetext` update
- [x] Arm is disabled/inert before a record is loaded
- [x] Timeline slider seeks and stays in sync with the arm
- [x] Tests for pointer and keyboard seek added to `tests/record-player-check.mjs`; `npm run check` passes
