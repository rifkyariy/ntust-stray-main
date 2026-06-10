'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PawPrint, ArrowLeft, Check, QrCode } from '@stray/ui';
import { createPaymentSession, confirmPayment } from '../lib/api';
import type { Station, PaymentSession } from '@stray/ui';

const PRESETS = [
  { grams: 50,  price: 30 },
  { grams: 100, price: 50 },
  { grams: 150, price: 75 },
  { grams: 200, price: 90 },
];

type Phase = 'select' | 'pay' | 'success' | 'error';

export function DispenseSheet({ station }: { station: Station }) {
  const router = useRouter();
  const [selected, setSelected]   = useState(1);       // default 100g / NT$45
  const [name, setName]           = useState('');
  const [phase, setPhase]         = useState<Phase>('select');
  const [session, setSession]     = useState<PaymentSession | null>(null);
  const [loading, setLoading]     = useState(false);

  const preset = PRESETS[selected];

  // ── Step 1: Create session → show LINE Pay screen ──
  async function handleProceed() {
    setLoading(true);
    const s = await createPaymentSession(station.id, preset.price, preset.grams);
    setLoading(false);
    if (s) {
      setSession(s);
      setPhase('pay');
    } else {
      // Backend offline — create a dummy session so UI flow still works
      setSession({ id: 'dummy', short_id: 'offline', station_id: station.id, amount_ntd: preset.price, grams: preset.grams, status: 'pending', created_at: new Date().toISOString(), paid_at: null, donor_name: null });
      setPhase('pay');
    }
  }

  // ── Step 2: Confirm payment → dispense ──
  async function handlePay() {
    if (!session) return;
    setLoading(true);
    const result = session.id === 'dummy'
      ? await new Promise<PaymentSession>((r) => setTimeout(() => r({ ...session, status: 'paid', paid_at: new Date().toISOString() }), 900))
      : await confirmPayment(session.id);
    setLoading(false);
    setPhase(result ? 'success' : 'error');
  }

  // ── Success ──
  if (phase === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFBF7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#dcfce7', display: 'grid', placeItems: 'center', margin: '0 auto 24px', boxShadow: '0 0 40px rgba(34,197,94,0.35)' }}>
            <Check size={40} color="#16a34a" strokeWidth={2.5} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 28, color: '#1e293b', letterSpacing: '-0.03em', marginBottom: 10 }}>
            Dispensing now!
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', color: '#64748b', fontSize: 15, lineHeight: 1.6, marginBottom: 6 }}>
            <strong>{preset.grams}g</strong> of food is being dispensed at <strong>{station.name}</strong>.
          </p>
          <p style={{ fontFamily: 'var(--font-sans)', color: '#94a3b8', fontSize: 13, marginBottom: 32 }}>
            Thank you for your NT${preset.price} donation! A cat should appear soon.
          </p>
          <button onClick={() => router.back()} style={{ background: 'linear-gradient(90deg, #fb923c, #f97316)', color: '#fff', border: 0, padding: '14px 32px', borderRadius: 16, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 6px 18px rgba(249,115,22,0.3)' }}>
            Back to station
          </button>
        </div>
      </div>
    );
  }

  // ── LINE Pay screen ──
  if ((phase === 'pay' || phase === 'error') && session) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        {/* Header */}
        <div style={{ background: '#fff', padding: '14px 16px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
          <button onClick={() => setPhase('select')} style={{ background: '#f1f5f9', border: 0, borderRadius: 10, padding: 9, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <ArrowLeft size={18} color="#475569" strokeWidth={2} />
          </button>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18, color: '#1e293b', letterSpacing: '-0.02em' }}>
            Payment
          </div>
        </div>

        <div style={{ padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
          {/* LINE Pay card */}
          <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24, overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            {/* LINE Pay header */}
            <div style={{ background: '#00B900', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 13, color: '#00B900', letterSpacing: '-0.5px' }}>LINE</span>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.01em' }}>LINE Pay</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Secure payment</div>
              </div>
            </div>

            {/* Amount */}
            <div style={{ padding: '24px 24px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Total amount</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 48, color: '#1e293b', letterSpacing: '-0.04em' }}>
                NT${preset.price}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#64748b', marginTop: 4 }}>
                {preset.grams}g cat food · {station.name}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#f1f5f9', margin: '20px 24px' }} />

            {/* Order summary */}
            <div style={{ padding: '0 24px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Recipient', 'Stray Cat Feeder — NTUST'],
                ['Food portion', `${preset.grams}g`],
                ['Station', station.station_code],
                ['Session', `#${session.short_id}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                  <span style={{ color: '#94a3b8' }}>{k}</span>
                  <span style={{ color: '#334155', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* QR info — OLED is showing QR code */}
            <div style={{ margin: '16px 24px', background: '#f0fdf4', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <QrCode size={18} color="#16a34a" strokeWidth={2} />
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
                The feeder OLED is now showing a QR code for this payment session.
              </div>
            </div>

            {/* Pay button */}
            <div style={{ padding: '4px 24px 24px' }}>
              {phase === 'error' && (
                <div style={{ background: '#fee2e2', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontFamily: 'var(--font-sans)', fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
                  Payment failed — please try again.
                </div>
              )}
              <button
                onClick={handlePay}
                disabled={loading}
                style={{ width: '100%', padding: '16px 0', borderRadius: 16, background: loading ? '#86efac' : '#00B900', color: '#fff', border: 0, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 17, boxShadow: loading ? 'none' : '0 6px 20px rgba(0,185,0,0.3)', transition: 'all 0.15s' }}
              >
                {loading ? 'Processing…' : `Pay NT$${preset.price}`}
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

  // ── Select portion ──
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '14px 16px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: '#f1f5f9', border: 0, borderRadius: 10, padding: 9, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <ArrowLeft size={18} color="#475569" strokeWidth={2} />
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18, color: '#1e293b', letterSpacing: '-0.02em' }}>Feed a cat</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#94a3b8' }}>{station.name} · {station.station_code}</div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Presets */}
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 14 }}>Choose portion</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => setSelected(i)} style={{ padding: '16px 0', borderRadius: 16, cursor: 'pointer', border: selected === i ? '2px solid #f97316' : '2px solid #f1f5f9', background: selected === i ? '#fff7ed' : '#f8fafc', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                <div style={{ fontWeight: 900, fontSize: 24, color: selected === i ? '#ea580c' : '#1e293b', letterSpacing: '-0.02em' }}>{p.grams}g</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: selected === i ? '#f97316' : '#94a3b8', marginTop: 3 }}>NT${p.price}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Donor name */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>
            Your name <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown as Anonymous if left blank" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontFamily: 'var(--font-sans)', fontSize: 14, color: '#334155', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Summary + proceed */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '18px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>You&apos;re feeding</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: '#475569' }}>{preset.grams}g at {station.name}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 32, color: '#1e293b', letterSpacing: '-0.03em' }}>NT${preset.price}</div>
          </div>
          <button
            onClick={handleProceed}
            disabled={loading}
            style={{ width: '100%', padding: '16px 0', borderRadius: 16, background: loading ? '#fed7aa' : 'linear-gradient(90deg, #fb923c, #f97316)', color: '#fff', border: 0, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, boxShadow: loading ? 'none' : '0 8px 20px rgba(249,115,22,0.3)', transition: 'all 0.15s' }}
          >
            <PawPrint size={18} color="#fff" strokeWidth={2} />
            {loading ? 'Creating session…' : `Proceed to LINE Pay — NT$${preset.price}`}
          </button>
        </div>
      </div>
    </div>
  );
}
