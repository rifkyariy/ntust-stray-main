'use client';
import { useState } from 'react';
import { Search, Bell, Plus } from '@stray/ui';

const CITIES = ['All', 'Taipei', 'Tainan', 'Kaohsiung', 'Taichung', 'Hsinchu'];

interface TopbarProps {
  alertCount?: number;
  onAddStation?: () => void;
  onCityFilter?: (city: string | undefined) => void;
  onSearch?: (q: string) => void;
}

export default function Topbar({ alertCount = 0, onAddStation, onCityFilter, onSearch }: TopbarProps) {
  const [city, setCity] = useState('All');
  const [q, setQ] = useState('');

  function handleCity(c: string) {
    setCity(c);
    onCityFilter?.(c === 'All' ? undefined : c);
  }

  function handleSearch(v: string) {
    setQ(v);
    onSearch?.(v);
  }

  return (
    <header style={{
      height: 64,
      background: '#fff',
      borderBottom: '1px solid var(--slate-100)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--slate-50)',
        border: '1.5px solid var(--slate-100)',
        borderRadius: 10,
        padding: '0 12px',
        height: 38,
        flex: '0 0 220px',
      }}>
        <Search size={15} color="var(--slate-400)" strokeWidth={2} />
        <input
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search stations…"
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 13,
            color: 'var(--slate-900)',
            fontFamily: 'var(--font-sans)',
            width: '100%',
          }}
        />
      </div>

      {/* City filter pills */}
      <div style={{ display: 'flex', gap: 6 }}>
        {CITIES.map((c) => (
          <button
            key={c}
            onClick={() => handleCity(c)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: '1.5px solid',
              borderColor: city === c ? 'var(--orange-500)' : 'var(--slate-200)',
              background: city === c ? 'var(--orange-50)' : '#fff',
              color: city === c ? 'var(--orange-600)' : 'var(--slate-500)',
              fontSize: 12,
              fontWeight: city === c ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'all 0.15s',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Bell */}
      <button
        style={{
          position: 'relative',
          width: 38, height: 38,
          borderRadius: 10,
          border: '1.5px solid var(--slate-200)',
          background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Bell size={17} color="var(--slate-600)" strokeWidth={2} />
        {alertCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -3, right: -3,
            width: 16, height: 16,
            background: '#ef4444',
            borderRadius: '50%',
            border: '2px solid #fff',
            fontSize: 9,
            fontWeight: 700,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      {/* Add station */}
      <button
        onClick={onAddStation}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 16px',
          height: 38,
          borderRadius: 10,
          border: 'none',
          background: 'var(--orange-500)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <Plus size={15} strokeWidth={2.5} />
        Add Station
      </button>

      {/* Avatar */}
      <div style={{
        width: 36, height: 36,
        borderRadius: '50%',
        background: 'var(--orange-100)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--orange-600)',
        cursor: 'pointer',
      }}>
        A
      </div>
    </header>
  );
}
