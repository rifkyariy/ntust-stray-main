import type { LucideIcon } from 'lucide-react';
import { QrCode, PawPrint, Calendar } from '@stray/ui';

interface Step {
  icon: LucideIcon;
  step: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: QrCode,
    step: 'Step 1',
    title: 'Scan the station',
    body: 'Find a Stray station in Taipei. Scan the QR code with your phone — no app download needed, works in any browser.',
  },
  {
    icon: PawPrint,
    step: 'Step 2',
    title: 'Dispense now or schedule',
    body: 'Choose an immediate meal (50–200g) or schedule one for later in the day. NT$15 feeds one cat — or donate more to queue multiple meals.',
  },
  {
    icon: Calendar,
    step: 'Step 3',
    title: 'Pay and watch',
    body: 'Pay via LINE Pay, Apple Pay, or credit card. Watch the dispenser drop food on the live camera feed and see the cat come to eat in real time.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" style={{ background: '#fff', padding: '100px 0' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 40px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 68 }}>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 800,
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#f97316',
              marginBottom: 14,
            }}
          >
            How it works
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 48,
              color: '#1e293b',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Three steps.
            <br />
            <span style={{ color: '#f97316' }}>One happy cat.</span>
          </h2>
        </div>

        {/* Steps grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 28,
          }}
        >
          {STEPS.map(({ icon: Icon, step, title, body }, i) => (
            <div
              key={i}
              style={{
                background: '#FDFBF7',
                borderRadius: 24,
                padding: 32,
                border: '1px solid #f1f5f9',
                position: 'relative',
              }}
            >
              {/* Icon circle */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: '#fff7ed',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: 24,
                  border: '1px solid #ffedd5',
                }}
              >
                <Icon size={26} color="#f97316" strokeWidth={2} />
              </div>

              {/* Step label */}
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 800,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#f97316',
                  marginBottom: 10,
                }}
              >
                {step}
              </div>

              <h3
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 700,
                  fontSize: 20,
                  color: '#1e293b',
                  marginBottom: 12,
                  margin: '0 0 12px',
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  color: '#475569',
                  fontSize: 15,
                  lineHeight: 1.65,
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                {body}
              </p>

              {/* Step number watermark */}
              <div
                style={{
                  position: 'absolute',
                  top: 24,
                  right: 24,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: 40,
                  color: '#f1f5f9',
                  lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                0{i + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
