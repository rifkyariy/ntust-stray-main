import { Thermometer, Droplets } from '@stray/ui';
import { ProgressRow } from '@stray/ui';
import { PawPrint, Battery } from '@stray/ui';
import type { Station } from '@stray/ui';

export function SupplyLevels({ station }: { station: Station }) {
  const foodColor =
    station.food_pct < 20 ? '#ef4444' :
    station.food_pct < 40 ? '#fbbf24' :
    '#f97316';

  return (
    <>
      {/* Supply progress rows */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '18px 18px',
        border: '1px solid #f1f5f9',
        marginBottom: 12,
      }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 14 }}>
          Supply Levels
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ProgressRow
            icon={<PawPrint size={14} strokeWidth={2} />}
            label="Food"
            value={station.food_pct}
            color={foodColor}
          />
          <ProgressRow
            icon={<Battery size={14} strokeWidth={2} />}
            label="Battery"
            value={station.battery_pct}
            color="#22c55e"
          />
        </div>
      </div>

      {/* Env tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: '14px 16px',
          border: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef2f2', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Thermometer size={18} color="#ef4444" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 20, color: '#1e293b', lineHeight: 1.1 }}>
              {station.temp_c.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 600 }}>°C</span>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', marginTop: 1 }}>
              Temp
            </div>
          </div>
        </div>

        <div style={{
          background: '#fff', borderRadius: 16, padding: '14px 16px',
          border: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eff6ff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Droplets size={18} color="#3b82f6" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 20, color: '#1e293b', lineHeight: 1.1 }}>
              {station.humidity_pct}<span style={{ fontSize: 12, fontWeight: 600 }}>%</span>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', marginTop: 1 }}>
              Humidity
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
