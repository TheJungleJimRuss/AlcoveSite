# Admin mode: token setup

Admin mode lets Seth edit the site's wording and default look in the browser. It needs a GitHub account with access to the repo, and a token that proves it.

## 1. Create the token (once)

1. Sign in to GitHub as the account that should save changes.
2. Go to Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens -> Generate new token.
3. Name it "Alcove admin" and pick an expiry (90 days is fine; make a new one when it runs out).
4. Under Repository access choose Only select repositories, then `TheJungleJimRuss/AlcoveSite`. Nothing else.
5. Under Repository permissions set Contents to Read and write. Leave everything else as it is.
6. Generate, then copy the token (it starts with `github_pat_`). GitHub shows it once.

## 2. Unlock Admin mode

Open any page of the site with `?admin` on the end, for example `https://.../index.html?admin`. Paste the token and press Unlock. The token stays on that device, so you only paste it once. The Admin panel (bottom left) has an Edit mode switch, off on every new visit. While it is off the site works normally. Switch it on and any text turns outlined: headings, paragraphs, captions, nav labels, the footer, button labels (Play Preview, Start Your Project), and the A/B deck wording. Click the text to edit it (clicking a button or tab edits its words instead of running it), press Esc or click away to keep the change. The booking form, email address and times are not editable. On the Work page, a Songs list under the record player lets you rename, reorder (Move up / Move down), remove and add songs (up to 20; an added song needs a title and an MP3, M4A, WAV, OGG or WebM file). Open the panel to change the Site Defaults.

## 3. Save and publish

- Save sends your changes to a branch called `content` (created from main the first time).
- Pages deploys from the `content` branch, so a Save goes live in a minute or two once Pages redeploys (no merge needed). After a Save, replaced or removed media files are deleted from the branch when nothing else uses them.
- If Save says the branch changed, reload; your edits are kept and re-applied.

## Photos, video, audio and songs

You can change the pictures, the session video and the songs yourself. Turn Edit mode on first (the switch in the Admin panel).

- **Replace a photo, the video or a clip.** With Edit mode on, each photo, the session video and its poster, and the voice memo and finished master clips show a Replace button. Pick a file from your phone or computer. Big photos are shrunk for you. You see the new picture or hear the new clip in place straight away, before anything is saved. Changed your mind? Press Revert next to that item in the Admin panel before you Save.
- **Songs.** Under the record player on the Work page there is a Songs list. Rename a song by typing in its title box. Use Move up and Move down to change the order, and Remove to take a song off. To add one, type a title, choose an MP3, M4A, WAV, OGG or WebM audio file and press Add. The most you can have is 20 songs.
- **Size limit.** Each file can be up to 90 MB, but very big files may fail to upload, especially on a phone connection. Keep files small where you can: a few MB for a photo, and a short MP3 or M4A for a song. If an upload fails, the message names the file; try a smaller one.
- **Nothing is final until you press Save.** Your picked files are kept in the browser if you reload by accident, and the page warns you before you leave with unsaved changes.
- **Going live.** After Save, the new photos and songs appear on the live site in a minute or two. If you do not see them, wait a little and refresh.
- **Old files.** When you replace or remove a file, the old one is deleted from the site automatically, as long as nothing else uses it.

## Staying safe

- Sign out (in the Admin panel) on any shared computer. It forgets the token and discards unsaved changes.
- If the token leaks, delete it under the same GitHub settings page; it stops working at once.
- Saving fails with "not allowed" if the token lacks Contents read/write or belongs to another repo, and also if GitHub is rate-limiting; wait a little and retry.
