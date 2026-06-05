'use client';
import { useEffect, useRef } from 'react';
import { X, PawPrint, Banknote, Utensils, Zap } from '@stray/ui';

// ── Deterministic mock data ───────────────────────────────────────────────────
// Uses the date string as a seed so each day shows consistent (but varied) data.

function lcg(seed: number, i: number): number {
  return Math.abs((seed * 1664525 + i * 22695477 + 1013904223) % 2147483648) / 2147483648;
}

function dateToSeed(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return (y * 366 + m * 31 + d) & 0xfffffff;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface CatSighting {
  catCode: string;
  firstSeen: string;   // "HH:MM"
  visits: number;
  isNew: boolean;
  confidence: number;
}

interface DonationEvent {
  donor: string;
  amountNtd: number;
  time: string;
  grams: number;
}

interface FeedEvent {
  grams: number;
  trigger: 'donation' | 'schedule' | 'admin';
  time: string;
}

interface DayData {
  cats: CatSighting[];
  donations: DonationEvent[];
  feeds: FeedEvent[];
}

const CAT_POOL = ['CAT-003', 'CAT-007', 'CAT-012', 'CAT-018', 'CAT-025', 'CAT-031', 'CAT-044'];
const DONOR_POOL = ['Anonymous', 'Lin Wei', 'Chen Yi', 'Wang Fang', 'Anonymous', 'Liu Yang', 'Anonymous'];
const GRAM_OPTIONS = [50, 80, 100, 120, 150, 200];

// heatCount: the 0-9 value from buildHeatmapData — drives cat count so the
// detail view stays visually consistent with the heatmap colour.
function generateDayData(dateStr: string, heatCount: number): DayData {
  const seed = dateToSeed(dateStr);

  // Cat count tied directly to the heatmap value (0-9 → 0-5 unique cats)
  const catCount = Math.min(heatCount, 5);
  const cats: CatSighting[] = [];

  for (let i = 0; i < catCount; i++) {
    const catIdx = Math.floor(lcg(seed, i + 10) * CAT_POOL.length);
    const startMin = 360 + Math.floor(lcg(seed, i + 20) * 720); // 06:00–18:00
    const visits = 1 + Math.floor(lcg(seed, i + 30) * 4);
    cats.push({
      catCode: CAT_POOL[catIdx],
      firstSeen: minutesToTime(startMin),
      visits,
      isNew: lcg(seed, i + 40) > 0.75,
      confidence: 0.82 + lcg(seed, i + 50) * 0.17,
    });
  }
  // Sort by time
  cats.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
  // Deduplicate cat codes
  const seen = new Set<string>();
  const uniqueCats = cats.filter((c) => {
    if (seen.has(c.catCode)) return false;
    seen.add(c.catCode);
    return true;
  });

  // Donation count scales with activity: 0 → 0, 1-3 → 0-1, 4-6 → 1-2, 7-9 → 2-3
  const donationCount = heatCount === 0
    ? 0
    : Math.min(Math.floor(heatCount / 3), 3);
  const donations: DonationEvent[] = [];
  for (let i = 0; i < donationCount; i++) {
    const donorIdx = Math.floor(lcg(seed, i + 60) * DONOR_POOL.length);
    const amountNtd = [15, 15, 30, 15, 45][Math.floor(lcg(seed, i + 70) * 5)];
    const min = 420 + Math.floor(lcg(seed, i + 80) * 720);
    const grams = amountNtd === 15 ? 100 : amountNtd === 30 ? 200 : 300;
    donations.push({
      donor: DONOR_POOL[donorIdx],
      amountNtd,
      time: minutesToTime(min),
      grams,
    });
  }
  donations.sort((a, b) => a.time.localeCompare(b.time));

  // Feed events (schedule always runs, plus from donations)
  const feeds: FeedEvent[] = [];
  // Morning schedule
  const morningGrams = GRAM_OPTIONS[Math.floor(lcg(seed, 2) * GRAM_OPTIONS.length)];
  feeds.push({ grams: morningGrams, trigger: 'schedule', time: minutesToTime(420 + Math.floor(lcg(seed, 90) * 30)) });
  // Evening schedule
  if (lcg(seed, 3) > 0.3) {
    const eveningGrams = GRAM_OPTIONS[Math.floor(lcg(seed, 4) * GRAM_OPTIONS.length)];
    feeds.push({ grams: eveningGrams, trigger: 'schedule', time: minutesToTime(1020 + Math.floor(lcg(seed, 91) * 30)) });
  }
  // From donations
  donations.forEach((d, i) => {
    const feedMin = parseInt(d.time.split(':')[0]) * 60 + parseInt(d.time.split(':')[1]) + 1;
    feeds.push({ grams: d.grams, trigger: 'donation', time: minutesToTime(feedMin) });
  });
  feeds.sort((a, b) => a.time.localeCompare(b.time));

  return { cats: uniqueCats, donations, feeds };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function triggerLabel(t: FeedEvent['trigger']) {
  if (t === 'donation') return 'via donation';
  if (t === 'schedule') return 'scheduled';
  return 'manual';
}

function triggerColor(t: FeedEvent['trigger']) {
  if (t === 'donation') return '#8b5cf6';
  if (t === 'schedule') return '#3b82f6';
  return '#f97316';
}

// ── Section component ─────────────────────────────────────────────────────────

function Section({ title, icon, count, children }: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: '#f8fafc',
          border: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
          {title}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          color: '#94a3b8',
          background: '#f1f5f9', borderRadius: 20, padding: '2px 8px',
        }}>
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function TimelineRow({ time, children }: { time: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
        color: '#94a3b8', flexShrink: 0, paddingTop: 1, width: 38,
      }}>
        {time}
      </span>
      <div style={{
        width: 1, background: '#f1f5f9', alignSelf: 'stretch', flexShrink: 0, marginTop: 4,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

interface DayDetailSheetProps {
  dateStr: string | null;   // null = closed
  stationName?: string;
  /** Heatmap activity count for this day (0-9). Drives cat and donation count. */
  count?: number;
  onClose: () => void;
}

export function DayDetailSheet({ dateStr, stationName, count = 0, onClose }: DayDetailSheetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll when a new date is selected
  useEffect(() => {
    if (dateStr && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [dateStr]);

  // Close on Escape key
  useEffect(() => {
    if (!dateStr) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dateStr, onClose]);

  const isOpen = !!dateStr;
  const data = dateStr ? generateDayData(dateStr, count) : null;
  const totalFoodG = data?.feeds.reduce((s, f) => s + f.grams, 0) ?? 0;
  const totalDonatedNtd = data?.donations.reduce((s, d) => s + d.amountNtd, 0) ?? 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.40)',
          zIndex: 80,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Sheet — constrained to body/phone width (390 px) and centred */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          width: '100%',
          maxWidth: 390,
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 81,
          transform: isOpen
            ? 'translateX(-50%) translateY(0)'
            : 'translateX(-50%) translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 -4px 32px rgba(15,23,42,0.12)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '10px 20px 14px',
          borderBottom: '1px solid #f1f5f9',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 2 }}>
              {dateStr ? formatDate(dateStr) : ''}
            </div>
            {stationName && (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94a3b8' }}>
                {stationName}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: '1.5px solid #f1f5f9',
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={14} color="#94a3b8" strokeWidth={2} />
          </button>
        </div>

        {/* Summary strip */}
        {data && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1, background: '#f1f5f9',
            borderBottom: '1px solid #f1f5f9',
            flexShrink: 0,
          }}>
            {[
              { label: 'Cats', value: String(data.cats.length), color: '#f97316' },
              { label: 'Donated', value: `NT$${totalDonatedNtd}`, color: '#8b5cf6' },
              { label: 'Food', value: `${totalFoodG}g`, color: '#3b82f6' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#fff', padding: '10px 0', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, color, marginBottom: 1 }}>
                  {value}
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 32px' }}>
          {data && (
            <>
              {/* Cat activity */}
              <Section
                title="Cat Activity"
                icon={<PawPrint size={13} color="#f97316" strokeWidth={2} />}
                count={data.cats.length}
              >
                {data.cats.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                    No cats detected this day
                  </div>
                ) : (
                  data.cats.map((cat) => (
                    <TimelineRow key={cat.catCode} time={cat.firstSeen}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: '#1e293b',
                            }}>
                              {cat.catCode}
                            </span>
                            {cat.isNew && (
                              <span style={{
                                fontSize: 9, fontWeight: 800, color: '#16a34a',
                                background: '#f0fdf4', borderRadius: 20,
                                padding: '1px 6px', letterSpacing: '0.04em',
                              }}>
                                NEW
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>
                            {cat.visits} visit{cat.visits !== 1 ? 's' : ''} · {(cat.confidence * 100).toFixed(0)}% confidence
                          </div>
                        </div>
                        {/* Visit dots */}
                        <div style={{ display: 'flex', gap: 3 }}>
                          {Array.from({ length: Math.min(cat.visits, 5) }).map((_, i) => (
                            <div key={i} style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: i === 0 ? '#f97316' : '#ffedd5',
                            }} />
                          ))}
                          {cat.visits > 5 && (
                            <span style={{ fontSize: 9, color: '#94a3b8', lineHeight: '6px' }}>+{cat.visits - 5}</span>
                          )}
                        </div>
                      </div>
                    </TimelineRow>
                  ))
                )}
              </Section>

              {/* Donations */}
              <Section
                title="Donations"
                icon={<Banknote size={13} color="#8b5cf6" strokeWidth={2} />}
                count={data.donations.length}
              >
                {data.donations.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                    No donations this day
                  </div>
                ) : (
                  data.donations.map((d, i) => (
                    <TimelineRow key={i} time={d.time}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12, color: '#1e293b', marginBottom: 1 }}>
                            {d.donor}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>triggered {d.grams}g dispense</div>
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 14, color: '#8b5cf6',
                        }}>
                          NT${d.amountNtd}
                        </span>
                      </div>
                    </TimelineRow>
                  ))
                )}
              </Section>

              {/* Food dispensed */}
              <Section
                title="Food Dispensed"
                icon={<Utensils size={13} color="#3b82f6" strokeWidth={2} />}
                count={data.feeds.length}
              >
                {data.feeds.map((f, i) => (
                  <TimelineRow key={i} time={f.time}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12, color: '#1e293b', marginBottom: 1 }}>
                          {f.grams}g dispensed
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700,
                            color: triggerColor(f.trigger),
                            background: `${triggerColor(f.trigger)}18`,
                            borderRadius: 20, padding: '1px 7px',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            {triggerLabel(f.trigger)}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={12} color="#3b82f6" strokeWidth={2.5} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>
                          {f.grams}g
                        </span>
                      </div>
                    </div>
                  </TimelineRow>
                ))}
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
