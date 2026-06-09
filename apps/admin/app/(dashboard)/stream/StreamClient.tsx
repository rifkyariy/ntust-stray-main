'use client';
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import {
  Cat, Wifi, WifiOff, RefreshCw, Play, Pause, Trash2, ScanLine,
  ChevronDown, Layers, Box, Clock, BarChart2, RotateCcw,
} from '@stray/ui';

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface BBox { x: number; y: number; w: number; h: number }

interface Detection {
  id: string;
  videoTime: number;
  confidence: number;
  bbox: BBox;
  track_id: number | null;
  mask: number[][] | null;
}

interface CatSighting { videoTime: number; conf: number; }
interface VisitSegment { start: number; end: number; }

interface CatStats {
  trackId:    number;
  color:      string;
  sightings:  CatSighting[];
  visits:     VisitSegment[];
  visitCount: number;
  lastSeen:   number;
  avgConf:    number;
}

/* ── Tokens ─────────────────────────────────────────────────────────────────── */

const D = {
  bg:        '#0d1117',
  card:      '#161b22',
  cardHov:   '#1c2128',
  border:    '#30363d',
  text:      '#e6edf3',
  muted:     '#8b949e',
  orange:    '#f97316',
  orangeDim: 'rgba(249,115,22,0.12)',
  green:     '#22c55e',
  red:       '#ef4444',
  purple:    '#a855f7',
};

const PALETTE = [
  '#f97316','#3b82f6','#22c55e','#a855f7','#ec4899',
  '#14b8a6','#eab308','#ef4444','#06b6d4','#84cc16',
];
const tColor = (id: number | null) =>
  id == null ? D.muted : PALETTE[id % PALETTE.length];

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

const GAP_S = 3;

function computeVisits(times: number[]): VisitSegment[] {
  if (!times.length) return [];
  const s = [...times].sort((a, b) => a - b);
  const out: VisitSegment[] = [];
  let seg = { start: s[0], end: s[0] };
  for (let i = 1; i < s.length; i++) {
    if (s[i] - seg.end > GAP_S) { out.push(seg); seg = { start: s[i], end: s[i] }; }
    else seg.end = s[i];
  }
  out.push(seg);
  return out;
}

function fmtVT(s: number) {
  const abs = Math.abs(s);
  return `${Math.floor(abs / 60)}:${String(Math.floor(abs % 60)).padStart(2, '0')}`;
}

function modelLabel(p: string) { return p.replace(/.*\//, '').replace('.pt', ''); }

/* ── Sparkline ───────────────────────────────────────────────────────────────── */

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const pts = data.slice(-24);
  if (pts.length < 2) return <span style={{ color: D.muted, fontSize: 10, fontFamily: 'monospace' }}>—</span>;
  const W = 56; const H = 18;
  const path = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - v * (H - 3) - 1;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
      <circle cx={(W).toFixed(1)}
        cy={(H - pts[pts.length - 1] * (H - 3) - 1).toFixed(1)}
        r={2.5} fill={color} />
    </svg>
  );
}

/* ── Video scrubber ──────────────────────────────────────────────────────────── */

