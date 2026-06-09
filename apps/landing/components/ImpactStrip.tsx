'use client';
import { useEffect, useState } from 'react';
import { Eyebrow } from '@stray/ui';

interface Stats {
  online: number;
  cities: number;
  meals: number;
  raised: string;
}

const INITIAL: Stats = { online: 0, cities: 1, meals: 650, raised: 'NT$9,750' };

export function ImpactStrip() {
  const [stats, setStats] = useState<Stats>(INITIAL);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

    async function poll() {
      try {
        const res = await fetch(`${API}/stations`, { cache: 'no-store' });
        if (!res.ok) return;
        const stations: Array<{ status: string }> = await res.json();
        setStats((prev) => ({
          ...prev,
          online: stations.filter((s) => s.status === 'online').length,
        }));
      } catch {
        // network unavailable — keep previous values
      }
    }

    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  const items = [
    { v: String(stats.online), l: 'Stations online now' },
    { v: stats.raised, l: 'Total raised' },
    { v: String(stats.cities), l: 'City live' },
    { v: String(stats.meals) + '+', l: 'Meals funded' },
  ];

  return (
    <section
      id="impact"
      style={{ background: '#0f172a', padding: '80px 0' }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '0 40px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 40,
        }}
      >
        {items.map((item) => (
          <div key={item.l} style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 900,
                fontSize: 48,
                color: '#f97316',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {item.v}
            </div>
            <Eyebrow
              color="rgba(255,255,255,0.45)"
              style={{ marginTop: 10 }}
            >
              {item.l}
            </Eyebrow>
          </div>
        ))}
      </div>
    </section>
  );
}
