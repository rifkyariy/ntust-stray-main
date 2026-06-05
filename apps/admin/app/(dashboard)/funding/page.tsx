import { fetchDonations } from '../../../lib/api';
import Topbar from '../../../components/Topbar';

export default async function FundingPage() {
  const donations = await fetchDonations();

  const totalNtd = donations.reduce((sum, d) => sum + d.amount_ntd, 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayNtd = donations
    .filter((d) => d.created_at?.startsWith(today))
    .reduce((sum, d) => sum + d.amount_ntd, 0);

  const recent = [...donations]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 50);

  return (
    <>
      <Topbar />
      <div style={{ padding: '28px 28px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate-900)', margin: 0, letterSpacing: '-0.02em' }}>
            Funding
          </h1>
          <p style={{ fontSize: 13, color: 'var(--slate-400)', margin: '4px 0 0' }}>
            Donation history and totals
          </p>
        </div>

        {/* Summary tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { label: 'Total Raised', value: `NT$${totalNtd.toLocaleString()}`, note: 'All time' },
            { label: 'Today', value: `NT$${todayNtd.toLocaleString()}`, note: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) },
            { label: 'Donations', value: donations.length.toString(), note: 'Total transactions' },
          ].map(({ label, value, note }) => (
            <div key={label} style={{
              background: '#fff',
              borderRadius: 16,
              padding: '20px 22px',
              border: '1px solid var(--slate-100)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-500)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.03em', marginBottom: 4 }}>
                {value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--slate-400)' }}>{note}</div>
            </div>
          ))}
        </div>

        {/* Transactions table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--slate-100)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--slate-100)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)' }}>Recent Donations</span>
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
                    {['Date', 'Donor', 'Station', 'Amount'].map((h) => (
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
                        {d.created_at ? new Date(d.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--slate-800)' }}>
                        {d.donor_name ?? 'Anonymous'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--slate-500)' }}>
                        {d.station_id}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>
                        NT${d.amount_ntd}
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
