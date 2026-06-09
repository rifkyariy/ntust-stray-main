'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ArrowLeft, Check, Plus, Trash2 } from '@stray/ui';
import { postSchedule } from '../lib/api';
import type { Station } from '@stray/ui';

const GRAM_PRESETS = [50, 100, 150, 200];
const REPEAT_OPTIONS = ['Once', 'Daily', 'Weekdays', 'Weekends', 'Custom'] as const;
const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type Repeat = (typeof REPEAT_OPTIONS)[number];

interface FeedSlot { id: number; time: string; grams: number; }

function toCron(time: string, repeat: Repeat, customDays: number[]): string {
  const [h, m] = time.split(':').map(Number);
  const days =
    repeat === 'Daily'    ? '*' :
    repeat === 'Weekdays' ? '1-5' :
    repeat === 'Weekends' ? '0,6' :
    repeat === 'Once'     ? '*' :
    [...customDays].sort((a, b) => a - b).join(',') || '*';
  return `${m} ${h} * * ${days}`;
}

export function ScheduleSheet({ station }: { station: Station }) {
  const router = useRouter();
  const nextId = useRef(2);
  const [slots, setSlots]           = useState<FeedSlot[]>([{ id: 1, time: '08:00', grams: 100 }]);
  const [repeat, setRepeat]         = useState<Repeat>('Daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [saveError, setSaveError]   = useState(false);

  function addSlot() {
    setSlots(prev => [...prev, { id: nextId.current++, time: '12:00', grams: 100 }]);
  }

  function removeSlot(id: number) {
    setSlots(prev => prev.length > 1 ? prev.filter(s => s.id !== id) : prev);
  }

  function updateTime(id: number, time: string) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, time } : s));
  }

  function updateGrams(id: number, grams: number) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, grams } : s));
  }

  function toggleDay(d: number) {
    setCustomDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  async function handleConfirm() {
    setLoading(true);
    setSaveError(false);
    const results = await Promise.allSettled(
      slots.map(s => postSchedule(station.id, toCron(s.time, repeat, customDays), s.grams))
    );
    const allOk = results.every(r => r.status === 'fulfilled' && r.value === true);
    setLoading(false);
    if (allOk) {
      setDone(true);
    } else {
      setSaveError(true);
    }
  }

  const repeatLabel =
    repeat === 'Custom'
      ? (customDays.length === 7 ? 'Every day' :
         customDays.length === 0 ? 'No days' :
         [...customDays].sort((a,b)=>a-b).map(d => DAY_SHORT[d]).join(', '))
      : repeat.toLowerCase();

  // ── Success state ──
  if (done) {
    return (
      <div style={{
        minHeight: '100vh', background: '#FDFBF7',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%', background: '#dcfce7',
            display: 'grid', placeItems: 'center', margin: '0 auto 24px',
            boxShadow: '0 0 40px rgba(34,197,94,0.35)',
          }}>
            <Check size={40} color="#16a34a" strokeWidth={2.5} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 28, color: '#1e293b', letterSpacing: '-0.03em', marginBottom: 10 }}>
            Scheduled!
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', color: '#64748b', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
            <strong>{slots.length} meal{slots.length > 1 ? 's' : ''}</strong> scheduled <strong>{repeatLabel}</strong> at {station.name}.
          </p>
          <button onClick={() => router.back()} style={{
            background: 'linear-gradient(90deg, #fb923c, #f97316)',
            color: '#fff', border: 0, padding: '14px 32px', borderRadius: 16,
            fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', boxShadow: '0 6px 18px rgba(249,115,22,0.3)',
          }}>Back to station</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: '#fff', padding: '14px 16px 12px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => router.back()} style={{
          background: '#f1f5f9', border: 0, borderRadius: 10,
          padding: 9, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <ArrowLeft size={18} color="#475569" strokeWidth={2} />
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18, color: '#1e293b', letterSpacing: '-0.02em' }}>
            Schedule a meal
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#94a3b8' }}>
            {station.name} · {station.station_code}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Feed times */}
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 14 }}>
            Feed times
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {slots.map((slot) => (
              <div key={slot.id} style={{
                background: '#f8fafc', borderRadius: 16, padding: '14px 14px',
                border: '1.5px solid #e2e8f0',
              }}>
                {/* Time input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <input
                    type="time"
                    value={slot.time}
                    onChange={(e) => updateTime(slot.id, e.target.value)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 12,
                      border: '1.5px solid #e2e8f0', background: '#fff',
                      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22,
                      color: '#1e293b', outline: 'none', boxSizing: 'border-box',
                      letterSpacing: '0.04em',
                    }}
                  />
                  {slots.length > 1 && (
                    <button onClick={() => removeSlot(slot.id)} style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      border: '1.5px solid #fecaca', background: '#fef2f2',
                      display: 'grid', placeItems: 'center', cursor: 'pointer',
                    }}>
                      <Trash2 size={14} color="#ef4444" strokeWidth={2} />
                    </button>
                  )}
                </div>

                {/* Gram selector */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {GRAM_PRESETS.map((g) => (
                    <button key={g} onClick={() => updateGrams(slot.id, g)} style={{
                      flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 800,
                      border: slot.grams === g ? '2px solid #f97316' : '2px solid #e2e8f0',
                      background: slot.grams === g ? '#fff7ed' : '#fff',
                      color: slot.grams === g ? '#ea580c' : '#94a3b8',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}>{g}g</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={addSlot} style={{
            width: '100%', marginTop: 10, padding: '11px 0', borderRadius: 14,
            border: '1.5px dashed #cbd5e1', background: 'transparent',
            color: '#64748b', fontSize: 13, fontWeight: 700,
            display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 6,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}>
            <Plus size={15} strokeWidth={2.5} />
            Add another time
          </button>
        </div>

        {/* Repeat */}
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 12 }}>
            Repeat
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {REPEAT_OPTIONS.map((r) => (
              <button key={r} onClick={() => setRepeat(r)} style={{
                padding: '8px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 700,
                border: repeat === r ? '1.5px solid #fed7aa' : '1.5px solid #e2e8f0',
                background: repeat === r ? '#fff7ed' : '#f8fafc',
                color: repeat === r ? '#ea580c' : '#475569',
                cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.12s',
              }}>{r}</button>
            ))}
          </div>

          {/* Custom day picker */}
          {repeat === 'Custom' && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Select days
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {DAY_SHORT.map((label, d) => {
                  const active = customDays.includes(d);
                  return (
                    <button key={d} onClick={() => toggleDay(d)} style={{
                      padding: '9px 2px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                      border: active ? '1.5px solid #fed7aa' : '1.5px solid #e2e8f0',
                      background: active ? '#fff7ed' : '#f8fafc',
                      color: active ? '#ea580c' : '#94a3b8',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'center',
                      transition: 'all 0.12s',
                    }}>{label}</button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Error banner */}
        {saveError && (
          <div style={{
            background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 14,
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#b91c1c' }}>
                Failed to save schedule
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#dc2626', marginTop: 2 }}>
                Check your connection and try again.
              </div>
            </div>
          </div>
        )}

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          disabled={loading}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 16,
            background: loading ? '#e2e8f0' : 'linear-gradient(90deg, #fb923c, #f97316)',
            color: loading ? '#94a3b8' : '#fff', border: 0,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16,
            display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            boxShadow: loading ? 'none' : '0 8px 20px rgba(249,115,22,0.3)',
          }}
        >
          <Calendar size={18} color={loading ? '#94a3b8' : '#fff'} strokeWidth={2} />
          {loading
            ? 'Saving…'
            : saveError
            ? 'Retry'
            : `Confirm — ${slots.length} meal${slots.length > 1 ? 's' : ''} · ${repeatLabel}`}
        </button>
      </div>
    </div>
  );
}
