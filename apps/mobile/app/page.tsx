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

      {/* Station list */}
      <div style={{ padding: '16px 16px 40px' }}>
        <StationList initialStations={stations} />
      </div>
    </div>
  );
}
