'use client';
import { useState, useCallback } from 'react';
import type { Station, WSMessage } from '@stray/ui';
import { useWebSocket } from '../../../hooks/useWebSocket';
import Topbar from '../../../components/Topbar';
import StationsTable from '../../../components/StationsTable';
import StationDrawer from '../../../components/StationDrawer';
import AddStationModal from '../../../components/AddStationModal';

interface StationsPageClientProps {
  initialStations: Station[];
  token: string;
}

export default function StationsPageClient({ initialStations, token }: StationsPageClientProps) {
  const [stations, setStations] = useState<Station[]>(initialStations);
  const [selected, setSelected] = useState<Station | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [cityFilter, setCityFilter] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  const handleMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'telemetry') {
      setStations((prev) =>
        prev.map((s) => s.station_code === msg.station_id
          ? {
              ...s,
              food_pct:     msg.food_pct,
              battery_pct:  msg.battery_pct,
              temp_c:       msg.temp_c,
              humidity_pct: msg.humidity_pct,
              status:       msg.food_pct < 20 ? 'low_food' : 'online',
            }
          : s),
      );
    }
  }, []);

  useWebSocket(handleMessage);

  return (
    <>
      <Topbar
        alertCount={stations.filter((s) => s.status !== 'online').length}
        onAddStation={() => setShowAdd(true)}
        onCityFilter={setCityFilter}
        onSearch={setSearchQuery}
      />

      <div style={{ padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate-900)', margin: 0, letterSpacing: '-0.02em' }}>
            Stations
          </h1>
          <p style={{ fontSize: 13, color: 'var(--slate-400)', margin: '4px 0 0' }}>
            Manage and monitor all feeder nodes
          </p>
        </div>

        <StationsTable
          stations={stations}
          cityFilter={cityFilter}
          searchQuery={searchQuery}
          onSelect={setSelected}
        />
      </div>

      <StationDrawer
        station={selected}
        token={token}
        onClose={() => setSelected(null)}
      />

      <AddStationModal
        open={showAdd}
        token={token}
        onClose={() => setShowAdd(false)}
      />
    </>
  );
}