function Scrubber({
  currentTime, duration, onSeekStart, onSeek, onSeekEnd, paused, onTogglePlay, scanDone, onReplay,
}: {
  currentTime: number; duration: number;
  onSeekStart: () => void;
  onSeek: (t: number) => void;
  onSeekEnd: () => void;
  paused: boolean; onTogglePlay: () => void;
  scanDone: boolean; onReplay: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 12px', borderTop: `1px solid ${D.border}`,
    }}>
      {scanDone ? (
        <button onClick={onReplay} title="Replay from start" style={{
          width: 26, height: 26, borderRadius: 6,
          border: `1px solid ${D.border}`, background: D.orangeDim,
          color: D.orange, cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <RotateCcw size={11} />
        </button>
      ) : (
        <button onClick={onTogglePlay} style={{
          width: 26, height: 26, borderRadius: 6,
          border: `1px solid ${D.border}`, background: D.cardHov,
          color: D.text, cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {paused ? <Play size={11} /> : <Pause size={11} />}
        </button>
      )}

      <span style={{ fontSize: 10, fontFamily: 'monospace', color: D.muted, minWidth: 28, flexShrink: 0 }}>
        {fmtVT(currentTime)}
      </span>

      <input
        type="range" min={0} max={duration || 100} step={0.1}
        value={currentTime}
        onMouseDown={onSeekStart}
        onTouchStart={onSeekStart}
        onChange={e => onSeek(parseFloat(e.target.value))}
        onMouseUp={onSeekEnd}
        onTouchEnd={onSeekEnd}
        style={{ flex: 1, accentColor: D.orange, cursor: 'pointer', margin: 0 }}
      />

      <span style={{ fontSize: 10, fontFamily: 'monospace', color: D.muted, minWidth: 28, textAlign: 'right', flexShrink: 0 }}>
        {fmtVT(duration)}
      </span>

      {scanDone && (
        <span style={{
          fontSize: 9, fontFamily: 'monospace', color: D.green,
          background: `${D.green}18`, border: `1px solid ${D.green}40`,
          borderRadius: 10, padding: '2px 7px', flexShrink: 0,
        }}>
          {SCAN_PASSES} passes complete
        </span>
      )}
    </div>
  );
}

/* ── Presence timeline (Gantt) ───────────────────────────────────────────────── */

function PresenceTimeline({
  stats, duration, cursor,
}: {
  stats: CatStats[]; duration: number; cursor: number;
}) {
  const range = Math.max(duration, 1);
  const xp = (t: number) => `${Math.min(Math.max(t / range * 100, 0), 100).toFixed(2)}%`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      {stats.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 0', color: D.muted }}>
          <ScanLine size={15} strokeWidth={1.3} />
          <span style={{ fontSize: 11, fontFamily: 'monospace' }}>No cats yet — play the video to scan</span>
        </div>
      ) : (
        <>
          {/* Rows (scrollable if many cats) */}
          <div style={{ overflowY: 'auto', maxHeight: 176 }}>
            {stats.map(cat => (
              <div key={cat.trackId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 44, flexShrink: 0 }}>
                  <Cat size={10} color={cat.color} />
                  <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'monospace', color: cat.color }}>
                    #{cat.trackId}
                  </span>
                </div>
                {/* Track area */}
                <div style={{ flex: 1, height: 10, background: D.border, borderRadius: 5, position: 'relative' }}>
                  {cat.visits.map((v, j) => (
                    <div key={j} style={{
                      position: 'absolute', top: 0, height: '100%',
                      left: xp(v.start),
                      width: `${Math.max((v.end === v.start ? 0.5 : v.end - v.start) / range * 100, 0.4).toFixed(2)}%`,
                      background: cat.color, borderRadius: 3, opacity: 0.88,
                    }} />
                  ))}
                  {/* Cursor */}
                  <div style={{
                    position: 'absolute', top: -4, bottom: -4, width: 2,
                    left: xp(cursor), transform: 'translateX(-50%)',
                    background: D.orange, borderRadius: 1,
                    boxShadow: `0 0 5px ${D.orange}88`, zIndex: 2, pointerEvents: 'none',
                  }} />
                </div>
                <span style={{ fontSize: 9, color: D.muted, fontFamily: 'monospace', width: 28, textAlign: 'right', flexShrink: 0 }}>
                  {cat.visitCount}×
                </span>
              </div>
            ))}
          </div>

          {/* Time axis — must span the same horizontal range as the track area:
             left = id label (44) + gap (8); right = visit-count (28) + gap (8). */}
          <div style={{ position: 'relative', height: 14, marginLeft: 52, marginRight: 36, marginTop: 3 }}>
            {ticks.map(f => (
              <span key={f} style={{
                position: 'absolute', left: `${f * 100}%`, transform: 'translateX(-50%)',
                fontSize: 9, color: D.muted, fontFamily: 'monospace',
              }}>
                {fmtVT(f * duration)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Slider control ──────────────────────────────────────────────────────────── */

function DarkSlider({ label, value, min, max, step, onChange, fmt: fmtFn }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: D.muted, fontFamily: 'monospace', minWidth: 32, flexShrink: 0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: D.orange, cursor: 'pointer' }} />
      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: D.orange, minWidth: 36, textAlign: 'right', flexShrink: 0 }}>
        {fmtFn ? fmtFn(value) : value}
      </span>
    </div>
  );
}

/* ── Segmented control ───────────────────────────────────────────────────────── */

