'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Station, WSMessage } from '@stray/ui';
import { TintedPill, PawPrint, Zap, Calendar, X, AlertTriangle } from '@stray/ui';
import { useWebSocket } from '../hooks/useWebSocket';
import { postDispense, postSchedule } from '../lib/api';

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

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--slate-50)' }}>
      <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-800)' }}>{value}</span>
    </div>
  );
}

const GRAM_PRESETS = [50, 100, 150, 200];

interface StationDrawerProps {
  station: Station | null;
  token: string;
  onClose: () => void;
}

export default function StationDrawer({ station, token, onClose }: StationDrawerProps) {
  const [tab, setTab] = useState<'overview' | 'controls'>('overview');
  const [liveStation, setLiveStation] = useState<Station | null>(station);
  const [grams, setGrams] = useState(100);
  const [dispenseLoading, setDispenseLoading] = useState(false);
  const [dispenseMsg, setDispenseMsg] = useState('');
  const [cronExpr, setCronExpr] = useState('0 7 * * *');
  const [schedGrams, setSchedGrams] = useState(100);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedMsg, setSchedMsg] = useState('');

  useEffect(() => {
    setLiveStation(station);
    setTab('overview');
    setDispenseMsg('');
    setSchedMsg('');
  }, [station]);

  const handleMessage = useCallback((msg: WSMessage) => {
    if (!liveStation) return;
    if (msg.type === 'telemetry' && msg.station_id === liveStation.id) {
      setLiveStation((prev) => prev
        ? { ...prev, food_pct: msg.food_pct, battery_pct: msg.battery_pct, temp_c: msg.temp_c, humidity_pct: msg.humidity_pct }
        : prev);
    }
  }, [liveStation]);

  useWebSocket(handleMessage);

  async function handleDispense() {
    if (!liveStation) return;
    setDispenseLoading(true);
    setDispenseMsg('');
    const ok = await postDispense(liveStation.id, grams, token);
    setDispenseMsg(ok ? `Dispensed ${grams}g successfully!` : 'Failed — check connection.');
    setDispenseLoading(false);
  }

  async function handleSchedule() {
    if (!liveStation) return;
    setSchedLoading(true);
    setSchedMsg('');
    const ok = await postSchedule(liveStation.id, cronExpr, schedGrams, token);
    setSchedMsg(ok ? 'Schedule saved!' : 'Failed — check connection.');
    setSchedLoading(false);
  }

  const open = !!station;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.35)',
          zIndex: 100,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      />

      {/* Drawer */}
      <aside style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: 400,
        background: '#fff',
        zIndex: 101,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(15,23,42,0.12)',
      }}>
        {liveStation && (
          <>
            {/* Header */}
            <div style={{
              padding: '20px 20px 0',
              borderBottom: '1px solid var(--slate-100)',
              paddingBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-900)', marginBottom: 4 }}>
                    {liveStation.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                    {liveStation.station_code}
                  </div>
                  <TintedPill variant={statusVariant(liveStation.status)} label={statusLabel(liveStation.status)} />
                </div>
                <button
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: '1.5px solid var(--slate-200)',
                    background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={15} color="var(--slate-500)" strokeWidth={2} />
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 0, marginTop: 4 }}>
                {(['overview', 'controls'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      border: 'none',
                      borderBottom: `2px solid ${tab === t ? 'var(--orange-500)' : 'transparent'}`,
                      background: 'transparent',
                      fontSize: 13,
                      fontWeight: tab === t ? 700 : 500,
                      color: tab === t ? 'var(--orange-500)' : 'var(--slate-400)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {tab === 'overview' && (
                <>
                  {/* Camera placeholder */}
                  <div style={{
                    background: '#0f172a',
                    borderRadius: 12,
                    aspectRatio: '16/9',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {liveStation.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={liveStation.image_url}
                        alt={liveStation.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Camera feed unavailable</span>
                    )}
                    <div style={{
                      position: 'absolute', top: 10, left: 10,
                      background: 'rgba(239,68,68,0.9)',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.05em',
                    }}>
                      ● LIVE
                    </div>
                  </div>

                  {/* Info rows */}
                  <div>
                    <InfoRow label="City" value={`${liveStation.city}${liveStation.district ? `, ${liveStation.district}` : ''}`} />
                    <InfoRow label="Coordinates" value={`${liveStation.lat.toFixed(4)}, ${liveStation.lng.toFixed(4)}`} />
                    <InfoRow label="Food Level" value={`${liveStation.food_pct ?? 0}%`} />
                    <InfoRow label="Battery" value={`${liveStation.battery_pct ?? 100}%`} />
                    {liveStation.temp_c != null && liveStation.temp_c !== 0 && (
                      <InfoRow label="Temperature" value={`${liveStation.temp_c}°C`} />
                    )}
                    {liveStation.humidity_pct != null && liveStation.humidity_pct !== 0 && (
                      <InfoRow label="Humidity" value={`${liveStation.humidity_pct}%`} />
                    )}
                    <InfoRow label="Station ID" value={liveStation.id} />
                  </div>
                </>
              )}

              {tab === 'controls' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Dispense */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'var(--orange-50)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Zap size={14} color="var(--orange-500)" strokeWidth={2.5} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Dispense Food</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                      {GRAM_PRESETS.map((g) => (
                        <button
                          key={g}
                          onClick={() => setGrams(g)}
                          style={{
                            padding: '10px 4px',
                            borderRadius: 10,
                            border: '1.5px solid',
                            borderColor: grams === g ? 'var(--orange-500)' : 'var(--slate-200)',
                            background: grams === g ? 'var(--orange-50)' : '#fff',
                            color: grams === g ? 'var(--orange-600)' : 'var(--slate-600)',
                            fontSize: 13, fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {g}g
                        </button>
                      ))}
                    </div>

                    {dispenseMsg && (
                      <p style={{ fontSize: 12, color: dispenseMsg.includes('success') ? '#16a34a' : '#ef4444', marginBottom: 10 }}>
                        {dispenseMsg}
                      </p>
                    )}

                    <button
                      onClick={handleDispense}
                      disabled={dispenseLoading || liveStation.status === 'offline'}
                      style={{
                        width: '100%',
                        padding: '12px 0',
                        borderRadius: 12,
                        border: 'none',
                        background: dispenseLoading || liveStation.status === 'offline' ? 'var(--slate-200)' : 'var(--orange-500)',
                        color: '#fff',
                        fontSize: 14, fontWeight: 700,
                        cursor: dispenseLoading || liveStation.status === 'offline' ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {dispenseLoading ? 'Dispensing…' : `Dispense ${grams}g Now`}
                    </button>

                    {liveStation.status === 'offline' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <AlertTriangle size={13} color="#f59e0b" strokeWidth={2} />
                        <span style={{ fontSize: 12, color: '#92400e' }}>Station is offline — cannot dispense</span>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'var(--slate-50)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Calendar size={14} color="var(--slate-600)" strokeWidth={2} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Schedule</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 4 }}>
                          Cron expression
                        </label>
                        <input
                          value={cronExpr}
                          onChange={(e) => setCronExpr(e.target.value)}
                          placeholder="0 7 * * *"
                          style={{
                            width: '100%', padding: '9px 12px',
                            borderRadius: 8, border: '1.5px solid var(--slate-200)',
                            fontSize: 13, fontFamily: 'var(--font-mono)',
                            color: 'var(--slate-900)', outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 4 }}>
                          e.g. 0 7 * * * = daily at 07:00
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>
                          Amount (grams)
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                          {GRAM_PRESETS.map((g) => (
                            <button
                              key={g}
                              onClick={() => setSchedGrams(g)}
                              style={{
                                padding: '8px 4px',
                                borderRadius: 8,
                                border: '1.5px solid',
                                borderColor: schedGrams === g ? 'var(--slate-700)' : 'var(--slate-200)',
                                background: schedGrams === g ? 'var(--slate-800)' : '#fff',
                                color: schedGrams === g ? '#fff' : 'var(--slate-600)',
                                fontSize: 12, fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-sans)',
                              }}
                            >
                              {g}g
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {schedMsg && (
                      <p style={{ fontSize: 12, color: schedMsg.includes('saved') ? '#16a34a' : '#ef4444', marginBottom: 10 }}>
                        {schedMsg}
                      </p>
                    )}

                    <button
                      onClick={handleSchedule}
                      disabled={schedLoading}
                      style={{
                        width: '100%',
                        padding: '12px 0',
                        borderRadius: 12,
                        border: 'none',
                        background: schedLoading ? 'var(--slate-200)' : 'var(--slate-800)',
                        color: '#fff',
                        fontSize: 14, fontWeight: 700,
                        cursor: schedLoading ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {schedLoading ? 'Saving…' : 'Save Schedule'}
                    </button>
                  </div>

                  {/* Danger zone */}
                  <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <PawPrint size={13} color="var(--slate-400)" strokeWidth={2} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Station Detail Page
                      </span>
                    </div>
                    <Link
                      href={`/stations/${liveStation.id}`}
                      style={{
                        display: 'block',
                        textAlign: 'center',
                        padding: '10px 0',
                        borderRadius: 10,
                        border: '1.5px solid var(--slate-200)',
                        fontSize: 13, fontWeight: 600,
                        color: 'var(--slate-600)',
                        textDecoration: 'none',
                      }}
                    >
                      Open full page →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
