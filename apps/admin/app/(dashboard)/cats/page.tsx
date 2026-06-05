import Topbar from '../../../components/Topbar';

export default function CatsPage() {
  return (
    <>
      <Topbar />
      <div style={{ padding: '28px 28px 48px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate-900)', margin: 0, letterSpacing: '-0.02em' }}>
            Cats
          </h1>
          <p style={{ fontSize: 13, color: 'var(--slate-400)', margin: '4px 0 0' }}>
            AI-tracked individuals across all stations
          </p>
        </div>

        {/* Coming soon placeholder */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          border: '1px solid var(--slate-100)',
          padding: '60px 32px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🐱</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--slate-800)', marginBottom: 8 }}>
            Cat Registry — Coming Soon
          </div>
          <div style={{ fontSize: 14, color: 'var(--slate-400)', maxWidth: 400, margin: '0 auto' }}>
            AI-powered individual cat tracking with profile cards, visit history, and health monitoring will be available when detection data accumulates.
          </div>

          {/* Mock preview cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 40, maxWidth: 640, marginInline: 'auto', opacity: 0.4 }}>
            {[
              { id: 'CAT-007', visits: 42, station: "Da'an Park" },
              { id: 'CAT-012', visits: 28, station: 'Gongguan' },
              { id: 'CAT-003', visits: 17, station: 'Zhongshan' },
            ].map((cat) => (
              <div key={cat.id} style={{
                background: 'var(--slate-50)',
                borderRadius: 14,
                padding: '16px',
                border: '1px solid var(--slate-200)',
                textAlign: 'left',
              }}>
                <div style={{
                  width: '100%', aspectRatio: '1',
                  background: 'var(--slate-200)',
                  borderRadius: 10,
                  marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28,
                }}>
                  🐱
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--slate-700)' }}>{cat.id}</div>
                <div style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 4 }}>{cat.visits} visits · {cat.station}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
