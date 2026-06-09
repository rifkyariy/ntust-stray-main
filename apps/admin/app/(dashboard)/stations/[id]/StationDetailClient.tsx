'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Station, WSMessage } from '@stray/ui';
import {
  TintedPill, PawPrint, ArrowLeft, Zap, Calendar, AlertTriangle,
  Video, ScanLine, ChevronDown, Plus, Trash2,
  Battery, Thermometer, Droplets,
} from '@stray/ui';
import { useWebSocket } from '../../../../hooks/useWebSocket';
import { useToast } from '../../../../hooks/useToast';
import ToastStack from '../../../../components/ToastStack';
import { postDispense, postSchedule, fetchSchedules, deleteSchedule } from '../../../../lib/api';

const StreamClient = dynamic(() => import('../../stream/StreamClient'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-400)', fontSize: 13 }}>
      Loading detection console…
    </div>
  ),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const GRAM_PRESETS   = [50, 100, 150, 200];
const REPEAT_OPTIONS = ['Daily', 'Weekdays', 'Weekends', 'Custom'] as const;
const DAY_SHORT      = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type Repeat = (typeof REPEAT_OPTIONS)[number];

interface FeedSlot { id: number; time: string; grams: number; active: boolean; }

function repeatToDays(r: Repeat): number[] {
  if (r === 'Daily')    return [0,1,2,3,4,5,6];
  if (r === 'Weekdays') return [1,2,3,4,5];
  if (r === 'Weekends') return [0,6];
  return [];
}

function daysToRepeat(days: number[]): Repeat {
  const s = [...days].sort((a,b)=>a-b).join(',');
  if (s === '0,1,2,3,4,5,6') return 'Daily';
  if (s === '1,2,3,4,5')     return 'Weekdays';
  if (s === '0,6')            return 'Weekends';
  return 'Custom';
}

function slotToCron(time: string, repeat: Repeat, customDays: number[]): string {
  const [h, m] = time.split(':').map(Number);
  const days =
    repeat === 'Daily'    ? '*' :
    repeat === 'Weekdays' ? '1-5' :
    repeat === 'Weekends' ? '0,6' :
    [...customDays].sort((a,b)=>a-b).join(',') || '*';
  return `${m} ${h} * * ${days}`;
}

function parseCron(expr: string): { time: string; days: number[] } | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, , , dow] = parts;
  const minutes = parseInt(m, 10);
  const hours = parseInt(h, 10);
  if (isNaN(minutes) || isNaN(hours)) return null;
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const days =
    dow === '*'   ? [0,1,2,3,4,5,6] :
    dow === '1-5' ? [1,2,3,4,5] :
    dow === '0,6' ? [0,6] :
    dow.split(',').map(Number).filter(n => !isNaN(n));
  return { time, days };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props { station: Station; token: string; detectorUrl: string; }

// ── Component ─────────────────────────────────────────────────────────────────

