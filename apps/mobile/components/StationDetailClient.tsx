'use client';
import { useState, useCallback, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { DetectionFeed } from './DetectionFeed';
import { SupplyLevels } from './SupplyLevels';
import { WeeklyBarChart } from './WeeklyBarChart';
import { MonthlyHeatmap } from './MonthlyHeatmap';
import { DayDetailSheet } from './DayDetailSheet';
import { FeedSheet } from './FeedSheet';
import { ScheduleBottomSheet } from './ScheduleBottomSheet';
import { fetchDailyDonations } from '../lib/api';
import type { Station, WSMessage, WSDetection } from '@stray/ui';
import { MapPin, Clock } from 'lucide-react';

// ── Component ─────────────────────────────────────────────────────────────────

export function StationDetailClient({ initialStation }: { initialStation: Station }) {
  const [station, setStation]               = useState<Station>(initialStation);
  const [latestDetection, setLatestDetection] = useState<WSDetection | null>(null);
  const [selectedDate, setSelectedDate]     = useState<string | null>(null);
  const [showFeed, setShowFeed]             = useState(false);
  const [showSchedule, setShowSchedule]     = useState(false);
  const [activityData, setActivityData]     = useState<Record<string, number>>({});
  const [donationTick, setDonationTick]     = useState(0);

  // Fetch real daily donation counts; re-runs after each donation
  useEffect(() => {
    fetchDailyDonations(initialStation.id, 90).then((rows) => {
      const map: Record<string, number> = {};
      for (const { date, count } of rows) map[date] = count;
      setActivityData(map);
    });
  }, [initialStation.id, donationTick]);

  const handleDonated = useCallback(() => setDonationTick((n) => n + 1), []);

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

        {/* Weekly bar chart — real donation counts */}
        <WeeklyBarChart
          data={activityData}
          onDayClick={setSelectedDate}
        />

        {/* Monthly heatmap — real donation counts */}
        <MonthlyHeatmap
          data={activityData}
          onDayClick={setSelectedDate}
        />
      </div>

      {/* Bottom sheets */}
      <DayDetailSheet
        dateStr={selectedDate}
        stationName={station.name}
        count={selectedDate ? (activityData[selectedDate] ?? 0) : 0}
        onClose={() => setSelectedDate(null)}
      />

      <FeedSheet
        station={showFeed ? station : null}
        onClose={() => setShowFeed(false)}
        onDonated={handleDonated}
      />

      <ScheduleBottomSheet
        station={showSchedule ? station : null}
        onClose={() => setShowSchedule(false)}
      />
    </div>
  );
}
