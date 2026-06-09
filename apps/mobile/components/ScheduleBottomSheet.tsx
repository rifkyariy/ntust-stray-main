'use client';
import { useState, useEffect, useRef } from 'react';
import { X, Check, Calendar, Plus, Trash2 } from '@stray/ui';
import { postSchedule } from '../lib/api';
import type { Station } from '@stray/ui';

const GRAM_PRESETS   = [50, 100, 150, 200];
const REPEAT_OPTIONS = ['Once', 'Daily', 'Weekdays', 'Weekends', 'Custom'] as const;
const DAY_SHORT      = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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

interface Props {
  station: Station | null;
  onClose: () => void;
}

export function ScheduleBottomSheet({ station, onClose }: Props) {
  const nextId = useRef(2);
  const [slots, setSlots]           = useState<FeedSlot[]>([{ id: 1, time: '08:00', grams: 100 }]);
  const [repeat, setRepeat]         = useState<Repeat>('Daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const isOpen = !!station;

  useEffect(() => {
    if (isOpen) {
      setSlots([{ id: 1, time: '08:00', grams: 100 }]);
      nextId.current = 2;
      setRepeat('Daily');
      setCustomDays([1, 2, 3, 4, 5]);
      setLoading(false);
      setDone(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [isOpen, onClose]);

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
    if (!station) return;
    setLoading(true);
    await Promise.allSettled(
      slots.map(s => postSchedule(station.id, toCron(s.time, repeat, customDays), s.grams))
    );
    setDone(true);
    setLoading(false);
  }

  const repeatLabel =
    repeat === 'Custom'
      ? (customDays.length === 7 ? 'every day' :
         customDays.length === 0 ? 'no days' :
         [...customDays].sort((a,b)=>a-b).map(d => DAY_SHORT[d]).join(', '))
      : repeat.toLowerCase();

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.4)', zIndex: 84,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 0.25s ease',
      }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        width: '100%', maxWidth: 390,
        background: '#fff', borderRadius: '20px 20px 0 0',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        zIndex: 85,
        transform: isOpen ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 -4px 32px rgba(15,23,42,0.12)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px 14px', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 2 }}>
              Schedule a meal
            </div>
            {station && (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94a3b8' }}>
                {station.name} · {station.station_code}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8,
            border: '1.5px solid #f1f5f9', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>
            <X size={14} color="#94a3b8" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {done ? (
            /* ── Success ── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0 12px', textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', background: '#dcfce7',
                display: 'grid', placeItems: 'center', marginBottom: 20,
                boxShadow: '0 0 32px rgba(34,197,94,0.3)',
              }}>
                <Check size={32} color="#16a34a" strokeWidth={2.5} />
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, color: '#1e293b', letterSpacing: '-0.02em', marginBottom: 8 }}>
                Scheduled!
              </div>
              <p style={{ fontFamily: 'var(--font-sans)', color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                <strong>{slots.length} meal{slots.length > 1 ? 's' : ''}</strong> will be served <strong>{repeatLabel}</strong> at {station?.name}.
              </p>
              <button onClick={onClose} style={{
                background: 'linear-gradient(90deg, #fb923c, #f97316)',
                color: '#fff', border: 0, padding: '13px 0', borderRadius: 14,
                fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
                cursor: 'pointer', boxShadow: '0 6px 16px rgba(249,115,22,0.3)', width: '100%',
              }}>Done</button>
            </div>
          ) : (
            <>
              {/* Feed times */}
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>
                  Feed times
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {slots.map((slot) => (
                    <div key={slot.id} style={{
                      background: '#f8fafc', borderRadius: 16, padding: '12px',
                      border: '1.5px solid #e2e8f0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <input
                          type="time"
                          value={slot.time}
                          onChange={(e) => updateTime(slot.id, e.target.value)}
                          style={{
                            flex: 1, padding: '8px 10px', borderRadius: 10,
                            border: '1.5px solid #e2e8f0', background: '#fff',
                            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20,
                            color: '#1e293b', outline: 'none', boxSizing: 'border-box',
                            letterSpacing: '0.04em',
                          }}
                        />
                        {slots.length > 1 && (
                          <button onClick={() => removeSlot(slot.id)} style={{
                            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                            border: '1.5px solid #fecaca', background: '#fef2f2',
                            display: 'grid', placeItems: 'center', cursor: 'pointer',
                          }}>
                            <Trash2 size={13} color="#ef4444" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {GRAM_PRESETS.map((g) => (
                          <button key={g} onClick={() => updateGrams(slot.id, g)} style={{
                            flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 800,
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
                  width: '100%', marginTop: 8, padding: '10px 0', borderRadius: 12,
                  border: '1.5px dashed #cbd5e1', background: 'transparent',
                  color: '#64748b', fontSize: 12, fontWeight: 700,
                  display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 6,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                  <Plus size={13} strokeWidth={2.5} />
                  Add another time
                </button>
              </div>

              {/* Repeat */}
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>
                  Repeat
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {REPEAT_OPTIONS.map((r) => (
                    <button key={r} onClick={() => setRepeat(r)} style={{
                      padding: '7px 13px', borderRadius: 9999, fontSize: 12, fontWeight: 700,
                      border: repeat === r ? '1.5px solid #fed7aa' : '1.5px solid #e2e8f0',
                      background: repeat === r ? '#fff7ed' : '#f8fafc',
                      color: repeat === r ? '#ea580c' : '#475569',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.12s',
                    }}>{r}</button>
                  ))}
                </div>

                {repeat === 'Custom' && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Select days
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
                      {DAY_SHORT.map((label, d) => {
                        const active = customDays.includes(d);
                        return (
                          <button key={d} onClick={() => toggleDay(d)} style={{
                            padding: '8px 2px', borderRadius: 9, fontSize: 11, fontWeight: 800,
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

              {/* Confirm */}
              <button
                onClick={handleConfirm}
                disabled={loading}
                style={{
                  width: '100%', padding: '15px 0', borderRadius: 14,
                  background: loading ? '#e2e8f0' : 'linear-gradient(90deg, #fb923c, #f97316)',
                  color: loading ? '#94a3b8' : '#fff', border: 0,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
                  display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8,
                  boxShadow: loading ? 'none' : '0 6px 18px rgba(249,115,22,0.28)', marginTop: 4,
                }}
              >
                <Calendar size={17} color={loading ? '#94a3b8' : '#fff'} strokeWidth={2} />
                {loading
                  ? 'Saving…'
                  : `Confirm — ${slots.length} meal${slots.length > 1 ? 's' : ''} · ${repeatLabel}`}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
