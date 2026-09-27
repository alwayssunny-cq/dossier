'use client'

import { useEffect, useRef } from 'react'
import type { SubTabSlug } from './ItinerarySubTabs'

// ── Exported geo types ─────────────────────────────────────────────────────────

export interface GeoExperience {
  id: string
  title: string
  location: string | null
  lat: number
  lng: number
  sort_order: number | null
  date: string | null
  day_number: number | null
}

export interface GeoStay {
  id: string
  property_name: string
  destination: string | null
  lat: number
  lng: number
  check_in: string | null
}

export interface GeoTransfer {
  id: string
  from_location: string | null
  to_location: string | null
  transfer_mode: string | null
  fromLat: number
  fromLng: number
  toLat: number
  toLng: number
}

interface Props {
  experiences: GeoExperience[]
  stays:       GeoStay[]
  transfers:   GeoTransfer[]
  activeTab:   SubTabSlug
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const GOLD = 'var(--color-text-accent)'
const DARK = 'var(--color-surface-sunken)'

// ── Opacity helpers by tab ─────────────────────────────────────────────────────

function opacities(tab: SubTabSlug) {
  const full = 1
  const dim  = 0.15
  switch (tab) {
    case 'experiences': return { exp: full, stay: dim,  trf: dim  }
    case 'stay':        return { exp: dim,  stay: full, trf: dim  }
    case 'transfers':   return { exp: dim,  stay: dim,  trf: full }
    default:            return { exp: full, stay: full, trf: full }
  }
}

// ── GeoJSON builders ──────────────────────────────────────────────────────────

function buildRouteFeature(exps: GeoExperience[], stays: GeoStay[]) {
  // Merge experiences and stays in chronological order, deduplicate consecutive coords
  type Pt = { lat: number; lng: number; date: string | null; sort: number }
  const pts: Pt[] = [
    ...exps.map(e => ({ lat: e.lat, lng: e.lng, date: e.date, sort: e.sort_order ?? 999 })),
    ...stays.map(s => ({ lat: s.lat, lng: s.lng, date: s.check_in, sort: 0 })),
  ].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date) || a.sort - b.sort
    if (a.date) return -1
    if (b.date) return 1
    return a.sort - b.sort
  })

  const coords: [number, number][] = []
  for (const p of pts) {
    const last = coords[coords.length - 1]
    if (!last || Math.abs(last[0] - p.lng) > 0.001 || Math.abs(last[1] - p.lat) > 0.001) {
      coords.push([p.lng, p.lat])
    }
  }

  if (coords.length < 2) return null
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: coords },
  }
}

function buildExpCollection(exps: GeoExperience[]) {
  return {
    type: 'FeatureCollection' as const,
    features: exps.map((e, i) => ({
      type: 'Feature' as const,
      properties: { title: e.title, index: i + 1, id: e.id },
      geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] },
    })),
  }
}

function buildStayCollection(stays: GeoStay[]) {
  return {
    type: 'FeatureCollection' as const,
    features: stays.map(s => ({
      type: 'Feature' as const,
      properties: { name: s.property_name, id: s.id },
      geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
    })),
  }
}

function buildTrfCollection(trfs: GeoTransfer[]) {
  return {
    type: 'FeatureCollection' as const,
    features: trfs.map(t => ({
      type: 'Feature' as const,
      properties: { mode: t.transfer_mode, id: t.id },
      geometry: { type: 'LineString' as const, coordinates: [[t.fromLng, t.fromLat], [t.toLng, t.toLat]] },
    })),
  }
}

