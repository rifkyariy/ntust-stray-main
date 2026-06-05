'use client';
import { useState, useEffect } from 'react';
import { X, Check } from '@stray/ui';
import { Calendar } from '@stray/ui';
import type { Station } from '@stray/ui';

const GRAM_PRESETS   = [50, 100, 150, 200];
const REPEAT_OPTIONS = ['Once', 'Daily', 'Weekdays', 'Weekends'];

interface ScheduleBottomSheetProps {
  station: Station | null;   // null = closed
  onClose: () => void;
}

export function ScheduleBottomSheet({ station, onClose }: ScheduleBottomSheetProps) {
  const [time,   setTime]   = useState('08:00');
  const [repeat, setRepeat] = useState('Daily');
  const [grams,  setGrams]  = useState(100);
  const [done,   setDone]   = useState(false);
  const isOpen = !!station;

  // Reset when the sheet opens
  useEffect(() => {
    if (isOpen) { setTime('08:00'); setRepeat('Daily'); setGrams(100); setDone(false); }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.4)',
          zIndex: 84,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: '50%',
        width: '100%', maxWidth: 390,
        background: '#fff',
        borderRadius: '20px 20px 0 0',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        zIndex: 85,
        transform: isOpen
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(100%)',
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
          padding: '10px 20px 14px',
          borderBottom: '1px solid #f1f5f9',
          flexShrink: 0,
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
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: '1.5px solid #f1f5f9', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={14} color="#94a3b8" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {done ? (
            /* ── Success state ── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0 12px', textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: '#dcfce7', display: 'grid', placeItems: 'center',
                marginBottom: 20, boxShadow: '0 0 32px rgba(34,197,94,0.3)',
              }}>
                <Check size={32} color="#16a34a" strokeWidth={2.5} />
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, color: '#1e293b', letterSpacing: '-0.02em', marginBottom: 8 }}>
                Scheduled!
              </div>
              <p style={{ fontFamily: 'var(--font-sans)', color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                <strong>{grams}g</strong> will dispense at <strong>{time}</strong> ({repeat.toLowerCase()}) at {station?.name}.
              </p>
              <button
                onClick={onClose}
                style={{
                  background: 'linear-gradient(90deg, #fb923c, #f97316)',
                  color: '#fff', border: 0, padding: '13px 0', borderRadius: 14,
                  fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
                  cursor: 'pointer', boxShadow: '0 6px 16px rgba(249,115,22,0.3)', width: '100%',
                }}
              >
                Done
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <>
              {/* Time picker */}
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>
                  Time
                </div>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 14,
                    border: '1.5px solid #e2e8f0', background: '#f8fafc',
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 26,
                    color: '#1e293b', outline: 'none', boxSizing: 'border-box',
                    letterSpacing: '0.04em',
                  }}
                />
              </div>

              {/* Repeat pills */}
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>
                  Repeat
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {REPEAT_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRepeat(r)}
                      style={{
                        padding: '8px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 700,
                        border: repeat === r ? '1.5px solid #fed7aa' : '1.5px solid #e2e8f0',
                        background: repeat === r ? '#fff7ed' : '#f8fafc',
                        color: repeat === r ? '#ea580c' : '#475569',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        transition: 'all 0.12s',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gram presets */}
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>
                  Portion
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {GRAM_PRESETS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrams(g)}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: 14, fontSize: 14, fontWeight: 800,
                        border: grams === g ? '2px solid #f97316' : '2px solid #f1f5f9',
                        background: grams === g ? '#fff7ed' : '#f8fafc',
                        color: grams === g ? '#ea580c' : '#1e293b',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        transition: 'all 0.12s',
                      }}
                    >
                      {g}g
                    </button>
                  ))}
                </div>
              </div>

              {/* Confirm button */}
              <button
                onClick={() => setDone(true)}
                style={{
                  width: '100%', padding: '15px 0', borderRadius: 14,
                  background: 'linear-gradient(90deg, #fb923c, #f97316)',
                  color: '#fff', border: 0, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
                  display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8,
                  boxShadow: '0 6px 18px rgba(249,115,22,0.28)',
                  marginTop: 4,
                }}
              >
                <Calendar size={17} color="#fff" strokeWidth={2} />
                Confirm — {grams}g {repeat.toLowerCase()} at {time}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
