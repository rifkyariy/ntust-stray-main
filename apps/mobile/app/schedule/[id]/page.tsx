import { fetchStation } from '../../../lib/api';
import { findSeed } from '../../../lib/seeds';
import { notFound } from 'next/navigation';
import { ScheduleSheet } from '../../../components/ScheduleSheet';

interface Props {
  params: { id: string };
}

export default async function SchedulePage({ params }: Props) {
  const station = (await fetchStation(params.id)) ?? findSeed(params.id);
  if (!station) notFound();
  return <ScheduleSheet station={station} />;
}
