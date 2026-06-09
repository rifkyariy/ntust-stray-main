import type { Station, Donation, PaymentSession } from '@stray/ui';

export async function fetchDonations(stationId: string): Promise<Donation[]> {
  try {
    const res = await fetch(`${API}/donations?station_id=${stationId}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface DailyCount { date: string; count: number; }

export async function fetchDailyDonations(stationId: string, days = 90): Promise<DailyCount[]> {
  try {
    const res = await fetch(
      `${API}/donations/daily?station_id=${stationId}&days=${days}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// Server-side hits backend directly; browser goes same-origin through Next rewrite.
const API =
  typeof window === 'undefined'
    ? (process.env.API_URL ?? 'http://backend:8000')
    : '/api/backend';

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

export async function createPaymentSession(
  stationId: string,
  amountNtd: number,
  grams: number,
  donorName?: string,
): Promise<PaymentSession | null> {
  try {
    const res = await fetch(`${API}/payments/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station_id: stationId, amount_ntd: amountNtd, grams, donor_name: donorName || null }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchPaymentSession(sessionId: string): Promise<PaymentSession | null> {
  try {
    const res = await fetch(`${API}/payments/sessions/${sessionId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchPaymentSessionByShortId(shortId: string): Promise<PaymentSession | null> {
  try {
    const res = await fetch(`${API}/payments/sessions/by-short/${shortId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function confirmPayment(sessionId: string): Promise<PaymentSession | null> {
  try {
    const res = await fetch(`${API}/payments/sessions/${sessionId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    // Simulate success so UI flow works without backend
    await new Promise((r) => setTimeout(r, 800));
    return { id: 'dummy', short_id: 'dummy', station_id: '', amount_ntd: 0, grams: 0, status: 'paid', created_at: new Date().toISOString(), paid_at: new Date().toISOString() };
  }
}

export async function postSchedule(
  stationId: string,
  cronExpr: string,
  grams: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${API}/stations/${stationId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cron_expr: cronExpr, grams, active: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
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