function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T;
  options: { value: T; label: string; sub?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: D.muted, fontFamily: 'monospace', minWidth: 32, flexShrink: 0 }}>{label}</span>
      <div style={{
        flex: 1, display: 'flex', gap: 2, padding: 2,
        background: D.cardHov, border: `1px solid ${D.border}`, borderRadius: 8,
      }}>
        {options.map(o => {
          const active = o.value === value;
          return (
            <button key={String(o.value)} onClick={() => onChange(o.value)} style={{
              flex: 1, border: 'none', cursor: 'pointer', borderRadius: 6,
              padding: '4px 0', lineHeight: 1.1,
              background: active ? D.orange : 'transparent',
              color: active ? '#fff' : D.muted,
              fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
              transition: 'background 0.12s',
            }}>
              {o.label}
              {o.sub && <div style={{ fontSize: 8, fontWeight: 500, opacity: 0.8 }}>{o.sub}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Toggle ──────────────────────────────────────────────────────────────────── */

function Toggle({ label, sub, value, onChange }: {
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div>
        <div style={{ fontSize: 11, color: D.text, fontFamily: 'monospace', fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 9, color: D.muted, fontFamily: 'monospace', marginTop: 1 }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: 38, height: 22, borderRadius: 11, flexShrink: 0,
        border: `1px solid ${value ? D.orange : D.border}`,
        background: value ? D.orange : D.cardHov,
        position: 'relative', cursor: 'pointer', transition: 'all 0.15s', padding: 0,
      }}>
        <span style={{
          position: 'absolute', top: 2, left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.15s',
        }} />
      </button>
    </div>
  );
}

/* ── Model picker ────────────────────────────────────────────────────────────── */

function ModelPicker({ current, models, switching, onSelect }: {
  current: string; models: string[]; switching: boolean; onSelect: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const detect = models.filter(m => !m.includes('-seg'));
  const seg    = models.filter(m =>  m.includes('-seg'));

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 11px', borderRadius: 8,
        background: D.cardHov, border: `1px solid ${D.border}`,
        color: switching ? D.muted : D.text,
        fontSize: 12, fontFamily: 'monospace', cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {current.includes('-seg') ? <Layers size={12} color={D.purple} /> : <Box size={12} color={D.muted} />}
          <span>{switching ? 'Loading…' : modelLabel(current)}</span>
        </div>
        <ChevronDown size={12} color={D.muted} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
          background: D.card, border: `1px solid ${D.border}`,
          borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.7)', overflow: 'hidden',
        }}>
          {([
            { label: 'DETECTION',    items: detect, Icon: Box,    activeColor: D.orange },
            { label: 'SEGMENTATION', items: seg,    Icon: Layers, activeColor: D.purple },
          ] as const).filter(g => g.items.length > 0).map(({ label, items, Icon, activeColor }, gi) => (
            <div key={label}>
              <div style={{
                padding: '6px 10px 3px', fontSize: 9, color: D.muted,
                fontFamily: 'monospace', letterSpacing: '0.1em',
                borderTop: gi > 0 ? `1px solid ${D.border}` : 'none',
              }}>{label}</div>
              {items.map(m => (
                <button key={m} onClick={() => { onSelect(m); setOpen(false); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: m === current ? `${activeColor}18` : 'transparent',
                  color: m === current ? activeColor : D.text,
                  fontSize: 12, fontFamily: 'monospace',
                }}>
                  <Icon size={11} color={m === current ? activeColor : D.muted} />
                  {modelLabel(m)}
                  {m === current && <span style={{ marginLeft: 'auto', fontSize: 9, color: D.muted }}>active</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Card wrapper ────────────────────────────────────────────────────────────── */

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: D.card, border: `1px solid ${D.border}`,
      borderRadius: 12, overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  );
}

function CardHeader({ title, icon, badge, action }: {
  title: string; icon: ReactNode; badge?: ReactNode; action?: ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 14px', borderBottom: `1px solid ${D.border}`, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 700, color: D.text }}>{title}</span>
        {badge}
      </div>
      {action}
    </div>
  );
}

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontFamily: 'monospace', padding: '1px 7px', borderRadius: 20,
      background: `${color}18`, border: `1px solid ${color}30`, color,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>{children}</span>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────────── */

const SCAN_PASSES = 3;

export default function StreamClient({ detectorUrl, embedded = false }: { detectorUrl: string; embedded?: boolean }) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const captureCanvas = useRef<HTMLCanvasElement>(null);
  /* prevent onTimeUpdate from fighting slider drag */
  const isSeekingRef        = useRef(false);
  /* prevent re-capturing the same video timestamp during a slow detection round-trip */
  const lastCapturedTimeRef = useRef(-1);
  /* only one detection request in flight at a time — inference can take 1–4s on CPU */
  const inFlightRef         = useRef(false);
  /* closure-safe pass counter + history (avoid stale closure in onEnded) */
  const passCountRef        = useRef(0);
  const detectionHistoryRef = useRef<Detection[]>([]);

  /* video state */
  const [source, setSource]           = useState<'demo' | 'espcam'>('demo');
  const [streamUrl, setStreamUrl]     = useState('http://192.168.1.100/stream');
  const [imgError, setImgError]       = useState(false);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const [videoTime, setVideoTime]     = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [paused, setPaused]           = useState(false);
  /* multi-pass scan state */
  const [passCount, setPassCount]     = useState(0);   // display only
  const [scanDone, setScanDone]       = useState(false);

  /* detector state */
  const [detectorOnline, setDetectorOnline]   = useState<boolean | null>(null);
  const [inferMs, setInferMs]                 = useState<number | null>(null);
  const [conf, setConf]                       = useState(0.15);
  const [iou, setIou]                         = useState(0.45);
  const [imgsz, setImgsz]                     = useState(960);   // inference resolution
  const [augment, setAugment]                 = useState(false); // test-time augmentation
  const [slice, setSlice]                     = useState(false); // off by default (fast); opt-in for small-cat recall
  const [smooth, setSmooth]                   = useState(true);
  const [reprocessNonce, setReprocessNonce]   = useState(0);
  const [currentModel, setCurrentModel]       = useState('yolo26/yolo26l.pt');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [switching, setSwitching]             = useState(false);
  const [showSidePanel, setShowSidePanel]     = useState(true);

  /* isSeg always derived from model path — never separate state */
  const isSeg = currentModel.includes('-seg');

  /* demo precompute state */
  const [demoStatus, setDemoStatus]   = useState<'idle'|'processing'|'ready'|'error'>('idle');
  const [demoProgress, setDemoProgress] = useState(0);
  const [demoError, setDemoError]     = useState<string | null>(null);

  /* detection data */
  const [activeBoxes, setActiveBoxes]         = useState<Detection[]>([]);
  const [detectionHistory, setDetectionHistory] = useState<Detection[]>([]);
  const [catLogs, setCatLogs]                 = useState<Map<number, CatSighting[]>>(new Map());

  /* ── Config on mount ── */
  useEffect(() => {
    fetch(`${detectorUrl}/config`)
      .then(r => r.json())
      .then(cfg => {
        setCurrentModel(cfg.model ?? 'yolo26/yolo26l.pt');
        setAvailableModels(cfg.models ?? []);
        if (typeof cfg.imgsz === 'number') setImgsz(cfg.imgsz);
        if (typeof cfg.augment === 'boolean') setAugment(cfg.augment);
        if (typeof cfg.slice  === 'boolean') setSlice(cfg.slice);
        if (typeof cfg.smooth === 'boolean') setSmooth(cfg.smooth);
        setDetectorOnline(true);
      })
      .catch(() => setDetectorOnline(false));
  }, [detectorUrl]);

  /* ── Model switch ── */
  const switchModel = useCallback(async (path: string) => {
    if (path === currentModel) return;
    setSwitching(true);
    setActiveBoxes([]);
    try {
      const res = await fetch(`${detectorUrl}/config/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: path }),
      });
      if (res.ok) {
        const cfg = await res.json();
        setCurrentModel(cfg.model);
      }
    } finally {
      setSwitching(false);
    }
  }, [currentModel, detectorUrl]);

  /* ── Video controls ── */
  const handleSeekStart = useCallback(() => { isSeekingRef.current = true; }, []);
  const handleSeekEnd   = useCallback(() => { isSeekingRef.current = false; }, []);
  const handleSeek      = useCallback((t: number) => {
    setVideoTime(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  }, []);

  const handleTogglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  }, []);

  /* ── Finalize: dedup history across passes, rebuild catLogs chronologically ── */
  const finalizeTimeline = useCallback((history: Detection[]) => {
    const BUCKET = 0.5; // seconds — merge detections within this window per track
    const best = new Map<string, Detection>();
    for (const d of history) {
      if (d.track_id == null) continue;
      const key = `${d.track_id}-${Math.round(d.videoTime / BUCKET)}`;
      const prev = best.get(key);
      if (!prev || d.confidence > prev.confidence) best.set(key, d);
    }
    const dedupedSorted = [...best.values()].sort((a, b) => a.videoTime - b.videoTime);

    /* rebuild catLogs from deduped, chronological data */
    const newLogs = new Map<number, CatSighting[]>();
    for (const d of dedupedSorted) {
      if (d.track_id == null) continue;
      const arr = newLogs.get(d.track_id) ?? [];
      arr.push({ videoTime: d.videoTime, conf: d.confidence });
      newLogs.set(d.track_id, arr);
    }
    setCatLogs(newLogs);
    setDetectionHistory(dedupedSorted);
    detectionHistoryRef.current = dedupedSorted;
  }, []);

  /* ── Demo: load precomputed detections (process-once, replay-forever) ── */
  useEffect(() => {
    if (source !== 'demo') return;
    let cancelled = false;

    const flatten = (data: any) => {
      const hist: Detection[] = [];
      for (const fr of data.frames ?? []) {
        for (const d of fr.detections ?? []) {
          hist.push({
            id: `${fr.t.toFixed(2)}-${Math.random().toString(36).slice(2)}`,
            videoTime: fr.t,
            confidence: d.confidence,
            bbox: d.bbox,
            track_id: d.track_id ?? null,
            mask: d.mask ?? null,
          });
        }
      }
      detectionHistoryRef.current = hist;
      finalizeTimeline(hist);
      setScanDone(true);
      setDemoStatus('ready');
      const v = videoRef.current;
      if (v) { v.loop = true; v.currentTime = 0; v.play().catch(() => {}); setPaused(false); }
    };

    const poll = async () => {
      try {
        const r = await fetch(`${detectorUrl}/demo/detections`);
        const j = await r.json();
        if (cancelled) return;
        if (j.status === 'ready') { setDetectorOnline(true); flatten(j.data); return; }
        if (j.status === 'error') { setDemoStatus('error'); setDemoError(j.message ?? 'processing failed'); return; }
        setDetectorOnline(true);
        setDemoStatus('processing');
        setDemoProgress(j.progress ?? 0);
        setTimeout(poll, 1200);
      } catch {
        if (!cancelled) { setDetectorOnline(false); setDemoStatus('error'); setDemoError('detector offline'); }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [source, detectorUrl, finalizeTimeline, reprocessNonce]);

  /* ── Called on every video 'ended' event ── */
  const handleVideoEnd = useCallback(() => {
    passCountRef.current += 1;
    setPassCount(passCountRef.current);

    if (passCountRef.current < SCAN_PASSES) {
      /* auto-replay for next pass — reset capture pointer */
      lastCapturedTimeRef.current = -1;
      const v = videoRef.current;
      if (v) { v.currentTime = 0; v.play().catch(() => {}); }
    } else {
      /* all passes done — finalize and enter review mode */
      setScanDone(true);
      setPaused(true);
      finalizeTimeline(detectionHistoryRef.current);
    }
  }, [finalizeTimeline]);

  const handleReplay = useCallback(() => {
    /* clear all recorded data and restart from pass 1 */
    passCountRef.current = 0;
    detectionHistoryRef.current = [];
    setPassCount(0);
    setDetectionHistory([]);
    setCatLogs(new Map());
    setActiveBoxes([]);
    setScanDone(false);
    lastCapturedTimeRef.current = -1;
    const v = videoRef.current;
    if (v) { v.currentTime = 0; v.play().catch(() => {}); setPaused(false); }
  }, []);

  const reprocessDemo = useCallback(async () => {
    setScanDone(false);
    setDemoStatus('processing');
    setDemoProgress(0);
    setActiveBoxes([]);
    const qs = `conf=${conf}&iou=${iou}&imgsz=${imgsz}&slice=${slice}&smooth=${smooth}&force=true`;
    await fetch(`${detectorUrl}/demo/process?${qs}`, { method: 'POST' }).catch(() => {});
    setReprocessNonce(n => n + 1);
  }, [detectorUrl, conf, iou, imgsz, slice, smooth]);

  /* ── Capture & detect one frame ── */
  const captureAndDetect = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = captureCanvas.current;
    if (!video || !canvas || video.readyState < 2) return;
    /* skip if video is paused / ended */
    if (video.paused || video.ended) return;
    /* only one request in flight — inference can take 1–4s; never queue a backlog */
    if (inFlightRef.current) return;
    /* skip if we already captured this timestamp */
    const vt = video.currentTime;
    if (vt - lastCapturedTimeRef.current < 0.2) return;
    lastCapturedTimeRef.current = vt;

    const w = video.videoWidth || 640, h = video.videoHeight || 480;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    inFlightRef.current = true;
    canvas.toBlob(async blob => {
      if (!blob) { inFlightRef.current = false; return; }
      const form = new FormData();
      form.append('file', blob, 'frame.jpg');
      try {
        const res = await fetch(
          `${detectorUrl}/detect?conf=${conf}&iou=${iou}&imgsz=${imgsz}&slice=${slice}&smooth=${smooth}`,
          { method: 'POST', body: form });
        if (!res.ok) return;
        const data: {
          detections: Array<{
            confidence: number; bbox: BBox;
            track_id?: number | null; mask?: number[][] | null;
          }>;
          inference_ms: number;
        } = await res.json();

        setInferMs(data.inference_ms);
        setDetectorOnline(true);
        if (!data.detections.length) { setActiveBoxes([]); return; }

        const boxes: Detection[] = data.detections.map(d => ({
          id: `${vt.toFixed(2)}-${Math.random().toString(36).slice(2)}`,
          videoTime: vt,
          confidence: d.confidence,
          bbox: d.bbox,
          track_id: d.track_id ?? null,
          mask: d.mask ?? null,
        }));

        setActiveBoxes(boxes);
        setTimeout(() => setActiveBoxes([]), 1400);

        /* append to permanent history (ref stays in sync for closure-safe finalize) */
        detectionHistoryRef.current = [...detectionHistoryRef.current, ...boxes];
        setDetectionHistory(detectionHistoryRef.current);

        /* update per-cat logs */
        setCatLogs(prev => {
          const next = new Map(prev);
          boxes.forEach(b => {
            if (b.track_id == null) return;
            const arr = next.get(b.track_id) ?? [];
            next.set(b.track_id, [...arr, { videoTime: vt, conf: b.confidence }]);
          });
          return next;
        });
      } catch {
        setDetectorOnline(false);
      } finally {
        inFlightRef.current = false;
      }
    }, 'image/jpeg', 0.92);
  }, [detectorUrl, conf, iou, imgsz, slice, smooth]);

  /* detection loop — only while ESP-Cam source and scan not finished.
     The in-flight guard means each tick just asks "can I capture yet?", so a
     short interval simply minimises the gap after each inference completes. */
  useEffect(() => {
    if (source !== 'espcam' || scanDone) return;
    const id = setInterval(captureAndDetect, 250);
    return () => clearInterval(id);
  }, [source, scanDone, captureAndDetect]);

  /* Demo always plays at 1× — no slow scan pass needed (detections precomputed). */
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = 1;
  }, [scanDone, passCount]);

  /* auto-play on mount */
  useEffect(() => {
    if (source === 'demo') videoRef.current?.play().catch(() => {});
  }, [source]);

  /* ── Cat stats ── */
  const catStats = useMemo<CatStats[]>(() => {
    const out: CatStats[] = [];
    catLogs.forEach((sightings, trackId) => {
      const times  = sightings.map(s => s.videoTime);
      const visits = computeVisits(times);
      const confs  = sightings.map(s => s.conf);
      out.push({
        trackId, color: tColor(trackId), sightings, visits,
        visitCount: visits.length,
        lastSeen: times[times.length - 1],
        avgConf: confs.reduce((a, b) => a + b, 0) / confs.length,
      });
    });
    return out.sort((a, b) => a.trackId - b.trackId);
  }, [catLogs]);

  /*
   * displayBoxes: during the scan, show live boxes; after scan done,
   * show historical detections closest to the scrubber position so
   * seeked frames show their recorded bboxes/masks.
   */
  const displayBoxes = useMemo<Detection[]>(() => {
    if (scanDone) {
      return detectionHistory.filter(d => Math.abs(d.videoTime - videoTime) < 0.45);
    }
    return activeBoxes;
  }, [scanDone, detectionHistory, videoTime, activeBoxes]);

  const uniqueCats  = catStats.length;
  const totalVisits = catStats.reduce((s, c) => s + c.visitCount, 0);
  const statusColor = detectorOnline === true ? D.green : detectorOnline === false ? D.red : D.muted;

  const scrollStyle: CSSProperties = {
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: `${D.border} transparent`,
  };

  return (
    /* A bounded height makes the dashboard fixed-size so inner panels scroll
       instead of growing the page. Full-page (/stream) fills the viewport;
       embedded (station accordion) uses a capped height with rounded chrome. */
    <div style={{
      padding: embedded ? 14 : 18, display: 'flex', flexDirection: 'column', gap: 12,
      height: embedded ? 'min(82dvh, 780px)' : '100dvh',
      boxSizing: 'border-box', background: D.bg, overflow: 'hidden',
      borderRadius: embedded ? 16 : 0,
      border: embedded ? `1px solid ${D.border}` : 'none',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          {!embedded && (
            <h1 style={{ fontSize: 19, fontWeight: 800, color: D.text, letterSpacing: '-0.02em', margin: 0 }}>
              Cat Stream Monitor
            </h1>
          )}
          <p style={{ fontSize: 11, color: D.muted, marginTop: embedded ? 0 : 2, fontFamily: 'monospace' }}>
            {modelLabel(currentModel)} · {isSeg ? 'segmentation' : 'detection'} ·{' '}
            {source === 'demo' && demoStatus === 'processing'
              ? `processing… ${Math.round(demoProgress * 100)}%`
              : scanDone
                ? `${uniqueCats} cat${uniqueCats !== 1 ? 's' : ''} · ${totalVisits} visits · live replay`
                : 'live'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 12px', borderRadius: 20, background: D.card, border: `1px solid ${D.border}`,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0,
              boxShadow: detectorOnline ? `0 0 6px ${statusColor}` : 'none',
              animation: detectorOnline === true ? 'stray-pulse 1.4s infinite' : 'none',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: statusColor, letterSpacing: '0.05em' }}>
              {detectorOnline === null ? 'CONNECTING' : detectorOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
            {inferMs != null && detectorOnline && (
              <span style={{ fontSize: 10, color: D.muted, fontFamily: 'monospace' }}>{inferMs.toFixed(0)}ms</span>
            )}
          </div>
          <button
            onClick={() => setShowSidePanel(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 20, background: D.card, border: `1px solid ${D.border}`,
              color: D.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'monospace',
              letterSpacing: '0.05em',
            }}
          >
            <ChevronDown size={12} style={{ transform: showSidePanel ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
            {showSidePanel ? 'HIDE' : 'CONFIG'}
          </button>
        </div>
      </div>

      {/* ── Main + collapsible side panel ── */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>

        {/* ──── Left column ──── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

          {/* Video */}
          <Card style={{ flexShrink: 0 }}>
            {/*
              Keep aspect ratio AND cap height at 42dvh without cropping.
              When height would exceed 42dvh, shrink width so the box stays
              proportional: width = min(100%, 42dvh × aspect).
              The black centering bar fills any leftover horizontal space.
            */}
            <div style={{ width: '100%', background: '#000', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              position: 'relative',
              width: `min(100%, calc(42dvh * ${videoAspect ?? (16/9)}))`,
              aspectRatio: videoAspect ? String(videoAspect) : '16/9',
              background: '#000',
            }}>
              {source === 'demo' && (
                <video
                  ref={videoRef}
                  src="/video/dummy.mp4"
                  muted playsInline
                  onTimeUpdate={() => {
                    if (!isSeekingRef.current) {
                      const v = videoRef.current;
                      if (v) setVideoTime(v.currentTime);
                    }
                  }}
                  onLoadedMetadata={() => {
                    const v = videoRef.current;
                    if (v) {
                      setVideoAspect(v.videoWidth / v.videoHeight);
                      setVideoDuration(v.duration);
                    }
                  }}
                  onPlay={() => setPaused(false)}
                  onPause={() => setPaused(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              )}
              {source === 'espcam' && !imgError && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={streamUrl} alt="ESP-Cam" onError={() => setImgError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              )}
              {source === 'espcam' && imgError && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: D.muted }}>
                  <WifiOff size={28} strokeWidth={1.5} />
                  <span style={{ fontSize: 12, fontFamily: 'monospace' }}>Stream unavailable</span>
                  <button onClick={() => setImgError(false)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: `1px solid ${D.border}`, background: 'transparent', color: D.muted, fontSize: 11, cursor: 'pointer' }}>
                    <RefreshCw size={10} /> Retry
                  </button>
                </div>
              )}

              {/* Seg mask overlay — always in DOM, visible when mask data present */}
              <svg viewBox="0 0 1 1" preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                {displayBoxes.map(d => {
                  if (!d.mask || d.mask.length < 3) return null;
                  const color = tColor(d.track_id);
                  return (
                    <polygon key={d.id + '-m'}
                      points={d.mask.map(([x, y]) => `${x},${y}`).join(' ')}
                      fill={`${color}38`} stroke={color} strokeWidth={0.003} />
                  );
                })}
              </svg>

              {/* Bounding boxes */}
              {displayBoxes.map(d => {
                const color = tColor(d.track_id);
                return (
                  <div key={d.id} style={{
                    position: 'absolute',
                    left: `${d.bbox.x * 100}%`, top: `${d.bbox.y * 100}%`,
                    width: `${d.bbox.w * 100}%`, height: `${d.bbox.h * 100}%`,
                    border: `2px solid ${color}`, borderRadius: 4,
                    boxShadow: `0 0 8px ${color}44`, pointerEvents: 'none',
                    animation: 'fadeSlideIn 0.12s ease-out',
                  }}>
                    <div style={{
                      position: 'absolute', top: -22, left: -1,
                      background: color, color: '#fff',
                      fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                      padding: '2px 6px', borderRadius: '4px 4px 4px 0',
                      display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                    }}>
                      <Cat size={9} />
                      {d.track_id != null ? `#${d.track_id}` : '?'}
                      <span style={{ opacity: 0.8 }}>{Math.round(d.confidence * 100)}%</span>
                    </div>
                  </div>
                );
              })}

              {/* Offline overlay */}
              {detectorOnline === false && (
                <div style={{
                  position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(239,68,68,0.85)', backdropFilter: 'blur(4px)',
                  borderRadius: 8, padding: '5px 14px',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <WifiOff size={11} color="#fff" />
                  <span style={{ fontSize: 11, color: '#fff', fontFamily: 'monospace' }}>Detector offline</span>
                </div>
              )}

              {source === 'demo' && demoStatus === 'processing' && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10,
                  background: 'rgba(13,17,23,0.78)', backdropFilter: 'blur(3px)',
                }}>
                  <ScanLine size={26} color={D.orange} strokeWidth={1.4} />
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: D.text }}>
                    Processing demo · {Math.round(demoProgress * 100)}%
                  </span>
                  <div style={{ width: 180, height: 4, background: D.border, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(demoProgress * 100)}%`, background: D.orange }} />
                  </div>
                </div>
              )}
              {source === 'demo' && demoStatus === 'error' && (
                <div style={{
                  position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(239,68,68,0.85)', borderRadius: 8, padding: '5px 14px',
                }}>
                  <span style={{ fontSize: 11, color: '#fff', fontFamily: 'monospace' }}>{demoError}</span>
                </div>
              )}

              {/* Source toggle */}
              <div style={{
                position: 'absolute', bottom: 10, left: 10,
                display: 'flex', gap: 2,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                borderRadius: 8, padding: 3, border: `1px solid ${D.border}`,
              }}>
                {(['demo', 'espcam'] as const).map(src => (
                  <button key={src} onClick={() => {
                    setSource(src);
                    setImgError(false);
                    if (src === 'espcam') {
                      setScanDone(false);
                      lastCapturedTimeRef.current = -1;
                      fetch(`${detectorUrl}/tracker/reset`, { method: 'POST' }).catch(() => {});
                    }
                  }} style={{
                    padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
                    background: source === src ? D.orange : 'transparent',
                    color: source === src ? '#fff' : D.muted,
                  }}>
                    {src === 'demo' ? 'Demo' : 'ESP-Cam'}
                  </button>
                ))}
              </div>

              {/* Live / processing badge */}
              <div style={{
                position: 'absolute', top: 10, right: 10,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                border: `1px solid ${D.border}`, borderRadius: 8,
                padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {source === 'demo' && demoStatus === 'processing' ? (
                  <>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: D.orange, flexShrink: 0,
                      animation: 'stray-pulse 0.8s infinite',
                    }} />
                    <span style={{ fontSize: 10, color: D.orange, fontFamily: 'monospace', fontWeight: 700 }}>
                      PROCESSING {Math.round(demoProgress * 100)}%
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: D.red, flexShrink: 0,
                      animation: 'stray-pulse 1.4s infinite',
                    }} />
                    <span style={{ fontSize: 10, color: D.red, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em' }}>
                      LIVE
                    </span>
                    <span style={{ fontSize: 10, color: D.muted, fontFamily: 'monospace' }}>
                      {displayBoxes.length} cat{displayBoxes.length !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </div>

              {/* ESP-Cam URL input */}
              {source === 'espcam' && (
                <div style={{ position: 'absolute', top: 10, left: 10, right: 10 }}>
                  <input type="text" value={streamUrl} onChange={e => setStreamUrl(e.target.value)}
                    placeholder="http://192.168.x.x/stream"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(0,0,0,0.65)', border: `1px solid ${D.border}`,
                      borderRadius: 7, padding: '5px 10px',
                      color: D.text, fontSize: 11, fontFamily: 'monospace', outline: 'none',
                    }} />
                </div>
              )}
            </div>
            </div>{/* end centering wrapper */}

            {source === 'demo' && (
              <Scrubber
                currentTime={videoTime} duration={videoDuration}
                onSeekStart={handleSeekStart}
                onSeek={handleSeek}
                onSeekEnd={handleSeekEnd}
                paused={paused} onTogglePlay={handleTogglePlay}
                scanDone={scanDone} onReplay={handleReplay}
              />
            )}
          </Card>
          <canvas ref={captureCanvas} style={{ display: 'none' }} />

          {/* Presence Timeline */}
          <Card style={{ flexShrink: 0 }}>
            <CardHeader
              title="Presence Timeline"
              icon={<Clock size={13} color={D.orange} />}
              badge={
                uniqueCats > 0
                  ? <Pill color={D.orange}>{uniqueCats} cat{uniqueCats !== 1 ? 's' : ''} · {totalVisits} visits</Pill>
                  : undefined
              }
              action={
                catStats.length > 0
                  ? <button onClick={() => { setCatLogs(new Map()); setDetectionHistory([]); setScanDone(false); lastCapturedTimeRef.current = -1; }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: `1px solid ${D.border}`, background: 'transparent', color: D.muted, fontSize: 10, cursor: 'pointer' }}>
                      <Trash2 size={10} /> Clear
                    </button>
                  : undefined
              }
            />
            <div style={{ padding: '10px 14px 6px' }}>
              <PresenceTimeline stats={catStats} duration={videoDuration || 1} cursor={videoTime} />
            </div>
          </Card>

          {/* Cat Presence — scrollable */}
          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <CardHeader
              title="Cat Presence"
              icon={<BarChart2 size={13} color={D.orange} />}
              badge={<span style={{ fontSize: 10, color: D.muted, fontFamily: 'monospace' }}>{catStats.reduce((s, c) => s + c.sightings.length, 0)} frames</span>}
            />
            <div style={{ ...scrollStyle, flex: 1, minHeight: 0 }}>
              {catStats.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: D.muted }}>
                  <ScanLine size={22} strokeWidth={1.3} />
                  <span style={{ fontSize: 11, fontFamily: 'monospace' }}>
                    {detectorOnline === false ? 'Start the detector service' : 'Play video to scan for cats'}
                  </span>
                </div>
              ) : catStats.map(cat => (
                <div key={cat.trackId} style={{
                  display: 'grid', gridTemplateColumns: '48px 1fr 58px 46px',
                  alignItems: 'center', gap: 10, padding: '8px 14px',
                  borderBottom: `1px solid ${D.border}18`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Cat size={12} color={cat.color} />
                    <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: cat.color }}>
                      #{cat.trackId}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: D.text, fontFamily: 'monospace' }}>
                      {cat.visitCount} visit{cat.visitCount !== 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: 10, color: D.muted, marginTop: 1 }}>last @ {fmtVT(cat.lastSeen)}</div>
                    <div style={{ height: 2, background: D.border, borderRadius: 1, marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(cat.avgConf * 100)}%`, background: cat.color, borderRadius: 1 }} />
                    </div>
                  </div>
                  <Sparkline data={cat.sightings.map(s => s.conf)} color={cat.color} />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: D.text }}>
                      {Math.round(cat.avgConf * 100)}%
                    </div>
                    <div style={{ fontSize: 9, color: D.muted }}>avg conf</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ──── Right side panel (collapsible) ──── */}
        <div style={{
          width: showSidePanel ? 286 : 0,
          overflow: 'hidden',
          transition: 'width 0.25s ease',
          flexShrink: 0,
        }}>
        <div style={{ width: 286, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

          {/* Config — overflow visible so the model dropdown can extend beyond the card */}
          <Card style={{ flexShrink: 0, padding: '14px 16px', overflow: 'visible' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: D.muted, fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 12 }}>
              DETECTOR CONFIG
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: D.muted, fontFamily: 'monospace', marginBottom: 5 }}>Model</div>
              <ModelPicker current={currentModel} models={availableModels} switching={switching} onSelect={switchModel} />
            </div>
            {isSeg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 9px', borderRadius: 7, marginBottom: 12,
                background: `${D.purple}14`, border: `1px solid ${D.purple}30`,
              }}>
                <Layers size={10} color={D.purple} />
                <span style={{ fontSize: 10, color: D.purple, fontFamily: 'monospace', fontWeight: 600 }}>
                  Body mask segmentation active
                </span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <DarkSlider label="Conf" value={conf} min={0.05} max={0.9} step={0.05}
                onChange={setConf} fmt={v => `${Math.round(v * 100)}%`} />
              <DarkSlider label="IOU" value={iou} min={0.1} max={0.9} step={0.05}
                onChange={setIou} fmt={v => `${Math.round(v * 100)}%`} />
              <Segmented<number>
                label="Res"
                value={imgsz}
                options={[
                  { value: 640,  label: '640',  sub: 'fast' },
                  { value: 960,  label: '960',  sub: 'balanced' },
                  { value: 1280, label: '1280', sub: 'best' },
                ]}
                onChange={setImgsz}
              />
              <Toggle
                label="Augment"
                sub="multi-scale · ~3× slower, better recall"
                value={augment}
                onChange={setAugment}
              />
              <Toggle
                label="Slicing"
                sub="SAHI tiling · finds small/distant cats"
                value={slice}
                onChange={setSlice}
              />
              <Toggle
                label="Smoothing"
                sub="temporal · steadier boxes"
                value={smooth}
                onChange={setSmooth}
              />
              {source === 'demo' && (
                <button onClick={reprocessDemo} disabled={demoStatus === 'processing'} style={{
                  marginTop: 4, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${D.orange}`, background: D.orangeDim, color: D.orange,
                  fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                  opacity: demoStatus === 'processing' ? 0.5 : 1,
                }}>
                  {demoStatus === 'processing' ? `Processing ${Math.round(demoProgress*100)}%` : 'Re-process demo'}
                </button>
              )}
              {inferMs != null && (
                <div style={{
                  fontSize: 9, color: D.muted, fontFamily: 'monospace',
                  textAlign: 'right', marginTop: -2,
                }}>
                  last inference {inferMs.toFixed(0)}ms · higher res &amp; augment improve small-cat detection
                </div>
              )}
            </div>
            {source === 'espcam' && !scanDone && (
              <div style={{ marginTop: 10, fontSize: 9, color: D.orange, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ScanLine size={10} /> Changes apply on the next captured frame
              </div>
            )}
            {source === 'demo' && (
              <div style={{ marginTop: 10, fontSize: 9, color: D.muted, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ScanLine size={10} /> Re-process to apply changes to the demo
              </div>
            )}
          </Card>

          {/* Cat Sightings — scrollable event feed */}
          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <CardHeader
              title="Cat Sightings"
              icon={<Cat size={13} color={D.orange} />}
              badge={
                <span style={{ fontSize: 18, fontWeight: 800, color: D.text, fontFamily: 'monospace', lineHeight: 1 }}>
                  {uniqueCats}
                </span>
              }
            />
            <div style={{ ...scrollStyle, flex: 1, minHeight: 0 }}>
              {detectionHistory.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: '100%', color: D.muted, padding: 20 }}>
                  <ScanLine size={22} strokeWidth={1.3} />
                  <span style={{ fontSize: 11, fontFamily: 'monospace', textAlign: 'center' }}>
                    {detectorOnline === false ? 'Start the detector' : 'Detections will appear here'}
                  </span>
                </div>
              ) : [...detectionHistory].reverse().map(evt => {
                const color = tColor(evt.track_id);
                return (
                  <div key={evt.id} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 14px', borderBottom: `1px solid ${D.border}18`,
                    borderLeft: `3px solid ${color}`,
                    background: `${color}06`,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: `${color}18`, border: `1.5px solid ${color}38`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Cat size={13} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color }}>
                          {evt.track_id != null ? `Cat #${evt.track_id}` : 'Cat ?'}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color }}>
                          {Math.round(evt.confidence * 100)}%
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: D.muted, fontFamily: 'monospace', marginTop: 2, display: 'flex', gap: 8 }}>
                        <span>{fmtVT(evt.videoTime)}</span>
                        {evt.mask && (
                          <span style={{ color: D.purple, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Layers size={9} />{evt.mask.length}pts
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
        </div>{/* end side panel inner */}
      </div>
    </div>
  );
}
