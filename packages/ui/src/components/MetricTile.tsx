import React from 'react';

interface MetricTileProps {
  icon: React.ReactNode;
  value: string | number;
  unit?: string;
  label: string;
  color: string;
  bg: string;
  style?: React.CSSProperties;
}

/**
 * Icon circle + large value + optional unit + label.
 * Used in KPI strips and detail panels.
 */
export function MetricTile({ icon, value, unit, label, color, bg, style }: MetricTileProps) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: 'var(--shadow-sm)',
        ...style,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--slate-900)',
            lineHeight: 1.1,
            fontFamily: 'var(--font-sans)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
          {unit && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--slate-400)',
                marginLeft: 3,
              }}
            >
              {unit}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--slate-400)',
            fontFamily: 'var(--font-sans)',
            marginTop: 2,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
