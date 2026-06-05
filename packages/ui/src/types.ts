// ── Domain types ──────────────────────────────────────────────────────────────

export type StationStatus = 'online' | 'low_food' | 'offline';

export interface Station {
  id: string;
  station_code: string;
  name: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  status: StationStatus;
  food_pct: number;
  battery_pct: number;
  temp_c: number;
  humidity_pct: number;
  installed_at: string;
  image_url: string | null;
}

export interface Donation {
  id: string;
  station_id: string;
  amount_ntd: number;
  donor_name: string | null;
  dispensed: boolean;
  created_at: string;
}

export interface Schedule {
  id: string;
  station_id: string;
  cron_expr: string;
  grams: number;
  active: boolean;
}

// ── WebSocket message union ────────────────────────────────────────────────────

export interface WSTelemetry {
  type: 'telemetry';
  station_id: string;
  food_pct: number;
  battery_pct: number;
  temp_c: number;
  humidity_pct: number;
  ts: string;
}

export interface WSDetection {
  type: 'detection';
  station_id: string;
  cat_code: string;
  confidence: number;
  bbox?: { x: number; y: number; w: number; h: number };
  ts: string;
}

export interface WSFeedEvent {
  type: 'feed_event';
  station_id: string;
  grams: number;
  trigger: 'donation' | 'schedule' | 'admin';
  donor?: string;
  ts: string;
}

export interface WSAlert {
  type: 'alert';
  station_id: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  ts: string;
}

export type WSMessage = WSTelemetry | WSDetection | WSFeedEvent | WSAlert;
