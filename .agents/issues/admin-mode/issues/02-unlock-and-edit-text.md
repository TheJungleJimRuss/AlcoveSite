# 02: Unlock Admin mode and edit text in place

**What to build:** An editor pastes a GitHub token to unlock Admin mode (entry via `?admin`), clicks marked Site Content to edit plain text in place, sees what changed, can revert one item, and can sign out. Drafts survive reload and a leave-page warning shows while dirty. Admin code loads only when unlocked.

**Blocked by:** 01: Content loader

**Status:** done

- [ ] No admin UI or admin code without a token
- [ ] Token stored only in localStorage; sign-out removes it and the drafts' admin state
- [ ] Editable text is visibly marked; edits are plain text, structure and heading levels unchanged
- [ ] Changed items are listed with per-item revert
- [ ] Draft persists across reload and clears on successful save (ticket 03); beforeunload warning when dirty
- [ ] Works at phone width
- [ ] admin-check extended
