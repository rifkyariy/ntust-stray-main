'use client';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import type { Station } from '@stray/ui';

// leaflet/dist/leaflet.css is imported globally in globals.css

function markerColor(status: Station['status']) {
  if (status === 'online')   return '#f97316';
  if (status === 'low_food') return '#eab308';
  return '#94a3b8';
}

function statusLabel(status: Station['status']) {
  if (status === 'online')   return 'Online';
  if (status === 'low_food') return 'Low Food';
  return 'Offline';
}

interface Props {
  stations: Station[];
  onSelect?: (s: Station) => void;
}

export default function StationsMapInner({ stations, onSelect }: Props) {
  return (
    <MapContainer
      center={[25.05, 121.55]}
      zoom={12}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={false}
      zoomControl={false}
    >
      {/* CartoDB Voyager — warm modern palette, no API key required */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />

      {/* Zoom control bottom-right, away from the legend */}
      <ZoomControl position="bottomright" />

      {stations.map((s) => {
        const color = markerColor(s.status);
        return (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={s.status === 'online' ? 9 : 7}
            pathOptions={{
              color: '#fff',
              weight: 2.5,
              fillColor: color,
              fillOpacity: 1,
            }}
            eventHandlers={{
              click: () => onSelect?.(s),
            }}
          >
            <Popup>
              <div style={{ minWidth: 168 }}>
                {/* Status badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: color, flexShrink: 0,
                    display: 'inline-block',
                  }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {statusLabel(s.status)}
                  </span>
                </div>

                {/* Name + location */}
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 2, lineHeight: 1.3 }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
                  {s.city}{s.district ? ` · ${s.district}` : ''}
                </div>

                {/* Mini gauges */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 10 }}>
                  <Meter label="Food"    value={s.food_pct}    color={s.food_pct < 25    ? '#ef4444' : '#f97316'} />
                  <Meter label="Battery" value={s.battery_pct} color={s.battery_pct < 20 ? '#ef4444' : '#4ade80'} />
                </div>

                {/* CTA */}
                <button
                  onClick={() => onSelect?.(s)}
                  style={{
                    width: '100%',
                    padding: '7px 0',
                    borderRadius: 8,
                    border: 'none',
                    background: '#f97316',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Open details →
                </button>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', width: 28, textAlign: 'right' }}>{value}%</span>
      </div>
    </div>
  );
}
