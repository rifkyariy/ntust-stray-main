import type { Station, Donation } from '@stray/ui';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Authenticated fetch ───────────────────────────────────────────────────────
export async function apiFetch(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
}

// ── Public read fetch ─────────────────────────────────────────────────────────
export async function publicFetch(path: string): Promise<Response> {
  return fetch(`${API}${path}`, { cache: 'no-store' });
}

// ── Endpoint wrappers ─────────────────────────────────────────────────────────
export async function fetchStations(): Promise<Station[]> {
  try {
    const res = await publicFetch('/stations');
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchStation(id: string): Promise<Station | null> {
  try {
    const res = await publicFetch(`/stations/${id}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchDonations(stationId?: string): Promise<Donation[]> {
  try {
    const qs = stationId ? `?station_id=${stationId}` : '';
    const res = await publicFetch(`/donations${qs}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface KPIData {
  stations_online: number;
  dispensed_today_kg: number;
  donated_today_ntd: number;
  cats_tracked: number;
  active_alerts: number;
}

export function deriveKPIs(stations: Station[]): KPIData {
  return {
    stations_online: stations.filter((s) => s.status === 'online').length,
    dispensed_today_kg: 0,
    donated_today_ntd: 0,
    cats_tracked: 0,
    active_alerts: stations.filter(
      (s) => s.status === 'offline' || s.status === 'low_food',
    ).length,
  };
}

export async function postLogin(
  email: string,
  password: string,
): Promise<{ access_token: string } | null> {
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function postDispense(
  stationId: string,
  grams: number,
  token: string,
): Promise<boolean> {
  try {
    const res = await apiFetch(`/stations/${stationId}/dispense`, token, {
      method: 'POST',
      body: JSON.stringify({ grams, trigger: 'admin' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function postSchedule(
  stationId: string,
  cron_expr: string,
  grams: number,
  token: string,
): Promise<boolean> {
  try {
    const res = await apiFetch(`/stations/${stationId}/schedule`, token, {
      method: 'POST',
      body: JSON.stringify({ cron_expr, grams, active: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function postStation(
  payload: {
    station_code: string;
    name: string;
    city: string;
    district: string;
    lat: number;
    lng: number;
  },
  token: string,
): Promise<Station | null> {
  try {
    const res = await apiFetch('/stations', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
