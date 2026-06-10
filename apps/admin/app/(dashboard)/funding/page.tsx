import { fetchDonations, fetchStations } from '../../../lib/api';
import Topbar from '../../../components/Topbar';
import FundingClient from './FundingClient';

export default async function FundingPage() {
  const [donations, stations] = await Promise.all([fetchDonations(), fetchStations()]);

  const stationMap = Object.fromEntries(
    stations.map((s) => [s.id, { name: s.name, code: s.station_code }])
  );

  const TZ = 'Asia/Taipei';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

  function donationTWDate(createdAt: string): string {
    const ts = new Date(createdAt.endsWith('Z') || createdAt.includes('+') ? createdAt : createdAt + 'Z');
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(ts);
  }

  const totalNtd   = donations.reduce((s, d) => s + d.amount_ntd, 0);
  const todayNtd   = donations.filter((d) => d.created_at && donationTWDate(d.created_at) === today).reduce((s, d) => s + d.amount_ntd, 0);
  const todayGrams = donations.filter((d) => d.created_at && donationTWDate(d.created_at) === today && d.grams).reduce((s, d) => s + (d.grams ?? 0), 0);
  const totalGrams = donations.filter((d) => d.grams).reduce((s, d) => s + (d.grams ?? 0), 0);

  const tiles = [
    { label: 'Total Raised',       value: `NT$${totalNtd.toLocaleString()}`,      note: 'All time' },
    { label: "Today's Donations",  value: `NT$${todayNtd.toLocaleString()}`,      note: new Date().toLocaleDateString('en-US', { timeZone: TZ, month: 'long', day: 'numeric' }) },
    { label: "Today's Dispensed",  value: `${todayGrams.toLocaleString()}g`,      note: `${(todayGrams / 1000).toFixed(2)} kg today` },
    { label: 'Total Dispensed',    value: `${(totalGrams / 1000).toFixed(2)} kg`, note: `${donations.filter((d) => d.dispensed).length} sessions` },
  ];

  return (
    <>
      <Topbar />
      <FundingClient donations={donations} stationMap={stationMap} tiles={tiles} />
    </>
  );
}
