const MOBILE_URL = 'https://stray.heretichydra.xyz';
const ADMIN_URL  = 'https://minstray.heretichydra.xyz';

const NAV_COLS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: 'Platform',
    links: [
      { label: 'How it works',  href: '#how-it-works' },
      { label: 'Stations map',  href: MOBILE_URL },
      { label: 'Schedule meal', href: MOBILE_URL },
      { label: 'Feed a cat',    href: MOBILE_URL },
    ],
  },
  {
    heading: 'Admin',
    links: [
      { label: 'Sign in',       href: ADMIN_URL },
      { label: 'Dashboard',     href: ADMIN_URL },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy policy',    href: '#' },
      { label: 'Terms of service',  href: '#' },
    ],
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
            <a
              href={MOBILE_URL}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 18,
                textDecoration: 'none',
              }}
            >
              <img
                src="/assets/stray-logo.svg"
                alt="Stray logo"
                style={{ width: 36, height: 36, borderRadius: 9 }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 900,
                  fontSize: 20,
                  letterSpacing: '-0.03em',
                  color: '#fff',
                }}
              >
                stray<span style={{ color: '#f97316' }}>.</span>
              </span>
            </a>
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
              {col.links.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
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
                  {label}
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
            From NT$30 · One meal · One cat.
          </div>
        </div>
      </div>
    </footer>
  );
}
