import { fetchStations } from '../lib/api';
import { TintedPill, Eyebrow } from '@stray/ui';
import type { Station, StationStatus } from '@stray/ui';

function pillVariant(status: StationStatus): 'green' | 'orange' | 'slate' {
  if (status === 'online') return 'green';
  if (status === 'low_food') return 'orange';
  return 'slate';
}

function pillLabel(status: StationStatus): string {
  if (status === 'online') return 'Online';
  if (status === 'low_food') return 'Low food';
  return 'Offline';
}

function FoodBar({ pct }: { pct: number }) {
  const color = pct < 25 ? '#fbbf24' : pct < 50 ? '#fb923c' : '#f97316';
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          fontWeight: 700,
          color: '#94a3b8',
          marginBottom: 5,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span>Food</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 6,
          background: '#ffedd5',
          borderRadius: 9999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
            height: '100%',
            background: color,
            borderRadius: 9999,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

function StationCard({ station: s }: { station: Station }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 20,
        padding: '22px 22px 20px',
        border: '1px solid #f1f5f9',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 10,
              color: '#94a3b8',
              marginBottom: 4,
              letterSpacing: '0.04em',
            }}
          >
            {s.station_code}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 15,
              color: '#1e293b',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {s.name}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: '#64748b',
              marginTop: 2,
            }}
          >
            {s.city} · {s.district}
          </div>
        </div>
        <TintedPill variant={pillVariant(s.status)} label={pillLabel(s.status)} />
      </div>

      {/* Food bar */}
      <FoodBar pct={s.food_pct ?? 0} />
    </div>
  );
}

// Fallback skeleton when API is unavailable
const SKELETON_STATIONS: Station[] = Array.from({ length: 6 }, (_, i) => ({
  id: `seed-${i}`,
  station_code: `F-TPE-0${i + 1}`,
  name: ['Da\'an Park', 'Ximending', 'Shilin Night Market', 'Gongguan', 'Xinyi', 'Zhongshan'][i],
  city: 'Taipei',
  district: ['Da\'an', 'Wanhua', 'Shilin', 'Zhongzheng', 'Xinyi', 'Zhongshan'][i],
  lat: 25.03 + i * 0.01,
  lng: 121.53 + i * 0.01,
  status: (['online', 'online', 'online', 'low_food', 'online', 'offline'] as const)[i],
  food_pct: [72, 45, 88, 18, 63, 0][i],
  battery_pct: [90, 75, 95, 40, 80, 0][i],
  temp_c: 27.2,
  humidity_pct: 68,
  installed_at: '2026-01-01T00:00:00Z',
  image_url: null,
}));

export async function StationsSection() {
  const stations = await fetchStations();
  const featured = (stations.length > 0 ? stations : SKELETON_STATIONS).slice(0, 6);

  return (
    <section id="stations" style={{ background: '#FDFBF7', padding: '100px 0' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 40px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 48,
          }}
        >
          <div>
            <Eyebrow color="#f97316" style={{ marginBottom: 12 }}>
              Live network
            </Eyebrow>
            <h2
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 900,
                fontSize: 48,
                color: '#1e293b',
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              Stations across Taiwan
            </h2>
          </div>
          <a
            href="#"
            style={{
              textDecoration: 'none',
              color: '#f97316',
              fontWeight: 700,
              fontSize: 14,
              fontFamily: 'var(--font-sans)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              paddingBottom: 4,
              borderBottom: '2px solid #fed7aa',
            }}
          >
            View all stations →
          </a>
        </div>

        {/* Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
          }}
        >
          {featured.map((s) => (
            <StationCard key={s.id} station={s} />
          ))}
        </div>
      </div>
    </section>
  );
}
