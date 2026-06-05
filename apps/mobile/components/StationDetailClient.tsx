'use client';
import { useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { DetectionFeed } from './DetectionFeed';
import { SupplyLevels } from './SupplyLevels';
import { WeeklyBarChart } from './WeeklyBarChart';
import { MonthlyHeatmap } from './MonthlyHeatmap';
import { DayDetailSheet } from './DayDetailSheet';
import { FeedSheet } from './FeedSheet';
import { ScheduleBottomSheet } from './ScheduleBottomSheet';
import type { Station, WSMessage, WSDetection } from '@stray/ui';
import { MapPin, Clock } from 'lucide-react';

// ── Heatmap seed data ──────────────────────────────────────────────────────────
// Uses a proper LCG so values cluster naturally into busy / quiet weeks with
// day-of-week variation and occasional zero (no-visit) days.

function lcg(n: number): number {
  return Math.abs((n * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
}

function buildHeatmapData(stationId: string): Record<string, number> {
  // Stable integer seed from the station ID string
  const base = stationId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const result: Record<string, number> = {};
  const today = new Date();

  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dow = d.getDay(); // 0 = Sun

    // Week-level baseline: some weeks are busier than others (0–1)
    const weekIdx = Math.floor(i / 7);
    const weekBase = lcg(base * 31 + weekIdx * 1013904223);

    // Day-of-week pattern — weekdays a bit more active than weekends
    const dowMult = (dow === 0 || dow === 6) ? 0.60 : 1.0;

    // Per-day noise adds scatter within the week (0–1)
    const dayNoise = lcg(base + i * 22695477 + 1013904223);

    // Raw score: week baseline drives density, day noise adds scatter
    const raw = (weekBase * 6.5 + dayNoise * 3.5) * dowMult;

    // Sparse zero days: probability is inversely proportional to week activity
    const zeroChance = lcg(base * 7 + i * 1664525);
    const sparsityP  = 0.22 - weekBase * 0.18; // busy weeks ~4 %, quiet weeks ~22 %
    const val = zeroChance < sparsityP ? 0 : Math.min(9, Math.round(raw));

    result[dateStr] = val;
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StationDetailClient({ initialStation }: { initialStation: Station }) {
  const [station, setStation]               = useState<Station>(initialStation);
  const [latestDetection, setLatestDetection] = useState<WSDetection | null>(null);
  const [selectedDate, setSelectedDate]     = useState<string | null>(null);
  const [showFeed, setShowFeed]             = useState(false);
  const [showSchedule, setShowSchedule]     = useState(false);

  const heatmapData = buildHeatmapData(initialStation.id);

  const onMessage = useCallback((msg: WSMessage) => {
    if (msg.station_id !== initialStation.station_code) return;

    if (msg.type === 'telemetry') {
      setStation((prev) => ({
        ...prev,
        food_pct:     msg.food_pct,
        battery_pct:  msg.battery_pct,
        temp_c:       msg.temp_c,
        humidity_pct: msg.humidity_pct,
        status: msg.food_pct < 20 ? 'low_food' : 'online',
      }));
    }

    if (msg.type === 'detection') {
      setLatestDetection(msg);
    }
  }, [initialStation.station_code]);

  useWebSocket(onMessage);

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 48 }}>
      {/* Live camera feed + Feed / Schedule buttons */}
      <DetectionFeed
        station={station}
        latestDetection={latestDetection}
        onFeedClick={() => setShowFeed(true)}
        onScheduleClick={() => setShowSchedule(true)}
      />

      <div style={{ padding: '16px 16px 0' }}>
        {/* Info pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: '#f1f5f9', border: '1px solid #e2e8f0',
            borderRadius: 8, padding: '4px 10px',
          }}>
            <MapPin size={11} color="#64748b" strokeWidth={2} />
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11, color: '#475569' }}>
              {station.city} · {station.district}
            </span>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: '#f1f5f9', border: '1px solid #e2e8f0',
            borderRadius: 8, padding: '4px 10px',
          }}>
            <Clock size={11} color="#64748b" strokeWidth={2} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, color: '#475569' }}>
              {station.station_code}
            </span>
          </div>
        </div>

        {/* Supply levels + env tiles */}
        <SupplyLevels station={station} />

        {/* Weekly bar chart — tappable */}
        <WeeklyBarChart
          data={heatmapData}
          onDayClick={setSelectedDate}
        />

        {/* Monthly heatmap — tappable */}
        <MonthlyHeatmap
          data={heatmapData}
          onDayClick={setSelectedDate}
        />
      </div>

      {/* Bottom sheets */}
      <DayDetailSheet
        dateStr={selectedDate}
        stationName={station.name}
        count={selectedDate ? (heatmapData[selectedDate] ?? 0) : 0}
        onClose={() => setSelectedDate(null)}
      />

      <FeedSheet
        station={showFeed ? station : null}
        onClose={() => setShowFeed(false)}
      />

      <ScheduleBottomSheet
        station={showSchedule ? station : null}
        onClose={() => setShowSchedule(false)}
      />
    </div>
  );
}
