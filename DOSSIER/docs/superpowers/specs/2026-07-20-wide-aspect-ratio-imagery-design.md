# Apply Wide/Cinematic Aspect Ratios Across the Dossier

## Context

User referenced four external sites (Lost Loret Tequila, Battleaxe, Oishii, Hello World Studio) as visual inspiration for a "wide aspect ratio" treatment. Inspecting their raw markup/CSS (not just rendered appearance) showed a consistent pattern: full-bleed horizontal imagery, `object-fit: cover`, ranging from cinematic 16:9 up to ultra-panoramic ~2.9–3:1 — never square, never tall.

The dossier currently has no consistent aspect-ratio system for imagery. Every photographic component sizes its image container with an ad-hoc fixed height (`200px`, `300px`, `192px`, `180px`, `220px`) or a viewport-relative `clamp()`, with no deliberate ratio — so the resulting crop shape varies by container width rather than holding an intentional wide shape. `object-fit: cover` is already used everywhere, so the crop mechanism doesn't change — only how the container's height is determined.

This spec covers introducing a two-tier ratio system and applying it to the components where it fits their existing composition.

## Ratio system

- **Hero-tier: `aspect-ratio: 21 / 9`** — one large, cinematic image per view.
- **Card-tier: `aspect-ratio: 16 / 9`** — standard wide crop for grid/carousel cards.

Both replace the current fixed-height/clamp approach on the image container; `object-fit: cover` stays as-is.

## In scope

**Hero-tier (21:9):**
| Component | Current | File:line |
|---|---|---|
| `HeroBanner.tsx` | `height: clamp(360px, 52vh, 580px)` | `src/components/HeroBanner.tsx:39-65` |
| `TripCards.tsx` — `ActiveTripCard` | `height: clamp(320px, 46vw, 460px)` + scroll parallax (parallax transform stays) | `src/components/TripCards.tsx:86-109` |
| `ArchetypeQuiz.tsx` — destination reveal image | `height: clamp(320px, 55vw, 480px)` | `src/components/ArchetypeQuiz.tsx:555-567` |

**Card-tier (16:9):**
| Component | Current | File:line |
|---|---|---|
| `TripCards.tsx` — `PastTripCard` | fixed `height: 200px` | `src/components/TripCards.tsx:204-224` |
| `ExperiencesList.tsx` — `ExperienceCard` | fixed `height: 300px` | `src/components/ExperiencesList.tsx:101-109` |
| `StaysCarousel.tsx` — slide image | fixed `height: 180px` | `src/components/StaysCarousel.tsx:94-101` |
| `DestinationsCarousel.tsx` — slide image | fixed `height: 220px` | `src/components/DestinationsCarousel.tsx:222-229` |
| `RecommendationsSection.tsx` — `StoryCard` | fixed `height: 192px` | `src/components/RecommendationsSection.tsx:56-74` |

## Out of scope (with reasons)

- **`StayCard.tsx`** and **`RecommendationsSection.tsx`'s `FeaturedCard`** — both use a side-by-side composition (image as a full-height column next to text), not a stacked top-image card. Forcing 16:9 onto that column would shrink the image well below the text block's height, leaving dead space — a different problem from the other cards. User confirmed: leave these two as-is.
- **`CQLoafSection.tsx`'s `ThisWeekCard`** — already reworked earlier this session with a different, deliberate design (faint 28%-opacity background photo behind text, not a photo-forward crop). Its `LoafCard` already got its own fix this session (branded placeholder for missing images) and already renders in a roughly-wide shape via its `120px`-tall grid card. Not touched further here to avoid re-opening already-settled work.
- **Maps, logo, Notion-embedded content, itinerary UI** (`MapEmbed`, `TabMap`, `TripOverviewMap`, `CQLogo`, `NotionImageBlock`, `NotionPageViewer`, `ItineraryDrawer`, `itinerary/ItineraryClient.tsx`) — not photographic brand-presentation surfaces; forcing a crop ratio would actively break maps/logos.
- **Admin app** — inventoried all `<img>` usage in `src/app/admin/page.tsx`: a `96px`-tall trip-cover preview, `80×80px` stay thumbnails, `48×48px` and `40×40px` experience/trip-list icons. These are small utility thumbnails for data-entry confirmation ("is this the right image"), not brand-presentation surfaces — a cinematic ratio would be impractical at that size and serves no purpose there. No admin changes.

## Process

For each in-scope component:
1. Replace the fixed `height`/`clamp()` on the image container with `aspectRatio: '21 / 9'` or `'16 / 9'` per its tier.
2. Keep `width: 100%` (or existing responsive width behavior) and `object-fit: cover` unchanged.
3. Where a component has scroll/interaction behavior tied to the image (e.g. `ActiveTripCard`'s parallax `transform`), keep that logic untouched — only the height-determination mechanism changes.
4. No changes to card padding, text layout, or grid/carousel mechanics — this is an image-container sizing change only.

## Testing

No automated visual tests exist. Verification is manual: load each changed page in the dev server and confirm the image area holds the correct wide shape at a few viewport widths (mobile/tablet/desktop), and that text/layout around the image isn't broken by the height change (some components currently use the image container's height to also set the card's overall height via flow — check `PastTripCard`, `ExperienceCard` grid siblings still align).

## Risks

- `ActiveTripCard`'s `clamp(320px, 46vw, 460px)` height currently also caps how tall the card can grow on very wide viewports; switching to a pure `21/9` ratio means height scales directly with width with no cap — on ultrawide viewports the hero could get taller than the old 460px ceiling. Worth a quick check at a wide viewport during verification.
- `DestinationsCarousel`/`StaysCarousel` slides may have fixed-width containers set elsewhere in their track logic; confirm width isn't independently fixed in a way that fights the new ratio.
