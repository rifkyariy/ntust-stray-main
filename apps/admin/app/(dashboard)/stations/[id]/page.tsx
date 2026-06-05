import { notFound } from 'next/navigation';
import { fetchStation } from '../../../../lib/api';
import { getAuthToken } from '../../../../lib/auth';
import { findSeed } from '../../../../lib/seeds';
import StationDetailClient from './StationDetailClient';

export default async function StationDetailPage({ params }: { params: { id: string } }) {
  const token = (await getAuthToken()) ?? '';
  const station = (await fetchStation(params.id)) ?? findSeed(params.id);
  if (!station) notFound();
  return <StationDetailClient station={station} token={token} />;
}
