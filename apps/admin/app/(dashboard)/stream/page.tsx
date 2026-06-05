import StreamClient from './StreamClient';

export default function StreamPage() {
  const detectorUrl =
    process.env.NEXT_PUBLIC_DETECTOR_URL ?? 'http://localhost:8001';

  return <StreamClient detectorUrl={detectorUrl} />;
}