// ── Map source updater ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateSources(map: any, exps: GeoExperience[], stays: GeoStay[], trfs: GeoTransfer[]) {
  const route = buildRouteFeature(exps, stays)
  map.getSource('route')?.setData(route ?? { type: 'FeatureCollection', features: [] })
  map.getSource('experiences')?.setData(buildExpCollection(exps))
  map.getSource('stays')?.setData(buildStayCollection(stays))
  map.getSource('transfers')?.setData(buildTrfCollection(trfs))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fitToData(map: any, exps: GeoExperience[], stays: GeoStay[], trfs: GeoTransfer[], LngLatBounds: any) {
  const allCoords: [number, number][] = [
    ...exps.map(e => [e.lng, e.lat] as [number, number]),
    ...stays.map(s => [s.lng, s.lat] as [number, number]),
    ...trfs.flatMap(t => [[t.fromLng, t.fromLat], [t.toLng, t.toLat]] as [number, number][]),
  ]
  if (allCoords.length === 0) return
  if (allCoords.length === 1) {
    map.setCenter(allCoords[0])
    map.setZoom(10)
    return
  }
  const bounds = allCoords.reduce(
    (b, c) => b.extend(c),
    new LngLatBounds(allCoords[0], allCoords[0]),
  )
  map.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 13, duration: 600 })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyTabOpacities(map: any, tab: SubTabSlug) {
  const o = opacities(tab)
  const LAYERS = [
    ['exp-circles',   'circle-opacity',       o.exp],
    ['exp-circles',   'circle-stroke-opacity', o.exp],
    ['exp-labels',    'text-opacity',          o.exp],
    ['stay-circles',  'circle-opacity',        o.stay],
    ['stay-circles',  'circle-stroke-opacity', o.stay],
    ['trf-lines',     'line-opacity',          o.trf * 0.5],
    ['route-base',    'line-opacity',          0.25],
    ['route-dash',    'line-opacity',          tab === 'transfers' ? 0.6 : 0.45],
  ] as const
  for (const [id, prop, val] of LAYERS) {
    if (map.getLayer(id)) {
      map.setPaintProperty(id, prop, val)
    }
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function JourneyHeroMap({ experiences, stays, transfers, activeTab }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef         = useRef<any>(null)
  const loadedRef      = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LngLatBoundsRef = useRef<any>(null)

  // Stable dep keys — avoid unnecessary effect runs
  const dataKey = [
    experiences.map(e => e.id).join(','),
    stays.map(s => s.id).join(','),
    transfers.map(t => t.id).join(','),
  ].join('|')

  // ── Init map once ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false

    ;(async () => {
      // Inject CSS if needed
      if (typeof document !== 'undefined' && !document.getElementById('maplibre-gl-css')) {
        const link = document.createElement('link')
        link.id   = 'maplibre-gl-css'
        link.rel  = 'stylesheet'
        link.href = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl.css'
        document.head.appendChild(link)
      }

      const ml = await import('maplibre-gl')
      if (cancelled || !containerRef.current) return

      const { Map, Popup, LngLatBounds } = ml
      LngLatBoundsRef.current = LngLatBounds

      const startCoord: [number, number] = experiences[0]
        ? [experiences[0].lng, experiences[0].lat]
        : stays[0]
        ? [stays[0].lng, stays[0].lat]
        : [78.9629, 20.5937] // India fallback

      const map = new Map({
        container:        containerRef.current,
        style:            CARTO_DARK,
        center:           startCoord,
        zoom:             5,
        attributionControl: false,
        interactive:      true,
      })

      map.on('load', () => {
        if (cancelled) { map.remove(); return }

        // ── Sources ────────────────────────────────────────────────────────
        map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addSource('experiences', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addSource('stays',       { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addSource('transfers',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

        // ── Layers ─────────────────────────────────────────────────────────

        // Route base (subtle glow)
        map.addLayer({ id: 'route-base', type: 'line', source: 'route',
          paint: { 'line-color': GOLD, 'line-width': 3, 'line-opacity': 0.25, 'line-blur': 4 } })

        // Route dashed
        map.addLayer({ id: 'route-dash', type: 'line', source: 'route',
          paint: { 'line-color': GOLD, 'line-width': 1.5, 'line-opacity': 0.45, 'line-dasharray': [5, 4] } })

        // Transfer lines (dashed, dimmer)
        map.addLayer({ id: 'trf-lines', type: 'line', source: 'transfers',
          paint: { 'line-color': GOLD, 'line-width': 1, 'line-opacity': 0.3, 'line-dasharray': [3, 5] } })

        // Stay outer ring
        map.addLayer({ id: 'stay-circles', type: 'circle', source: 'stays',
          paint: {
            'circle-radius': 8,
            'circle-color': DARK,
            'circle-stroke-width': 2,
            'circle-stroke-color': GOLD,
            'circle-opacity': 1,
            'circle-stroke-opacity': 1,
          } })

        // Experience filled circles
        map.addLayer({ id: 'exp-circles', type: 'circle', source: 'experiences',
          paint: {
            'circle-radius': 9,
            'circle-color': GOLD,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': DARK,
            'circle-opacity': 1,
            'circle-stroke-opacity': 1,
          } })

        // Experience number labels
        map.addLayer({ id: 'exp-labels', type: 'symbol', source: 'experiences',
          layout: {
            'text-field': ['to-string', ['get', 'index']],
            'text-size': 9,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
          },
          paint: { 'text-color': DARK, 'text-opacity': 1 } })

        // ── Interactions ────────────────────────────────────────────────────

        // Experience click → popup
        map.on('click', 'exp-circles', (e: { features?: Array<{ properties: Record<string, unknown> }>; lngLat: { lng: number; lat: number } }) => {
          const feat = e.features?.[0]
          if (!feat) return
          new Popup({
            offset: 14,
            closeButton: false,
            className: 'cq-map-popup',
          })
            .setLngLat([e.lngLat.lng, e.lngLat.lat])
            .setHTML(`
              <div style="
                background:var(--color-surface-sunken);border:0.5px solid rgba(112,110,86,0.3);
                border-radius:8px;padding:10px 14px;min-width:160px;
              ">
                <p style="margin:0;font-size:13px;letter-spacing:0.01em;color:var(--color-text-accent);margin-bottom:4px;font-family:var(--font-optima,'Optima',Georgia,serif)">
                  Experience ${feat.properties.index}
                </p>
                <p style="margin:0;font-size:13px;color:var(--color-surface);font-family:var(--font-optima,'Cormorant Garamond',Georgia,serif);line-height:1.3">
                  ${feat.properties.title}
                </p>
              </div>
            `)
            .addTo(map)
        })

        // Stay hover → popup
        map.on('mouseenter', 'stay-circles', (e: { features?: Array<{ properties: Record<string, unknown> }>; lngLat: { lng: number; lat: number } }) => {
          map.getCanvas().style.cursor = 'pointer'
          const feat = e.features?.[0]
          if (!feat) return
          new Popup({
            offset: 12,
            closeButton: false,
            className: 'cq-map-popup',
          })
            .setLngLat([e.lngLat.lng, e.lngLat.lat])
            .setHTML(`
              <div style="
                background:var(--color-surface-sunken);border:0.5px solid rgba(112,110,86,0.3);
                border-radius:8px;padding:10px 14px;min-width:140px;
              ">
                <p style="margin:0;font-size:13px;letter-spacing:0.01em;color:var(--color-text-accent);margin-bottom:4px;font-family:var(--font-optima,'Optima',Georgia,serif)">Stay</p>
                <p style="margin:0;font-size:13px;color:var(--color-surface);font-family:var(--font-optima,'Cormorant Garamond',Georgia,serif);line-height:1.3">
                  ${feat.properties.name}
                </p>
              </div>
            `)
            .addTo(map)
        })
        map.on('mouseleave', 'stay-circles', () => { map.getCanvas().style.cursor = '' })
        map.on('mouseenter', 'exp-circles',  () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'exp-circles',  () => { map.getCanvas().style.cursor = '' })

        // ── Load initial data ───────────────────────────────────────────────
        updateSources(map, experiences, stays, transfers)
        fitToData(map, experiences, stays, transfers, LngLatBounds)
        applyTabOpacities(map, activeTab)

        loadedRef.current = true
        mapRef.current = map
      })
    })()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        loadedRef.current = false
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Update sources when iteration data changes ────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current || !mapRef.current) return
    updateSources(mapRef.current, experiences, stays, transfers)
    if (LngLatBoundsRef.current) {
      fitToData(mapRef.current, experiences, stays, transfers, LngLatBoundsRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  // ── Update opacity when tab changes ──────────────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current || !mapRef.current) return
    applyTabOpacities(mapRef.current, activeTab)
  }, [activeTab])

  const hasData = experiences.length > 0 || stays.length > 0 || transfers.length > 0
  if (!hasData) return null

  return (
    <div style={{ marginBottom: '0' }}>
      <div
        style={{
          position: 'relative',
          borderRadius: '0',
          overflow: 'hidden',
          borderBottom: '0.5px solid rgba(112,110,86,0.15)',
        }}
      >
        <div
          ref={containerRef}
          style={{
            height: 'clamp(260px, 35vw, 380px)',
            width: '100%',
            backgroundColor: 'var(--color-text)',
          }}
        />

        {/* Attribution */}
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            right: '8px',
            fontSize: 'var(--text-caption)',
            color: 'rgba(245,243,238,0.25)',
            pointerEvents: 'none',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.06em',
          }}
        >
          © CARTO · © OSM
        </div>
      </div>
    </div>
  )
}
