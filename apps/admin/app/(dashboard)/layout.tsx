import type { ReactNode } from 'react';
import Sidebar from '../../components/Sidebar';
import { fetchStations, deriveKPIs } from '../../lib/api';
import { getAuthToken } from '../../lib/auth';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const token = (await getAuthToken()) ?? '';
  const stations = await fetchStations();
  const kpis = deriveKPIs(stations);

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--slate-50)',
      fontFamily: 'var(--font-sans)',
    }}>
      <Sidebar alertCount={kpis.active_alerts} />
      <main style={{
        flex: 1,
        marginLeft: 240,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {children}
      </main>
    </div>
  );
}
