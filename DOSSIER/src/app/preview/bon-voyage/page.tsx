/**
 * A rendering harness for the Bon Voyage page.
 *
 * The design of this page has been argued about at length and never settled,
 * because every attempt was made by reading code rather than looking at the
 * result. This route renders the real components against fixed sample data and
 * no database, so the page can actually be seen — and screenshotted — while it
 * is being worked on.
 *
 * Not linked from anywhere. Delete it when the page is right.
 */
import type { Experience, Stay, Transfer, DailyBrief } from '@/lib/types'
import type { ItineraryDay } from '@/components/DayByDayItinerary'
import TodayInFull from '@/components/TodayInFull'
import DailyBriefSection from '@/components/DailyBriefSection'
import RecommendsSection from '@/components/RecommendsSection'
import type { Recommendation } from '@/lib/types'
import { SectionOpen } from '@/components/PageSection'

export const dynamic = 'force-dynamic'

const TODAY = new Date().toISOString().slice(0, 10)

const exp = (over: Partial<Experience>): Experience => ({
  id: Math.random().toString(36).slice(2), experience_id: 'x', trip_id: 't',
  day_number: 1, date: TODAY, location: 'Khonoma', title: 'Untitled',
  description: null, time_of_day: null, duration: null, tags: null,
  cost_indicator: null, image_url: null, image_urls: null,
  ...over,
} as Experience)

const SAMPLE_DAY: ItineraryDay = {
  dayNumber: 3,
  date: TODAY,
  dayLabel: 'Day three',
  city: 'Khonoma, Nagaland',
  experiences: [
    exp({
      title: 'Into the Green Heart of Khonoma',
      time_of_day: 'Morning',
      duration: '4 hours',
      location: 'Khonoma village',
      meeting_point: 'Hotel lobby, 7:30am',
      description:
        'Khonoma gave up the gun. In 1998 the village banned hunting across twenty square kilometres of forest that had fed it for centuries, and the birds came back.\n\nYou walk it with someone whose father hunted here. The terraces are still worked by hand, the alder trees still pollarded on a cycle older than the state, and the quiet is the kind that takes an hour to stop noticing.',
    } as Partial<Experience>),
    exp({
      title: 'An afternoon with the weavers',
      time_of_day: 'Afternoon',
      duration: '2 hours',
      location: 'Lower Khonoma',
      description:
        'Loin-loom weaving, done on a strap around the back, the tension held by the weaver’s own body. Every pattern here is a claim: to a clan, a village, sometimes a single family.',
    } as Partial<Experience>),
  ],
  stay: {
    id: 's1', stay_id: 's', trip_id: 't', destination: 'Khonoma',
    property_name: 'The Dovipie Inn', room_type: 'Garden room',
  } as Stay,
  transfers: [
    { id: 't1', transfer_id: 't', trip_id: 't', transfer_mode: 'Car',
      from_location: 'Kohima', to_location: 'Khonoma', date: TODAY } as Transfer,
  ],
}

const BRIEFS: DailyBrief[] = [
  { id: 'b1', notion_page_id: null, trip_id: 't', date: TODAY,
    title: 'Tomorrow: the road through tea country',
    body: 'A slow morning in the village, then the weavers after lunch. Bring layers — the valley holds its cloud until eleven.',
    updated_at: '' },
  { id: 'b2', notion_page_id: null, trip_id: 't', date: '2026-05-11',
    title: 'The road through tea country', body: null, updated_at: '' },
  { id: 'b3', notion_page_id: null, trip_id: 't', date: '2026-05-13',
    title: 'The Moidams of Charaideo', body: null, updated_at: '' },
]

/* Two real photographs, served through our own proxy so the harness needs no
   database. */
const SHOTS: Record<string, string> = {
  'Into the Green Heart of Khonoma':
    '/api/notion-image?pageId=3b9cc540-df09-8174-91ea-d0163f7b69b5&prop=Cover%20Image',
  'An afternoon with the weavers':
    '/api/notion-image?pageId=387cc540-df09-81da-b8c0-d44048233a8d&prop=Cover%20Image',
}

const PLACES: Recommendation[] = [
  { id: 'r1', notion_page_id: null, trip_id: 't', category: 'Food & Drinks',
    destination: 'Kohima', name: 'Ozone Cafe',
    description: 'On Dr Neilhouzhu Road, serving Naga cooking alongside familiar Indian and mainland dishes.',
    timings: 'Daytime', map_link: 'https://maps.google.com', updated_at: '' },
  { id: 'r2', notion_page_id: null, trip_id: 't', category: 'Food & Drinks',
    destination: 'Kohima', name: 'Iolite Cafe',
    description: "Just across from Martyr's Park — an easy, friendly stop for coffee.",
    timings: 'Daytime', map_link: 'https://maps.google.com', updated_at: '' },
  { id: 'r3', notion_page_id: null, trip_id: 't', category: 'Food & Drinks',
    destination: 'Kohima', name: 'Chuvi Restaurant',
    description: 'A quiet, well-loved spot for an unhurried Naga lunch.',
    timings: 'Lunch hours', map_link: 'https://maps.google.com', updated_at: '' },
  { id: 'r4', notion_page_id: null, trip_id: 't', category: 'Other',
    destination: 'Kohima', name: 'Dzukou Valley',
    description: "Nagaland's valley of flowers — worth the trek in season.",
    timings: 'Full day', map_link: 'https://maps.google.com', updated_at: '' },
]

export default function PreviewBonVoyage() {

  return (
    <article className="cq-shell" style={{ paddingTop: 'var(--space-16)', paddingBottom: 'var(--gap-section)' }}>
      <header className="cq-section-open">
        <p className="cq-label">
          <span className="cq-mark" aria-hidden="true">✧</span>
          Nagaland, India
        </p>
        <h1 className="cq-t1" style={{ margin: 'var(--space-3) 0 0', color: 'var(--color-text)' }}>
          Bon Voyage, John.
        </h1>
      </header>

      <TodayInFull
        day={SAMPLE_DAY}
        city="Khonoma, Nagaland"
        imageFor={t => SHOTS[t] ?? null}
      />

      <section style={{ marginBottom: 'var(--gap-section)' }}>
        <SectionOpen eyebrow="Day by day" title="Daily Brief" />
        <DailyBriefSection briefs={BRIEFS} />
      </section>

      <section style={{ marginBottom: 'var(--gap-section)' }}>
        <SectionOpen eyebrow="Around you" title="CQ Recommends" />
        <RecommendsSection places={PLACES} />
      </section>
    </article>
  )
}
