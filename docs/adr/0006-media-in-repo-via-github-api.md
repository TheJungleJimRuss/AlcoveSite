# 0006: Admin media: photos, video and audio are stored in the repo and uploaded through the GitHub API

Status: accepted (2026-11-13); spec `.agents/issues/admin-media/spec.md` approved by the user

Seth wants to change photos, videos and audio, and manage the Work song list, without the developer. The site is static on GitHub Pages with no server of ours, and Admin mode (ADR 0004) already saves text to the repo with a token.

**Decision:** Media files go into the repo like everything else. Save uploads new files, then the content file, to the Content branch through the GitHub contents API, and deletes replaced or removed files once nothing references them. Pages deploys from the Content branch, so a Save goes live when Pages redeploys. Photos are shrunk in the browser; audio and video are uploaded as chosen, up to a single size cap (about 90 MB, tunable). The song list moves into the content file and is rendered by script, with the authored HTML as fallback.

- **Repo storage vs external hosting** (YouTube, SoundCloud, Drive, a storage bucket): we rejected external hosting. It adds a second place content lives, a second account for Seth, embeds that change the site's look, and no versioning. In-repo media is free, versioned and served by Pages. Cost: the repo grows with every upload (soft limit about 1 GB), git history keeps deleted files, large uploads are slow and may fail on mobile, and deploys get heavier.
- **Content file written last**, after every media file, so the live page never points at a missing file; a failed upload stops the Save.
- **Deleting replaced files** keeps the repo small, but only when no other slot or song uses the file; history still holds the old copy.
- **Size cap** is a guess against GitHub's limit (100 MB per file, and base64 inflates the request about a third), so it must be verified with a real upload and lowered, or the Git Data API used, if rejected.
- **Publishing**: because Pages deploys from the Content branch, Admin saves are live without a merge. This replaces ADR 0004's "developer merges to publish" step in practice; the review gate is gone unless Pages is pointed back at main.

**Consequences:** the token's Contents write scope now also allows large binary commits; the same mitigations as ADR 0004 apply. The genre filter on Work is retired because songs carry only a title and a file.
