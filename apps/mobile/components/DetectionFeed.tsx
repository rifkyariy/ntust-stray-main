'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PawPrint, Calendar, ArrowLeft } from '@stray/ui';
import type { Station, WSDetection } from '@stray/ui';

interface DetectionFeedProps {
  station: Station;
  latestDetection: WSDetection | null;
  onFeedClick?: () => void;
  onScheduleClick?: () => void;
}

export function DetectionFeed({ station, latestDetection, onFeedClick, onScheduleClick }: DetectionFeedProps) {
  const router = useRouter();
  const [glowing, setGlowing] = useState(false);

  useEffect(() => {
    if (!latestDetection) return;
    setGlowing(true);
    const t = setTimeout(() => setGlowing(false), 2500);
    return () => clearTimeout(t);
  }, [latestDetection]);

  return (
    <div style={{
      position: 'relative',
      height: 280,
      background: 'linear-gradient(160deg, #334155, #0f172a)',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Camera placeholder image */}
      {station.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={station.image_url}
          alt={`${station.name} live feed`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
        />
      ) : (
        /* Placeholder gradient when no image URL */
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', opacity: 0.3 }}>
            <PawPrint size={48} color="#fff" strokeWidth={1.5} />
            <div style={{ color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 12, marginTop: 8 }}>
              Camera connecting…
            </div>
          </div>
        </div>
      )}

      {/* AI detection bounding box */}
      {latestDetection && (
        <div style={{
          position: 'absolute',
          top: '28%', left: '20%',
          width: '50%', height: '54%',
          border: `2px solid ${glowing ? '#4ade80' : 'rgba(74,222,128,0.5)'}`,
          borderRadius: 8,
          background: 'rgba(74,222,128,0.07)',
          boxShadow: glowing ? '0 0 20px rgba(74,222,128,0.45)' : 'none',
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}>
          {/* Label chip */}
          <div style={{
            position: 'absolute',
            top: -23,
            left: -2,
            background: '#4ade80',
            color: '#0f172a',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 10,
            padding: '2px 7px',
            borderRadius: '4px 4px 4px 0',
            whiteSpace: 'nowrap',
          }}>
            cat {latestDetection.confidence.toFixed(2)} · {latestDetection.cat_code}
          </div>
        </div>
      )}

      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          position: 'absolute', top: 14, left: 14, zIndex: 5,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          padding: '8px',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <ArrowLeft size={18} color="#fff" strokeWidth={2} />
      </button>

      {/* LIVE badge */}
      <div style={{
        position: 'absolute', top: 14, right: 14,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)',
        padding: '4px 9px',
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontWeight: 900,
        fontSize: 10,
        letterSpacing: '0.15em',
        color: '#fff',
        fontFamily: 'var(--font-sans)',
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#ef4444',
          boxShadow: '0 0 8px rgba(239,68,68,0.9)',
          animation: 'stray-pulse 2s infinite',
        }} />
        LIVE
      </div>

      {/* Bottom overlay — station info + action buttons */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        padding: '72px 16px 16px',
        background: 'linear-gradient(0deg, rgba(15,23,42,0.95) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10,
              color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em', marginBottom: 3,
            }}>
              {station.station_code}
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 17, color: '#fff',
              letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {station.name}
            </div>
          </div>

          {/* Feed + Schedule buttons */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onFeedClick}
              style={{
                background: 'linear-gradient(90deg, #fb923c, #f97316)',
                color: '#fff',
                padding: '9px 14px',
                borderRadius: 12,
                border: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'var(--font-sans)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(249,115,22,0.4)',
                whiteSpace: 'nowrap',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <PawPrint size={14} color="#fff" strokeWidth={2} />
              Feed
            </button>
            <button
              onClick={onScheduleClick}
              style={{
                background: 'rgba(255,255,255,0.14)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                padding: '9px 14px',
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'var(--font-sans)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Calendar size={14} color="#fff" strokeWidth={2} />
              Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