export default function StationDetailClient({ station: initial, token, detectorUrl }: Props) {
  const router = useRouter();
  const { toast, toasts, dismiss } = useToast();
  const [station, setStation] = useState<Station>(initial);
  const [showStream, setShowStream] = useState(false);

  // Dispense
  const [grams, setGrams] = useState(100);
  const [confirming, setConfirming] = useState(false);
  const [dispenseLoading, setDispenseLoading] = useState(false);
  const [dispensing, setDispensing]   = useState(false);   // servo is physically moving
  const [dispenseProgress, setDispenseProgress] = useState(0); // 0–1

  // Schedule — always in edit mode
  const nextSlotId = useRef(2);
  const [slots, setSlots]         = useState<FeedSlot[]>([{ id: 1, time: '07:00', grams: 100, active: true }]);
  const [repeat, setRepeat]       = useState<Repeat>('Weekdays');
  const [schedDays, setSchedDays] = useState<number[]>([1,2,3,4,5]);
  const [schedLoading, setSchedLoading] = useState(false);
  const existingScheduleIds = useRef<string[]>([]);

  // Load existing schedules from DB on mount
  useEffect(() => {
    fetchSchedules(station.id, token).then(scheds => {
      if (scheds.length === 0) return;
      existingScheduleIds.current = scheds.map(s => s.id);
      const first = parseCron(scheds[0].cron_expr);
      if (first) {
        const r = daysToRepeat(first.days);
        setRepeat(r);
        setSchedDays(first.days);
      }
      const loaded = scheds.map((s, i) => {
        const parsed = parseCron(s.cron_expr);
        return { id: i + 1, time: parsed?.time ?? '07:00', grams: s.grams, active: s.active };
      });
      nextSlotId.current = loaded.length + 1;
      setSlots(loaded);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station.id]);

  // ── WebSocket telemetry ──────────────────────────────────────────────────────

  const handleMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'telemetry' && msg.station_id === station.station_code) {
      setStation(prev => ({
        ...prev,
        food_pct: msg.food_pct,
        battery_pct: msg.battery_pct,
        temp_c: msg.temp_c,
        humidity_pct: msg.humidity_pct,
      }));
    }
  }, [station.station_code]);

  useWebSocket(handleMessage);

  // ── Dispense ─────────────────────────────────────────────────────────────────

  async function handleDispense() {
    setConfirming(false);
    setDispenseLoading(true);
    setDispenseProgress(0);
    const result = await postDispense(station.id, grams, token);
    setDispenseLoading(false);

    if (!result.ok) {
      if (result.status === 401) {
        router.push('/login');
        return;
      }
      const hint = result.status === 502 ? 'MQTT broker unreachable — check connection.'
                 : result.status === 0   ? 'Network error — check connection.'
                 : `Failed (${result.status}).`;
      toast('error', hint);
      return;
    }

    // Animate a progress bar for exactly as long as the servo takes
    const durationMs = result.dispensing_ms;
    const startTime  = performance.now();
    setDispensing(true);

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      setDispenseProgress(progress);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setDispensing(false);
        setDispenseProgress(0);
        toast('success', `Dispensed ${grams}g successfully!`);
      }
    };
    requestAnimationFrame(tick);
  }

  // ── Schedule slot helpers ────────────────────────────────────────────────────

  function addSlot() {
    setSlots(prev => [...prev, { id: nextSlotId.current++, time: '12:00', grams: 100, active: true }]);
  }

  function removeSlot(id: number) {
    setSlots(prev => prev.length > 1 ? prev.filter(s => s.id !== id) : prev);
  }

  function updateSlotTime(id: number, time: string) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, time } : s));
  }

  function updateSlotGrams(id: number, g: number) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, grams: g } : s));
  }

  function toggleSlotActive(id: number) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  }

  function toggleDay(d: number) {
    const next = schedDays.includes(d) ? schedDays.filter(x => x !== d) : [...schedDays, d];
    setSchedDays(next);
    setRepeat(daysToRepeat(next));
  }

  function selectRepeat(r: Repeat) {
    setRepeat(r);
    if (r !== 'Custom') setSchedDays(repeatToDays(r));
  }

  async function handleSchedule() {
    setSchedLoading(true);
    // Delete all existing DB schedule rows for this station
    if (existingScheduleIds.current.length > 0) {
      await Promise.allSettled(
        existingScheduleIds.current.map(id => deleteSchedule(station.id, id, token))
      );
      existingScheduleIds.current = [];
    }
    // Recreate from current slot state (active slots only)
    const activeSlots = slots.filter(s => s.active);
    const results = await Promise.allSettled(
      activeSlots.map(s => postSchedule(station.id, slotToCron(s.time, repeat, schedDays), s.grams, token))
    );
    const newIds: string[] = [];
    let allOk = true;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        newIds.push(r.value.id);
      } else {
        allOk = false;
      }
    }
    existingScheduleIds.current = newIds;
    if (allOk) {
      toast('success', `${activeSlots.length} schedule${activeSlots.length !== 1 ? 's' : ''} saved!`);
    } else {
      toast('error', 'Some schedules failed to save — check connection.');
    }
    setSchedLoading(false);
  }

  // ── Derived values ────────────────────────────────────────────────────────────

  const foodColor =
    (station.food_pct ?? 0) < 20 ? '#ef4444' :
    (station.food_pct ?? 0) < 40 ? '#fbbf24' : '#f97316';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* Topbar */}
      <div style={{
        height: 64, background: '#fff', borderBottom: '1px solid var(--slate-100)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <Link href="/stations" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--slate-500)', textDecoration: 'none' }}>
          <ArrowLeft size={15} strokeWidth={2} />
          All Stations
        </Link>
        <span style={{ color: 'var(--slate-300)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)' }}>{station.name}</span>
        <div style={{ marginLeft: 8 }}>
          <TintedPill variant={statusVariant(station.status)} label={statusLabel(station.status)} />
        </div>
      </div>

      <div style={{ padding: '28px 28px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Title */}
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

        {/* Live Detection accordion */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <button onClick={() => setShowStream(v => !v)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 18px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              background: showStream ? '#0d1117' : 'var(--slate-900)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            }}>
              <Video size={18} color={showStream ? '#f97316' : '#fff'} strokeWidth={2} />
              {!showStream && <span style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>Live Detection &amp; Analytics</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: '#ef4444', background: '#fef2f2', borderRadius: 20, padding: '2px 8px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                  LIVE
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 2 }}>AI cat detection · presence timeline · sightings feed</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--slate-500)', flexShrink: 0 }}>
              {showStream ? 'Hide' : 'Show'}
              <ChevronDown size={18} color="var(--slate-400)" style={{ transform: showStream ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
          </button>
          {showStream && <div style={{ padding: '0 14px 14px' }}><StreamClient detectorUrl={detectorUrl} embedded /></div>}
          {!showStream && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px 16px', color: 'var(--slate-400)', fontSize: 12 }}>
              <ScanLine size={14} strokeWidth={1.6} />
              Detection runs only while this panel is open.
            </div>
          )}
        </div>

        {/* Main 2-col layout: left info + right schedule */}
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Location Details */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '20px', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <PawPrint size={15} color="var(--slate-500)" strokeWidth={2} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Location Details</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-400)' }}>City</span>
                  <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{station.city}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-400)' }}>District</span>
                  <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{station.district ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--slate-400)' }}>Coordinates</span>
                  <span style={{ fontWeight: 600, color: 'var(--slate-800)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {station.lat.toFixed(4)}, {station.lng.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Metric cards in 2×2 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

              {/* Food */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '14px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <PawPrint size={12} color={foodColor} strokeWidth={2} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Food</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {station.food_pct ?? 0}<span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>%</span>
                </div>
                <div style={{ marginTop: 8, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${station.food_pct ?? 0}%`, background: foodColor, borderRadius: 2 }} />
                </div>
              </div>

              {/* Battery */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '14px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <Battery size={12} color="#22c55e" strokeWidth={2} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Battery</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  100<span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>%</span>
                </div>
                <div style={{ marginTop: 8, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '100%', background: '#22c55e', borderRadius: 2 }} />
                </div>
              </div>

              {/* Temp */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '14px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <Thermometer size={12} color="#ef4444" strokeWidth={2} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Temp</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {station.temp_c.toFixed(1)}<span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>°C</span>
                </div>
              </div>

              {/* Humidity */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '14px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <Droplets size={12} color="#3b82f6" strokeWidth={2} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Humidity</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {station.humidity_pct}<span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>%</span>
                </div>
              </div>

            </div>

            {/* Dispense Food */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '20px', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={15} color="#f97316" strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>Dispense Food</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                {GRAM_PRESETS.map((g) => (
                  <button key={g} onClick={() => !dispensing && setGrams(g)} style={{
                    padding: '10px 4px', borderRadius: 10,
                    border: `1.5px solid ${grams === g ? '#f97316' : '#e2e8f0'}`,
                    background: grams === g ? '#fff7ed' : '#f8fafc',
                    color: grams === g ? '#ea580c' : '#475569',
                    fontSize: 13, fontWeight: 600,
                    cursor: dispensing ? 'not-allowed' : 'pointer',
                    opacity: dispensing ? 0.5 : 1,
                    fontFamily: 'var(--font-sans)',
                  }}>{g}g</button>
                ))}
              </div>

              {/* Progress bar — shown while servo is physically moving */}
              {dispensing && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                    <span>Dispensing {grams}g…</span>
                    <span>{Math.round(dispenseProgress * 100)}%</span>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      background: 'linear-gradient(90deg, #fb923c, #f97316)',
                      width: `${dispenseProgress * 100}%`,
                      transition: 'width 0.05s linear',
                    }} />
                  </div>
                </div>
              )}

              {confirming && !dispensing ? (
                <div>
                  <p style={{ fontSize: 13, color: '#475569', textAlign: 'center', marginBottom: 10, marginTop: 0 }}>
                    Dispense <strong>{grams}g</strong> to this station now?
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      onClick={() => setConfirming(false)}
                      style={{
                        padding: '12px 0', borderRadius: 12,
                        border: '1.5px solid #e2e8f0', background: '#f8fafc',
                        color: '#475569', fontSize: 14, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDispense}
                      style={{
                        padding: '12px 0', borderRadius: 12, border: 'none',
                        background: 'linear-gradient(90deg, #fb923c, #f97316)',
                        color: '#fff', fontSize: 14, fontWeight: 700,
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
                  disabled={dispenseLoading || dispensing || station.status === 'offline'}
                  style={{
                    width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                    background: dispenseLoading || dispensing || station.status === 'offline' ? '#e2e8f0' : 'linear-gradient(90deg, #fb923c, #f97316)',
                    color: dispenseLoading || dispensing || station.status === 'offline' ? '#94a3b8' : '#fff',
                    fontSize: 14, fontWeight: 700,
                    cursor: dispenseLoading || dispensing || station.status === 'offline' ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {dispenseLoading ? 'Sending command…' : dispensing ? 'Motor running…' : `Dispense ${grams}g`}
                </button>
              )}

              {station.status === 'offline' && !dispensing && !confirming && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <AlertTriangle size={13} color="#f59e0b" strokeWidth={2} />
                  <span style={{ fontSize: 12, color: '#92400e' }}>Station offline</span>
                </div>
              )}
            </div>

          </div>

          {/* ── Right column: Schedule (always edit) ── */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '24px', border: '1px solid #f1f5f9' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={15} color="var(--slate-600)" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>Schedule</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Repeat presets */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-500)', display: 'block', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Repeat</label>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' as const }}>
                  {REPEAT_OPTIONS.map((r) => (
                    <button key={r} onClick={() => selectRepeat(r)} style={{
                      padding: '7px 16px', borderRadius: 9999, fontSize: 12, fontWeight: 700,
                      border: repeat === r ? '1.5px solid var(--slate-700)' : '1.5px solid #e2e8f0',
                      background: repeat === r ? 'var(--slate-800)' : '#f8fafc',
                      color: repeat === r ? '#fff' : 'var(--slate-500)',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.12s',
                    }}>{r}</button>
                  ))}
                </div>
              </div>

              {/* Day picker */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-500)', display: 'block', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Days</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {DAY_SHORT.map((label, d) => {
                    const active = schedDays.includes(d);
                    return (
                      <button key={d} onClick={() => toggleDay(d)} style={{
                        padding: '9px 2px', borderRadius: 9, fontSize: 11, fontWeight: 700,
                        border: `1.5px solid ${active ? 'var(--slate-700)' : '#e2e8f0'}`,
                        background: active ? 'var(--slate-800)' : '#fff',
                        color: active ? '#fff' : 'var(--slate-400)',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'center', transition: 'all 0.12s',
                      }}>{label}</button>
                    );
                  })}
                </div>
              </div>

              {/* Feed slots */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-500)', display: 'block', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Feed times</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {slots.map((slot) => (
                    <div key={slot.id} style={{
                      background: slot.active ? '#f8fafc' : '#f8f9fa',
                      borderRadius: 14, padding: '14px',
                      border: `1.5px solid ${slot.active ? '#e2e8f0' : '#f1f5f9'}`,
                      opacity: slot.active ? 1 : 0.55,
                      transition: 'opacity 0.2s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>

                        {/* Active toggle switch */}
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          <input
                            type="checkbox"
                            checked={slot.active}
                            onChange={() => toggleSlotActive(slot.id)}
                            style={{ display: 'none' }}
                          />
                          <div style={{
                            width: 38, height: 21, borderRadius: 10.5, flexShrink: 0, cursor: 'pointer',
                            background: slot.active ? '#f97316' : '#e2e8f0',
                            position: 'relative', transition: 'background 0.2s',
                          }}>
                            <div style={{
                              position: 'absolute', top: 2.5,
                              left: slot.active ? 19 : 2.5,
                              width: 16, height: 16, borderRadius: '50%', background: '#fff',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.18)', transition: 'left 0.18s',
                            }} />
                          </div>
                        </label>

                        <input
                          type="time"
                          value={slot.time}
                          onChange={(e) => updateSlotTime(slot.id, e.target.value)}
                          style={{
                            flex: 1, padding: '8px 10px', borderRadius: 9,
                            border: '1.5px solid #e2e8f0', background: '#fff',
                            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18,
                            color: 'var(--slate-900)', outline: 'none', boxSizing: 'border-box' as const,
                          }}
                        />
                        {slots.length > 1 && (
                          <button onClick={() => removeSlot(slot.id)} style={{
                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                            border: '1.5px solid #fecaca', background: '#fef2f2',
                            display: 'grid', placeItems: 'center', cursor: 'pointer',
                          }}>
                            <Trash2 size={13} color="#ef4444" strokeWidth={2} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {GRAM_PRESETS.map((g) => (
                          <button key={g} onClick={() => updateSlotGrams(slot.id, g)} style={{
                            padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            border: slot.grams === g ? '1.5px solid var(--slate-700)' : '1.5px solid #e2e8f0',
                            background: slot.grams === g ? 'var(--slate-800)' : '#fff',
                            color: slot.grams === g ? '#fff' : 'var(--slate-500)',
                            cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          }}>{g}g</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={addSlot} style={{
                  width: '100%', marginTop: 10, padding: '10px 0', borderRadius: 11,
                  border: '1.5px dashed #cbd5e1', background: 'transparent',
                  color: 'var(--slate-500)', fontSize: 12, fontWeight: 700,
                  display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 6,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                  <Plus size={13} strokeWidth={2.5} />
                  Add time
                </button>
              </div>

              {/* Cron preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {slots.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)', opacity: s.active ? 1 : 0.4 }}>
                      {slotToCron(s.time, repeat, schedDays)}
                    </span>
                    {!s.active && (
                      <span style={{ fontSize: 9, color: '#94a3b8', background: '#f1f5f9', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>disabled</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Save action */}
              <button onClick={handleSchedule} disabled={schedLoading} style={{
                width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                background: schedLoading ? '#e2e8f0' : 'var(--slate-800)',
                color: schedLoading ? '#94a3b8' : '#fff', fontSize: 14, fontWeight: 700,
                cursor: schedLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
              }}>{schedLoading ? 'Saving…' : 'Save Schedule'}</button>

            </div>
          </div>

        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
