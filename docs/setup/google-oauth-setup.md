# Google OAuth setup — 5-minute guide

The "Sign in with Google" button on `/login` and `/signup` is already
wired in the code (`src/features/auth/components/GoogleSignInButton.tsx`)
and the callback handler is at `src/app/auth/callback/route.ts`.

To make it actually work end-to-end, three pieces of config need to
exist outside the code:

1. A **Google Cloud OAuth 2.0 Client** (client ID + secret)
2. **Supabase Google provider** enabled with the client ID + secret pasted in
3. **Allowed redirect URLs** registered in both Google + Supabase

---

## Step 1 — Google Cloud OAuth client (3 min)

Open https://console.cloud.google.com/

1. Top-left project dropdown → **New Project** → name it `Quiksheets` →
   Create. Wait for the project to provision, then select it.
2. Left nav → **APIs & Services** → **OAuth consent screen**
   - User Type: **External** → Create
   - App name: `Quiksheets`
   - User support email: your email
   - Developer contact email: your email
   - Skip "Scopes" and "Test users" pages → Save and Continue
3. Left nav → **APIs & Services** → **Credentials** → **Create
   Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Quiksheets Web`
   - **Authorized JavaScript origins:**
     ```
     https://quiksheets-v2.vercel.app
     http://localhost:3000
     ```
   - **Authorized redirect URIs:**
     ```
     https://anfvgmlgsthhdhwncxzt.supabase.co/auth/v1/callback
     ```
     (This is the Supabase project's OAuth callback — Supabase forwards
     to our `/auth/callback` after exchange.)
   - Click **Create**
4. A modal pops up with **Client ID** and **Client secret**. Copy both —
   you'll paste them into Supabase next.

---

## Step 2 — Supabase provider (1 min)

Open https://supabase.com/dashboard/project/anfvgmlgsthhdhwncxzt/auth/providers

1. Find **Google** in the list → click to expand
2. Toggle **Enable Sign in with Google** to ON
3. Paste the **Client ID** from Google
4. Paste the **Client Secret** from Google
5. Click **Save**

---

## Step 3 — Supabase redirect URLs (30 sec)

Open https://supabase.com/dashboard/project/anfvgmlgsthhdhwncxzt/auth/url-configuration

1. **Site URL**: `https://quiksheets-v2.vercel.app`
2. **Redirect URLs** (add these one per line):
   ```
   https://quiksheets-v2.vercel.app/auth/callback
   http://localhost:3000/auth/callback
   ```
3. Click **Save**

---

## Test it

1. Open **https://quiksheets-v2.vercel.app/login** in an incognito window
2. Click **Sign in with Google**
3. Pick your Google account from the consent screen
4. You should land on `/dashboard` logged in

If anything fails, the error message + detail will appear on the login
page (we surface them automatically). Most common issue: redirect URL
mismatch between Google Cloud Console and Supabase — make sure all
three URLs in Step 3 also exist in Step 1's "Authorized redirect URIs"
(specifically the Supabase callback URL).

---

## Verifying it worked at the database level

The auth bootstrap trigger auto-creates a `profiles` row + a
`workspaces` row + a `workspace_members` row when a new auth user is
created. To verify after a Google sign-in:

```bash
PG_PASSWORD='<db-password>' node -e "
const { Client } = require('pg')
const c = new Client({
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.anfvgmlgsthhdhwncxzt',
  password: process.env.PG_PASSWORD,
  ssl: { rejectUnauthorized: false },
})
;(async () => {
  await c.connect()
  console.log((await c.query('select id, email, display_name from profiles')).rows)
  console.log((await c.query('select id, name, owner_id from workspaces')).rows)
  await c.end()
})()
"
```

The newly signed-in user should appear with their Google profile email
and an auto-generated display name. The display name + avatar can be
back-filled later from the OAuth provider's `raw_user_meta_data`.
