# Håfa Code domain cutover

Håfa Code's canonical public address is `https://code.shimizu-technology.com`.
The original `https://hafa-code.netlify.app` address remains available as a
recovery path for browser-local work. The private code-server installation that
previously used `code.shimizu-technology.com` now uses
`https://ide.shimizu-technology.com`.

## Why the old Netlify address stays online

Browser storage belongs to an origin. Projects, checkpoints, Practice Lab
progress, and preferences saved at `hafa-code.netlify.app` do not automatically
appear at `code.shimizu-technology.com`. The app therefore provides a complete,
versioned workspace backup:

1. Open the old Netlify address and choose **Workspace backup**.
2. Download the complete backup.
3. Open `code.shimizu-technology.com`, choose **Workspace backup**, and restore
   the file.

Restore merges matching records and preserves work already present in the new
origin. Cloud projects still load from the signed-in account.

## Production configuration

- Netlify serves the web app and owns the custom domain.
- Cloudflare DNS points `code` to the Netlify site and routes `ide` through the
  private code-server tunnel.
- Render uses `FRONTEND_URL=https://code.shimizu-technology.com` so generated
  links use the canonical host.
- Render's `ALLOWED_ORIGINS` includes both the canonical host and the Netlify
  recovery host during the migration period.
- Clerk must allow the canonical host before signed-in production QA.

After any domain change, verify the canonical metadata, TLS, sign-in, API CORS,
project sync, every in-browser language runner, and desktop/mobile layouts.
