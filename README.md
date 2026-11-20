# TRIPPIN

Our trips in one place: tickets, plans, places, expenses and documents. Works offline, synced between Gal's iPhone, Mom's iPhone and Mom's iPad.

**No private data is stored in this repository.** It only holds the app's code. Trip data and files live in a private Supabase database that only our two accounts can open.

## How it works
- **Offline first:** everything is saved on each device (IndexedDB), and a service worker keeps the app itself available with no signal.
- **Sync:** changes go to Supabase as soon as there's internet. Each device keeps a full copy, including ticket files.
- **Free services, no keys:** weather from Open-Meteo, places and parking from OpenStreetMap, photos from Wikipedia/Wikimedia, exchange rates from the ECB (via Frankfurter).
- **Booking PDFs** are read on the device itself, and you approve the details before saving.

## One-time setup

### 1. Supabase (the private sync database, free)
1. Create a free account at supabase.com → **New project** (any name, e.g. `trippin`; region: Frankfurt).
2. **SQL Editor → New query**: paste `supabase/schema.sql`, put your two emails in the last line (remove the `--`), then **Run**.
3. **Authentication → Users → Add user** twice (Gal and Mom), each with an email and password. Tick "Auto confirm".
4. **Authentication → Sign In / Providers**: turn off "Allow new users to sign up".
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `.env.production`.

### 2. GitHub Pages (hosting the app, free)
1. Push this folder to a GitHub repository.
2. **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` builds and publishes the app to `https://<user>.github.io/<repo>/`.

### 3. On each iPhone / iPad
Open the link in **Safari** → Share → **Add to Home Screen** → open TRIPPIN from the home screen → **Sign in**.

## Develop
```
npm install
npm run dev
npm run build
```
