'use client';
import { useEffect, useRef, useState } from 'react';
import type { WSMessage } from '@stray/ui';
import { Zap, Eye, AlertTriangle, PawPrint } from '@stray/ui';

type IconKind = 'feed' | 'detect' | 'alert' | 'status';

interface FeedItem {
  id: string;
  icon: IconKind;
  text: string;
  station?: string;
  ts: Date;
}

type FilterKey = 'all' | IconKind;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'feed',   label: 'Feed' },
  { key: 'detect', label: 'Detect' },
  { key: 'alert',  label: 'Alert' },
  { key: 'status', label: 'Status' },
];

function itemIcon(kind: IconKind) {
  switch (kind) {
    case 'feed':    return <Zap size={13} color="var(--orange-500)" strokeWidth={2.5} />;
    case 'detect':  return <Eye size={13} color="#3b82f6" strokeWidth={2} />;
    case 'alert':   return <AlertTriangle size={13} color="#ef4444" strokeWidth={2} />;
    case 'status':  return <PawPrint size={13} color="#4ade80" strokeWidth={2} />;
  }
}

function itemBg(kind: IconKind) {
  switch (kind) {
    case 'feed':   return 'var(--orange-50)';
    case 'detect': return '#eff6ff';
    case 'alert':  return '#fef2f2';
    case 'status': return '#f0fdf4';
  }
}

function timeAgo(ts: Date) {
  const diff = Math.floor((Date.now() - ts.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}


interface ActivityFeedProps {
  latestMsg?: WSMessage | null;
}

export default function ActivityFeed({ latestMsg }: ActivityFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  // Track first-seen stations and last food-alert level per station
  const seenStations   = useRef<Set<string>>(new Set());
  const lastFoodAlert  = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!latestMsg || !mounted) return;

    let item: FeedItem | null = null;
    const ts  = new Date();
    const sid = latestMsg.station_id;

    if (latestMsg.type === 'feed_event') {
      item = { id: `${ts.getTime()}`, icon: 'feed',   text: `${latestMsg.grams}g dispensed`,                    station: sid, ts };
    } else if (latestMsg.type === 'detection') {
      item = { id: `${ts.getTime()}`, icon: 'detect', text: `Cat detected (${latestMsg.confidence.toFixed(2)})`, station: sid, ts };
    } else if (latestMsg.type === 'alert') {
      item = { id: `${ts.getTime()}`, icon: 'alert',  text: latestMsg.message,                                   station: sid, ts };
    } else if (latestMsg.type === 'station_status') {
      item = { id: `${ts.getTime()}`, icon: 'alert',  text: `Station went ${latestMsg.status}`,                  station: sid, ts };
    } else if (latestMsg.type === 'telemetry') {
      const food = latestMsg.food_pct;

      if (!seenStations.current.has(sid)) {
        // First telemetry from this station → station came online
        seenStations.current.add(sid);
        item = { id: `${ts.getTime()}`, icon: 'status', text: 'Station online', station: sid, ts };
      } else if (food < 20) {
        const prev = lastFoodAlert.current.get(sid) ?? 100;
        // Alert when crossing the threshold or dropping 5+ percentage points
        if (prev >= 20 || food <= prev - 5) {
          lastFoodAlert.current.set(sid, food);
          item = { id: `${ts.getTime()}`, icon: 'alert', text: `Food level low (${food}%)`, station: sid, ts };
        }
      } else {
        // Food recovered above 20% — reset alert tracking
        if (lastFoodAlert.current.has(sid)) lastFoodAlert.current.delete(sid);
      }
    }

    if (item) setItems((prev) => [item!, ...prev].slice(0, 50));
  }, [latestMsg, mounted]);

  const visible = filter === 'all' ? items : items.filter((i) => i.icon === filter);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: '1px solid var(--slate-100)',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px 0',
        borderBottom: '1px solid var(--slate-100)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Live Activity</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', background: '#f0fdf4', borderRadius: 20, padding: '2px 8px' }}>
            ● LIVE
          </span>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 12, flexWrap: 'wrap' }}>
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 999,
                  border: '1.5px solid',
                  borderColor: active ? (
                    key === 'feed'   ? 'var(--orange-500)' :
                    key === 'detect' ? '#3b82f6' :
                    key === 'alert'  ? '#ef4444' :
                    key === 'status' ? '#4ade80' :
                    'var(--slate-700)'
                  ) : 'var(--slate-200)',
                  background: active ? (
                    key === 'feed'   ? 'var(--orange-50)' :
                    key === 'detect' ? '#eff6ff' :
                    key === 'alert'  ? '#fef2f2' :
                    key === 'status' ? '#f0fdf4' :
                    'var(--slate-900)'
                  ) : '#f8fafc',
                  color: active ? (
                    key === 'feed'   ? 'var(--orange-600)' :
                    key === 'detect' ? '#1d4ed8' :
                    key === 'alert'  ? '#dc2626' :
                    key === 'status' ? '#16a34a' :
                    '#fff'
                  ) : 'var(--slate-500)',
                  fontSize: 11, fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.12s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {visible.length === 0 && (
          <div style={{ padding: '24px 18px', fontSize: 12, color: 'var(--slate-400)', textAlign: 'center' }}>
            {filter === 'all' ? 'Waiting for events…' : `No ${filter} events yet`}
          </div>
        )}
        {visible.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '9px 18px',
              borderBottom: '1px solid var(--slate-50)',
              animation: 'fadeSlideIn 0.25s ease',
            }}
          >
            <div style={{
              width: 26, height: 26,
              borderRadius: 8,
              background: itemBg(item.icon),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              marginTop: 1,
            }}>
              {itemIcon(item.icon)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-800)', marginBottom: 2 }}>{item.text}</div>
              {item.station && (
                <div style={{ fontSize: 11, color: 'var(--slate-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.station}
                </div>
              )}
            </div>
            <span suppressHydrationWarning style={{ fontSize: 11, color: 'var(--slate-400)', flexShrink: 0 }}>
              {timeAgo(item.ts)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
