'use client';
import { useState } from 'react';
import { X, MapPin } from '@stray/ui';
import { postStation } from '../lib/api';

interface AddStationModalProps {
  open: boolean;
  token: string;
  onClose: () => void;
  onCreated?: () => void;
}

const TAIWAN_CITIES = ['Taipei', 'New Taipei', 'Taichung', 'Tainan', 'Kaohsiung', 'Hsinchu', 'Keelung', 'Taoyuan'];

export default function AddStationModal({ open, token, onClose, onCreated }: AddStationModalProps) {
  const [form, setForm] = useState({
    station_code: '',
    name: '',
    city: 'Taipei',
    district: '',
    lat: '',
    lng: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Latitude and longitude must be valid numbers.');
      setLoading(false);
      return;
    }
    if (lat < 21 || lat > 26 || lng < 119 || lng > 123) {
      setError('Coordinates must be within Taiwan (lat 21-26, lng 119-123).');
      setLoading(false);
      return;
    }

    const result = await postStation({
      station_code: form.station_code,
      name: form.name,
      city: form.city,
      district: form.district,
      lat,
      lng,
    }, token);

    if (!result) {
      setError('Failed to create station — check backend connection.');
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => {
      setSuccess(false);
      setForm({ station_code: '', name: '', city: 'Taipei', district: '', lat: '', lng: '' });
      onCreated?.();
      onClose();
    }, 1200);
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.45)',
          zIndex: 200,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#fff',
        borderRadius: 20,
        width: '100%',
        maxWidth: 480,
        padding: '28px 28px 24px',
        zIndex: 201,
        boxShadow: '0 20px 60px rgba(15,23,42,0.18)',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--orange-50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MapPin size={17} color="var(--orange-500)" strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-900)' }}>Add Station</div>
              <div style={{ fontSize: 12, color: 'var(--slate-400)' }}>Register a new feeder node</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1.5px solid var(--slate-200)',
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={15} color="var(--slate-500)" strokeWidth={2} />
          </button>
        </div>

        {success ? (
          <div style={{
            textAlign: 'center',
            padding: '32px 0',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>Station created!</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Station Code" required>
                <input
                  value={form.station_code}
                  onChange={(e) => update('station_code', e.target.value)}
                  placeholder="CAT-099"
                  required
                  style={inputStyle}
                />
              </Field>
              <Field label="Display Name" required>
                <input
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Da'an Park Station"
                  required
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="City" required>
                <select
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  style={inputStyle}
                >
                  {TAIWAN_CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="District">
                <input
                  value={form.district}
                  onChange={(e) => update('district', e.target.value)}
                  placeholder="Da'an"
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Latitude" required>
                <input
                  value={form.lat}
                  onChange={(e) => update('lat', e.target.value)}
                  placeholder="25.0330"
                  required
                  style={inputStyle}
                />
              </Field>
              <Field label="Longitude" required>
                <input
                  value={form.lng}
                  onChange={(e) => update('lng', e.target.value)}
                  placeholder="121.5654"
                  required
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{
              background: 'var(--slate-50)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 12,
              color: 'var(--slate-500)',
            }}>
              💡 Taiwan coordinates: lat 21–25.4°N, lng 119.9–122.1°E
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  border: '1.5px solid var(--slate-200)',
                  background: '#fff',
                  color: 'var(--slate-600)',
                  fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  border: 'none',
                  background: loading ? 'var(--slate-300)' : 'var(--orange-500)',
                  color: '#fff',
                  fontSize: 14, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {loading ? 'Creating…' : 'Create Station'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1.5px solid var(--slate-200)',
  fontSize: 13,
  color: 'var(--slate-900)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
