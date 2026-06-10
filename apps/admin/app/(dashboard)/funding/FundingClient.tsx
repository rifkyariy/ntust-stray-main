'use client';
import { useState, useMemo } from 'react';
import type { Donation } from '@stray/ui';

const PAGE_SIZE = 20;
const TZ = 'Asia/Taipei';

type Tab = 'overview' | 'leaderboard';

function toTWDate(ts: string): string {
  const d = new Date(ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z');
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

function buildDailyTotals(donations: Donation[], days: number) {
  const bins: { label: string; dateStr: string; ntd: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
    bins.push({
      label: days <= 7
        ? new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d)
        : String(d.getDate()),
      dateStr,
      ntd: donations
        .filter((x) => x.created_at && toTWDate(x.created_at) === dateStr)
        .reduce((s, x) => s + x.amount_ntd, 0),
    });
  }
  return bins;
}

function BarChart({
  data,
  today,
  showEveryNth = 1,
}: {
  data: { label: string; dateStr: string; ntd: number }[];
  today: string;
  showEveryNth?: number;
}) {
  const max = Math.max(...data.map((d) => d.ntd), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 88 }}>
        {data.map((d, i) => {
          const isToday = d.dateStr === today;
          const h = d.ntd > 0 ? `${Math.max((d.ntd / max) * 100, 7)}%` : '2%';
          return (
            <div
              key={i}
              title={`${d.dateStr}: NT$${d.ntd.toLocaleString()}`}
              style={{
                flex: 1,
                height: h,
                background: isToday ? '#f97316' : d.ntd > 0 ? '#fed7aa' : '#f1f5f9',
                borderRadius: '3px 3px 0 0',
              }}
            />
          );
        })}
      </div>
      <div style={{
        display: 'flex', gap: 3, marginTop: 5,
        borderTop: '1px solid var(--slate-100)', paddingTop: 5,
      }}>
        {data.map((d, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center', fontSize: 9, overflow: 'hidden',
            color: d.dateStr === today ? '#f97316' : 'var(--slate-400)',
            fontFamily: 'var(--font-sans)',
            fontWeight: d.dateStr === today ? 700 : 400,
          }}>
            {i % showEveryNth === 0 || i === data.length - 1 ? d.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

const RANK_STYLE: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: '#fef3c7', color: '#d97706', label: '1' },
  2: { bg: '#f1f5f9', color: '#64748b', label: '2' },
  3: { bg: '#fff7ed', color: '#c2410c', label: '3' },
};

function RankBadge({ rank }: { rank: number }) {
  const style = RANK_STYLE[rank] ?? { bg: 'transparent', color: 'var(--slate-400)', label: String(rank) };
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 8,
      background: style.bg, color: style.color,
      fontSize: rank <= 3 ? 13 : 12,
      fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontFamily: 'var(--font-mono)',
    }}>
      {style.label}
    </div>
  );
}

export interface FundingClientProps {
  donations: Donation[];
  stationMap: Record<string, { name: string; code: string }>;
  tiles: { label: string; value: string; note: string }[];
}

