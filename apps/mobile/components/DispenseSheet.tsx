'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PawPrint, QrCode, ArrowLeft, Check } from '@stray/ui';
import { postDonation } from '../lib/api';
import type { Station } from '@stray/ui';

const PRESETS = [
  { grams: 50,  price: 8  },
  { grams: 100, price: 15 },
  { grams: 150, price: 22 },
  { grams: 200, price: 30 },
];

export function DispenseSheet({ station }: { station: Station }) {
  const router = useRouter();
  const [selected, setSelected] = useState(1); // default 100g / NT$15
  const [name, setName] = useState('');
  const [state, setState] = useState<'idle' | 'paying' | 'success' | 'error'>('idle');

  const preset = PRESETS[selected];

  async function handlePay() {
    setState('paying');
    const donation = await postDonation({
      station_id: station.id,
      amount_ntd: preset.price,
      donor_name: name.trim() || undefined,
      dispense: true,
    });
    setState(donation ? 'success' : 'error');
  }

  // ── Success state ──
  if (state === 'success') {
    return (
      <div style={{
        minHeight: '100vh', background: '#FDFBF7',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 24px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: '#dcfce7',
            display: 'grid', placeItems: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 0 40px rgba(34,197,94,0.35)',
          }}>
            <Check size={40} color="#16a34a" strokeWidth={2.5} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 28, color: '#1e293b', letterSpacing: '-0.03em', marginBottom: 10 }}>
            Dispensing now!
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', color: '#64748b', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
            {preset.grams}g of food is being dispensed at <strong>{station.name}</strong>. Watch the live feed — a cat should appear soon.
          </p>
          <button
            onClick={() => router.back()}
            style={{
              background: 'linear-gradient(90deg, #fb923c, #f97316)',
              color: '#fff', border: 0,
              padding: '14px 32px', borderRadius: 16,
              fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
              cursor: 'pointer', boxShadow: '0 6px 18px rgba(249,115,22,0.3)',
            }}
          >
            Back to station
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ──
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: '#fff',
        padding: '14px 16px 12px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: '#f1f5f9', border: 0, borderRadius: 10,
            padding: 9, cursor: 'pointer', display: 'grid', placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} color="#475569" strokeWidth={2} />
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18, color: '#1e293b', letterSpacing: '-0.02em' }}>
            Feed a cat
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#94a3b8' }}>
            {station.name} · {station.station_code}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Gram presets */}
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 14 }}>
            Choose portion
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                style={{
                  padding: '16px 0',
                  borderRadius: 16,
                  cursor: 'pointer',
                  border: selected === i ? '2px solid #f97316' : '2px solid #f1f5f9',
                  background: selected === i ? '#fff7ed' : '#f8fafc',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 24, color: selected === i ? '#ea580c' : '#1e293b', letterSpacing: '-0.02em' }}>
                  {p.grams}g
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: selected === i ? '#f97316' : '#94a3b8', marginTop: 3 }}>
                  NT${p.price}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Donor name */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>
            Your name <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shown as Anonymous if left blank"
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12,
              border: '1.5px solid #e2e8f0', background: '#f8fafc',
              fontFamily: 'var(--font-sans)', fontSize: 14, color: '#334155',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Summary + Pay */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '18px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>
                You&apos;re feeding
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: '#475569' }}>
                {preset.grams}g at {station.name}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 32, color: '#1e293b', letterSpacing: '-0.03em' }}>
              NT${preset.price}
            </div>
          </div>

          {state === 'error' && (
            <div style={{ background: '#fee2e2', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontFamily: 'var(--font-sans)', fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
              Payment failed — please try again.
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={state === 'paying'}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 16,
              background: state === 'paying'
                ? '#fed7aa'
                : 'linear-gradient(90deg, #fb923c, #f97316)',
              color: '#fff', border: 0,
              cursor: state === 'paying' ? 'wait' : 'pointer',
              fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16,
              display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8,
              boxShadow: state === 'paying' ? 'none' : '0 8px 20px rgba(249,115,22,0.3)',
              transition: 'all 0.15s',
            }}
          >
            <PawPrint size={18} color="#fff" strokeWidth={2} />
            {state === 'paying' ? 'Processing…' : `Feed now — NT$${preset.price}`}
          </button>

          <button
            style={{
              width: '100%', padding: '14px 0', borderRadius: 16,
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
              cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600,
              fontSize: 14, color: '#475569', marginTop: 10,
              display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            }}
          >
            <QrCode size={16} color="#475569" strokeWidth={2} />
            Generate QR Pay
          </button>
        </div>
      </div>
    </div>
  );
}
