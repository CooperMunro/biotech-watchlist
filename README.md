# Biotech Watchlist

Private, single-user watchlist for early-stage biotech names. Next.js 15 (App Router) + TypeScript, Supabase (Postgres + magic-link auth), Tailwind, deployed on Vercel.

## Folder structure

```
biotech-watchlist/
├── app/
│   ├── layout.tsx               root layout (noindex)
│   ├── globals.css              Tailwind + a few shared classes
│   ├── login/                   magic-link form + server action (email allowlist check)
│   ├── auth/callback/route.ts   exchanges the magic-link code, rejects any other email
│   ├── auth/signout/route.ts
│   └── (app)/                   everything behind auth
│       ├── layout.tsx           nav bar
│       ├── actions.ts           server actions: create/update/delete, review, thesis
│       ├── page.tsx             /            dashboard
│       ├── watchlist/page.tsx   /watchlist   filter + sort table
│       ├── watchlist/new/       /watchlist/new
│       ├── watchlist/[id]/      /watchlist/:id  detail + edit + delete
│       ├── calendar/            /calendar    catalysts ascending, <30 days in red
│       ├── review/              /review      Tier 1 + stale (>90d) with Buy/Hold/Pass
│       └── thesis/              /thesis      editable one-pager
├── components/                  CompanyForm (rubric auto-sum, auto-tier), Nav, Badges
├── lib/                         supabase server client, tiering, dates, types, auth
├── middleware.ts                auth gate on every route except /login and /auth/callback
└── supabase/schema.sql          tables, triggers, row-level security
```

## Setup (about 15 minutes)

### 1. Supabase
1. Create a project at supabase.com (free tier).
2. Open `supabase/schema.sql`, replace all four `you@example.com` with your email, then paste it into **SQL Editor** and run it.
3. **Authentication → Sign In / Providers → Email**: keep Email enabled. Turn **off** "Allow new users to sign up".
4. **Authentication → Users → Add user → Send invitation** (or Create user) with your email. Because signups are off, this is the only account that can ever exist.
5. **Authentication → URL Configuration**: set Site URL to `http://localhost:3000` for now, and add `http://localhost:3000/auth/callback` to Redirect URLs. (Add your Vercel URL later.)
6. **Settings → API**: copy the Project URL and the anon public key.

### 2. Run locally
```bash
npm install
cp .env.example .env.local     # fill in the four values
npm run dev
```
Open http://localhost:3000, enter your email, click the link in the email.

### 3. Deploy to Vercel
1. Push this folder to a private GitHub repo and import it in Vercel.
2. Add the same four env vars in Vercel → Settings → Environment Variables, with `NEXT_PUBLIC_SITE_URL` set to your Vercel URL (e.g. `https://biotech-watchlist.vercel.app`).
3. In Supabase → URL Configuration, set Site URL to the Vercel URL and add `https://<your-vercel-url>/auth/callback` to Redirect URLs.

## Password login (avoids email limits)
Supabase's free email service only sends a few login emails per hour. To sign in without email: Supabase → Authentication → Users → delete your user, then **Add user → Create new user** with your email, a password, and **Auto Confirm User** ticked. Then use "Sign in with a password instead" on the login page.

## How access is locked down
Four layers, any one of which blocks a stranger:
1. The login action only sends a link if the email matches `ALLOWED_EMAIL` (same response either way, so the page doesn't leak your address).
2. Signups are disabled in Supabase and `shouldCreateUser: false`, so no other account can be created.
3. Middleware and the auth callback sign out and redirect any session whose email isn't `ALLOWED_EMAIL`.
4. Row-level security in Postgres only returns rows to a JWT carrying your email, even if someone gets the anon key.

## Behaviour notes
- **Scoring rubric**: 5 categories (science/data, team & backers, catalyst proximity, funding/runway, market & differentiation), each 0–2, summed live to the 0–10 score. Per-category values are stored in a `rubric` jsonb column so you can re-score later; edit the categories and hints in `lib/types.ts`.
- **Auto-tiering** (`lib/tiering.ts`): runs on save when Tier is left on "Auto". Score ≥ 7 and catalyst within 6 months → Tier 1; score ≥ 4 → Tier 2; else Tier 3. Pick a tier manually to override.
- **Review page**: "Hold" writes `Watch` (the schema's decision values are Buy/Watch/Pass) and stamps today as `last_reviewed`.
- **Not built (v2)**: ClinicalTrials.gov auto-pull cron, email/Slack catalyst alerts.
