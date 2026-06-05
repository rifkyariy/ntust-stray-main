import { fetchStations } from '../../lib/api';
import { getAuthToken } from '../../lib/auth';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const token = (await getAuthToken()) ?? '';
  const stations = await fetchStations();
  return <DashboardClient initialStations={stations} token={token} />;
}
