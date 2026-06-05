'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { Station, WSMessage } from '@stray/ui';
import { TintedPill, PawPrint, ArrowLeft, Zap, Calendar, AlertTriangle } from '@stray/ui';
import { useWebSocket } from '../../../../hooks/useWebSocket';
import { postDispense, postSchedule } from '../../../../lib/api';

function statusVariant(s: Station['status']): 'green' | 'orange' | 'slate' {
  if (s === 'online')   return 'green';
  if (s === 'low_food') return 'orange';
  return 'slate';
}

function statusLabel(s: Station['status']) {
  if (s === 'online')   return 'Online';
  if (s === 'low_food') return 'Low Food';
  return 'Offline';
}

function MetricCard({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '16px 18px',
      border: '1px solid var(--slate-100)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-400)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: color ?? 'var(--slate-900)', letterSpacing: '-0.03em' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-400)' }}>{unit}</span>}
      </div>
    </div>
  );
}

const GRAM_PRESETS = [50, 100, 150, 200];

interface Props {
  station: Station;
  token: string;
}

export default function StationDetailClient({ station: initial, token }: Props) {
  const [station, setStation] = useState<Station>(initial);
  const [tab, setTab] = useState<'overview' | 'controls'>('overview');
  const [grams, setGrams] = useState(100);
  const [dispenseLoading, setDispenseLoading] = useState(false);
  const [dispenseMsg, setDispenseMsg] = useState('');
  const [cronExpr, setCronExpr] = useState('0 7 * * *');
  const [schedGrams, setSchedGrams] = useState(100);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedMsg, setSchedMsg] = useState('');

  const handleMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'telemetry' && msg.station_id === station.id) {
      setStation((prev) => ({
        ...prev,
        food_pct: msg.food_pct,
        battery_pct: msg.battery_pct,
        temp_c: msg.temp_c,
        humidity_pct: msg.humidity_pct,
      }));
    }
  }, [station.id]);

  useWebSocket(handleMessage);

  async function handleDispense() {
    setDispenseLoading(true);
    setDispenseMsg('');
    const ok = await postDispense(station.id, grams, token);
    setDispenseMsg(ok ? `Dispensed ${grams}g successfully!` : 'Failed — check connection.');
    setDispenseLoading(false);
  }

  async function handleSchedule() {
    setSchedLoading(true);
    setSchedMsg('');
    const ok = await postSchedule(station.id, cronExpr, schedGrams, token);
    setSchedMsg(ok ? 'Schedule saved!' : 'Failed — check connection.');
    setSchedLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Topbar */}
      <div style={{
        height: 64, background: '#fff', borderBottom: '1px solid var(--slate-100)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <Link
          href="/stations"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600, color: 'var(--slate-500)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          All Stations
        </Link>
        <span style={{ color: 'var(--slate-300)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)' }}>{station.name}</span>
        <div style={{ marginLeft: 8 }}>
          <TintedPill variant={statusVariant(station.status)} label={statusLabel(station.status)} />
        </div>
      </div>

      <div style={{ padding: '28px 28px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Title row */}
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--slate-900)', margin: 0, letterSpacing: '-0.02em' }}>
            {station.name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--slate-400)' }}>
              {station.city}{station.district ? `, ${station.district}` : ''}
            </span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--slate-400)', background: 'var(--slate-100)', borderRadius: 6, padding: '2px 8px' }}>
              {station.station_code}
            </span>
          </div>
        </div>

        {/* Camera */}
        <div style={{
          background: '#0f172a',
          borderRadius: 16,
          aspectRatio: '16/7',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {station.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={station.image_url}
              alt={station.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
            />
          ) : (
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>Camera feed not available</span>
          )}
          <div style={{
            position: 'absolute', top: 14, left: 14,
            background: 'rgba(239,68,68,0.9)',
            borderRadius: 8, padding: '4px 10px',
            fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.05em',
          }}>
            ● LIVE
          </div>
        </div>

        {/* Metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <MetricCard label="Food Level" value={station.food_pct ?? 0} unit="%" color="var(--orange-500)" />
          <MetricCard label="Battery" value={station.battery_pct ?? 100} unit="%" color="#4ade80" />
          {station.temp_c !== 0 && (
            <MetricCard label="Temperature" value={station.temp_c} unit="°C" />
          )}
          {station.humidity_pct !== 0 && (
            <MetricCard label="Humidity" value={station.humidity_pct} unit="%" />
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Dispense */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid var(--slate-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--orange-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={15} color="var(--orange-500)" strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>Dispense Food</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {GRAM_PRESETS.map((g) => (
                <button key={g} onClick={() => setGrams(g)} style={{
                  padding: '10px 4px', borderRadius: 10,
                  border: `1.5px solid ${grams === g ? 'var(--orange-500)' : 'var(--slate-200)'}`,
                  background: grams === g ? 'var(--orange-50)' : '#fff',
                  color: grams === g ? 'var(--orange-600)' : 'var(--slate-600)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>{g}g</button>
              ))}
            </div>

            {dispenseMsg && (
              <p style={{ fontSize: 13, color: dispenseMsg.includes('success') ? '#16a34a' : '#ef4444', marginBottom: 12 }}>{dispenseMsg}</p>
            )}

            <button
              onClick={handleDispense}
              disabled={dispenseLoading || station.status === 'offline'}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                background: dispenseLoading || station.status === 'offline' ? 'var(--slate-200)' : 'var(--orange-500)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: dispenseLoading || station.status === 'offline' ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {dispenseLoading ? 'Dispensing…' : `Dispense ${grams}g`}
            </button>

            {station.status === 'offline' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <AlertTriangle size={13} color="#f59e0b" strokeWidth={2} />
                <span style={{ fontSize: 12, color: '#92400e' }}>Station offline</span>
              </div>
            )}
          </div>

          {/* Schedule */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid var(--slate-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--slate-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={15} color="var(--slate-600)" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>Schedule</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 5 }}>Cron expression</label>
                <input
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1.5px solid var(--slate-200)', fontSize: 13,
                    fontFamily: 'var(--font-mono)', color: 'var(--slate-900)', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Amount (g)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {GRAM_PRESETS.map((g) => (
                    <button key={g} onClick={() => setSchedGrams(g)} style={{
                      padding: '8px 4px', borderRadius: 8,
                      border: `1.5px solid ${schedGrams === g ? 'var(--slate-700)' : 'var(--slate-200)'}`,
                      background: schedGrams === g ? 'var(--slate-800)' : '#fff',
                      color: schedGrams === g ? '#fff' : 'var(--slate-600)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}>{g}g</button>
                  ))}
                </div>
              </div>
            </div>

            {schedMsg && (
              <p style={{ fontSize: 13, color: schedMsg.includes('saved') ? '#16a34a' : '#ef4444', marginBottom: 12 }}>{schedMsg}</p>
            )}

            <button
              onClick={handleSchedule}
              disabled={schedLoading}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                background: schedLoading ? 'var(--slate-200)' : 'var(--slate-800)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: schedLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {schedLoading ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>
        </div>

        {/* Location info */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid var(--slate-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <PawPrint size={15} color="var(--slate-500)" strokeWidth={2} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Location Details</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 13 }}>
            <div>
              <div style={{ color: 'var(--slate-400)', marginBottom: 4 }}>City</div>
              <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{station.city}</div>
            </div>
            <div>
              <div style={{ color: 'var(--slate-400)', marginBottom: 4 }}>District</div>
              <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{station.district ?? '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--slate-400)', marginBottom: 4 }}>Coordinates</div>
              <div style={{ fontWeight: 600, color: 'var(--slate-800)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {station.lat.toFixed(4)}, {station.lng.toFixed(4)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
