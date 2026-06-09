'use client';
import { useState, useEffect, useRef } from 'react';
import { X, Check, Zap } from '@stray/ui';
import { PawPrint } from '@stray/ui';
import { createPaymentSession, confirmPayment, fetchPaymentSession } from '../lib/api';
import type { Station, PaymentSession } from '@stray/ui';

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS = [
  { grams: 50,  price: 30 },
  { grams: 100, price: 50 },
  { grams: 150, price: 75 },
  { grams: 200, price: 90 },
];

// ── QR code (real, using qrcode package) ──────────────────────────────────────

function RealQRCode({ value, size = 190 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!value) return;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(value, { width: size, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
        .then(setSrc)
        .catch(() => setSrc(''));
    });
  }, [value, size]);

  if (!src) {
    return (
      <div style={{ width: size, height: size, background: '#f8fafc', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid #e2e8f0',
          borderTopColor: '#94a3b8', borderRadius: '50%',
          animation: 'stray-spin 0.75s linear infinite' }} />
      </div>
    );
  }

  return <img src={src} width={size} height={size} alt="Payment QR" style={{ display: 'block', borderRadius: 8 }} />;
}

// ── Apple logo SVG ────────────────────────────────────────────────────────────
// Inline SVG so it renders identically on every platform.

function AppleIcon({ size = 34, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block' }}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

// ── Phase type ────────────────────────────────────────────────────────────────

type Phase = 'select' | 'payment' | 'apple-pay' | 'confirmed' | 'dispensing' | 'done';

// ── Component ─────────────────────────────────────────────────────────────────

interface FeedSheetProps {
  station: Station | null;
  onClose: () => void;
  onDonated?: () => void;
}

export function FeedSheet({ station, onClose, onDonated }: FeedSheetProps) {
  const [selected, setSelected]   = useState(1);
  const [name, setName]           = useState('');
  const [phase, setPhase]         = useState<Phase>('select');
  const [fillPct, setFillPct]     = useState(0);
  const [session, setSession]     = useState<PaymentSession | null>(null);
  const [timeLeft, setTimeLeft]   = useState(300);  // 5 min countdown
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);
  const isOpen = !!station;

  const preset  = PRESETS[selected];
  const isDark  = phase === 'apple-pay' || phase === 'confirmed';
  const presetPrice = preset.price;
  const presetGrams = preset.grams;

  // Reset when sheet opens
  useEffect(() => {
    if (isOpen) { setSelected(1); setName(''); setPhase('select'); setFillPct(0); setSession(null); }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [isOpen, onClose]);

  // Auto-advance through animation phases
  useEffect(() => {
    if (phase === 'apple-pay') {
      const t = setTimeout(() => setPhase('confirmed'), 1300);
      return () => clearTimeout(t);
    }
    if (phase === 'confirmed') {
      const t = setTimeout(() => setPhase('dispensing'), 900);
      return () => clearTimeout(t);
    }
    if (phase === 'dispensing') {
      // Send dispense command NOW — servo starts in sync with animation
      if (session && session.id !== 'dummy') {
        confirmPayment(session.id);
      }
      const t1 = setTimeout(() => setFillPct(100), 60);
      const t2 = setTimeout(() => { setPhase('done'); onDonated?.(); }, 2900);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [phase, session]);

  // Poll for external payment confirmation (user paid via the /payment/[id] page)
  useEffect(() => {
    if (phase !== 'payment' || !session || session.id === 'dummy') return;
    const id = session.id;
    const interval = setInterval(async () => {
      const updated = await fetchPaymentSession(id);
      if (updated?.status === 'paid') {
        clearInterval(interval);
        setPhase('dispensing');
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [phase, session]);

  // Start countdown when entering payment phase; auto-regenerate on expiry
  useEffect(() => {
    if (phase === 'payment') {
      setTimeLeft(300);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            // Regenerate a fresh payment session silently
            if (station) {
              createPaymentSession(station.id, presetPrice, presetGrams, name.trim() || undefined)
                .then((s) => { if (s) { setSession(s); setTimeLeft(300); } });
            }
            return 300; // reset display immediately so it doesn't flicker to 0
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, station, presetPrice, presetGrams, name]);

  async function handleProceedToPayment() {
    if (!station) return;
    // Create payment session — fires MQTT show_qr to ESP32
    const s = await createPaymentSession(station.id, preset.price, preset.grams, name.trim() || undefined);
    setSession(s);
    setPhase('payment');
  }

  function handleApplePay() {
    if (!station) return;
    setPhase('apple-pay');
    // confirmPayment is deferred to 'dispensing' phase so servo starts in sync with animation
  }

  // ── Per-phase body ────────────────────────────────────────────────────────

  function renderBody() {
    // Select grams
    if (phase === 'select') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'stray-fade-in 0.2s ease' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 12 }}>
            Choose portion
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => setSelected(i)} style={{
                padding: '16px 0', borderRadius: 16, cursor: 'pointer',
                border: selected === i ? '2px solid #f97316' : '2px solid #e2e8f0',
                background: selected === i ? '#fff7ed' : '#f8fafc',
                fontFamily: 'var(--font-sans)', transition: 'all 0.12s',
              }}>
                <div style={{ fontWeight: 900, fontSize: 24, color: selected === i ? '#ea580c' : '#1e293b', letterSpacing: '-0.02em' }}>
                  {p.grams}g
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: selected === i ? '#f97316' : '#94a3b8', marginTop: 3 }}>
                  NT${p.price}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 8 }}>
            Your name <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shown as Anonymous if left blank"
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 12,
              border: '1.5px solid #e2e8f0', background: '#f8fafc',
              fontFamily: 'var(--font-sans)', fontSize: 14, color: '#334155',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <button onClick={handleProceedToPayment} style={{
          width: '100%', padding: '15px 0', borderRadius: 14, border: 0,
          background: 'linear-gradient(90deg, #fb923c, #f97316)',
          color: '#fff', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16,
          display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8,
          boxShadow: '0 6px 18px rgba(249,115,22,0.28)',
        }}>
          <PawPrint size={17} color="#fff" strokeWidth={2} />
          Continue — NT${preset.price}
        </button>
      </div>
    );

    // QR + Apple Pay
    if (phase === 'payment') return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'stray-fade-in 0.2s ease' }}>
        <button onClick={() => setPhase('select')} style={{
          alignSelf: 'flex-start', background: 'none', border: 0, cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontSize: 13, color: '#94a3b8',
          padding: '0 0 14px', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          &larr; change portion
        </button>

        <div style={{
          background: '#fff', borderRadius: 20, padding: 20,
          boxShadow: '0 4px 32px rgba(15,23,42,0.10)',
          border: '1px solid #f1f5f9',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          width: '100%',
        }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#94a3b8' }}>
            Scan to pay
          </div>

          <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,42,0.08)', position: 'relative' }}>
            {station && (() => {
              const qrValue = session ? `https://stray.heretichydra.xyz/payment/${session.short_id}` : `stray:${station.id}:${preset.price}`;
              const payUrl  = session ? `https://stray.heretichydra.xyz/payment/${session.short_id}` : null;
              return payUrl ? (
                <a href={payUrl} target="_blank" rel="noopener noreferrer" title="Tap to open payment page"
                  style={{ display: 'block', cursor: 'pointer', position: 'relative' }}>
                  <RealQRCode value={qrValue} size={190} />
                  <div style={{
                    position: 'absolute', bottom: 6, left: 0, right: 0,
                    textAlign: 'center',
                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700,
                    color: 'rgba(15,23,42,0.5)', letterSpacing: '0.05em',
                    pointerEvents: 'none',
                  }}>TAP TO OPEN</div>
                </a>
              ) : (
                <RealQRCode value={qrValue} size={190} />
              );
            })()}
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 28, color: '#0f172a', letterSpacing: '-0.03em' }}>
              NT${preset.price}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {preset.grams}g · {station?.name}
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: timeLeft < 60 ? '#f97316' : '#cbd5e1', letterSpacing: '0.08em' }}>
            CODE EXPIRES IN {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#cbd5e1', fontWeight: 600 }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
        </div>

        <button onClick={handleApplePay} style={{
          width: '100%', padding: '15px 0', borderRadius: 14, border: 0,
          background: '#000', color: '#fff', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 17,
          display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8,
          letterSpacing: '-0.01em',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <AppleIcon size={22} color="#fff" />
          Pay
        </button>
      </div>
    );

    // Apple Pay — authenticating
    if (phase === 'apple-pay') return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 0 20px', gap: 22, animation: 'stray-fade-in 0.2s ease',
      }}>
        {/* Apple logo tile */}
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          background: '#1c1c1e',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
        }}>
          <AppleIcon size={38} color="#fff" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, color: '#fff', marginBottom: 6 }}>
            Apple Pay
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            Confirming NT${preset.price}&hellip;
          </div>
        </div>

        {/* Spinner — white on dark background */}
        <div style={{
          width: 32, height: 32,
          border: '2.5px solid rgba(255,255,255,0.18)',
          borderTopColor: 'rgba(255,255,255,0.9)',
          borderRadius: '50%',
          animation: 'stray-spin 0.75s linear infinite',
        }} />
      </div>
    );

    // Confirmed — checkmark pops in as the whole circle
    if (phase === 'confirmed') return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 0 20px', gap: 22, animation: 'stray-fade-in 0.15s ease',
      }}>
        {/* Outer circle animates in as a unit — no off-centre drift */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: '#1c1c1e',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'grid', placeItems: 'center',
          animation: 'stray-scale-in 0.38s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <Check size={36} color="#fff" strokeWidth={2.5} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, color: '#fff', marginBottom: 4 }}>
            Payment approved
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 30, color: '#fff', letterSpacing: '-0.03em' }}>
            NT${preset.price}
          </div>
        </div>
      </div>
    );

    // Dispensing animation
    if (phase === 'dispensing') return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '28px 0 12px', gap: 18, animation: 'stray-fade-in 0.2s ease',
      }}>
        {/* Bowl + falling kibble */}
        <div style={{ position: 'relative', width: 90, height: 88 }}>
          <div style={{
            position: 'absolute', bottom: 0, left: '50%',
            transform: 'translateX(-50%)',
            width: 72, height: 32,
            background: 'linear-gradient(180deg, #fde68a, #fbbf24)',
            borderRadius: '0 0 36px 36px',
            border: '2px solid #f59e0b',
          }}>
            <div style={{
              position: 'absolute', bottom: 0, left: 4, right: 4,
              height: '55%',
              background: 'linear-gradient(180deg, #fb923c, #f97316)',
              borderRadius: '0 0 32px 32px',
            }} />
          </div>

          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{
              position: 'absolute',
              top: 4,
              left: `${22 + i * 14}px`,
              width: 9, height: 9,
              borderRadius: '50%',
              background: i % 2 === 0 ? '#f97316' : '#fb923c',
              animation: `stray-kibble 0.65s ease-in ${i * 0.17}s infinite`,
            }} />
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 20, color: '#1e293b', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Dispensing {preset.grams}g
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#94a3b8' }}>
            {station?.name}
          </div>
        </div>

        <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${fillPct}%`,
            background: 'linear-gradient(90deg, #fb923c, #f97316)',
            borderRadius: 3,
            transition: 'width 2.75s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={13} color="#f97316" strokeWidth={2.5} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#f97316', fontWeight: 700 }}>
            Station active
          </span>
        </div>
      </div>
    );

    // Done
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '28px 0 12px', textAlign: 'center', animation: 'stray-fade-in 0.25s ease',
      }}>
        <div style={{
          width: 76, height: 76, borderRadius: '50%',
          background: '#dcfce7',
          display: 'grid', placeItems: 'center',
          marginBottom: 20,
          boxShadow: '0 0 36px rgba(34,197,94,0.28)',
          animation: 'stray-scale-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <Check size={34} color="#16a34a" strokeWidth={2.5} />
        </div>

        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 24, color: '#1e293b', letterSpacing: '-0.02em', marginBottom: 6 }}>
          Fed!
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#64748b', marginBottom: 6 }}>
          {preset.grams}g dispensed at <strong>{station?.name}</strong>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94a3b8', marginBottom: 28 }}>
          Check the live camera — a cat should appear soon
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: 0,
          background: 'linear-gradient(90deg, #fb923c, #f97316)',
          color: '#fff', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
          boxShadow: '0 6px 16px rgba(249,115,22,0.28)',
        }}>
          Done
        </button>
      </div>
    );
  }

  const TITLES: Record<Phase, string> = {
    'select':     'Feed a cat',
    'payment':    'Choose payment',
    'apple-pay':  '',
    'confirmed':  '',
    'dispensing': 'Dispensing',
    'done':       'All done',
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.45)',
        zIndex: 82,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 0.25s ease',
      }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: '50%',
        width: '100%', maxWidth: 390,
        background: isDark ? '#0f172a' : '#fff',
        borderRadius: '20px 20px 0 0',
        maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        zIndex: 83,
        transform: isOpen
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease',
        boxShadow: '0 -4px 32px rgba(15,23,42,0.14)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
            transition: 'background 0.3s ease',
          }} />
        </div>

        {/* Header — hidden during Apple Pay animation */}
        {!isDark && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 20px 14px',
            borderBottom: '1px solid #f1f5f9',
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 2 }}>
                {TITLES[phase]}
              </div>
              {station && (
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94a3b8' }}>
                  {station.name} · {station.station_code}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: 8,
              border: '1.5px solid #f1f5f9', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}>
              <X size={14} color="#94a3b8" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 36px' }}>
          {renderBody()}
        </div>
      </div>
    </>
  );
}
