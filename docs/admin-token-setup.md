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

Open any page of the site with `?admin` on the end, for example `https://.../index.html?admin`. Paste the token and press Unlock. The token stays on that device, so you only paste it once. Click any outlined text to edit it; open the Admin panel (bottom left) to change the Site Defaults.

## 3. Save and publish

- Save sends your changes to a branch called `content` (created from main the first time). It does not change the live site.
- To publish, the developer merges `content` into `main`. GitHub Pages republishes within a minute or two.
- If Save says the branch changed, reload; your edits are kept and re-applied.

## Staying safe

- Sign out (in the Admin panel) on any shared computer. It forgets the token and discards unsaved changes.
- If the token leaks, delete it under the same GitHub settings page; it stops working at once.
- Saving fails with "not allowed" if the token lacks Contents read/write or belongs to another repo, and also if GitHub is rate-limiting; wait a little and retry.
