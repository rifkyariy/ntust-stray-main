'use client';
import { PawPrint } from '@stray/ui';

const MOBILE_URL = 'https://stray.heretichydra.xyz';
const ADMIN_URL  = 'https://minstray.heretichydra.xyz';

export function MHeader() {
  return (
    <header
      style={{
        background: 'transparent',
        padding: '20px 0',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '0 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Logo */}
        <a
          href={MOBILE_URL}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          <img
            src="/assets/stray-logo.svg"
            alt="Stray logo"
            style={{ width: 40, height: 40, borderRadius: 10 }}
          />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 22,
              letterSpacing: '-0.04em',
              color: '#1e293b',
            }}
          >
            stray<span style={{ color: '#f97316' }}>.</span>
          </span>
        </a>

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: 32 }}>
          {[
            { label: 'How it works', href: '#how-it-works' },
            { label: 'Stations',     href: '#stations' },
            { label: 'For cities',   href: '#for-cities' },
            { label: 'Impact',       href: '#impact' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              style={{
                textDecoration: 'none',
                color: '#475569',
                fontWeight: 600,
                fontSize: 14,
                fontFamily: 'var(--font-sans)',
                transition: 'color 0.15s',
              }}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a
            href={ADMIN_URL}
            style={{
              textDecoration: 'none',
              color: '#475569',
              fontWeight: 600,
              fontSize: 14,
              fontFamily: 'var(--font-sans)',
            }}
          >
            Sign in
          </a>
          <a
            href={MOBILE_URL}
            style={{
              background: '#f97316',
              color: '#fff',
              border: '1px solid #fb923c',
              padding: '10px 18px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(249,115,22,0.4)',
              display: 'inline-flex',
              gap: 8,
              alignItems: 'center',
              fontFamily: 'var(--font-sans)',
              textDecoration: 'none',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            <PawPrint size={16} color="#fff" strokeWidth={2} />
            Feed a cat — from NT$30
          </a>
        </div>
      </div>
    </header>
  );
}
