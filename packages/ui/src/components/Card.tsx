import React from 'react';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  padding?: number | string;
}

/**
 * White card with 24px radius and subtle shadow.
 * Base container for dashboard panels.
 */
export function Card({ children, style, padding = 24 }: CardProps) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 24,
        padding,
        boxShadow: 'var(--shadow-md)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
