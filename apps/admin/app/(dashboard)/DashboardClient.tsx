'use client';
import { useState, useCallback, useEffect } from 'react';
import type { Station, WSMessage } from '@stray/ui';
import type { KPIData } from '../../lib/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import Topbar from '../../components/Topbar';
import KPIStrip from '../../components/KPIStrip';
import StationsMap from '../../components/StationsMap';
import StationsTable from '../../components/StationsTable';
import ActivityFeed from '../../components/ActivityFeed';
import StationDrawer from '../../components/StationDrawer';
import AddStationModal from '../../components/AddStationModal';

interface DashboardClientProps {
  initialStations: Station[];
  initialKpis: KPIData;
  token: string;
}

export default function DashboardClient({ initialStations, initialKpis, token }: DashboardClientProps) {
  const [stations, setStations] = useState<Station[]>(initialStations);
  const [kpis, setKpis] = useState<KPIData>(initialKpis);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [cityFilter, setCityFilter] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [latestMsg, setLatestMsg] = useState<WSMessage | null>(null);

  // Keep station-derived KPI fields live; preserve donation fields from server
  useEffect(() => {
    setKpis((prev) => ({
      ...prev,
      stations_online: stations.filter((s) => s.status !== 'offline').length,
      active_alerts:   stations.filter((s) => s.status === 'offline' || s.status === 'low_food').length,
    }));
  }, [stations]);

  const handleMessage = useCallback((msg: WSMessage) => {
    setLatestMsg(msg);

    if (msg.type === 'telemetry') {
      setStations((prev) =>
        prev.map((s) =>
          s.station_code === msg.station_id
            ? {
                ...s,
                food_pct:     msg.food_pct,
                battery_pct:  msg.battery_pct,
                temp_c:       msg.temp_c,
                humidity_pct: msg.humidity_pct,
                status:       msg.food_pct < 20 ? 'low_food' : 'online',
              }
            : s,
        ),
      );
    }

    if (msg.type === 'station_status') {
      setStations((prev) =>
        prev.map((s) =>
          s.station_code === msg.station_id ? { ...s, status: msg.status } : s,
        ),
      );
    }
  }, []);

  useWebSocket(handleMessage);

  return (
    <>
      <Topbar
        alertCount={kpis.active_alerts}
        onAddStation={() => setShowAddModal(true)}
        onCityFilter={setCityFilter}
        onSearch={setSearchQuery}
      />

      <div style={{ padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Page title */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate-900)', margin: 0, letterSpacing: '-0.02em' }}>
            Overview
          </h1>
          <p style={{ fontSize: 13, color: 'var(--slate-400)', margin: '4px 0 0' }}>
            Real-time dashboard — {stations.length} station{stations.length !== 1 ? 's' : ''} registered
          </p>
        </div>

        {/* KPI strip */}
        <KPIStrip data={kpis} />

        {/* Map + right column (live feed + activity) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          <StationsMap stations={stations} onSelect={setSelectedStation} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Live camera feed */}
            <div style={{
              background: '#0f172a',
              borderRadius: 14,
              overflow: 'hidden',
              position: 'relative',
              aspectRatio: '16/9',
              flexShrink: 0,
            }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src="/video/dummy.mp4"
                autoPlay
                loop
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.88 }}
              />
              <div style={{
                position: 'absolute', top: 8, left: 8,
                background: 'rgba(239,68,68,0.9)',
                borderRadius: 5,
                padding: '2px 7px',
                fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.05em',
              }}>
                ● LIVE
              </div>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '20px 10px 8px',
                background: 'linear-gradient(0deg, rgba(15,23,42,0.85) 0%, transparent 100%)',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>
                  CAMPUS FEED · NTUST
                </div>
              </div>
            </div>

            <ActivityFeed latestMsg={latestMsg} />
          </div>
        </div>

        {/* Stations table */}
        <StationsTable
          stations={stations}
          cityFilter={cityFilter}
          searchQuery={searchQuery}
          onSelect={setSelectedStation}
        />
      </div>

      {/* Station detail drawer */}
      <StationDrawer
        station={selectedStation}
        token={token}
        onClose={() => setSelectedStation(null)}
      />

      {/* Add station modal */}
      <AddStationModal
        open={showAddModal}
        token={token}
        onClose={() => setShowAddModal(false)}
        onCreated={() => {
          // In production this would re-fetch; for now just close
          setShowAddModal(false);
        }}
      />
    </>
  );
}
