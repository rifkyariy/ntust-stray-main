'use client';
import { useState, useCallback, useEffect } from 'react';
import type { Station, WSMessage } from '@stray/ui';
import type { KPIData } from '../../lib/api';
import { deriveKPIs } from '../../lib/api';
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
  token: string;
}

export default function DashboardClient({ initialStations, token }: DashboardClientProps) {
  const [stations, setStations] = useState<Station[]>(initialStations);
  const [kpis, setKpis] = useState<KPIData>(() => deriveKPIs(initialStations));
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [cityFilter, setCityFilter] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [latestMsg, setLatestMsg] = useState<WSMessage | null>(null);

  // Re-derive KPIs whenever stations change (not inside the updater fn)
  useEffect(() => {
    setKpis(deriveKPIs(stations));
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

        {/* Map + Activity side by side — default stretch so ActivityFeed fills the row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          <StationsMap stations={stations} onSelect={setSelectedStation} />
          <ActivityFeed latestMsg={latestMsg} />
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
