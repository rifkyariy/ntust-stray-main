import type { Station } from '@stray/ui';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function fetchStations(city?: string): Promise<Station[]> {
  const url = city
    ? `${API}/stations?city=${encodeURIComponent(city)}`
    : `${API}/stations`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchStats(): Promise<{
  total_donations: number;
  total_stations: number;
  total_events: number;
}> {
  const stations = await fetchStations();
  return {
    total_donations: 0,
    total_stations: stations.filter((s) => s.status !== 'offline').length,
    total_events: 0,
  };
}
