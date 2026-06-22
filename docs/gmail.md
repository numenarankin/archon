# Connecting Google Workspace (Gmail) to the Email page

The Email page works out of the box with sample data. To make it read and send
your **real** Google Workspace mail, give the app OAuth access to your mailbox.

Reading and sending email is **not** a simple API key — Google requires OAuth.
The one-time setup below produces a long-lived **refresh token** that the app
exchanges for short-lived access tokens on every request. No extra npm packages
are needed; the client (`src/lib/email/gmail.ts`) talks to the Gmail REST API
directly.

## What you'll end up with

Four values in `wildcat-superapp/.env.local`:

```bash
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=1//0g...
GOOGLE_USER_EMAIL=you@yourcompany.com
```

Once all three of the first values are present, `hasGmail()` flips to true and
the page switches from sample data to your live inbox automatically. Restart
`npm run dev` after editing `.env.local`.

## Step 1 — Create a Google Cloud project & enable the Gmail API

1. Go to <https://console.cloud.google.com/> and create a project (or pick one).
2. **APIs & Services → Library**, search "Gmail API", click **Enable**.

## Step 2 — Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **Internal** (recommended for Google Workspace — only your org's
   users, no Google verification needed). Choose **External** only if this is a
   personal `@gmail.com` account; then add yourself as a **Test user**.
3. Add these **scopes**:
   - `https://www.googleapis.com/auth/gmail.readonly` (read mail)
   - `https://www.googleapis.com/auth/gmail.send` (send mail)
   - `https://www.googleapis.com/auth/calendar` (read + write Calendar — the
     Calendar page uses the same credentials)
   - Or use `https://mail.google.com/` for full Gmail access if you'll add more
     mail actions later (archive, delete, mark read).

## Step 3 — Create OAuth client credentials

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Under **Authorized redirect URIs**, add:
   `https://developers.google.com/oauthplayground`
4. Save. Copy the **Client ID** and **Client secret** into `.env.local` as
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## Step 4 — Mint a refresh token (OAuth Playground)

1. Open <https://developers.google.com/oauthplayground>.
2. Click the gear icon (top right) → check **Use your own OAuth credentials**,
   and paste your Client ID and Client secret.
3. In the left "Select & authorize APIs" box, paste these scopes (one per line
   or space-separated):
   ```
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/calendar
   ```
4. Click **Authorize APIs**, sign in with the mailbox account, and grant access.
5. Click **Exchange authorization code for tokens**.
6. Copy the **Refresh token** into `.env.local` as `GOOGLE_REFRESH_TOKEN`.
7. Set `GOOGLE_USER_EMAIL` to the address you just authorized.

That's it. Reload the Email page and the amber "sample data" banner disappears.

## Alternative: service account with domain-wide delegation

If you're a Workspace **admin** and want the app to access mailboxes without an
interactive consent step (e.g. a shared `ops@` inbox or several users), use a
service account with domain-wide delegation instead:

1. Create a **service account** in Google Cloud and enable domain-wide
   delegation; download its JSON key.
2. In the Google **Admin console → Security → API controls → Domain-wide
   delegation**, authorize the service account's client ID for the same two
   Gmail scopes.
3. The service account then mints access tokens that **impersonate** a chosen
   user (`subject = the mailbox address`).

This avoids refresh tokens but requires admin rights and a small change to
`getAccessToken()` in `src/lib/email/gmail.ts` to sign a JWT assertion. The
refresh-token flow above is simpler for a single user, so start there.

## Security notes

- These secrets are read **server-side only** (`src/lib/email/gmail.ts` is
  marked `server-only`) and never reach the browser.
- Keep `.env.local` out of git (it already is via `.gitignore`).
- Limit scopes to what you use. `gmail.readonly` + `gmail.send` is enough for
  the current Email page; only broaden to `https://mail.google.com/` when you
  add archive/delete/label actions.
- If a token leaks, revoke it at <https://myaccount.google.com/permissions> and
  mint a new one.

## How it's wired in code

- `src/lib/email/gmail.ts` — Gmail REST client: token refresh, list+map
  messages, send. Gated by `hasGmail()`.
- `src/lib/email/mailbox.ts` — `getMailbox()` returns live Gmail data when
  configured, otherwise the mock sample set.
- `src/lib/email/actions.ts` — the `sendMessage` server action used by the
  composer (delivers via Gmail when configured, simulates otherwise).
