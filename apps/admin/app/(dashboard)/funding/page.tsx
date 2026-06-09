import { fetchDonations, fetchStations } from '../../../lib/api';
import Topbar from '../../../components/Topbar';

export default async function FundingPage() {
  const [donations, stations] = await Promise.all([fetchDonations(), fetchStations()]);

  // Build a lookup map: station UUID → display name
  const stationMap = Object.fromEntries(
    stations.map((s) => [s.id, { name: s.name, code: s.station_code }])
  );

  // Use Taiwan timezone (UTC+8) for all "today" computations
  const TZ = 'Asia/Taipei';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

  // Backend stores UTC-naive datetimes — append 'Z' so JS parses them as UTC
  function donationTWDate(createdAt: string): string {
    const ts = new Date(createdAt.endsWith('Z') || createdAt.includes('+') ? createdAt : createdAt + 'Z');
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(ts);
  }

  const totalNtd   = donations.reduce((s, d) => s + d.amount_ntd, 0);
  const todayNtd   = donations.filter((d) => d.created_at && donationTWDate(d.created_at) === today).reduce((s, d) => s + d.amount_ntd, 0);
  const todayGrams = donations.filter((d) => d.created_at && donationTWDate(d.created_at) === today && d.grams).reduce((s, d) => s + (d.grams ?? 0), 0);
  const totalGrams    = donations.filter((d) => d.grams).reduce((s, d) => s + (d.grams ?? 0), 0);

  const recent = [...donations]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 50);

  const tiles = [
    { label: 'Total Raised',       value: `NT$${totalNtd.toLocaleString()}`,      note: 'All time' },
    { label: 'Today\'s Donations', value: `NT$${todayNtd.toLocaleString()}`,      note: new Date().toLocaleDateString('en-US', { timeZone: TZ, month: 'long', day: 'numeric' }) },
    { label: 'Today\'s Dispensed', value: `${todayGrams.toLocaleString()}g`,      note: `${(todayGrams / 1000).toFixed(2)} kg today` },
    { label: 'Total Dispensed',    value: `${(totalGrams / 1000).toFixed(2)} kg`, note: `${donations.filter((d) => d.dispensed).length} sessions` },
  ];

  return (
    <>
      <Topbar />
      <div style={{ padding: '28px 28px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate-900)', margin: 0, letterSpacing: '-0.02em' }}>
            Funding
          </h1>
          <p style={{ fontSize: 13, color: 'var(--slate-400)', margin: '4px 0 0' }}>
            Donation history, daily totals, and food dispensed
          </p>
        </div>

        {/* Summary tiles — 2×2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {tiles.map(({ label, value, note }, i) => (
            <div key={label} style={{
              background: '#fff',
              borderRadius: 16,
              padding: '20px 22px',
              border: '1px solid var(--slate-100)',
              borderTop: i < 2 ? '3px solid #f97316' : '3px solid #00B900',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.03em', marginBottom: 4 }}>
                {value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--slate-400)' }}>{note}</div>
            </div>
          ))}
        </div>

        {/* Transactions table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--slate-100)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--slate-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Donation History</span>
            <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>{donations.length} total</span>
          </div>
          {donations.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', fontSize: 14, color: 'var(--slate-400)' }}>
              No donations yet — backend may be offline.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--slate-50)' }}>
                    {['Date', 'Donor', 'Station', 'Amount', 'Food', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((d, i) => (
                    <tr key={d.id} style={{ borderTop: '1px solid var(--slate-50)', background: i % 2 === 0 ? '#fff' : 'var(--slate-50)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                        {d.created_at ? new Date(d.created_at.endsWith('Z') || d.created_at.includes('+') ? d.created_at : d.created_at + 'Z').toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--slate-800)' }}>
                        {d.donor_name ?? 'Anonymous'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--slate-600)' }}>
                        <div style={{ fontWeight: 600 }}>{stationMap[d.station_id]?.name ?? '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>
                          {stationMap[d.station_id]?.code ?? d.station_id}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#f97316' }}>
                        NT${Number(d.amount_ntd).toFixed(0)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--slate-600)', fontWeight: 500 }}>
                        {d.grams ? `${d.grams}g` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 700,
                          background: d.dispensed ? '#dcfce7' : '#f1f5f9',
                          color: d.dispensed ? '#16a34a' : '#64748b',
                        }}>
                          {d.dispensed ? 'Dispensed' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
