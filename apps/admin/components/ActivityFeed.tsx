'use client';
import { useEffect, useState } from 'react';
import type { WSMessage } from '@stray/ui';
import { Zap, Eye, AlertTriangle, PawPrint } from '@stray/ui';

interface FeedItem {
  id: string;
  icon: 'feed' | 'detect' | 'alert' | 'status';
  text: string;
  station?: string;
  ts: Date;
}

function itemIcon(kind: FeedItem['icon']) {
  switch (kind) {
    case 'feed':    return <Zap size={13} color="var(--orange-500)" strokeWidth={2.5} />;
    case 'detect':  return <Eye size={13} color="#3b82f6" strokeWidth={2} />;
    case 'alert':   return <AlertTriangle size={13} color="#ef4444" strokeWidth={2} />;
    case 'status':  return <PawPrint size={13} color="#4ade80" strokeWidth={2} />;
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

// Offsets in ms — used to generate the seed feed AFTER mount so server/client timestamps match
const SEED_OFFSETS: Array<{ icon: FeedItem['icon']; text: string; station: string; offset: number }> = [
  { icon: 'feed',   text: '120g dispensed',       station: "Da'an Park Station", offset: 80_000 },
  { icon: 'detect', text: 'Cat detected (0.94)',  station: 'Gongguan Station',    offset: 150_000 },
  { icon: 'status', text: 'Station online',       station: 'Zhongshan Station',   offset: 320_000 },
  { icon: 'alert',  text: 'Food level low (18%)', station: 'Yonghe Station',      offset: 600_000 },
  { icon: 'feed',   text: '80g dispensed',        station: 'Xinyi Station',       offset: 900_000 },
];

export default function ActivityFeed({ latestMsg }: ActivityFeedProps) {
  // Start empty on the server — seed is populated in useEffect (client-only)
  // so the initial SSR HTML matches the client's initial render.
  const [items, setItems] = useState<FeedItem[]>([]);
  const [mounted, setMounted] = useState(false);

  // Populate seed data after hydration
  useEffect(() => {
    const now = Date.now();
    setItems(
      SEED_OFFSETS.map((s, i) => ({
        id: String(i + 1),
        icon: s.icon,
        text: s.text,
        station: s.station,
        ts: new Date(now - s.offset),
      })),
    );
    setMounted(true);
  }, []);

  // Prepend new WS events
  useEffect(() => {
    if (!latestMsg || !mounted) return;
    let item: FeedItem | null = null;
    const ts = new Date();
    if (latestMsg.type === 'feed_event') {
      item = { id: `${ts.getTime()}`, icon: 'feed',   text: `${latestMsg.grams}g dispensed`,                    station: latestMsg.station_id, ts };
    } else if (latestMsg.type === 'detection') {
      item = { id: `${ts.getTime()}`, icon: 'detect', text: `Cat detected (${latestMsg.confidence.toFixed(2)})`, station: latestMsg.station_id, ts };
    } else if (latestMsg.type === 'alert') {
      item = { id: `${ts.getTime()}`, icon: 'alert',  text: latestMsg.message,                                   station: latestMsg.station_id, ts };
    }
    if (item) setItems((prev) => [item!, ...prev].slice(0, 50));
  }, [latestMsg, mounted]);

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
      <div style={{
        padding: '16px 18px',
        borderBottom: '1px solid var(--slate-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Live Activity</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', background: '#f0fdf4', borderRadius: 20, padding: '2px 8px' }}>
          ● LIVE
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {items.length === 0 && (
          <div style={{ padding: '24px 18px', fontSize: 12, color: 'var(--slate-400)', textAlign: 'center' }}>
            Waiting for events…
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 18px',
              borderBottom: '1px solid var(--slate-50)',
              animation: 'fadeSlideIn 0.25s ease',
            }}
          >
            <div style={{
              width: 26, height: 26,
              borderRadius: 8,
              background: 'var(--slate-50)',
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
            {/* suppressHydrationWarning because timeAgo() is time-dependent */}
            <span suppressHydrationWarning style={{ fontSize: 11, color: 'var(--slate-400)', flexShrink: 0 }}>
              {timeAgo(item.ts)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
