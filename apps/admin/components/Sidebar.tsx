'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  LayoutDashboard,
  MapPin,
  Cat,
  Banknote,
  AlertTriangle,
  LogOut,
  Video,
} from '@stray/ui';

const NAV = [
  { href: '/',       icon: LayoutDashboard, label: 'Overview' },
  { href: '/stations', icon: MapPin,         label: 'Stations' },
  { href: '/cats',   icon: Cat,              label: 'Cats' },
  { href: '/funding', icon: Banknote,        label: 'Funding' },
  { href: '/alerts', icon: AlertTriangle,    label: 'Alerts' },
  { href: '/stream', icon: Video,            label: 'Stream' },
];

interface SidebarProps {
  alertCount?: number;
}

export default function Sidebar({ alertCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <aside style={{
      width: 240,
      minHeight: '100vh',
      background: 'var(--slate-900)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--orange-500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.03em' }}>
            stray <span style={{ color: 'var(--orange-500)' }}>admin</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 10,
                textDecoration: 'none',
                background: active ? 'rgba(249,115,22,0.15)' : 'transparent',
                color: active ? 'var(--orange-400)' : 'rgba(255,255,255,0.55)',
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                transition: 'background 0.15s, color 0.15s',
                position: 'relative',
              }}
            >
              <Icon size={17} strokeWidth={2} />
              <span style={{ flex: 1 }}>{label}</span>
              {label === 'Alerts' && alertCount > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 20,
                  padding: '1px 6px',
                  minWidth: 18,
                  textAlign: 'center',
                }}>
                  {alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* System status tile */}
      <div style={{
        margin: '0 12px 12px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: '12px 14px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          System
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>API</span>
            <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>● Online</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>MQTT</span>
            <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>● Connected</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>WS</span>
            <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>● Live</span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div style={{ padding: '0 12px' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
            fontFamily: 'var(--font-sans)',
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)';
            (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)';
          }}
        >
          <LogOut size={17} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
