'use client'

import { useEffect, useRef } from 'react'
import type { GeoCity } from '@/lib/geocode'

interface Props {
  cities: GeoCity[]
}

const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

function goldPinSvg(label: string): string {
  const display = label.length > 10 ? label.slice(0, 9) + '…' : label
  return `
    <div style="display:flex;flex-direction:column;align-items:center;cursor:default">
      <div style="
        background:var(--color-text-accent);
        border:2px solid var(--color-surface);
        border-radius:50% 50% 50% 0;
        width:20px;height:20px;
        transform:rotate(-45deg);
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
        flex-shrink:0;
      "></div>
      <div style="
        margin-top:4px;
        background:rgba(28,28,26,0.85);
        color:var(--color-surface);
        font-size:9px;
        letter-spacing:0.08em;
        padding:2px 6px;
        border-radius:4px;
        white-space:nowrap;
        backdrop-filter:blur(4px);
        border:0.5px solid rgba(112,110,86,0.4);
        font-family:var(--font-optima,'Optima',Georgia,serif);
        
      ">${display}</div>
    </div>
  `
}

export default function JourneyMap({ cities }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || cities.length === 0) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any = null

    import('maplibre-gl').then((ml) => {
      const { Map, Marker, LngLatBounds } = ml

      map = new Map({
        container: containerRef.current!,
        style: CARTO_DARK,
        center: [cities[0].lng, cities[0].lat],
        zoom: cities.length === 1 ? 9 : 7,
        attributionControl: false,
        interactive: true,
      })

      map.on('load', () => {
        // Gold dashed polyline connecting cities in order
        if (cities.length > 1) {
          map.addSource('journey-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: cities.map(c => [c.lng, c.lat]),
              },
            },
          })

          // Solid gold base line
          map.addLayer({
            id: 'journey-route-base',
            type: 'line',
            source: 'journey-route',
            paint: {
              'line-color': 'rgba(112,110,86,0.3)',
              'line-width': 2,
            },
          })

          // Dashed gold overlay
          map.addLayer({
            id: 'journey-route-dash',
            type: 'line',
            source: 'journey-route',
            paint: {
              'line-color': 'var(--color-text-accent)',
              'line-width': 2,
              'line-dasharray': [4, 3],
            },
          })
        }

        // Gold pins for each city
        for (const city of cities) {
          const el = document.createElement('div')
          el.innerHTML = goldPinSvg(city.name)
          new Marker({ element: el, anchor: 'bottom' })
            .setLngLat([city.lng, city.lat])
            .addTo(map)
        }

        // Fit bounds to show all cities
        if (cities.length > 1) {
          const bounds = new LngLatBounds()
          cities.forEach(c => bounds.extend([c.lng, c.lat]))
          map.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 60, right: 60 }, animate: false })
        }
      })

      mapRef.current = map
    }).catch(err => {
      console.error('[JourneyMap] Failed to load maplibre-gl:', err)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities.map(c => `${c.name}:${c.lat}:${c.lng}`).join('|')])

  if (cities.length === 0) return null

  const cityCaption = cities.map(c => c.name).join(' · ')

  return (
    <div style={{ marginBottom: 'var(--pad-40)' }}>
      {/* Section label */}
      <p
        className="font-optima"
        style={{
          fontSize: 'var(--text-caption)',
          letterSpacing: '0.01em',
          color: 'var(--color-text-accent)',
          marginBottom: '12px',
        }}
      >
        Journey
      </p>

      {/* Map container */}
      <div
        style={{
          borderRadius: '16px',
          overflow: 'hidden',
          border: '0.5px solid rgba(112,110,86,0.25)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          position: 'relative',
        }}
      >
        <div
          ref={containerRef}
          style={{
            height: 'clamp(220px, 30vw, 320px)',
            width: '100%',
          }}
        />

        {/* Attribution */}
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            right: '8px',
            fontSize: 'var(--text-caption)',
            color: 'rgba(245,243,238,0.35)',
            pointerEvents: 'none',
          }}
        >
          © CARTO · © OSM
        </div>
      </div>

      {/* City caption */}
      <p
        className="font-optima"
        style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-accent)',
          letterSpacing: '0.06em',
          marginTop: '10px',
          textAlign: 'center',
        }}
      >
        {cityCaption}
      </p>
    </div>
  )
}
