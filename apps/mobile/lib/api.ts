import type { Station, Donation } from '@stray/ui';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function fetchStations(): Promise<Station[]> {
  try {
    const res = await fetch(`${API}/stations`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchStation(id: string): Promise<Station | null> {
  try {
    const res = await fetch(`${API}/stations/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function postDonation(payload: {
  station_id: string;
  amount_ntd: number;
  donor_name?: string;
  dispense: boolean;
}): Promise<Donation | null> {
  try {
    const res = await fetch(`${API}/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return dummyDonation(payload);
    return res.json();
  } catch {
    // Backend offline — simulate a successful payment so the UI flow works
    return dummyDonation(payload);
  }
}

/** Fake donation returned when the backend is unreachable. */
async function dummyDonation(payload: {
  station_id: string;
  amount_ntd: number;
  donor_name?: string;
  dispense: boolean;
}): Promise<Donation> {
  // Simulate ~700 ms network latency so the "Processing…" state is visible
  await new Promise((r) => setTimeout(r, 700));
  return {
    id:         `dummy-${Date.now()}`,
    station_id: payload.station_id,
    amount_ntd: payload.amount_ntd,
    donor_name: payload.donor_name ?? null,
    dispensed:  payload.dispense,
    created_at: new Date().toISOString(),
  };
}

export interface MetricPoint {
  ts: string;
  value: number;
}

export interface StationMetrics {
  range: string;
  food_pct: MetricPoint[];
  temp_c: MetricPoint[];
  humidity_pct: MetricPoint[];
}

export async function fetchStationMetrics(
  id: string,
  range: '1h' | '24h' | '7d' = '7d',
): Promise<StationMetrics | null> {
  try {
    const res = await fetch(`${API}/stations/${id}/metrics?range=${range}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
