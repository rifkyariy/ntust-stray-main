'use client';
import { useState, useEffect } from 'react';

// Monthly activity heatmap calendar.
// Each day cell is coloured by feeding count: 0=slate, 1-2=light orange, 3-5=orange, 6+=deep orange.
// Tapping a day fires onDayClick(dateStr).

const TZ = 'Asia/Taipei';

function twDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

function heatColor(count: number): string {
  if (count === 0) return '#f1f5f9';
  if (count <= 2) return '#ffedd5';
  if (count <= 5) return '#fb923c';
  return '#f97316';
}

interface MonthlyHeatmapProps {
  year?: number;
  month?: number; // 0-indexed (0 = Jan)
  /** Map of "YYYY-MM-DD" → count */
  data?: Record<string, number>;
  onDayClick?: (dateStr: string) => void;
}

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function MonthlyHeatmap({
  year,
  month,
  data = {},
  onDayClick,
}: MonthlyHeatmapProps) {
  // Compute today in Taiwan timezone only on the client to avoid SSR mismatch
  const [todayTW, setTodayTW] = useState('');
  useEffect(() => {
    setTodayTW(twDateStr());
  }, []);

  // Derive year/month from Taiwan today once available, or fall back to UTC for SSR skeleton
  const resolvedYear  = year  ?? (todayTW ? parseInt(todayTW.slice(0, 4))  : new Date().getFullYear());
  const resolvedMonth = month ?? (todayTW ? parseInt(todayTW.slice(5, 7)) - 1 : new Date().getMonth());

  const firstDay   = new Date(resolvedYear, resolvedMonth, 1).getDay();
  const daysInMonth = new Date(resolvedYear, resolvedMonth + 1, 0).getDate();

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const cells: Array<{ day: number | null }> = [
    ...Array.from({ length: firstDay }, () => ({ day: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1 })),
  ];

  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      padding: '18px 18px 16px',
      border: '1px solid #f1f5f9',
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
          {MONTH_NAMES[resolvedMonth]} {resolvedYear}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[0, 2, 5, 7].map((n) => (
            <div key={n} style={{ width: 10, height: 10, borderRadius: 2, background: heatColor(n) }} />
          ))}
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#94a3b8', marginLeft: 2 }}>
            activity
          </span>
        </div>
      </div>

      {/* Day-of-week labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
        {DOW_LABELS.map((l, i) => (
          <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 700, color: '#cbd5e1' }}>
            {l}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map(({ day }, idx) => {
          if (!day) return <div key={`blank-${idx}`} />;

          const dateStr = `${resolvedYear}-${String(resolvedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const count = data[dateStr] ?? 0;
          // Compare date strings — only correct after todayTW is set on client
          const isToday  = !!todayTW && dateStr === todayTW;
          const isFuture = !!todayTW && dateStr > todayTW;

          return (
            <div
              key={day}
              onClick={() => !isFuture && onDayClick?.(dateStr)}
              style={{
                aspectRatio: '1',
                borderRadius: 5,
                background: heatColor(count),
                border: isToday ? '1.5px solid #f97316' : '1.5px solid transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isFuture ? 'default' : 'pointer',
                opacity: isFuture ? 0.35 : 1,
                WebkitTapHighlightColor: 'transparent',
                transition: 'transform 0.1s ease, opacity 0.1s ease',
              }}
              onMouseDown={(e) => {
                if (!isFuture) (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.88)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
              }}
            >
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 9,
                fontWeight: isToday ? 800 : 500,
                color: count > 2 ? '#fff' : '#94a3b8',
                pointerEvents: 'none',
              }}>
                {day}
              </span>
            </div>
          );
        })}
      </div>

      {onDayClick && (
        <div style={{ textAlign: 'center', marginTop: 10, fontFamily: 'var(--font-sans)', fontSize: 10, color: '#cbd5e1' }}>
          Tap a day to see details
        </div>
      )}
    </div>
  );
}
