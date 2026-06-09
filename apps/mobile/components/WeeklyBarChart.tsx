'use client';
import { useState, useEffect } from 'react';

// 7-day feeding frequency bar chart.
// Shows the last 7 days with real dates; today highlighted in orange.
// Tapping a bar fires onDayClick(dateStr).

export interface DayBar {
  dateStr: string;  // "YYYY-MM-DD"
  day: string;      // "Mon", "Tue", …
  count: number;
}

const TZ = 'Asia/Taipei';

function twDateStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

function twDayAbbrev(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
}

function buildLastSevenDays(data?: Record<string, number>): DayBar[] {
  const result: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = twDateStr(d);
    const day = twDayAbbrev(d);
    const seed = parseInt(dateStr.slice(8)) * 7 + parseInt(dateStr.slice(5, 7)) * 31;
    const defaultCount = ((seed * 13 + 7) % 11) + 1;
    result.push({ dateStr, day, count: data?.[dateStr] ?? defaultCount });
  }
  return result;
}

interface WeeklyBarChartProps {
  /** Map of "YYYY-MM-DD" → count. Falls back to deterministic seed data. */
  data?: Record<string, number>;
  onDayClick?: (dateStr: string) => void;
}

export function WeeklyBarChart({ data, onDayClick }: WeeklyBarChartProps) {
  // Keep bars/todayStr undefined until after mount so server HTML and first
  // client render match, avoiding the "Mon" vs "Tue" hydration mismatch.
  const [bars, setBars]       = useState<DayBar[]>([]);
  const [todayStr, setTodayStr] = useState('');

  useEffect(() => {
    setBars(buildLastSevenDays(data));
    setTodayStr(twDateStr(new Date()));
  }, [data]);

  const max = Math.max(...bars.map((d) => d.count), 1);

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 20,
    padding: '18px 18px 14px',
    border: '1px solid #f1f5f9',
    marginBottom: 12,
  };

  // Skeleton while waiting for client-side date calculation
  if (bars.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 16 }}>
          Weekly activity
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', height: 32, borderRadius: 5, background: '#f1f5f9' }} />
              <div style={{ width: 20, height: 8, borderRadius: 4, background: '#f1f5f9' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
          Weekly activity
        </div>
        {onDayClick && (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#cbd5e1' }}>
            Tap a bar to see details
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {bars.map(({ dateStr, day, count }) => {
          const isToday = dateStr === todayStr;
          const pct = count / max;

          return (
            <div
              key={dateStr}
              onClick={() => onDayClick?.(dateStr)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: onDayClick ? 'pointer' : 'default',
                WebkitTapHighlightColor: 'transparent',
                paddingBottom: 2,
              }}
            >
              {/* Count label */}
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                color: isToday ? '#f97316' : '#94a3b8',
                visibility: count > 0 ? 'visible' : 'hidden',
              }}>
                {count}
              </div>

              {/* Bar */}
              <div
                style={{
                  width: '100%',
                  height: Math.max(4, pct * 52),
                  borderRadius: 5,
                  background: isToday
                    ? 'linear-gradient(180deg, #fb923c, #f97316)'
                    : '#f1f5f9',
                  transition: 'height 0.4s ease, background 0.15s',
                  position: 'relative',
                }}
              >
                {/* Tap ripple highlight */}
                {onDayClick && (
                  <div style={{
                    position: 'absolute', inset: -4,
                    borderRadius: 8,
                  }} />
                )}
              </div>

              {/* Day label */}
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 10,
                fontWeight: isToday ? 800 : 600,
                color: isToday ? '#f97316' : '#94a3b8',
              }}>
                {day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
