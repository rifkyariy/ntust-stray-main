'use client';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import type { Station } from '@stray/ui';

// Leaflet cannot run during SSR — load the map only on the client
const StationsMapInner = dynamic(() => import('./StationsMapInner'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc',
      fontSize: 13, color: '#94a3b8',
    }}>
      Loading map…
    </div>
  ),
});

interface StationsMapProps {
  stations: Station[];
  onSelect?: (station: Station) => void;
}

export default function StationsMap({ stations, onSelect }: StationsMapProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: '1px solid var(--slate-100)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--slate-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Station Map</span>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--slate-500)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
            Online
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308', display: 'inline-block' }} />
            Low food
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
            Offline
          </span>
        </div>
      </div>

      {/* Map — position:relative + zIndex:0 creates an isolated stacking context.
           Leaflet's internal z-indexes (zoom: 1000, popup: 700) are contained
           within this context and can't bleed above the drawer (z-index: 101). */}
      <div style={{ height: 420, position: 'relative', zIndex: 0 }}>
        <StationsMapInner stations={stations} onSelect={onSelect} />
      </div>
    </div>
  );
}
