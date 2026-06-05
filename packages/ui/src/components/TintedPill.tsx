import React from 'react';

type PillVariant = 'green' | 'orange' | 'slate' | 'red' | 'blue' | 'purple';

interface TintedPillProps {
  variant: PillVariant;
  label: string;
  style?: React.CSSProperties;
}

const PALETTE: Record<PillVariant, { bg: string; color: string; dot: string }> = {
  green:  { bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
  orange: { bg: '#fff7ed', color: '#9a3412', dot: '#f97316' },
  slate:  { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  red:    { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  blue:   { bg: '#e0f2fe', color: '#075985', dot: '#0284c7' },
  purple: { bg: '#ede9fe', color: '#4c1d95', dot: '#7c3aed' },
};

/**
 * Small status pill with a coloured dot. One of the most-used primitives.
 *
 * @example
 * <TintedPill variant="green" label="Online" />
 * <TintedPill variant="orange" label="Low food" />
 */
export function TintedPill({ variant, label, style }: TintedPillProps) {
  const { bg, color, dot } = PALETTE[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: bg,
        color,
        borderRadius: 9999,
        padding: '3px 9px',
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--font-sans)',
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}
