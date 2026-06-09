'use client';
import { Check, AlertTriangle, X } from '@stray/ui';
import type { ToastItem } from '../hooks/useToast';

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

const CONFIG = {
  success: {
    border: '#22c55e',
    bg:     '#f0fdf4',
    iconBg: '#dcfce7',
    icon:   <Check       size={15} color="#16a34a" strokeWidth={2.5} />,
  },
  error: {
    border: '#ef4444',
    bg:     '#fef2f2',
    iconBg: '#fee2e2',
    icon:   <AlertTriangle size={15} color="#dc2626" strokeWidth={2.5} />,
  },
} as const;

export default function ToastStack({ toasts, onDismiss }: Props) {
  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 500,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => {
        const c = CONFIG[t.kind];
        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minWidth: 280,
              maxWidth: 360,
              background: '#fff',
              borderRadius: 14,
              border: '1.5px solid',
              borderColor: c.border,
              boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
              padding: '13px 14px',
              pointerEvents: 'auto',
              animation: 'toastSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: c.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {c.icon}
            </div>

            {/* Message */}
            <span style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--slate-800)',
              lineHeight: 1.4,
            }}>
              {t.message}
            </span>

            {/* Dismiss */}
            <button
              onClick={() => onDismiss(t.id)}
              style={{
                flexShrink: 0,
                width: 24, height: 24,
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--slate-400)',
                padding: 0,
              }}
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
