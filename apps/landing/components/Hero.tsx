import { PawPrint, Calendar, Check } from '@stray/ui';
import { Eyebrow } from '@stray/ui';
import { StatusDot } from '@stray/ui';

const MOBILE_URL = 'https://stray.heretichydra.xyz';

export function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        background: '#FDFBF7',
        paddingTop: 140,
        paddingBottom: 100,
        overflow: 'hidden',
      }}
    >
      {/* Background radial glow top-right */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          right: -200,
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(253,186,116,0.35), transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '0 40px',
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '1.05fr 1fr',
          gap: 64,
          alignItems: 'center',
        }}
      >
        {/* ── Left: copy ─────────────────────────────────────── */}
        <div>
          {/* Live badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#fff',
              border: '1px solid #fed7aa',
              padding: '6px 14px',
              borderRadius: 9999,
              fontWeight: 700,
              fontSize: 12,
              color: '#ea580c',
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              marginBottom: 28,
              fontFamily: 'var(--font-sans)',
            }}
          >
            <StatusDot color="#22c55e" size={8} />
            89 meals funded today
          </div>

          {/* Headline */}
          <h1
            style={{
              margin: 0,
              color: '#1e293b',
              fontWeight: 900,
              fontSize: 72,
              lineHeight: 1.02,
              letterSpacing: '-0.04em',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Feed the cats
            <br />
            your city
            <br />
            <span style={{ color: '#f97316' }}>forgot.</span>
          </h1>

          {/* Sub-copy */}
          <p
            style={{
              margin: '24px 0 36px',
              maxWidth: 480,
              color: '#475569',
              fontSize: 18,
              fontWeight: 500,
              lineHeight: 1.55,
              fontFamily: 'var(--font-sans)',
            }}
          >
            Stray is a network of public smart feeders, run by cities and crowdfunded by neighbours.
            Scan any station, choose how much to dispense, pay NT$15 — and watch a stray walk up to
            eat, on a live camera, within minutes.
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 40 }}>
            <a
              href={MOBILE_URL}
              style={{
                background: 'linear-gradient(90deg, #fb923c, #f97316)',
                color: '#fff',
                border: 0,
                padding: '16px 28px',
                borderRadius: 16,
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(249,115,22,0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-sans)',
                textDecoration: 'none',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
            >
              <PawPrint size={18} color="#fff" strokeWidth={2} />
              Feed a cat now
            </a>
            <a
              href={`${MOBILE_URL}`}
              style={{
                background: '#fff',
                color: '#1e293b',
                border: '2px solid #e2e8f0',
                padding: '14px 22px',
                borderRadius: 16,
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-sans)',
                textDecoration: 'none',
              }}
            >
              <Calendar size={16} color="#1e293b" strokeWidth={2} />
              Schedule a meal
            </a>
          </div>

          {/* Stats strip */}
          <div
            style={{
              display: 'flex',
              gap: 28,
              paddingTop: 20,
              borderTop: '1px solid #f1f5f9',
            }}
          >
            {[
              { v: '650+', l: 'Meals funded' },
              { v: '1', l: 'City live' },
              { v: '24', l: 'Stray cats fed' },
            ].map((s) => (
              <div key={s.l}>
                <div
                  style={{
                    color: '#1e293b',
                    fontWeight: 900,
                    fontSize: 26,
                    letterSpacing: '-0.02em',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {s.v}
                </div>
                <Eyebrow style={{ marginTop: 3 }}>{s.l}</Eyebrow>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: photo stack ──────────────────────────────── */}
        <HeroPhotoStack />
      </div>
    </section>
  );
}

function HeroPhotoStack() {
  return (
    <div style={{ position: 'relative', height: 580 }}>
      {/* Radial glow behind photo */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251,146,60,0.22), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Main photo */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          right: 40,
          bottom: 80,
          borderRadius: 28,
          overflow: 'hidden',
          boxShadow: '0 30px 70px rgba(15,23,42,0.18)',
          background: '#1e293b',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1574158622682-e40e69881006?w=900&q=80&auto=format&fit=crop"
          alt="A stray cat eating at a Stray feeding station"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* AI detection bounding box */}
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '20%',
            width: '48%',
            height: '52%',
            border: '2px solid #4ade80',
            borderRadius: 8,
            background: 'rgba(74,222,128,0.08)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -24,
              left: -2,
              background: '#4ade80',
              color: '#0f172a',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: '4px 4px 4px 0',
              whiteSpace: 'nowrap',
            }}
          >
            cat 0.96 · CAT-007
          </div>
        </div>

        {/* Bottom gradient + station info */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '80px 20px 18px',
            background: 'linear-gradient(0deg, rgba(15,23,42,0.92), transparent)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <div>
              <Eyebrow color="rgba(255,255,255,0.55)">Now feeding · F-TPE-04</Eyebrow>
              <div
                style={{
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 17,
                  marginTop: 4,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Ximending Station
              </div>
            </div>
            {/* LIVE badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.12)',
                padding: '4px 10px',
                borderRadius: 6,
                fontWeight: 900,
                fontSize: 10,
                letterSpacing: '0.15em',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 8px rgba(239,68,68,0.9)',
                }}
              />
              LIVE
            </div>
          </div>
        </div>
      </div>

      {/* Floating donation card — top right */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          background: '#fff',
          border: '1px solid #f1f5f9',
          borderRadius: 16,
          padding: '14px 18px',
          boxShadow: '0 12px 30px rgba(15,23,42,0.10)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          transform: 'rotate(2.5deg)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            background: 'linear-gradient(135deg, #fb923c, #f97316)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <PawPrint size={20} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <Eyebrow color="#94a3b8" style={{ fontSize: 9 }}>
            Anonymous · just now
          </Eyebrow>
          <div
            style={{
              color: '#1e293b',
              fontWeight: 700,
              fontSize: 14,
              fontFamily: 'var(--font-sans)',
              marginTop: 2,
            }}
          >
            NT$60 · 4 meals queued
          </div>
        </div>
      </div>

      {/* Floating receipt — bottom left */}
      <div
        style={{
          position: 'absolute',
          left: -10,
          bottom: 30,
          background: '#fff',
          border: '1px solid #f1f5f9',
          borderRadius: 16,
          padding: '14px 18px',
          boxShadow: '0 12px 30px rgba(15,23,42,0.10)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          transform: 'rotate(-3deg)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            background: '#dcfce7',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Check size={18} color="#16a34a" strokeWidth={2.5} />
        </div>
        <div>
          <Eyebrow color="#94a3b8" style={{ fontSize: 9 }}>
            Dispensed · CAT-019 ate
          </Eyebrow>
          <div
            style={{
              color: '#1e293b',
              fontWeight: 700,
              fontSize: 14,
              fontFamily: 'var(--font-sans)',
              marginTop: 2,
            }}
          >
            120g · funded by Lin Wei
          </div>
        </div>
      </div>
    </div>
  );
}
