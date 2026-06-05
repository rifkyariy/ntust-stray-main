'use client';
import { useRouter } from 'next/navigation';
import { TintedPill } from '@stray/ui';
import type { Station, StationStatus } from '@stray/ui';

function dotColor(status: StationStatus): string {
  if (status === 'online') return '#22c55e';
  if (status === 'low_food') return '#fbbf24';
  return '#94a3b8';
}

function pillProps(status: StationStatus): { variant: 'green' | 'orange' | 'slate'; label: string } {
  if (status === 'online') return { variant: 'green', label: 'Online' };
  if (status === 'low_food') return { variant: 'orange', label: 'Low food' };
  return { variant: 'slate', label: 'Offline' };
}

export function StationCard({ station }: { station: Station }) {
  const router = useRouter();
  const { variant, label } = pillProps(station.status);
  const foodColor = station.food_pct < 25 ? '#fbbf24' : '#f97316';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/station/${station.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/station/${station.id}`)}
      style={{
        background: '#fff',
        border: '1px solid #f1f5f9',
        borderRadius: 20,
        padding: '16px 16px 14px',
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        marginBottom: 10,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: dotColor(station.status),
              boxShadow: `0 0 8px ${dotColor(station.status)}99`,
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10, color: '#94a3b8', letterSpacing: '0.04em' }}>
              {station.station_code}
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {station.name}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#64748b' }}>
            {station.city} · {station.district}
          </div>
        </div>
        <TintedPill variant={variant} label={label} />
      </div>

      {/* Food bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 5, fontFamily: 'var(--font-sans)' }}>
          <span>Food level</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{station.food_pct}%</span>
        </div>
        <div style={{ height: 6, background: '#ffedd5', borderRadius: 9999, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, station.food_pct))}%`,
            height: '100%',
            background: foodColor,
            borderRadius: 9999,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>
    </div>
  );
}
