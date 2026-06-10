import { Eyebrow } from '@stray/ui';

interface Partner {
  name: string;
  logo: string | null;   // path under /assets/ — null shows initials fallback
  initials: string;
  type: 'university' | 'government';
}

const PARTNERS: Partner[] = [
  {
    name: 'National Taiwan University of Science and Technology',
    logo: '/assets/ntust-logo.png',
    initials: 'NTUST',
    type: 'university',
  },
  {
    name: 'National Taiwan University',
    logo: '/assets/ntu-logo.png',
    initials: 'NTU',
    type: 'university',
  },
  {
    name: 'Taipei City Government',
    logo: '/assets/taipei-gov-logo.png',
    initials: 'TPE',
    type: 'government',
  },
];

function PartnerLogo({ partner }: { partner: Partner }) {
  const accent = partner.type === 'government' ? '#1d4ed8' : '#f97316';
  const bg     = partner.type === 'government' ? '#eff6ff' : '#fff7ed';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 24,
          background: bg,
          border: `1.5px solid ${partner.type === 'government' ? '#dbeafe' : '#ffedd5'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={partner.logo ?? ''}
          alt={partner.name}
          style={{ width: '80%', height: '80%', objectFit: 'contain' }}
          onError={(e) => {
            // Swap to initials fallback if image is missing
            const target = e.currentTarget;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        <div
          style={{
            display: 'none',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 18,
            color: accent,
            letterSpacing: '-0.02em',
          }}
        >
          {partner.initials}
        </div>
      </div>
      <div style={{ textAlign: 'center', maxWidth: 160 }}>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 13,
            color: '#1e293b',
            lineHeight: 1.4,
          }}
        >
          {partner.name}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 600,
            color: accent,
            marginTop: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {partner.type === 'government' ? 'Government' : 'University'}
        </div>
      </div>
    </div>
  );
}

export function Collaboration() {
  return (
    <section
      id="for-cities"
      style={{ background: '#fff', padding: '100px 0' }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 40px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <Eyebrow color="#f97316" style={{ marginBottom: 14 }}>
            Partners & Collaboration
          </Eyebrow>
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 48,
              color: '#1e293b',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              margin: '0 0 20px',
            }}
          >
            Built with the city,
            <br />
            <span style={{ color: '#f97316' }}>for the city.</span>
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              color: '#64748b',
              fontSize: 17,
              fontWeight: 500,
              lineHeight: 1.65,
              maxWidth: 520,
              margin: '0 auto',
            }}
          >
            Stray is developed in partnership with leading universities and the
            Taipei City Government — combining research, technology, and public
            infrastructure to care for stray cats at scale.
          </p>
        </div>

        {/* Logos row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: 80,
            flexWrap: 'wrap',
          }}
        >
          {PARTNERS.map((p) => (
            <PartnerLogo key={p.name} partner={p} />
          ))}
        </div>

        {/* Divider quote */}
        <div
          style={{
            marginTop: 72,
            padding: '40px 48px',
            background: '#FDFBF7',
            borderRadius: 24,
            border: '1px solid #f1f5f9',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontStyle: 'italic',
              fontSize: 18,
              fontWeight: 600,
              color: '#475569',
              lineHeight: 1.7,
              margin: '0 0 16px',
              maxWidth: 680,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            &ldquo;Smart cities take care of all their residents — including the
            ones with four legs.&rdquo;
          </p>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 13,
              color: '#f97316',
              letterSpacing: '0.04em',
            }}
          >
            Stray · NTUST Research Initiative · Taipei, 2026
          </div>
        </div>
      </div>
    </section>
  );
}
