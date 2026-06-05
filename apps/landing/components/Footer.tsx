import { PawPrint } from '@stray/ui';

const NAV_COLS = [
  {
    heading: 'Platform',
    links: ['How it works', 'Stations map', 'For cities', 'Impact'],
  },
  {
    heading: 'Company',
    links: ['About', 'Blog', 'Careers', 'Press'],
  },
  {
    heading: 'Legal',
    links: ['Privacy policy', 'Terms of service', 'Cookie policy'],
  },
];

export function Footer() {
  return (
    <footer style={{ background: '#0f172a', color: '#fff', padding: '72px 0 36px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 40px' }}>
        {/* Top grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            gap: 48,
            marginBottom: 56,
          }}
        >
          {/* Brand column */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: '#f97316',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <PawPrint size={20} color="#fff" strokeWidth={2} />
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 900,
                  fontSize: 20,
                  letterSpacing: '-0.03em',
                }}
              >
                stray<span style={{ color: '#f97316' }}>.</span>
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                color: '#64748b',
                fontSize: 14,
                lineHeight: 1.7,
                maxWidth: 280,
                margin: 0,
              }}
            >
              Community-powered smart feeders for stray cats. Built in
              collaboration with city governments across Taiwan.
            </p>
            {/* Social links placeholder */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginTop: 24,
              }}
            >
              {['𝕏', 'IG', 'FB'].map((s) => (
                <a
                  key={s}
                  href="#"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: '#1e293b',
                    display: 'grid',
                    placeItems: 'center',
                    textDecoration: 'none',
                    color: '#64748b',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {NAV_COLS.map((col) => (
            <div key={col.heading}>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#94a3b8',
                  marginBottom: 18,
                }}
              >
                {col.heading}
              </div>
              {col.links.map((link) => (
                <a
                  key={link}
                  href="#"
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    color: '#64748b',
                    fontSize: 14,
                    fontFamily: 'var(--font-sans)',
                    marginBottom: 12,
                    transition: 'color 0.15s',
                  }}
                >
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: '1px solid #1e293b',
            paddingTop: 28,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              color: '#475569',
              fontSize: 13,
            }}
          >
            © 2026 Stray. In partnership with NTUST and the city governments of
            Taiwan.
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: '#334155',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            NT$15 · One meal · One cat.
          </div>
        </div>
      </div>
    </footer>
  );
}
