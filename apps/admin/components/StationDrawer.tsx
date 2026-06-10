'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Station, WSMessage } from '@stray/ui';
import {
  TintedPill, Zap, X, AlertTriangle,
  Battery, Thermometer, Droplets, PawPrint,
} from '@stray/ui';
import { useWebSocket } from '../hooks/useWebSocket';
import { useToast } from '../hooks/useToast';
import ToastStack from './ToastStack';
import { postDispense } from '../lib/api';

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

const GRAM_PRESETS = [50, 100, 150, 200];

interface StationDrawerProps {
  station: Station | null;
  token: string;
  onClose: () => void;
}

export default function StationDrawer({ station, token, onClose }: StationDrawerProps) {
  const [liveStation, setLiveStation] = useState<Station | null>(station);
  const { toast, toasts, dismiss } = useToast();
  const [grams, setGrams] = useState(100);
  const [confirming, setConfirming] = useState(false);
  const [dispenseLoading, setDispenseLoading] = useState(false);

  useEffect(() => {
    setLiveStation(station);
    setConfirming(false);
  }, [station]);

  const handleMessage = useCallback((msg: WSMessage) => {
    if (!liveStation) return;
    if (msg.type === 'telemetry' && msg.station_id === liveStation.station_code) {
      setLiveStation((prev) => prev
        ? { ...prev, food_pct: msg.food_pct, battery_pct: msg.battery_pct, temp_c: msg.temp_c, humidity_pct: msg.humidity_pct }
        : prev);
    }
    if (msg.type === 'station_status' && msg.station_id === liveStation.station_code) {
      setLiveStation((prev) => prev ? { ...prev, status: msg.status } : prev);
    }
  }, [liveStation]);

  useWebSocket(handleMessage);

  async function handleDispense() {
    if (!liveStation) return;
    setConfirming(false);
    setDispenseLoading(true);
    const result = await postDispense(liveStation.id, grams, token);
    if (result.ok) {
      toast('success', `Dispensed ${grams}g successfully!`);
    } else {
      toast('error',
        result.status === 401 ? 'Session expired — please log in again.' :
        result.status === 502 ? 'MQTT broker unreachable.' :
        'Failed — check connection.',
      );
    }
    setDispenseLoading(false);
  }

  const open = !!station;
  const foodPct  = liveStation?.food_pct  ?? 0;
  const batPct   = liveStation?.battery_pct ?? 100;
  const tempC    = liveStation?.temp_c    ?? 0;
  const humPct   = liveStation?.humidity_pct ?? 0;

  const foodColor = foodPct < 20 ? '#ef4444' : foodPct < 40 ? '#fbbf24' : '#f97316';
  const batColor  = batPct  < 20 ? '#ef4444' : batPct  < 50 ? '#fbbf24' : '#22c55e';

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
        width: 380,
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
              padding: '18px 18px 14px',
              borderBottom: '1px solid var(--slate-100)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--slate-900)', marginBottom: 3 }}>
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
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <X size={15} color="var(--slate-500)" strokeWidth={2} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 24px' }}>

              {/* Camera */}
              <div style={{
                background: '#0f172a',
                borderRadius: 12,
                aspectRatio: '16/9',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src="/video/dummy.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.88 }}
                />
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

              {/* 4 metric cards — 2×2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>

                {/* Food */}
                <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 14px 12px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <PawPrint size={12} color={foodColor} strokeWidth={2} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Food</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {foodPct}<span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>%</span>
                  </div>
                  <div style={{ marginTop: 8, height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${foodPct}%`, background: foodColor, borderRadius: 2, transition: 'width 0.4s' }} />
                  </div>
                </div>

                {/* Battery */}
                <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 14px 12px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <Battery size={12} color={batColor} strokeWidth={2} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Battery</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {batPct}<span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>%</span>
                  </div>
                  <div style={{ marginTop: 8, height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${batPct}%`, background: batColor, borderRadius: 2, transition: 'width 0.4s' }} />
                  </div>
                </div>

                {/* Temperature */}
                <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 14px 12px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <Thermometer size={12} color="#ef4444" strokeWidth={2} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Temp</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {tempC.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>°C</span>
                  </div>
                </div>

                {/* Humidity */}
                <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 14px 12px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <Droplets size={12} color="#3b82f6" strokeWidth={2} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Humidity</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {humPct}<span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>%</span>
                  </div>
                </div>

              </div>

              {/* Dispense */}
              <div style={{
                background: '#fff',
                borderRadius: 14,
                border: '1.5px solid #f1f5f9',
                padding: '16px',
                marginBottom: 16,
              }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7, marginBottom: 12 }}>
                  {GRAM_PRESETS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrams(g)}
                      style={{
                        padding: '9px 4px',
                        borderRadius: 9,
                        border: '1.5px solid',
                        borderColor: grams === g ? 'var(--orange-500)' : 'var(--slate-200)',
                        background: grams === g ? 'var(--orange-50)' : '#f8fafc',
                        color: grams === g ? 'var(--orange-600)' : 'var(--slate-600)',
                        fontSize: 12, fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {g}g
                    </button>
                  ))}
                </div>

                {confirming ? (
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--slate-600)', textAlign: 'center', marginBottom: 8, marginTop: 0 }}>
                      Dispense <strong>{grams}g</strong> now?
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button
                        onClick={() => setConfirming(false)}
                        style={{
                          padding: '11px 0', borderRadius: 11,
                          border: '1.5px solid var(--slate-200)',
                          background: '#f8fafc',
                          color: 'var(--slate-600)',
                          fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDispense}
                        style={{
                          padding: '11px 0', borderRadius: 11,
                          border: 'none',
                          background: 'linear-gradient(90deg, #fb923c, #f97316)',
                          color: '#fff',
                          fontSize: 13, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    disabled={dispenseLoading || liveStation.status === 'offline'}
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      borderRadius: 11,
                      border: 'none',
                      background: dispenseLoading || liveStation.status === 'offline'
                        ? 'var(--slate-200)'
                        : 'linear-gradient(90deg, #fb923c, #f97316)',
                      color: dispenseLoading || liveStation.status === 'offline' ? '#94a3b8' : '#fff',
                      fontSize: 14, fontWeight: 700,
                      cursor: dispenseLoading || liveStation.status === 'offline' ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {dispenseLoading ? 'Dispensing…' : `Dispense ${grams}g Now`}
                  </button>
                )}

                {liveStation.status === 'offline' && !confirming && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <AlertTriangle size={13} color="#f59e0b" strokeWidth={2} />
                    <span style={{ fontSize: 12, color: '#92400e' }}>Station offline — cannot dispense</span>
                  </div>
                )}
              </div>

              {/* Open full page */}
              <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: 16 }}>
                <Link
                  href={`/stations/${liveStation.id}`}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '11px 0',
                    borderRadius: 10,
                    border: '1.5px solid var(--slate-200)',
                    fontSize: 13, fontWeight: 600,
                    color: 'var(--slate-600)',
                    textDecoration: 'none',
                    background: '#f8fafc',
                  }}
                >
                  Open full page →
                </Link>
              </div>

            </div>
          </>
        )}
      </aside>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
