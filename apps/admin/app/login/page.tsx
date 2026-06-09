'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { postLogin } from '../../lib/api';
import { Activity } from '@stray/ui';

// ── Dummy credentials for offline / dev use ──────────────────────────────────
const DUMMY_EMAIL    = 'admin@stray.tw';
const DUMMY_PASSWORD = 'stray2026';

async function setCookie(token: string) {
  await fetch('/api/auth/set-cookie', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState(DUMMY_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await postLogin(email, password);
      if (!data) {
        setError('Invalid credentials — or backend is offline');
        setLoading(false);
        return;
      }
      await setCookie(data.access_token);
      router.push('/');
    } catch {
      setError('Login failed — check your connection.');
      setLoading(false);
    }
  }

  function fillDummy() {
    setEmail(DUMMY_EMAIL);
    setPassword(DUMMY_PASSWORD);
    setError('');
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 24,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 8px 40px rgba(15,23,42,0.10)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'var(--orange-500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={22} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--slate-900)', letterSpacing: '-0.03em' }}>
            Stray <span style={{ color: 'var(--orange-500)' }}>Admin</span>
          </span>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--slate-900)', marginBottom: 6, letterSpacing: '-0.02em' }}>
          Sign in
        </h1>
        <p style={{ fontSize: 14, color: 'var(--slate-400)', marginBottom: 32 }}>
          Authorised admin access only
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-700)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@stray.tw"
              style={{
                padding: '11px 14px', borderRadius: 10,
                border: '1.5px solid var(--slate-200)',
                fontSize: 14, outline: 'none',
                fontFamily: 'var(--font-sans)', color: 'var(--slate-900)',
                background: '#fff',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-700)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                padding: '11px 14px', borderRadius: 10,
                border: '1.5px solid var(--slate-200)',
                fontSize: 14, outline: 'none',
                fontFamily: 'var(--font-sans)', color: 'var(--slate-900)',
                background: '#fff',
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>
          )}

          {/* Dev credentials hint */}
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 3, letterSpacing: '0.03em' }}>
                DEMO CREDENTIALS
              </div>
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
                Email: <strong>admin@stray.tw</strong><br />
                Password: <strong>stray2026</strong>
              </div>
            </div>
            <button
              type="button"
              onClick={fillDummy}
              style={{
                flexShrink: 0,
                padding: '5px 10px',
                borderRadius: 7,
                border: '1px solid #f59e0b',
                background: '#fef3c7',
                color: '#92400e',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Fill in
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? 'var(--slate-300)' : 'var(--orange-500)',
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '13px 0', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)', marginTop: 6,
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