export default function FundingClient({ donations, stationMap, tiles }: FundingClientProps) {
  const [tab, setTab]   = useState<Tab>('overview');
  const [page, setPage] = useState(0);

  const today = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()),
    [],
  );

  const sorted = useMemo(
    () => [...donations].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [donations],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows   = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const weeklyData  = useMemo(() => buildDailyTotals(donations, 7),  [donations]);
  const monthlyData = useMemo(() => buildDailyTotals(donations, 30), [donations]);

  const weeklyTotal  = weeklyData.reduce((s, d) => s + d.ntd, 0);
  const monthlyTotal = monthlyData.reduce((s, d) => s + d.ntd, 0);

  const leaderboard = useMemo(() => {
    const map = new Map<string, { name: string; ntd: number; count: number; grams: number }>();
    for (const d of donations) {
      const name = d.donor_name?.trim() || 'Anonymous';
      const existing = map.get(name) ?? { name, ntd: 0, count: 0, grams: 0 };
      existing.ntd   += d.amount_ntd;
      existing.count += 1;
      existing.grams += d.grams ?? 0;
      map.set(name, existing);
    }
    return [...map.values()].sort((a, b) => b.ntd - a.ntd);
  }, [donations]);

  const topNtd = leaderboard[0]?.ntd ?? 1;

  function go(n: number) {
    if (n >= 0 && n < totalPages) setPage(n);
  }

  const btnBase: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 8,
    border: '1.5px solid var(--slate-200)',
    fontSize: 12, fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
  };

  return (
    <div style={{ padding: '28px 28px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate-900)', margin: 0, letterSpacing: '-0.02em' }}>
          Funding
        </h1>
        <p style={{ fontSize: 13, color: 'var(--slate-400)', margin: '4px 0 0' }}>
          Donation history, daily totals, and food dispensed
        </p>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {tiles.map(({ label, value, note }, i) => (
          <div key={label} style={{
            background: '#fff', borderRadius: 16, padding: '20px 22px',
            border: '1px solid var(--slate-100)',
            borderTop: i < 2 ? '3px solid #f97316' : '3px solid #00B900',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.03em', marginBottom: 4 }}>
              {value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--slate-400)' }}>{note}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '2px solid var(--slate-100)', display: 'flex', gap: 0 }}>
        {(['overview', 'leaderboard'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 22px',
              background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid #f97316' : '2px solid transparent',
              marginBottom: -2,
              fontSize: 14,
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? '#f97316' : 'var(--slate-500)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.01em',
              textTransform: 'capitalize',
            }}
          >
            {t === 'leaderboard' ? 'Leaderboard' : 'Overview'}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <>
          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--slate-100)', padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Weekly Overview</div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 2 }}>Last 7 days · NT$ raised</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f97316', letterSpacing: '-0.03em' }}>
                  NT${weeklyTotal.toLocaleString()}
                </div>
              </div>
              <BarChart data={weeklyData} today={today} />
            </div>

            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--slate-100)', padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Monthly Overview</div>
                  <div style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 2 }}>Last 30 days · NT$ raised</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f97316', letterSpacing: '-0.03em' }}>
                  NT${monthlyTotal.toLocaleString()}
                </div>
              </div>
              <BarChart data={monthlyData} today={today} showEveryNth={5} />
            </div>
          </div>

          {/* Transactions table + pagination */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--slate-100)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--slate-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Donation History</span>
              <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>{donations.length} total</span>
            </div>

            {donations.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', fontSize: 14, color: 'var(--slate-400)' }}>
                No donations yet — backend may be offline.
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--slate-50)' }}>
                        {['Date', 'Donor', 'Station', 'Amount', 'Food', 'Status'].map((h) => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((d, i) => (
                        <tr key={d.id} style={{ borderTop: '1px solid var(--slate-50)', background: i % 2 === 0 ? '#fff' : 'var(--slate-50)' }}>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                            {d.created_at
                              ? new Date(d.created_at.endsWith('Z') || d.created_at.includes('+') ? d.created_at : d.created_at + 'Z')
                                  .toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--slate-800)' }}>
                            {d.donor_name ?? 'Anonymous'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--slate-600)' }}>
                            <div style={{ fontWeight: 600 }}>{stationMap[d.station_id]?.name ?? '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>
                              {stationMap[d.station_id]?.code ?? d.station_id}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#f97316' }}>
                            NT${Number(d.amount_ntd).toFixed(0)}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--slate-600)', fontWeight: 500 }}>
                            {d.grams ? `${d.grams}g` : '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              display: 'inline-block', padding: '3px 10px', borderRadius: 99,
                              fontSize: 11, fontWeight: 700,
                              background: d.dispensed ? '#dcfce7' : '#f1f5f9',
                              color: d.dispensed ? '#16a34a' : '#64748b',
                            }}>
                              {d.dispensed ? 'Dispensed' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--slate-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--slate-500)' }}>
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => go(0)} disabled={page === 0}
                      style={{ ...btnBase, background: page === 0 ? 'var(--slate-50)' : '#fff', color: page === 0 ? 'var(--slate-300)' : 'var(--slate-600)', cursor: page === 0 ? 'default' : 'pointer' }}>
                      ««
                    </button>
                    <button onClick={() => go(page - 1)} disabled={page === 0}
                      style={{ ...btnBase, background: page === 0 ? 'var(--slate-50)' : '#fff', color: page === 0 ? 'var(--slate-300)' : 'var(--slate-600)', cursor: page === 0 ? 'default' : 'pointer' }}>
                      ← Prev
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--slate-500)', padding: '0 8px', whiteSpace: 'nowrap' }}>
                      Page {page + 1} of {totalPages}
                    </span>
                    <button onClick={() => go(page + 1)} disabled={page >= totalPages - 1}
                      style={{ ...btnBase, background: page >= totalPages - 1 ? 'var(--slate-50)' : '#fff', color: page >= totalPages - 1 ? 'var(--slate-300)' : 'var(--slate-600)', cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
                      Next →
                    </button>
                    <button onClick={() => go(totalPages - 1)} disabled={page >= totalPages - 1}
                      style={{ ...btnBase, background: page >= totalPages - 1 ? 'var(--slate-50)' : '#fff', color: page >= totalPages - 1 ? 'var(--slate-300)' : 'var(--slate-600)', cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
                      »»
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Leaderboard tab ── */}
      {tab === 'leaderboard' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--slate-100)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--slate-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Donor Leaderboard</span>
            <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>{leaderboard.length} donors</span>
          </div>

          {leaderboard.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', fontSize: 14, color: 'var(--slate-400)' }}>
              No donations yet.
            </div>
          ) : (
            <div>
              {leaderboard.map((entry, i) => {
                const rank = i + 1;
                const barPct = Math.max((entry.ntd / topNtd) * 100, 2);
                const isAnon = entry.name === 'Anonymous';
                return (
                  <div
                    key={entry.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 20px',
                      borderTop: i > 0 ? '1px solid var(--slate-50)' : 'none',
                      background: rank === 1 ? '#fffbeb' : '#fff',
                    }}
                  >
                    <RankBadge rank={rank} />

                    {/* Name + bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: isAnon ? 'var(--slate-400)' : 'var(--slate-800)',
                          fontStyle: isAnon ? 'italic' : 'normal',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {entry.name}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#f97316', letterSpacing: '-0.02em', flexShrink: 0, marginLeft: 12 }}>
                          NT${entry.ntd.toLocaleString()}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 4, background: 'var(--slate-100)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${barPct}%`,
                          background: rank === 1 ? '#f97316' : rank === 2 ? '#94a3b8' : rank === 3 ? '#fb923c' : '#fed7aa',
                          borderRadius: 99,
                        }} />
                      </div>
                      {/* Meta */}
                      <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                          {entry.count} donation{entry.count !== 1 ? 's' : ''}
                        </span>
                        {entry.grams > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                            {entry.grams.toLocaleString()}g dispensed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
