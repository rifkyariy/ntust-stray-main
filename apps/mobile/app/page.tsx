import { fetchStations } from '../lib/api';
import { StationList } from '../components/StationList';
import { PawPrint } from '@stray/ui';

export default async function HomePage() {
  const stations = await fetchStations();

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Top bar */}
      <div style={{
        background: '#fff',
        padding: '14px 20px 12px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: 'linear-gradient(135deg, #fb923c, #f97316)',
          display: 'grid', placeItems: 'center',
          flexShrink: 0,
        }}>
          <PawPrint size={18} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 18, color: '#1e293b', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            stray<span style={{ color: '#f97316' }}>.</span>
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {stations.length} stations
          </div>
        </div>
      </div>

      {/* Live feed hero */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#0f172a', overflow: 'hidden' }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src="/video/dummy.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.88 }}
        />

        {/* LIVE badge */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.12)',
          padding: '4px 9px',
          borderRadius: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: 900,
          fontSize: 10,
          letterSpacing: '0.15em',
          color: '#fff',
          fontFamily: 'var(--font-sans)',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#ef4444',
            boxShadow: '0 0 8px rgba(239,68,68,0.9)',
            animation: 'stray-pulse 2s infinite',
          }} />
          LIVE
        </div>

        {/* Bottom label */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '40px 14px 12px',
          background: 'linear-gradient(0deg, rgba(15,23,42,0.9) 0%, transparent 100%)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginBottom: 2 }}>
            CAMPUS FEED · NTUST
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: '#fff', letterSpacing: '-0.01em' }}>
            Stray Cat Detection
          </div>
        </div>
      </div>

      {/* Station list */}
      <div style={{ padding: '16px 16px 40px' }}>
        <StationList initialStations={stations} />
      </div>
    </div>
  );
}
