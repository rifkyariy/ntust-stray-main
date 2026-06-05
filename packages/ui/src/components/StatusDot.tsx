import React from 'react';

interface StatusDotProps {
  color: string;
  size?: number;
  /** If true, adds a CSS pulse animation */
  pulse?: boolean;
}

/**
 * Small glowing coloured dot. Used for live/online indicators.
 */
export function StatusDot({ color, size = 8, pulse = true }: StatusDotProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 ${size + 2}px ${color}88`,
        flexShrink: 0,
        animation: pulse ? 'stray-pulse 2s ease-in-out infinite' : undefined,
      }}
    />
  );
}
