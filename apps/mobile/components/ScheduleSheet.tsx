'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ArrowLeft, Check } from '@stray/ui';
import type { Station } from '@stray/ui';

const GRAM_PRESETS = [50, 100, 150, 200];
const REPEAT_OPTIONS = ['Once', 'Daily', 'Weekdays', 'Weekends'];

export function ScheduleSheet({ station }: { station: Station }) {
  const router = useRouter();
  const [time, setTime] = useState('08:00');
  const [repeat, setRepeat] = useState('Daily');
  const [grams, setGrams] = useState(100);
  const [done, setDone] = useState(false);

  // ── Success state ──
  if (done) {
    return (
      <div style={{
        minHeight: '100vh', background: '#FDFBF7',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: '#dcfce7',
            display: 'grid', placeItems: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 0 40px rgba(34,197,94,0.35)',
          }}>
            <Check size={40} color="#16a34a" strokeWidth={2.5} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 28, color: '#1e293b', letterSpacing: '-0.03em', marginBottom: 10 }}>
            Scheduled!
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', color: '#64748b', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
            <strong>{grams}g</strong> will be dispensed at <strong>{time}</strong> ({repeat.toLowerCase()}) at {station.name}.
          </p>
          <button
            onClick={() => router.back()}
            style={{
              background: 'linear-gradient(90deg, #fb923c, #f97316)',
              color: '#fff', border: 0,
              padding: '14px 32px', borderRadius: 16,
              fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
              cursor: 'pointer', boxShadow: '0 6px 18px rgba(249,115,22,0.3)',
            }}
          >
            Back to station
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ──
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: '#fff',
        padding: '14px 16px 12px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: '#f1f5f9', border: 0, borderRadius: 10,
            padding: 9, cursor: 'pointer', display: 'grid', placeItems: 'center',
            flexShrink: 0,
          }}
        >
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
        {/* Time picker */}
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 12 }}>
            Time
          </div>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 14,
              border: '1.5px solid #e2e8f0', background: '#f8fafc',
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 28,
              color: '#1e293b', outline: 'none', boxSizing: 'border-box',
              letterSpacing: '0.04em',
            }}
          />
        </div>

        {/* Repeat */}
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 12 }}>
            Repeat
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {REPEAT_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRepeat(r)}
                style={{
                  padding: '8px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 700,
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
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 12 }}>
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

        {/* Confirm */}
        <button
          onClick={() => setDone(true)}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 16,
            background: 'linear-gradient(90deg, #fb923c, #f97316)',
            color: '#fff', border: 0, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16,
            display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            boxShadow: '0 8px 20px rgba(249,115,22,0.3)',
          }}
        >
          <Calendar size={18} color="#fff" strokeWidth={2} />
          Confirm — {grams}g {repeat.toLowerCase()} at {time}
        </button>
      </div>
    </div>
  );
}
