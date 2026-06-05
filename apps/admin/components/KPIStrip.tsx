import { MapPin, Utensils, Banknote, Cat, AlertTriangle } from '@stray/ui';
import type { KPIData } from '../lib/api';

interface KPIStripProps {
  data: KPIData;
}

const TILES = [
  {
    key: 'stations_online' as keyof KPIData,
    label: 'Stations Online',
    icon: MapPin,
    color: '#4ade80',
    bg: '#f0fdf4',
    format: (v: number) => String(v),
    unit: '',
  },
  {
    key: 'dispensed_today_kg' as keyof KPIData,
    label: 'Dispensed Today',
    icon: Utensils,
    color: 'var(--orange-500)',
    bg: 'var(--orange-50)',
    format: (v: number) => v.toFixed(1),
    unit: 'kg',
  },
  {
    key: 'donated_today_ntd' as keyof KPIData,
    label: 'Donated Today',
    icon: Banknote,
    color: '#a855f7',
    bg: '#faf5ff',
    format: (v: number) => v.toLocaleString(),
    unit: 'NT$',
  },
  {
    key: 'cats_tracked' as keyof KPIData,
    label: 'Cats Tracked',
    icon: Cat,
    color: '#3b82f6',
    bg: '#eff6ff',
    format: (v: number) => String(v),
    unit: '',
  },
  {
    key: 'active_alerts' as keyof KPIData,
    label: 'Active Alerts',
    icon: AlertTriangle,
    color: '#ef4444',
    bg: '#fef2f2',
    format: (v: number) => String(v),
    unit: '',
  },
];

export default function KPIStrip({ data }: KPIStripProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 16,
    }}>
      {TILES.map(({ key, label, icon: Icon, color, bg, format, unit }) => {
        const val = data[key];
        return (
          <div
            key={key}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '18px 20px',
              border: '1px solid var(--slate-100)',
              boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-500)', letterSpacing: '0.01em' }}>
                {label}
              </span>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={15} color={color} strokeWidth={2.2} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              {unit === 'NT$' && (
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-400)' }}>NT$</span>
              )}
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {format(val)}
              </span>
              {unit && unit !== 'NT$' && (
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-400)' }}>{unit}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
