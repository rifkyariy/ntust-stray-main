import { fetchStations } from '../../../lib/api';
import { getAuthToken } from '../../../lib/auth';
import StationsPageClient from './StationsPageClient';

export default async function StationsPage() {
  const token = (await getAuthToken()) ?? '';
  const stations = await fetchStations();
  return <StationsPageClient initialStations={stations} token={token} />;
}
