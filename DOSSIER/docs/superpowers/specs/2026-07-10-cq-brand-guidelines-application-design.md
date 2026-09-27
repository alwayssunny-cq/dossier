# Apply CQ Brand Guidelines Across the Dossier

## Context

CQ shared a full brand book (ethos, voice, typography hierarchy, banned-word list) with the instruction to apply it to all CQ projects by default. The brand book is stored as a standing reference in Claude's memory (`project_cq_brand_book.md`) for future sessions. This spec covers a one-time audit-and-fix pass applying it to the current state of `cq-client-portal` (client dossier + admin dossier).

Full brand rules (typography tiers, voice attributes, tone conversions, banned-word table, litmus tests) are not repeated here — see the brand book memory. This spec covers scope, file ownership, and process only.

## Scope

Three independent tracks, split by file ownership so work doesn't collide:

### Track 1 — Client-facing pages/components
**Files:** `src/app/**` (excluding `admin/`, `api/`), `src/components/**`

- Read every user-visible string for banned words (luxury→intentional, bespoke→designed, stunning→raw/evocative, etc. — full table in brand book memory) and tone violations (dramatic/academic/elitist phrasing per the brand book's conversion examples). Rewrite in place, in CQ voice: concise, atmospheric, quietly authoritative.
- Confirmed violations found in initial grep: `understand-cq/page.tsx` ("Quiet luxury" title, "bespoke travel studio", "real luxury is rarely loud"), `ArchetypeQuiz.tsx` ("stunning... Kuang Si Falls"). A full read-through may surface additional tone (not just keyword) violations not caught by grep.
- Typography audit: Mon Cheri (Tier 0) currently used in `layout.tsx`, `trip/[tripId]/reservations-payments/page.tsx`, `ExperiencesList.tsx`. Check each against: no all-caps, ≥60% surrounding negative space, ≥64px, never directly stacked above a Seasons (Tier 1) header without a rule/gap. Audit Seasons/Optima usage broadly for the tier's size range and Optima's ≥1.5 line-height rule where feasible without disrupting existing layout work.

### Track 2 — Admin app
**Files:** `src/app/admin/page.tsx`

- Same copy/tone/typography pass, scoped to client-facing strings surfaced inside the admin tool (e.g. preview text of what a client will see, labels describing client-facing features).
- Internal-only chrome (button labels like "Generate Insights," form field labels, technical section headers meant for CQ staff) is out of scope — brand voice governs what CQ says to clients, not internal tooling.

### Track 3 — AI prompts
**Files:** `src/app/api/ai/*/route.ts` (5 routes: `reading-insights`, `pre-travel-guide`, `loaf-digest`, `trip-carousel`, `sync-loaf`)

- Edit the Claude prompt language: remove banned-word role-framing (e.g. "You are a luxury travel curator at CQ") and align example/style-guide phrasing embedded in prompts with the brand book's tone conversions, so AI-generated client-facing content is on-brand at the source.
- Functional/instructional prompt content (data format asks, JSON schema, output structure) stays untouched — only the voice/tone-shaping language changes.

## Out of scope

- Imagery direction (Anti-Stock Energy / Half-open Doors / Sincerity in Faces) — no image-selection code exists to audit; this is a content-sourcing concern for whoever picks photos, not a code change.
- Any new features or refactoring beyond what's needed to apply the guidelines (no unrelated cleanup).
- Colors/hex values — brand book doesn't specify colors; existing color system from the prior redesign (`project_cq_redesign.md` memory) is unaffected.

## Process

For each track:
1. Grep for banned-word matches as a starting checklist (already run once; re-run per track at implementation time since new violations may exist beyond the initial scan).
2. Read the full file(s) for tone violations grep can't catch (formal/academic phrasing, exclamation points, elitist framing, over-explaining).
3. Rewrite violating copy directly, applying the tone-conversion pattern (state the CQ-voice equivalent, not just delete the banned word).
4. For files containing Mon Cheri/Seasons/Optima usage, check against the typography tier table and fix violations (spacing, size, caps, stacking).
5. No new UI, no schema changes, no behavior changes — this is a content and styling-rule compliance pass only.

## Testing

- No automated tests exist for copy content. Verification is manual: re-read each changed file to confirm no banned words remain and typography rule violations are resolved.
- Dev server smoke-check: load each changed client page and the admin page to confirm no layout breakage from copy-length changes (longer/shorter replacement text can affect wrapping).

## Risks

- Track 1/2 file overlap: none — admin lives entirely in `src/app/admin/page.tsx`, excluded from Track 1's glob.
- Copy-length changes could affect existing fixed-width/fixed-height layout containers (several components use hardcoded px dimensions per the prior redesign). Flag any spot where a rewrite meaningfully changes text length for a visual smoke-check.
