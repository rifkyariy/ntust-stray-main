'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, QrCode, ArrowLeft } from '@stray/ui';
import { confirmPayment } from '../../../lib/api';
import type { PaymentSession } from '@stray/ui';

export function PaymentPageClient({ session }: { session: PaymentSession }) {
  const router = useRouter();
  const [loading, setLoading]   = useState(false);
  const [dispensing, setDispensing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone]         = useState(session.status === 'paid');
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  async function handlePay() {
    setLoading(true);
    const result = await confirmPayment(session.id);
    setLoading(false);
    if (!result) return;

    // Animate a progress bar for the physical dispensing duration
    const durationMs = (session.grams / 50) * 600;
    const startTime  = performance.now();
    setDispensing(true);

    const tick = () => {
      const elapsed  = performance.now() - startTime;
      const p = Math.min(elapsed / durationMs, 1);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDispensing(false);
        setDone(true);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  if (dispensing) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff7ed', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 320, width: '100%' }}>
          {/* Spinning paw icon */}
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#ffedd5', display: 'grid', placeItems: 'center', margin: '0 auto 28px', boxShadow: '0 0 48px rgba(249,115,22,0.3)' }}>
            <span style={{ fontSize: 44, animation: 'spin 1s linear infinite' }}>🐾</span>
          </div>
          <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 26, color: '#c2410c', letterSpacing: '-0.03em', marginBottom: 8 }}>
            Dispensing food…
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#92400e', marginBottom: 28 }}>
            Motor is running — {session.grams}g on the way!
          </p>
          {/* Progress bar */}
          <div style={{ background: '#fed7aa', borderRadius: 99, height: 10, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 99,
              background: 'linear-gradient(90deg, #fb923c, #ea580c)',
              width: `${progress * 100}%`,
              transition: 'width 0.05s linear',
            }} />
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ea580c' }}>{Math.round(progress * 100)}%</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#dcfce7', display: 'grid', placeItems: 'center', margin: '0 auto 28px', boxShadow: '0 0 48px rgba(34,197,94,0.4)' }}>
            <Check size={48} color="#16a34a" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 30, color: '#14532d', letterSpacing: '-0.03em', marginBottom: 12 }}>
            Food dispensed!
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: '#166534', lineHeight: 1.6, marginBottom: 32 }}>
            <strong>{session.grams}g</strong> of cat food was just delivered.
            Thank you for your NT${session.amount_ntd} donation!
          </p>
          <button onClick={() => router.push('/')} style={{ background: '#00B900', color: '#fff', border: 0, padding: '14px 32px', borderRadius: 16, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Go to app
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '14px 16px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: '#f1f5f9', border: 0, borderRadius: 10, padding: 9, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <ArrowLeft size={18} color="#475569" strokeWidth={2} />
        </button>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18, color: '#1e293b', letterSpacing: '-0.02em' }}>
          LINE Pay
        </div>
      </div>

      <div style={{ padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        {/* Card */}
        <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24, overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          {/* LINE Pay header */}
          <div style={{ background: '#00B900', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 13, color: '#00B900' }}>LINE</span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18, color: '#fff' }}>LINE Pay</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Stray cat donation</div>
            </div>
          </div>

          {/* Amount */}
          <div style={{ padding: '24px 24px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Total amount</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 52, color: '#1e293b', letterSpacing: '-0.04em' }}>
              NT${session.amount_ntd}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#64748b', marginTop: 6 }}>
              {session.grams}g of cat food
            </div>
          </div>

          <div style={{ height: 1, background: '#f1f5f9', margin: '20px 24px' }} />

          {/* Details */}
          <div style={{ padding: '0 24px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Recipient', 'Stray Cat Feeder — NTUST'],
              ['Session', `#${session.short_id}`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>{k}</span>
                <span style={{ color: '#334155', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ margin: '16px 24px', background: '#f0fdf4', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <QrCode size={18} color="#16a34a" strokeWidth={2} />
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
              You scanned the QR code from the feeder station.
            </div>
          </div>

          {/* Pay button */}
          <div style={{ padding: '4px 24px 24px' }}>
            <button
              onClick={handlePay}
              disabled={loading}
              style={{ width: '100%', padding: '16px 0', borderRadius: 16, background: loading ? '#86efac' : '#00B900', color: '#fff', border: 0, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 17, boxShadow: loading ? 'none' : '0 6px 20px rgba(0,185,0,0.3)', transition: 'all 0.15s' }}
            >
              {loading ? 'Processing…' : `Pay NT$${session.amount_ntd}`}
            </button>
          </div>
        </div>

        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#cbd5e1', textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
          This is a demonstration payment. No real charge will be made.
        </p>
      </div>
    </div>
  );
}
