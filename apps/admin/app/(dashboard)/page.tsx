import { fetchStations, fetchDonations, deriveKPIs } from '../../lib/api';
import { getAuthToken } from '../../lib/auth';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const token = (await getAuthToken()) ?? '';
  const [stations, donations] = await Promise.all([fetchStations(), fetchDonations()]);
  const initialKpis = deriveKPIs(stations, donations);
  return <DashboardClient initialStations={stations} initialKpis={initialKpis} token={token} />;
}
