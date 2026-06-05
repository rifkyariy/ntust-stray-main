'use client';
import { useState, useCallback } from 'react';
import { Search } from '@stray/ui';
import type { Station, WSMessage } from '@stray/ui';
import { StationCard } from './StationCard';
import { useWebSocket } from '../hooks/useWebSocket';

const CITIES = ['All', 'Taipei', 'Tainan', 'Kaohsiung', 'Taichung'];

export function StationList({ initialStations }: { initialStations: Station[] }) {
  const [stations, setStations] = useState<Station[]>(initialStations);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('All');

  const onMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'telemetry') {
      setStations((prev) =>
        prev.map((s) =>
          s.station_code === msg.station_id
            ? {
                ...s,
                food_pct:     msg.food_pct,
                battery_pct:  msg.battery_pct,
                temp_c:       msg.temp_c,
                humidity_pct: msg.humidity_pct,
                status:       msg.food_pct < 20 ? 'low_food' : 'online',
              }
            : s,
        ),
      );
    }
  }, []);

  useWebSocket(onMessage);

  const filtered = stations.filter((s) => {
    const matchCity = city === 'All' || s.city === city;
    const matchQ =
      !q ||
      s.name.toLowerCase().includes(q.toLowerCase()) ||
      s.station_code.toLowerCase().includes(q.toLowerCase());
    return matchCity && matchQ;
  });

  return (
    <div>
      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search
          size={16}
          color="#94a3b8"
          strokeWidth={2}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search stations…"
          style={{
            width: '100%',
            padding: '11px 14px 11px 40px',
            borderRadius: 14,
            border: '1.5px solid #e2e8f0',
            background: '#fff',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            color: '#334155',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* City filter pills */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          overflowX: 'auto',
          paddingBottom: 2,
          scrollbarWidth: 'none',
        }}
      >
        {CITIES.map((c) => (
          <button
            key={c}
            onClick={() => setCity(c)}
            style={{
              padding: '6px 14px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 700,
              border: city === c ? '1.5px solid #fed7aa' : '1.5px solid #e2e8f0',
              background: city === c ? '#fff7ed' : '#fff',
              color: city === c ? '#ea580c' : '#475569',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-sans)',
              flexShrink: 0,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Result count */}
      {q || city !== 'All' ? (
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
          {filtered.length} station{filtered.length !== 1 ? 's' : ''} found
        </div>
      ) : null}

      {/* Cards */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontFamily: 'var(--font-sans)', fontSize: 14 }}>
          No stations found
        </div>
      ) : (
        filtered.map((s) => <StationCard key={s.id} station={s} />)
      )}
    </div>
  );
}
