'use client';
import { useState } from 'react';
import type { Station } from '@stray/ui';
import { TintedPill } from '@stray/ui';
import { ChevronDown, ChevronUp, Eye } from '@stray/ui';

type SortKey = 'name' | 'city' | 'status' | 'food_pct' | 'battery_pct';
type SortDir = 'asc' | 'desc';

function statusVariant(s: Station['status']): 'green' | 'orange' | 'slate' {
  if (s === 'online')   return 'green';
  if (s === 'low_food') return 'orange';
  return 'slate';
}

function statusLabel(s: Station['status']) {
  if (s === 'online')   return 'Online';
  if (s === 'low_food') return 'Low Food';
  return 'Offline';
}

function BarCell({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--slate-100)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', width: 32, textAlign: 'right' }}>
        {value}%
      </span>
    </div>
  );
}

interface StationsTableProps {
  stations: Station[];
  cityFilter?: string;
  searchQuery?: string;
  onSelect?: (station: Station) => void;
}

export default function StationsTable({ stations, cityFilter, searchQuery, onSelect }: StationsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = stations
    .filter((s) => {
      if (cityFilter && s.city !== cityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || s.station_code.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      let av: string | number = a[sortKey] ?? 0;
      let bv: string | number = b[sortKey] ?? 0;
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown size={12} color="var(--slate-300)" strokeWidth={2} />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} color="var(--orange-500)" strokeWidth={2} />
      : <ChevronDown size={12} color="var(--orange-500)" strokeWidth={2} />;
  }

  const thStyle = (k: SortKey): React.CSSProperties => ({
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--slate-500)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: '1px solid var(--slate-100)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--slate-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>
          All Stations
        </span>
        <span style={{ fontSize: 13, color: 'var(--slate-400)' }}>
          {filtered.length} station{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--slate-50)' }}>
              <th style={thStyle('name')} onClick={() => toggleSort('name')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Station <SortIcon k="name" /></span>
              </th>
              <th style={thStyle('city')} onClick={() => toggleSort('city')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>City <SortIcon k="city" /></span>
              </th>
              <th style={thStyle('status')} onClick={() => toggleSort('status')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Status <SortIcon k="status" /></span>
              </th>
              <th style={{ ...thStyle('food_pct'), width: 160 }} onClick={() => toggleSort('food_pct')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Food <SortIcon k="food_pct" /></span>
              </th>
              <th style={{ ...thStyle('battery_pct'), width: 160 }} onClick={() => toggleSort('battery_pct')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Battery <SortIcon k="battery_pct" /></span>
              </th>
              <th style={{ padding: '10px 14px', width: 48 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr
                key={s.id}
                style={{
                  borderTop: '1px solid var(--slate-50)',
                  background: i % 2 === 0 ? '#fff' : 'var(--slate-50)',
                  transition: 'background 0.12s',
                  cursor: 'pointer',
                }}
                onClick={() => onSelect?.(s)}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--orange-50)')}
                onMouseOut={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : 'var(--slate-50)')}
              >
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{s.station_code}</div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--slate-600)' }}>
                  {s.city}{s.district ? `, ${s.district}` : ''}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <TintedPill variant={statusVariant(s.status)} label={statusLabel(s.status)} />
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <BarCell value={s.food_pct ?? 0} color="var(--orange-400)" />
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <BarCell value={s.battery_pct ?? 100} color="#4ade80" />
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect?.(s); }}
                    style={{
                      width: 30, height: 30,
                      borderRadius: 8,
                      border: '1.5px solid var(--slate-200)',
                      background: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Eye size={14} color="var(--slate-500)" strokeWidth={2} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: 13, color: 'var(--slate-400)' }}>
                  No stations match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
