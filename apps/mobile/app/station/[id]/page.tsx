import { fetchStation } from '../../../lib/api';
import { notFound } from 'next/navigation';
import { StationDetailClient } from '../../../components/StationDetailClient';

interface Props {
  params: { id: string };
}

export default async function StationPage({ params }: Props) {
  const station = await fetchStation(params.id);
  if (!station) notFound();
  return <StationDetailClient initialStation={station} />;
}
