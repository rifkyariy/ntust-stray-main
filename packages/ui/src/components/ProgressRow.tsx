import React from 'react';

interface ProgressRowProps {
  icon: React.ReactNode;
  label: string;
  value: number;        // 0–100
  color?: string;
  style?: React.CSSProperties;
}

/**
 * Icon + label + percentage text + gradient progress bar.
 * Used for food level and battery indicators.
 */
export function ProgressRow({ icon, label, value, color = 'var(--orange-500)', style }: ProgressRowProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--slate-500)',
        fontFamily: 'var(--font-sans)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--slate-600)' }}>
          {icon}
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{clamped}%</span>
      </div>
      {/* Track */}
      <div style={{ height: 6, background: 'var(--slate-100)', borderRadius: 9999, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
            borderRadius: 9999,
            transition: 'width 0.4s var(--ease-out)',
          }}
        />
      </div>
    </div>
  );
}
