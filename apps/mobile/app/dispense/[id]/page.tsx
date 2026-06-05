import { fetchStation } from '../../../lib/api';
import { findSeed } from '../../../lib/seeds';
import { notFound } from 'next/navigation';
import { DispenseSheet } from '../../../components/DispenseSheet';

interface Props {
  params: { id: string };
}

export default async function DispensePage({ params }: Props) {
  const station = (await fetchStation(params.id)) ?? findSeed(params.id);
  if (!station) notFound();
  return <DispenseSheet station={station} />;
}
