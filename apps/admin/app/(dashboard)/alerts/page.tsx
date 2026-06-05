import Link from 'next/link';
import { fetchStations } from '../../../lib/api';
import { SEED_STATIONS } from '../../../lib/seeds';
import Topbar from '../../../components/Topbar';
import { TintedPill } from '@stray/ui';

export default async function AlertsPage() {
  const fetched = await fetchStations();
  const stations = fetched.length > 0 ? fetched : SEED_STATIONS;

  const alerts = stations
    .filter((s) => s.status !== 'online')
    .map((s) => ({
      id: s.id,
      name: s.name,
      code: s.station_code,
      city: s.city,
      status: s.status,
      food_pct: s.food_pct ?? 0,
      battery_pct: s.battery_pct ?? 100,
    }));

  const lowFood = stations.filter((s) => (s.food_pct ?? 100) < 25 && s.status !== 'offline');
  const lowBattery = stations.filter((s) => (s.battery_pct ?? 100) < 20);

  return (
    <>
      <Topbar alertCount={alerts.length} />
      <div style={{ padding: '28px 28px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate-900)', margin: 0, letterSpacing: '-0.02em' }}>
            Alerts
          </h1>
          <p style={{ fontSize: 13, color: 'var(--slate-400)', margin: '4px 0 0' }}>
            Stations requiring attention
          </p>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { label: 'Offline Stations', count: stations.filter((s) => s.status === 'offline').length, color: '#ef4444', bg: '#fef2f2' },
            { label: 'Low Food', count: lowFood.length, color: '#f97316', bg: '#fff7ed' },
            { label: 'Low Battery', count: lowBattery.length, color: '#eab308', bg: '#fefce8' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} style={{
              background: '#fff',
              borderRadius: 16, padding: '18px 20px',
              border: '1px solid var(--slate-100)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-500)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.03em' }}>
                  {count}
                </div>
              </div>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>
                {label === 'Offline Stations' ? '📡' : label === 'Low Food' ? '🍽️' : '🔋'}
              </div>
            </div>
          ))}
        </div>

        {/* Alerts list */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--slate-100)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--slate-100)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>
              Active Issues — {alerts.length + lowFood.length + lowBattery.length} total
            </span>
          </div>

          {alerts.length === 0 && lowFood.length === 0 && lowBattery.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>All systems nominal</div>
              <div style={{ fontSize: 13, color: 'var(--slate-400)', marginTop: 6 }}>No active alerts.</div>
            </div>
          ) : (
            <div>
              {alerts.map((a, i) => (
                <Link
                  key={a.id}
                  href={`/stations/${a.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 20px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--slate-50)',
                    textDecoration: 'none',
                    background: '#fff',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>{a.name}</span>
                      <TintedPill
                        variant={a.status === 'offline' ? 'slate' : 'orange'}
                        label={a.status === 'offline' ? 'Offline' : 'Low Food'}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--slate-400)' }}>
                      <span>{a.city}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{a.code}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--slate-400)', marginBottom: 2 }}>Food</div>
                      <div style={{ fontWeight: 700, color: a.food_pct < 20 ? '#ef4444' : 'var(--orange-500)' }}>{a.food_pct}%</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--slate-400)', marginBottom: 2 }}>Battery</div>
                      <div style={{ fontWeight: 700, color: a.battery_pct < 20 ? '#ef4444' : 'var(--slate-700)' }}>{a.battery_pct}%</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 16, color: 'var(--slate-300)' }}>›</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
