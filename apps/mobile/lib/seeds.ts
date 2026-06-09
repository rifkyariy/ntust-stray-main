import type { Station } from '@stray/ui';

export const SEED_STATIONS: Station[] = [
  {
    id: 'seed-1',
    station_code: 'NTUST-STR-01',
    name: 'National Taiwan University of Science and Technology',
    city: 'Taipei City',
    district: 'Daan District',
    lat: 25.0122202,
    lng: 121.541437,
    status: 'online',
    food_pct: 85,
    battery_pct: 100,
    temp_c: 26.5,
    humidity_pct: 65,
    installed_at: '2026-01-01T00:00:00Z',
    image_url: 'https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80&auto=format&fit=crop',
  },
];

export function findSeed(id: string): Station | null {
  return SEED_STATIONS.find((s) => s.id === id || s.station_code === id) ?? null;
}
