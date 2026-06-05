import React from 'react';

interface EyebrowProps {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * UPPERCASE micro-label — 10px, wide letter-spacing, light weight.
 * Used as a section label above headings.
 */
export function Eyebrow({ children, color, style, className }: EyebrowProps) {
  return (
    <div
      className={className}
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: color ?? 'var(--slate-400)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
