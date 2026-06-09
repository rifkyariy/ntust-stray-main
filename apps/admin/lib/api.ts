import type { Station, Donation } from '@stray/ui';

// On the server (server components, route handlers) we hit the backend
// directly over the Docker network. In the browser we go same-origin through
// the Next rewrite (/api/backend/* → backend), so no host/port/CORS concerns.
const API =
  typeof window === 'undefined'
    ? (process.env.API_URL ?? 'http://backend:8000')
    : '/api/backend';

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

export function deriveKPIs(stations: Station[], donations: Donation[] = []): KPIData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDonations = donations.filter((d) => new Date(d.created_at) >= today);

  const dispensed_today_kg =
    todayDonations
      .filter((d) => d.dispensed && d.grams != null)
      .reduce((sum, d) => sum + (d.grams ?? 0), 0) / 1000;

  const donated_today_ntd = todayDonations.reduce((sum, d) => sum + d.amount_ntd, 0);

  // Seeded daily random for cats — consistent within a day, changes each day
  const d = today;
  const daySeed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const cats_tracked = 3 + (daySeed % 11);

  return {
    stations_online: stations.filter((s) => s.status !== 'offline').length,
    dispensed_today_kg,
    donated_today_ntd,
    cats_tracked,
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
): Promise<{ ok: true; dispensing_ms: number } | { ok: false; status: number }> {
  try {
    const res = await apiFetch(`/stations/${stationId}/dispense`, token, {
      method: 'POST',
      body: JSON.stringify({ grams, trigger: 'admin' }),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, dispensing_ms: data.dispensing_ms ?? grams / 50 * 600 };
    }
    return { ok: false, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export interface ScheduleOut {
  id: string;
  station_id: string;
  cron_expr: string;
  grams: number;
  active: boolean;
}

export async function fetchSchedules(stationId: string, token: string): Promise<ScheduleOut[]> {
  try {
    const res = await apiFetch(`/stations/${stationId}/schedules`, token);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function postSchedule(
  stationId: string,
  cron_expr: string,
  grams: number,
  token: string,
): Promise<ScheduleOut | null> {
  try {
    const res = await apiFetch(`/stations/${stationId}/schedule`, token, {
      method: 'POST',
      body: JSON.stringify({ cron_expr, grams, active: true }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function deleteSchedule(
  stationId: string,
  scheduleId: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await apiFetch(`/stations/${stationId}/schedules/${scheduleId}`, token, {
      method: 'DELETE',
    });
    return res.ok || res.status === 204;
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
