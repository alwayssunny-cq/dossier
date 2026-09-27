# CQ Dossier — Closequarters Client Portal

Private trip dossier for Closequarters Club members. Each client receives a personalised, phase-driven portal that evolves from inquiry through to Bon Voyage.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, Turbopack) |
| Database | Supabase (PostgreSQL) |
| Content source | Notion (synced via REST API) |
| Auth | Supabase Auth |
| Maps | Mapbox / MapLibre GL |
| PDF generation | Puppeteer Core + `@sparticuz/chromium` (Vercel) |
| AI | Anthropic Claude API |
| Deployment | Vercel |

---

## Trip Phases

The portal adapts its UI based on the trip's current stage:

| Stage | Phase | Visible Tabs |
|---|---|---|
| First Steps | `inquiry` | Overview · Log |
| Crafting | `crafting` | Dates & Destinations · Blueprint · Stays · Log |
| Reservations | `reservations` | Reservations · Your Trip · Log |
| Bon Voyage | `completed` / `live` | Overview · Need to Know · Log |

Trip status is set in Notion and synced to Supabase via `/api/sync`.

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project with the CQ schema applied
- A Notion integration with access to the CQ workspace databases
- A Mapbox account (public token)
- An Anthropic API key (for drawing-board sync)

### Local development

```bash
git clone https://github.com/jensoaden80-arch/CQ-DOSSIER.git
cd CQ-DOSSIER
npm install
cp .env.local.example .env.local   # fill in all values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Admin panel: [http://localhost:3000/admin](http://localhost:3000/admin) — requires `ADMIN_PASSWORD`.

### Environment variables

All required. See `.env.local.example` for the full list. Key groups:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Notion integration token + one DB ID per table
NOTION_TOKEN
NOTION_TRIPS_DB  ...etc

# Services
ADMIN_PASSWORD
ANTHROPIC_API_KEY
NEXT_PUBLIC_MAPBOX_TOKEN

# PDF (local dev only — Vercel uses @sparticuz/chromium automatically)
CHROMIUM_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

---

## Syncing Content from Notion

POST `/api/sync` (requires `Authorization: Bearer <ADMIN_PASSWORD>`) syncs all Notion databases into Supabase. Trigger manually from the admin panel or via a webhook/cron.

Trip status changes in Notion are reflected automatically via Supabase Realtime (`RealtimeRefresher` component polls the `trips` table).

---

## Key Routes

| Route | Description |
|---|---|
| `/dashboard` | Client's trip list |
| `/trip/[tripId]` | Redirects to the phase-appropriate default tab |
| `/trip/[tripId]/brief` | Overview / Bon Voyage landing page |
| `/trip/[tripId]/today` | Live day view (active trips only) |
| `/trip/[tripId]/your-trip` | Full day-by-day itinerary |
| `/trip/[tripId]/travel-guide` | Need to Know — culture, language, packing |
| `/trip/[tripId]/log` | Messaging thread with curator |
| `/api/sync` | Notion → Supabase sync |
| `/api/trip/[tripId]/itinerary` | JSON itinerary for the drawer modal |
| `/admin` | Admin panel |

---

## Build

```bash
npm run build   # production build
npm run dev     # development (Turbopack)
```

`@sparticuz/chromium` and `puppeteer-core` are excluded from the webpack bundle via `serverExternalPackages` — they are provided at runtime by Vercel's Lambda environment and do not need to be installed locally.

---

## Repository

Private — proprietary business logic. Secrets are gitignored (`.env*`).
