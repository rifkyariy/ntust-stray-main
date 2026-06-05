'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Video, Wifi, WifiOff, RefreshCw, Play, Trash2, Cat, Dog, HelpCircle, ScanLine,
} from '@stray/ui';

/* ── Types ─────────────────────────────────────────────────────────────────── */

type StreamSource = 'demo' | 'espcam';
type AnimalType   = 'cat' | 'dog' | 'other';

interface BBox { x: number; y: number; w: number; h: number }

interface Detection {
  id: string;
  timestamp: Date;
  animal: AnimalType;
  confidence: number;
  bbox: BBox;
  inference_ms?: number;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

const ANIMAL_COLORS: Record<string, string> = {
  cat:   'var(--orange-500)',
  dog:   '#3b82f6',
  other: 'var(--slate-400)',
};

const ANIMAL_ICONS: Record<string, React.ReactNode> = {
  cat:   <Cat   size={14} />,
  dog:   <Dog   size={14} />,
  other: <HelpCircle size={14} />,
};

const ANIMAL_BG: Record<string, string> = {
  cat:   'var(--orange-50)',
  dog:   '#eff6ff',
  other: 'var(--slate-100)',
};

/* ── Detection row ──────────────────────────────────────────────────────────── */

function EventRow({ d }: { d: Detection }) {
  const pct = Math.round(d.confidence * 100);
  const color = ANIMAL_COLORS[d.animal];
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px',
        borderBottom: '1px solid var(--slate-100)',
        animation: 'fadeSlideIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: ANIMAL_BG[d.animal], color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {ANIMAL_ICONS[d.animal]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-800)', textTransform: 'capitalize' }}>
            {d.animal}
            {d.inference_ms != null && (
              <span style={{ fontSize: 10, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
                {d.inference_ms.toFixed(0)}ms
              </span>
            )}
          </span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--slate-400)' }}>
            {d.timestamp.toTimeString().slice(0, 8)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{ flex: 1, height: 4, background: 'var(--slate-100)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 85 ? 'var(--orange-500)' : pct >= 70 ? '#f59e0b' : 'var(--slate-300)', borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--slate-600)', minWidth: 30 }}>
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */

interface StreamClientProps {
  detectorUrl: string;
}

export default function StreamClient({ detectorUrl }: StreamClientProps) {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const captureCanvas   = useRef<HTMLCanvasElement>(null);
  const [source, setSource]           = useState<StreamSource>('demo');
  const [streamUrl, setStreamUrl]     = useState('http://192.168.1.100/stream');
  const [conf, setConf]               = useState(0.45);
  const [imgError, setImgError]       = useState(false);
  const [detectorOnline, setDetectorOnline] = useState<boolean | null>(null);
  const [detections, setDetections]   = useState<Detection[]>([]);
  const [activeBoxes, setActiveBoxes] = useState<Detection[]>([]);
  const [inferMs, setInferMs]         = useState<number | null>(null);

  /* ── Probe detector health once on mount ── */
  useEffect(() => {
    fetch(`${detectorUrl}/health`)
      .then(r => setDetectorOnline(r.ok))
      .catch(() => setDetectorOnline(false));
  }, [detectorUrl]);

  /* ── Frame capture + inference loop ── */
  const captureAndDetect = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = captureCanvas.current;
    if (!video || !canvas) return;
    if (video.readyState < 2) return;

    const w = video.videoWidth  || 640;
    const h = video.videoHeight || 480;
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(async blob => {
      if (!blob) return;
      const form = new FormData();
      form.append('file', blob, 'frame.jpg');
      try {
        const res = await fetch(
          `${detectorUrl}/detect?conf=${conf}`,
          { method: 'POST', body: form },
        );
        if (!res.ok) return;
        const data: { detections: Array<{ animal: string; confidence: number; bbox: BBox; class_id: number; class_name: string }>; inference_ms: number } = await res.json();

        setInferMs(data.inference_ms);
        setDetectorOnline(true);

        if (data.detections.length === 0) {
          setActiveBoxes([]);
          return;
        }

        const mapped: Detection[] = data.detections.map(d => ({
          id: Math.random().toString(36).slice(2),
          timestamp: new Date(),
          animal: d.animal as AnimalType,
          confidence: d.confidence,
          bbox: d.bbox,
          inference_ms: data.inference_ms,
        }));

        setActiveBoxes(mapped);
        setDetections(prev => [...mapped, ...prev].slice(0, 150));

        // clear boxes after 1.5 s (next frame arrives by then)
        setTimeout(() => setActiveBoxes([]), 1400);
      } catch {
        setDetectorOnline(false);
      }
    }, 'image/jpeg', 0.85);
  }, [detectorUrl, conf]);

  useEffect(() => {
    if (source !== 'demo') return;
    const id = setInterval(captureAndDetect, 500);
    return () => clearInterval(id);
  }, [source, captureAndDetect]);

  /* ── Auto-play demo video ── */
  useEffect(() => {
    if (source !== 'demo') return;
    videoRef.current?.play().catch(() => {});
  }, [source]);

  const catCount   = detections.filter(d => d.animal === 'cat').length;
  const dogCount   = detections.filter(d => d.animal === 'dog').length;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, height: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.02em', margin: 0 }}>
            Live Stream
          </h1>
          <p style={{ fontSize: 13, color: 'var(--slate-400)', marginTop: 4 }}>
            YOLOv8 real-time detection · {detections.length} events this session
          </p>
        </div>

        {/* Detector status pill */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 20,
            background: detectorOnline === true ? 'var(--orange-50)' : detectorOnline === false ? '#fef2f2' : 'var(--slate-100)',
            border: `1.5px solid ${detectorOnline === true ? 'var(--orange-200)' : detectorOnline === false ? '#fecaca' : 'var(--slate-200)'}`,
          }}
        >
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: detectorOnline === true ? 'var(--orange-500)' : detectorOnline === false ? '#ef4444' : 'var(--slate-400)',
            animation: detectorOnline === true ? 'stray-pulse 1.4s infinite' : 'none',
          }} />
          <span style={{
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
            color: detectorOnline === true ? 'var(--orange-600)' : detectorOnline === false ? '#dc2626' : 'var(--slate-500)',
          }}>
            {detectorOnline === null ? 'CONNECTING' : detectorOnline ? 'DETECTOR ONLINE' : 'DETECTOR OFFLINE'}
          </span>
          {inferMs != null && detectorOnline && (
            <span style={{ fontSize: 10, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>
              {inferMs.toFixed(0)}ms
            </span>
          )}
        </div>
      </div>

      {/* Main layout: player + panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ── Video player ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              position: 'relative', background: '#0d1117',
              borderRadius: 16, overflow: 'hidden',
              flex: 1, minHeight: 300,
              border: '1.5px solid var(--slate-200)',
            }}
          >
            {/* Demo video */}
            {source === 'demo' && (
              <video
                ref={videoRef}
                src="/video/dummy.mp4"
                loop muted playsInline autoPlay
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}

            {/* ESP-Cam MJPEG */}
            {source === 'espcam' && !imgError && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={streamUrl}
                alt="ESP-Cam"
                onError={() => setImgError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
            {source === 'espcam' && imgError && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--slate-400)' }}>
                <WifiOff size={36} strokeWidth={1.5} />
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>Stream unavailable</span>
                <button onClick={() => setImgError(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1.5px solid var(--slate-600)', background: 'transparent', color: 'var(--slate-300)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            )}

            {/* Real bounding boxes from YOLOv8 */}
            {activeBoxes.map(d => (
              <div
                key={d.id}
                style={{
                  position: 'absolute',
                  left:   `${d.bbox.x * 100}%`,
                  top:    `${d.bbox.y * 100}%`,
                  width:  `${d.bbox.w * 100}%`,
                  height: `${d.bbox.h * 100}%`,
                  border: `2px solid ${ANIMAL_COLORS[d.animal]}`,
                  borderRadius: 3,
                  pointerEvents: 'none',
                  boxShadow: `0 0 8px ${ANIMAL_COLORS[d.animal]}55`,
                  animation: 'fadeSlideIn 0.15s ease-out',
                }}
              >
                <span style={{
                  position: 'absolute', top: -20, left: 0,
                  background: ANIMAL_COLORS[d.animal],
                  color: '#fff', fontSize: 10, fontFamily: 'var(--font-mono)',
                  fontWeight: 700, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                }}>
                  {d.animal === 'cat' ? '🐈 ' : d.animal === 'dog' ? '🐕 ' : ''}
                  {d.animal} {Math.round(d.confidence * 100)}%
                </span>
              </div>
            ))}

            {/* Offline fallback notice */}
            {detectorOnline === false && source === 'demo' && (
              <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(239,68,68,0.85)', backdropFilter: 'blur(4px)',
                borderRadius: 8, padding: '5px 12px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <WifiOff size={11} color="#fff" />
                <span style={{ fontSize: 11, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                  Detector offline — start the detector service
                </span>
              </div>
            )}

            {/* Counter badge */}
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: '4px 10px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Wifi size={11} color="var(--orange-400)" />
              <span style={{ fontSize: 11, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                {detections.length} detections
              </span>
            </div>

            {/* Demo label */}
            {source === 'demo' && (
              <button
                onClick={() => videoRef.current?.play()}
                style={{
                  position: 'absolute', bottom: 10, left: 10,
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 7, padding: '4px 10px', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'var(--font-mono)',
                }}
              >
                <Play size={10} /> dummy.mp4
              </button>
            )}
          </div>

          {/* Source + conf bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', border: '1.5px solid var(--slate-200)', borderRadius: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', minWidth: 52 }}>Source</span>
            <div style={{ display: 'flex', gap: 2, background: 'var(--slate-100)', borderRadius: 8, padding: 3 }}>
              {(['demo', 'espcam'] as const).map(src => (
                <button
                  key={src}
                  onClick={() => { setSource(src); setImgError(false); }}
                  style={{
                    padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)',
                    background: source === src ? '#fff' : 'transparent',
                    color: source === src ? 'var(--orange-600)' : 'var(--slate-500)',
                    boxShadow: source === src ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {src === 'demo' ? 'Demo Video' : 'ESP-Cam'}
                </button>
              ))}
            </div>
            {source === 'espcam' && (
              <input
                type="text"
                value={streamUrl}
                onChange={e => setStreamUrl(e.target.value)}
                placeholder="http://192.168.x.x/stream"
                style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', border: '1.5px solid var(--slate-200)', borderRadius: 8, padding: '5px 10px', outline: 'none', color: 'var(--slate-700)', background: 'var(--slate-50)' }}
              />
            )}
            <span style={{ fontSize: 11, color: 'var(--slate-400)', marginLeft: 'auto', flexShrink: 0 }}>
              conf&nbsp;
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--orange-600)' }}>
                {Math.round(conf * 100)}%
              </span>
            </span>
            <input
              type="range"
              min={0.1} max={0.9} step={0.05}
              value={conf}
              onChange={e => setConf(parseFloat(e.target.value))}
              style={{ width: 80 }}
            />
          </div>
        </div>

        {/* ── Detection feed ── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: '1.5px solid var(--slate-200)', borderRadius: 16, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '12px 14px', borderBottom: '1.5px solid var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-800)' }}>Detection Feed</p>
              <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 2 }}>Real YOLOv8 results</p>
            </div>
            <button
              onClick={() => { setDetections([]); setActiveBoxes([]); }}
              title="Clear"
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'var(--slate-100)', color: 'var(--slate-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* Counters */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--slate-100)', flexShrink: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: 'var(--orange-50)', color: 'var(--orange-600)', fontSize: 12, fontWeight: 600 }}>
              <Cat size={12} /> {catCount}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 600 }}>
              <Dog size={12} /> {dogCount}
            </span>
          </div>

          {/* Events */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {detections.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--slate-300)', padding: 24 }}>
                <ScanLine size={32} strokeWidth={1.2} />
                <p style={{ fontSize: 13, color: 'var(--slate-400)', textAlign: 'center' }}>
                  {detectorOnline === false
                    ? 'Start the detector service to see real detections'
                    : 'Waiting for detections…'}
                </p>
              </div>
            ) : (
              detections.slice(0, 80).map(d => <EventRow key={d.id} d={d} />)
            )}
          </div>
        </div>
      </div>

      {/* Hidden canvas for frame capture */}
      <canvas ref={captureCanvas} style={{ display: 'none' }} />
    </div>
  );
}
